import type { ImpactItem, Project, Ref, SourceDoc } from '@/lib/types';
import { reqTests } from './uat';
import { boundaryTests } from './rules';

/** Supersessions a corrigendum makes: "In paragraph 7.3 of the G.O." -> GO-7.3. */
export function corrigendumSupersessions(p: Project, cor: SourceDoc): { old: Ref; by: Ref }[] {
  const target = p.sources.find((d) => d.id === cor.amends);
  if (!target) return [];
  const out: { old: Ref; by: Ref }[] = [];
  for (const c of cor.clauses)
    for (const m of Array.from((c.english || c.original).matchAll(/paragraph\s+(\d+(?:\.\d+)*)/gi))) {
      const old = `${target.prefix}-${m[1]}`;
      if (target.clauses.some((x) => x.id === old)) out.push({ old, by: c.id });
    }
  return out;
}

/** Everything that cites a superseded clause, directly: requirements, their test cases, rules and rule tests, transitions, fields. */
export function directImpact(p: Project, olds: Ref[]): ImpactItem[] {
  const out: ImpactItem[] = [];
  const cites = (refs: Ref[]) => refs.find((r) => olds.includes(r));
  for (const r of p.requirements) {
    const c = cites(r.refs);
    if (!c) continue;
    out.push({ targetId: r.id, kind: 'Requirement', reason: `Cites ${c}`, proposedChange: '' });
    for (const t of reqTests(r)) out.push({ targetId: t.id, kind: 'Test', reason: `Derived from ${r.id}, which cites ${c}`, proposedChange: '' });
  }
  for (const r of p.rules) {
    const c = cites(r.refs);
    if (!c) continue;
    out.push({ targetId: r.id, kind: 'Rule', reason: `Cites ${c}`, proposedChange: '' });
    for (const t of boundaryTests(p.rules).filter((x) => x.reqId === r.id)) out.push({ targetId: t.id, kind: 'Test', reason: `Boundary test of ${r.id}`, proposedChange: '' });
  }
  for (const t of p.workflow?.transitions ?? []) {
    const c = cites(t.refs);
    if (c) out.push({ targetId: t.id, kind: 'Transition', reason: `Cites ${c}`, proposedChange: '' });
  }
  for (const e of p.entities) for (const f of e.fields) {
    const c = cites(f.refs);
    if (c) out.push({ targetId: f.id, kind: 'Field', reason: `Cites ${c}`, proposedChange: '' });
  }
  return out;
}
