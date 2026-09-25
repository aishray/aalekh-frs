import type { Project } from '@/lib/types';
import { SYSTEM_ACTORS } from './workflow';

export type Screen = { id: string; role: string; name: string; purpose: string; reqs: string[] };

/** Screens derived from roles x workflow actions x entities, plus reports and masters. */
export function screenInventory(p: Project): Screen[] {
  const out: Screen[] = [];
  const wf = p.workflow;
  const stateName = (id: string) => wf?.states.find((s) => s.id === id)?.name ?? id;
  const reqsFor = (pred: (refs: string[], actor?: string) => boolean) => p.requirements.filter((r) => pred(r.refs, r.actor)).map((r) => r.id);
  let n = 0;
  const add = (role: string, name: string, purpose: string, reqs: string[]) => out.push({ id: `SCR-${String(++n).padStart(2, '0')}`, role, name, purpose, reqs: Array.from(new Set(reqs)) });

  if (wf) {
    const actors = Array.from(new Set(wf.transitions.map((t) => t.actor))).filter((a) => !SYSTEM_ACTORS.includes(a));
    for (const actor of actors) {
      const ts = wf.transitions.filter((t) => t.actor === actor);
      const tids = ts.map((t) => t.id);
      const fromStates = Array.from(new Set(ts.map((t) => t.from)));
      if (/applicant|citizen|owner|architect/i.test(actor)) {
        for (const e of p.entities.length ? p.entities : [{ name: 'Application', fields: [] }]) add(actor, `${e.name} form`, `Enter and save ${e.name.toLowerCase()} details`, reqsFor((refs, a) => a === actor || refs.some((r) => r.startsWith('FLD-') && e.fields.some((f) => f.id === r))));
        add(actor, 'Application status', 'Track status, days elapsed and messages', reqsFor((refs) => refs.some((r) => tids.includes(r))));
      } else {
        for (const s of fromStates) add(actor, `Pending list: ${stateName(s)}`, `Applications awaiting ${ts.filter((t) => t.from === s).map((t) => t.action.toLowerCase()).join(' or ')}`, reqsFor((refs) => refs.some((r) => ts.filter((t) => t.from === s).some((t) => t.id === r))));
        add(actor, 'Application detail with actions', ts.map((t) => t.action).join(', '), reqsFor((refs, a) => a === actor || refs.some((r) => tids.includes(r))));
      }
    }
  }
  for (const r of p.requirements.filter((x) => x.module === 'RPT')) add(r.actor ?? 'Officer', r.title, 'Report or dashboard', [r.id]);
  for (const m of p.masters) add('State administrator', `Master: ${m.name}`, `Maintain ${m.name.toLowerCase()} values`, reqsFor((refs, a) => a === 'State administrator'));
  if (p.requirements.some((r) => r.module === 'GRV')) add('Applicant', 'Grievance', 'Register and track grievances', p.requirements.filter((r) => r.module === 'GRV').map((r) => r.id));
  return out;
}

export const DEFAULT_WEIGHTS: Record<string, number> = { screens: 3, entities: 4, integrations: 8, reports: 3, transitions: 2, productivity: 12 };

export function sizeEstimate(p: Project, w: Record<string, number> = DEFAULT_WEIGHTS) {
  const weights = { ...DEFAULT_WEIGHTS, ...w };
  const counts = {
    screens: screenInventory(p).length,
    entities: p.entities.length || (p.discovery?.entities.length ?? 0),
    integrations: p.requirements.filter((r) => r.kind === 'IR').length,
    reports: p.requirements.filter((r) => r.module === 'RPT').length,
    transitions: p.workflow?.transitions.length ?? 0,
  };
  const rows = (Object.keys(counts) as (keyof typeof counts)[]).map((k) => ({ key: k, count: counts[k], weight: weights[k], points: counts[k] * weights[k] }));
  const points = rows.reduce((s, r) => s + r.points, 0);
  const pm = points / Math.max(1, weights.productivity);
  return { rows, points, productivity: weights.productivity, low: Math.round(pm * 0.8 * 10) / 10, high: Math.round(pm * 1.25 * 10) / 10 };
}
