import type { Workflow, WfTransition } from '@/lib/types';

export type WfFinding = { id: string; severity: 'High' | 'Medium' | 'Low'; message: string; targets: string[] };

export const SYSTEM_ACTORS = ['System'];
/** Time with the applicant does not count against the Right to Service timeline. */
export const CLOCK_PAUSED_ACTORS = ['Applicant', 'Citizen', 'Architect', 'Owner'];

export function isHumanAction(t: WfTransition) {
  return !SYSTEM_ACTORS.includes(t.actor);
}

export function reachable(wf: Workflow, startId: string) {
  const seen = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length) {
    const s = stack.pop()!;
    for (const t of wf.transitions) if (t.from === s && !seen.has(t.to)) { seen.add(t.to); stack.push(t.to); }
  }
  return seen;
}

function stateId(wf: Workflow, name: string) {
  return wf.states.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id;
}

/**
 * Longest simple path (by SLA days that count against the RTS clock) from `from` to `to`.
 * Workflows are small, so exhaustive DFS over simple paths is fine.
 */
export function longestPath(wf: Workflow, from: string, to: string): { days: number; path: WfTransition[] } | null {
  let best: { days: number; path: WfTransition[] } | null = null;
  const visit = (s: string, seen: Set<string>, days: number, path: WfTransition[]) => {
    if (s === to) {
      if (!best || days > best.days) best = { days, path: path.slice() };
      return;
    }
    for (const t of wf.transitions) {
      if (t.from !== s || seen.has(t.to)) continue;
      const counted = CLOCK_PAUSED_ACTORS.includes(t.actor) ? 0 : t.slaDays ?? 0;
      seen.add(t.to);
      path.push(t);
      visit(t.to, seen, days + counted, path);
      path.pop();
      seen.delete(t.to);
    }
  };
  visit(from, new Set([from]), 0, []);
  return best;
}

export type RtsResult = { ok: boolean; total: number; limit?: number; path: WfTransition[]; message: string; from?: string; to?: string };

export function rtsCheck(wf: Workflow, opts?: { from?: string; to?: string }): RtsResult {
  const from = opts?.from ?? stateId(wf, 'Submitted') ?? wf.states[1]?.id;
  const to =
    opts?.to ??
    stateId(wf, 'Sanctioned') ??
    stateId(wf, 'Approved') ??
    wf.states.find((s) => s.terminal && !/reject|close|withdraw/i.test(s.name))?.id;
  if (!from || !to) return { ok: false, total: 0, path: [], message: 'The workflow needs a Submitted state and a sanction or approval state for the Right to Service check.' };
  const lp = longestPath(wf, from, to);
  const fromName = wf.states.find((s) => s.id === from)?.name;
  const toName = wf.states.find((s) => s.id === to)?.name;
  if (!lp) return { ok: false, total: 0, path: [], from: fromName, to: toName, message: `${toName} cannot be reached from ${fromName}.` };
  if (wf.rtsDays == null)
    return { ok: false, total: lp.days, path: lp.path, from: fromName, to: toName, message: `Total ${lp.days} working days from ${fromName} to ${toName}. No notified service timeline is recorded, so compliance cannot be checked.` };
  const ok = lp.days <= wf.rtsDays;
  return {
    ok,
    total: lp.days,
    limit: wf.rtsDays,
    path: lp.path,
    from: fromName,
    to: toName,
    message: ok
      ? `Total ${lp.days} working days against notified ${wf.rtsDays} days: compliant`
      : `Total ${lp.days} working days exceeds the notified ${wf.rtsDays} days by ${lp.days - wf.rtsDays}: not compliant with the Right to Service timeline`,
  };
}

export function validateWorkflow(wf: Workflow): WfFinding[] {
  const out: WfFinding[] = [];
  const start = stateId(wf, 'Draft') ?? wf.states[0]?.id;
  const reach = start ? reachable(wf, start) : new Set<string>();
  for (const s of wf.states) {
    if (!s.terminal && !wf.transitions.some((t) => t.from === s.id))
      out.push({ id: `WFV-dead-${s.id}`, severity: 'High', message: `State "${s.name}" is not terminal but has no outgoing transition.`, targets: [s.id] });
    if (!reach.has(s.id))
      out.push({ id: `WFV-unreach-${s.id}`, severity: 'High', message: `State "${s.name}" cannot be reached from Draft.`, targets: [s.id] });
  }
  for (const t of wf.transitions) {
    if (!wf.states.some((s) => s.id === t.from) || !wf.states.some((s) => s.id === t.to))
      out.push({ id: `WFV-bad-${t.id}`, severity: 'High', message: `${t.id} refers to a state that does not exist.`, targets: [t.id] });
    if (isHumanAction(t) && !t.actor.trim())
      out.push({ id: `WFV-actor-${t.id}`, severity: 'High', message: `${t.id} "${t.action}" has no actor.`, targets: [t.id] });
    if (isHumanAction(t) && !CLOCK_PAUSED_ACTORS.includes(t.actor) && t.slaDays == null)
      out.push({ id: `WFV-sla-${t.id}`, severity: 'Medium', message: `${t.id} "${t.action}" by ${t.actor} has no SLA.`, targets: [t.id] });
    const toName = wf.states.find((s) => s.id === t.to)?.name ?? '';
    if (/reject/i.test(toName) && (!t.notification || !/reason/i.test(t.notification.template)))
      out.push({ id: `WFV-rejnote-${t.id}`, severity: 'High', message: `${t.id} "${t.action}" leads to rejection but does not notify the applicant with the reason.`, targets: [t.id] });
  }
  const rts = rtsCheck(wf);
  if (!rts.ok) out.push({ id: 'WFV-rts', severity: 'High', message: rts.message, targets: rts.path.map((t) => t.id) });
  return out;
}
