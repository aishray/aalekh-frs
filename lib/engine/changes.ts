import type { Project, Requirement, TrackedChange } from '@/lib/types';
import { nowIso } from '@/lib/util';
import { idFor } from './generate';

/** Applies an accepted tracked change to the project in place. */
export function applyChange(p: Project, c: TrackedChange) {
  const at = nowIso();
  if (c.kind === 'Modify') {
    const r = p.requirements.find((x) => x.id === c.targetId);
    if (r) Object.assign(r, c.after, { generatedAt: at, status: 'Draft' as const });
  } else if (c.kind === 'Remove') {
    p.requirements = p.requirements.filter((x) => x.id !== c.targetId);
  } else if (c.kind === 'Add' && c.after) {
    const a = c.after as Requirement;
    const kind = a.kind ?? 'FR';
    const mod = a.module ?? 'APP';
    const prefix = kind === 'NFR' ? 'NFR-' : kind === 'IR' ? 'IR-' : `FR-${mod}-`;
    let n = 0;
    for (const r of p.requirements) if (r.id.startsWith(prefix)) n = Math.max(n, parseInt(r.id.slice(prefix.length), 10) || 0);
    const id = idFor(mod, kind, n + 1);
    p.requirements.push({
      id, kind, module: mod, title: a.title ?? 'New requirement', description: a.description ?? '', actor: a.actor, priority: a.priority ?? 'Must',
      acceptanceCriteria: a.acceptanceCriteria ?? [], refs: a.refs ?? [], origin: a.origin ?? 'Generated', status: 'Draft', generatedAt: at, reusedFrom: a.reusedFrom,
    });
    c.targetId = id;
  }
  c.status = 'Accepted';
  if (c.issueId) p.issueState[c.issueId] = { status: 'Fixed' };
}

export function pendingFor(p: Project, reqId: string) {
  return p.changes.filter((c) => c.status === 'Pending' && c.targetId === reqId);
}

export function pendingAdds(p: Project, module?: string) {
  return p.changes.filter((c) => c.status === 'Pending' && c.kind === 'Add' && (!module || c.after?.module === module));
}

/** Word-level diff for tracked-change display. */
export function wordDiff(a: string, b: string): { t: string; op: 'same' | 'del' | 'ins' }[] {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const m = x.length;
  const n = y.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: string; op: 'same' | 'del' | 'ins' }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (x[i] === y[j]) { out.push({ t: x[i], op: 'same' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: x[i++], op: 'del' });
    else out.push({ t: y[j++], op: 'ins' });
  }
  while (i < m) out.push({ t: x[i++], op: 'del' });
  while (j < n) out.push({ t: y[j++], op: 'ins' });
  // Merge runs.
  const merged: typeof out = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.op === s.op) last.t += s.t;
    else merged.push({ ...s });
  }
  return merged;
}
