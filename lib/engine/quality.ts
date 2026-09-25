import type { Issue, Project, Requirement } from '@/lib/types';
import { ambiguousTerms, complianceItems, referenceVersion } from './reference';
import { assumptions, coverageClauses, validRefs } from './model';
import { rtsCheck, validateWorkflow } from './workflow';
import { checkPermissions } from './permissions';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let termCache: { v: number; list: { term: string; hint: string; re: RegExp }[] } | undefined;
function termRes() {
  if (!termCache || termCache.v !== referenceVersion())
    termCache = { v: referenceVersion(), list: ambiguousTerms().map((t) => ({ ...t, re: new RegExp(`(^|[^a-z])${esc(t.term)}(?=$|[^a-z])`, 'i') })) };
  return termCache.list;
}

export function findAmbiguous(text: string) {
  return termRes().filter((t) => t.re.test(text)).map(({ term, hint }) => ({ term, hint }));
}

export const isModelRef = (r: string) => /^(FR|NFR|IR)-/.test(r);

/** Requirements whose referenced artefacts were edited after the requirement was generated. */
export function outOfDate(p: Project, r: Requirement) {
  return r.refs.filter((ref) => p.stamps[ref] && p.stamps[ref] > r.generatedAt);
}

export type ComplianceItem = { id: string; title: string; std: string; category: string; keyword: string; satisfied: boolean; by: string[]; note?: string };

export function complianceFor(p: Project): ComplianceItem[] {
  const items = complianceItems(p.type);
  return items.map((it) => {
    const by = p.requirements
      .filter((r) => r.refs.includes(it.std) && `${r.title} ${r.description} ${r.acceptanceCriteria.join(' ')}`.toLowerCase().includes(it.keyword.toLowerCase()))
      .map((r) => r.id);
    let satisfied = by.length > 0;
    let note: string | undefined;
    if (it.id === 'CMP-RTS' && p.workflow) {
      const rts = rtsCheck(p.workflow);
      if (!rts.ok) {
        satisfied = false;
        note = rts.message;
      }
    }
    return { ...it, satisfied, by, note };
  });
}

export type CoverageRow = { clauseId: string; text: string; type: string; covered: boolean; by: string[]; na?: string };

export function coverageFor(p: Project): CoverageRow[] {
  return coverageClauses(p).map((c) => {
    const by = p.requirements.filter((r) => r.refs.includes(c.id)).map((r) => r.id);
    return { clauseId: c.id, text: c.english || c.original, type: c.type, covered: by.length > 0 || !!c.notApplicable, by, na: c.notApplicable?.reason };
  });
}

/** Deterministic issues, recomputed on every change, merged with LLM review issues. */
export function issuesFor(p: Project): Issue[] {
  const out: Issue[] = [];
  const valid = validRefs(p);
  const reqs = p.requirements;

  for (const r of reqs) {
    const text = `${r.title}. ${r.description} ${r.acceptanceCriteria.join(' ')}`;
    for (const a of findAmbiguous(text))
      out.push({ id: `AMB-${r.id}-${a.term}`, severity: 'Medium', type: 'Ambiguity', category: 'Clarity', message: `${r.id} uses the ambiguous term "${a.term}".`, targetIds: [r.id], suggestion: a.hint, status: 'Open', source: 'Rule' });
    if (!r.acceptanceCriteria.filter((x) => x.trim()).length)
      out.push({ id: `NAC-${r.id}`, severity: 'High', type: 'NoAcceptance', category: 'Testability', message: `${r.id} has no acceptance criteria.`, targetIds: [r.id], suggestion: 'Add Given/When/Then acceptance criteria.', status: 'Open', source: 'Rule' });
    if (!r.refs.length)
      out.push({ id: `NRF-${r.id}`, severity: 'High', type: 'NoRefs', category: 'Traceability', message: `${r.id} does not cite any source, answer or model artefact.`, targetIds: [r.id], suggestion: 'Cite the clause, answer or artefact it implements.', status: 'Open', source: 'Rule' });
    for (const ref of r.refs.filter((x) => !valid.has(x) && !isModelRef(x)))
      out.push({ id: `IRF-${r.id}-${ref}`, severity: 'Medium', type: 'InvalidRef', category: 'Traceability', message: `${r.id} cites ${ref}, which does not exist in this project.`, targetIds: [r.id], suggestion: 'Remove the reference or restore the source.', status: 'Open', source: 'Rule' });
    if (!/\bshall\b/i.test(r.description))
      out.push({ id: `SHL-${r.id}`, severity: 'Low', type: 'Untestable', category: 'Testability', message: `${r.id} is not stated with "shall".`, targetIds: [r.id], suggestion: 'Rewrite as "The system shall ...".', status: 'Open', source: 'Rule' });
    const ood = outOfDate(p, r);
    if (ood.length)
      out.push({ id: `OOD-${r.id}`, severity: 'Medium', type: 'OutOfDate', category: 'Traceability', message: `${r.id} is out of date: ${ood.join(', ')} changed after it was generated.`, targetIds: [r.id], suggestion: 'Regenerate the module or edit the requirement.', status: 'Open', source: 'Rule' });
  }

  const byTitle = new Map<string, string[]>();
  for (const r of reqs) {
    const k = r.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    byTitle.set(k, [...(byTitle.get(k) ?? []), r.id]);
  }
  for (const ids of byTitle.values())
    if (ids.length > 1)
      out.push({ id: `DUP-${ids.join('-')}`, severity: 'Low', type: 'Duplicate', category: 'Clarity', message: `${ids.join(' and ')} have the same title.`, targetIds: ids, suggestion: 'Merge the requirements or make the titles specific.', status: 'Open', source: 'Rule' });

  if (reqs.length) {
    for (const row of coverageFor(p).filter((x) => !x.covered))
      out.push({ id: `COV-${row.clauseId}`, severity: 'High', type: 'Coverage', category: 'Completeness', message: `${row.clauseId} (${row.type}) is not cited by any requirement: "${row.text}"`, targetIds: [row.clauseId], suggestion: 'Draft a requirement for this clause, or mark it not applicable with a reason.', status: 'Open', source: 'Rule' });
  }

  if (p.workflow)
    for (const f of validateWorkflow(p.workflow))
      out.push({ id: f.id, severity: f.severity, type: 'Workflow', category: f.id === 'WFV-rts' ? 'Compliance' : 'Testability', message: f.message, targetIds: f.targets, suggestion: 'Fix in the Workflow designer.', status: 'Open', source: 'Rule' });

  if (p.permissions)
    for (const f of checkPermissions(p.permissions, p.workflow))
      out.push({ id: f.id, severity: f.severity, type: 'Permission', category: 'Compliance', message: f.message, targetIds: f.targets, suggestion: 'Fix in the Roles matrix.', status: 'Open', source: 'Rule' });

  if (reqs.length)
    for (const c of complianceFor(p).filter((x) => !x.satisfied))
      out.push({ id: `CMP-${c.id}`, severity: 'Medium', type: 'Compliance', category: 'Compliance', message: `Compliance item not satisfied: ${c.title} (${c.std}).${c.note ? ' ' + c.note : ''}`, targetIds: [c.std], suggestion: 'Add or restore the baseline NFR for this standard.', status: 'Open', source: 'Rule' });

  for (const a of assumptions(p).filter((x) => !x.q.confirmed))
    out.push({ id: `ASM-open-${a.id}`, severity: 'Low', type: 'Assumption', category: 'Completeness', message: `${a.id} is an unconfirmed assumption: "${a.text}"`, targetIds: [a.id], suggestion: 'Confirm with the department during review.', status: 'Open', source: 'Rule' });

  for (const r of p.reconciliations.filter((x) => x.resolution?.type === 'Deferred'))
    out.push({ id: `OPN-${r.id}`, severity: 'Low', type: 'OpenIssue', category: 'Completeness', message: `Open issue ${r.id}: ${r.description}`, targetIds: r.clauses, suggestion: 'Clarify with the department and record the resolution.', status: 'Open', source: 'Rule' });

  // Review (LLM) issues are stored; drop those whose targets no longer exist.
  const ids = new Set(reqs.map((r) => r.id));
  for (const i of p.reviewIssues) if (i.targetIds.every((t) => ids.has(t) || !/^(FR|NFR|IR)-/.test(t))) out.push(i);

  return out.map((i) => {
    const st = p.issueState[i.id];
    return st ? { ...i, status: st.status } : i;
  });
}

export type QualityScore = {
  total: number;
  parts: { key: string; label: string; max: number; value: number; formula: string; detail: string }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreFrom(p: Project, issues: Issue[]): QualityScore {
  const open = issues.filter((i) => i.status === 'Open');
  const count = (t: Issue['type']) => open.filter((i) => i.type === t).length;
  const reqs = p.requirements;
  const n = Math.max(1, reqs.length);

  const uncovered = count('Coverage');
  const missingEx = count('MissingException');
  const openIssues = count('OpenIssue');
  const completeness = Math.max(0, 25 - 2.5 * uncovered - 3 * missingEx - 1 * openIssues);

  const amb = count('Ambiguity');
  const dup = count('Duplicate');
  const conflicts = count('Conflict') + count('Contradiction');
  const clarity = Math.max(0, 20 - 3 * amb - 1 * dup - 3 * conflicts);

  const withAc = reqs.filter((r) => r.acceptanceCriteria.some((x) => x.trim())).length;
  const untestable = count('Untestable');
  const wfErr = open.filter((i) => i.type === 'Workflow' && i.id !== 'WFV-rts').length;
  const testability = Math.max(0, (20 * withAc) / n - 2 * untestable - 1 * wfErr);

  const valid = validRefs(p);
  const traced = reqs.filter((r) => r.refs.some((x) => valid.has(x) || isModelRef(x))).length;
  const invalid = count('InvalidRef');
  const ood = count('OutOfDate');
  const traceability = Math.max(0, (20 * traced) / n - 1 * invalid - 0.5 * ood);

  const comp = complianceFor(p);
  const sat = comp.filter((c) => c.satisfied).length;
  const perm = count('Permission');
  const compliance = Math.max(0, comp.length ? (15 * sat) / comp.length - 1 * perm : 15 - perm);

  const parts = [
    { key: 'completeness', label: 'Completeness', max: 25, value: round1(completeness), formula: '25 − 2.5 per uncovered clause − 3 per missing exception flow − 1 per open issue', detail: `${uncovered} uncovered, ${missingEx} missing exception flows, ${openIssues} open issues` },
    { key: 'clarity', label: 'Clarity', max: 20, value: round1(clarity), formula: '20 − 3 per ambiguous term − 1 per duplicate title − 3 per conflicting requirement', detail: `${amb} ambiguous, ${dup} duplicates, ${conflicts} conflicts` },
    { key: 'testability', label: 'Testability', max: 20, value: round1(testability), formula: '20 × share with acceptance criteria − 2 per untestable statement − 1 per workflow defect', detail: `${withAc} of ${reqs.length} with criteria, ${untestable} untestable, ${wfErr} workflow defects` },
    { key: 'traceability', label: 'Traceability', max: 20, value: round1(traceability), formula: '20 × share with a valid reference − 1 per invalid reference − 0.5 per out-of-date requirement', detail: `${traced} of ${reqs.length} traced, ${invalid} invalid, ${ood} out of date` },
    { key: 'compliance', label: 'Compliance', max: 15, value: round1(compliance), formula: '15 × share of compliance items satisfied − 1 per permission defect', detail: `${sat} of ${comp.length} items, ${perm} permission defects` },
  ];
  return { total: Math.round(parts.reduce((s, x) => s + x.value, 0)), parts };
}

export function qualityFor(p: Project) {
  const issues = issuesFor(p);
  return { ...scoreFrom(p, issues), issues };
}
