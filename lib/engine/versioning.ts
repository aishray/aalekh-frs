import type { ModelSnapshot, Project } from '@/lib/types';

export function snapshot(p: Project): ModelSnapshot {
  return structuredClone({
    sources: p.sources, reconciliations: p.reconciliations, questions: p.questions, workflow: p.workflow, entities: p.entities,
    rules: p.rules, permissions: p.permissions, requirements: p.requirements, sections: p.sections,
  });
}

/** Next draft version after a baseline: 1.0 -> 1.1; drafts 0.3 -> 0.4. */
export function nextMinor(v: string) {
  const [a, b] = v.split('.').map((x) => parseInt(x, 10) || 0);
  return `${a}.${b + 1}`;
}

/** Editing an approved FRS starts a new draft version; the baseline stays frozen for diff and change control. */
export function ensureDraft(x: Project) {
  if (x.status === 'Approved') {
    x.status = 'Draft';
    x.version = nextMinor(x.version);
  }
}

export type ReqDiff = { added: string[]; removed: string[]; modified: string[] };

export function diffRequirements(a: ModelSnapshot['requirements'], b: ModelSnapshot['requirements']): ReqDiff {
  const A = new Map(a.map((r) => [r.id, r]));
  const B = new Map(b.map((r) => [r.id, r]));
  const sig = (r: (typeof a)[number]) => JSON.stringify([r.title, r.description, r.acceptanceCriteria, r.refs, r.priority]);
  return {
    added: b.filter((r) => !A.has(r.id)).map((r) => r.id),
    removed: a.filter((r) => !B.has(r.id)).map((r) => r.id),
    modified: b.filter((r) => A.has(r.id) && sig(A.get(r.id)!) !== sig(r)).map((r) => r.id),
  };
}
