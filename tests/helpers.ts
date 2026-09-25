import fs from 'node:fs';
import { buildScholarshipProject } from '@/lib/seed/scholarship';
import { buildSeed } from '@/lib/seed';
import { detectDeterministic, mergeFindings, type Finding } from '@/lib/engine/reconcile';
import { integrationDrafts, mergeModelDerived, modelDerived, nfrDrafts, replaceModule } from '@/lib/engine/generate';
import { normalizeRefs } from '@/lib/engine/model';
import type { Project, Requirement } from '@/lib/types';

const rec = (name: string) => JSON.parse(fs.readFileSync(`data/recorded/scholarship/${name}.json`, 'utf8')).response;
const AT = '2026-09-25T10:00:00.000Z';

/** The sample project after the demo path up to FRS generation, built from the recordings without the UI. */
export function draftedSample(): Project {
  const p = buildScholarshipProject();
  p.reconciliations = mergeFindings([], rec('reconcile').findings as Finding[], detectDeterministic(p)).all;
  p.reconciledAt = AT;
  const by = 'Ravi Kumar';
  for (const r of p.reconciliations) {
    if (r.kind === 'Supersession') {
      r.resolution = { type: 'Prevails', prevailing: r.clauses[1], by, at: AT };
      for (const c of p.sources.flatMap((d) => d.clauses)) if (c.id === r.clauses[0]) c.supersededBy = r.clauses[1];
    } else if (r.kind === 'Conflict') r.resolution = { type: 'Prevails', prevailing: 'GO-5.1', by, at: AT };
    else r.resolution = { type: 'Deferred', by, at: AT };
  }
  const d = rec('discovery');
  p.discovery = { ...d, integrations: d.integrations.map((i: { name: string; refs: string[] }) => ({ ...i, catalogueId: { 'Aadhaar e-KYC': 'aadhaar-ekyc', DigiLocker: 'digilocker', 'PFMS DBT': 'pfms-dbt', 'SMS gateway': 'sms', 'CSC Digital Seva': 'csc' }[i.name] })) };
  p.questions = rec('questions').questions.map((q: object, i: number) => ({ ...q, id: `Q-${i + 1}` }));
  p.questions[0].answer = p.questions[0].suggestedAnswers[0];
  p.questions[1].answer = p.questions[1].suggestedAnswers[0];
  for (const q of p.questions.slice(2)) q.assumed = true;
  const w = rec('workflow');
  p.workflow = { states: w.states, rtsDays: w.rtsDays, rtsRef: w.rtsRef, transitions: w.transitions.map((t: Record<string, unknown>, i: number) => ({ ...t, id: `WF-T${i + 1}`, slaDays: t.slaDays ?? undefined, escalation: t.escalation ?? undefined, notification: t.notification ?? undefined })) };
  p.rules = rec('rules').tables.map((t: Record<string, unknown> & { conditions: Record<string, unknown>[] }, i: number) => ({ ...t, id: `BR-${String(i + 1).padStart(3, '0')}`, conditions: t.conditions.map((c) => ({ ...c, unit: c.unit ?? undefined })) }));
  const drafts = [...modelDerived(p), ...integrationDrafts(p), ...nfrDrafts(p)].map((x) => ({ ...x, refs: normalizeRefs(p, x.refs, { forward: true }).kept }));
  p.requirements = mergeModelDerived([], drafts, AT);
  for (const m of ['REG', 'APP', 'DOC', 'VER', 'PAY', 'NOT', 'GRV', 'RPT', 'ADM', 'NFR']) {
    const reqs = rec(`requirements.${m}`).requirements as (Omit<Requirement, 'id'> & { refs: string[] })[];
    const kind = m === 'NFR' ? 'NFR' : 'FR';
    p.requirements = replaceModule(p.requirements, m, kind, reqs.map((r) => ({ ...r, kind, module: m, refs: normalizeRefs(p, r.refs).kept, origin: 'Generated', status: 'Draft', generatedAt: AT, actor: r.actor || undefined })));
  }
  return p;
}

export function seedProjects() {
  return buildSeed().projects;
}
