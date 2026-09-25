'use client';

import { useRepo } from '@/lib/repo/store';
import type { Issue, Project, Requirement } from '@/lib/types';
import { runAi, streamNarrative } from '@/lib/ai/client';
import { compact, standardBlocks } from '@/lib/ai/context';
import { normalizeRefs, unresolvedFindings } from '@/lib/engine/model';
import { integrationDrafts, mergeModelDerived, modelDerived, nfrDrafts, replaceModule } from '@/lib/engine/generate';
import { buildLibraryIndex, libraryItems, reqText } from '@/lib/engine/similarity';
import templates from '@/data/templates.json';
import { nowIso } from '@/lib/util';

export const NARRATIVE = ['introduction', 'asis', 'tobe'] as const;

type LlmReq = { title: string; description: string; actor: string; priority: Requirement['priority']; acceptanceCriteria: string[]; refs: string[] };

function current(id: string) {
  return useRepo.getState().projects.find((p) => p.id === id)!;
}

export function modulesFor(p: Project) {
  const fromDiscovery = p.discovery?.modules.map((m) => m.code) ?? ['APP', 'VER', 'NOT', 'RPT', 'ADM'];
  return [...fromDiscovery.filter((m) => m !== 'NFR'), 'NFR'];
}

export function moduleName(code: string) {
  return (templates.modules as Record<string, string>)[code] ?? code;
}

/** Model-derived requirements, NFR baseline and catalogue integrations: deterministic, instant. */
export function regenerateFromModel(projectId: string, action = 'Generated requirements from the model') {
  useRepo.getState().update(projectId, action, undefined, (x) => {
    const drafts = [...modelDerived(x), ...integrationDrafts(x), ...nfrDrafts(x)].map((d) => ({ ...d, refs: normalizeRefs(x, d.refs, { forward: true }).kept }));
    x.requirements = mergeModelDerived(x.requirements, drafts, nowIso());
  });
}

/** One LLM module, with reuse examples, replacing only that module's generated requirements. */
export async function generateModule(projectId: string, module: string) {
  const p = current(projectId);
  const all = useRepo.getState().projects;
  const lib = libraryItems(all, p.id);
  const idx = buildLibraryIndex(lib);
  const already = p.requirements.filter((r) => r.module === module && r.origin === 'FromModel');
  const query = `${moduleName(module)} ${p.discovery?.modules.find((m) => m.code === module)?.name ?? ''} ${p.name}`;
  const examples = idx.query(query + ' ' + already.map((r) => r.title).join(' '), 5).filter((h) => h.score > 0.05).map((h) => lib[h.index]);
  const kind: Requirement['kind'] = module === 'NFR' ? 'NFR' : 'FR';
  const { data } = await runAi<{ requirements: LlmReq[] }>(
    'requirements',
    p,
    {
      ...standardBlocks(p),
      MODEL: compact({
        workflow: p.workflow?.transitions.map((t) => ({ id: t.id, action: t.action, actor: t.actor, sla: t.slaDays })),
        rules: p.rules.map((r) => ({ id: r.id, name: r.name })),
        fields: p.entities.flatMap((e) => e.fields.map((f) => f.id)).slice(0, 40),
      }),
      EXAMPLES: examples.map((e) => `[${e.req.id} in ${e.projectName}] ${e.req.title}: ${e.req.description}`).join('\n'),
      INPUT: `Module: ${module} (${moduleName(module)})\nAlready generated from the model (do not repeat):\n${already.map((r) => `${r.id} ${r.title}`).join('\n') || 'none'}${module === 'NFR' ? '\nBaseline NFRs already included: ' + p.requirements.filter((r) => r.kind === 'NFR').map((r) => r.title).join('; ') + '. Write only NFRs stated in or implied by the sources.' : ''}`,
    },
    module,
  );
  const at = nowIso();
  const invalid: { title: string; ref: string }[] = [];
  const drafts: Omit<Requirement, 'id'>[] = data.requirements.map((r) => {
    const { kept, dropped } = normalizeRefs(p, r.refs);
    dropped.forEach((ref) => invalid.push({ title: r.title, ref }));
    return {
      kind, module, title: r.title.trim(), description: r.description.trim(), actor: r.actor || undefined, priority: r.priority,
      acceptanceCriteria: r.acceptanceCriteria.filter((a) => a.trim()), refs: kept, origin: 'Generated', status: 'Draft', generatedAt: at,
    };
  });
  useRepo.getState().update(projectId, 'Generated module', `${module} (${drafts.length} requirements)`, (x) => {
    x.requirements = replaceModule(x.requirements, module, kind, drafts);
    // Invalid references were dropped from the requirement and are raised as issues.
    x.reviewIssues = x.reviewIssues.filter((i) => !i.id.startsWith(`GEN-${module}-`));
    for (const inv of invalid) {
      const req = x.requirements.find((r) => r.module === module && r.title === inv.title);
      const issue: Issue = { id: `GEN-${module}-${req?.id}-${inv.ref}`, severity: 'Medium', type: 'InvalidRef', category: 'Traceability', message: `The AI engine cited ${inv.ref} for ${req?.id}, which does not exist; the reference was removed.`, targetIds: req ? [req.id] : [], suggestion: 'Check whether the requirement needs another source.', status: 'Open', source: 'Rule' };
      x.reviewIssues.push(issue);
    }
  });
  return drafts.length;
}

export async function generateNarrative(projectId: string, section: string, onText: (t: string) => void) {
  const p = current(projectId);
  const text = await streamNarrative(
    p,
    section,
    { ...standardBlocks(p), MODEL: compact({ workflow: p.workflow?.transitions.map((t) => ({ id: t.id, action: t.action, actor: t.actor, sla: t.slaDays })) }) },
    onText,
  );
  useRepo.getState().update(projectId, 'Generated section', section, (x) => {
    x.sections[section] = text;
    x.sectionsAt[section] = nowIso();
  });
}

export function generationBlocked(p: Project) {
  if (!p.reconciledAt) return 'Run reconciliation before drafting, so the FRS is built only on effective clauses.';
  const n = unresolvedFindings(p).length;
  if (n) return `Drafting is blocked: ${n} reconciliation finding${n > 1 ? 's are' : ' is'} not yet resolved or deferred.`;
  return null;
}

/** Similar approved requirement from the reuse library, for the "Use this" suggestion. */
export function reuseSuggestions(p: Project, projects: Project[], threshold: number) {
  const lib = libraryItems(projects, p.id);
  if (!lib.length) return new Map<string, { item: (typeof lib)[number]; score: number }>();
  const idx = buildLibraryIndex(lib);
  const out = new Map<string, { item: (typeof lib)[number]; score: number }>();
  for (const r of p.requirements.filter((x) => x.origin === 'Generated')) {
    const [hit] = idx.query(reqText(r), 1);
    if (hit && hit.score >= threshold) out.set(r.id, { item: lib[hit.index], score: hit.score });
  }
  return out;
}
