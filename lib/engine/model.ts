import type { Project, Ref, SourceClause, Question, Requirement } from '@/lib/types';
import standards from '@/data/standards.json';

export const COVERAGE_TYPES = ['Mandate', 'Rule', 'Timeline'] as const;

export function allClauses(p: Pick<Project, 'sources'>): SourceClause[] {
  return p.sources.flatMap((d) => d.clauses);
}

export function clauseById(p: Pick<Project, 'sources'>, id: Ref) {
  for (const d of p.sources) for (const c of d.clauses) if (c.id === id) return { clause: c, doc: d };
  return undefined;
}

/** A clause overridden by a resolved conflict (another clause prevails, or a clarified value replaces it). */
export function overriddenBy(p: Pick<Project, 'reconciliations'>, id: Ref): Ref | undefined {
  for (const r of p.reconciliations) {
    if (!r.resolution || !r.clauses.includes(id)) continue;
    if (r.kind === 'Conflict' || r.kind === 'Duplicate') {
      if (r.resolution.type === 'Prevails' && r.resolution.prevailing && r.resolution.prevailing !== id) return r.resolution.prevailing;
      if (r.resolution.type === 'ClarifiedValue') return r.id;
    }
  }
  return undefined;
}

export type ClauseState = { effective: boolean; reason?: 'superseded' | 'overridden' | 'na'; by?: Ref };

export function clauseState(p: Pick<Project, 'reconciliations'>, c: SourceClause): ClauseState {
  if (c.supersededBy) return { effective: false, reason: 'superseded', by: c.supersededBy };
  const o = overriddenBy(p, c.id);
  if (o) return { effective: false, reason: 'overridden', by: o };
  return { effective: true };
}

/** Clauses used for drafting: not superseded, not overridden. */
export function effectiveClauses(p: Pick<Project, 'sources' | 'reconciliations'>) {
  return allClauses(p).filter((c) => clauseState(p, c).effective);
}

/** Clauses that must be covered by at least one requirement or marked not applicable. */
export function coverageClauses(p: Pick<Project, 'sources' | 'reconciliations'>) {
  return effectiveClauses(p).filter((c) => (COVERAGE_TYPES as readonly string[]).includes(c.type));
}

export const ansId = (q: Question) => q.id.replace(/^Q-/, 'ANS-');
export const asmId = (q: Question) => q.id.replace(/^Q-/, 'ASM-');

export function answers(p: Pick<Project, 'questions'>) {
  return p.questions.filter((q) => q.answer && !q.assumed).map((q) => ({ id: ansId(q), q }));
}
export function assumptions(p: Pick<Project, 'questions'>) {
  return p.questions.filter((q) => q.assumed).map((q) => ({ id: asmId(q), q, text: q.defaultAssumption }));
}

export type ResolvedRef = {
  ref: Ref;
  kind: 'Clause' | 'Answer' | 'Assumption' | 'Resolution' | 'Standard' | 'Transition' | 'Rule' | 'Field' | 'Requirement';
  title: string;
  text: string;
  sub?: string;
  original?: string;
  state?: ClauseState;
};

export function resolveRef(p: Project, ref: Ref): ResolvedRef | undefined {
  const c = clauseById(p, ref);
  if (c) {
    return {
      ref, kind: 'Clause', title: `${c.doc.name}, ${c.clause.label}`, text: c.clause.english || c.clause.original,
      original: c.doc.language !== 'en' ? c.clause.original : undefined,
      sub: [c.doc.refNo, c.doc.date].filter(Boolean).join(', '), state: clauseState(p, c.clause),
    };
  }
  if (/^ANS-\d+$/.test(ref)) {
    const q = p.questions.find((x) => ansId(x) === ref && x.answer && !x.assumed);
    if (q) return { ref, kind: 'Answer', title: `Answer to: ${q.question}`, text: q.answer!, sub: q.topic };
  }
  if (/^ASM-\d+$/.test(ref)) {
    const q = p.questions.find((x) => asmId(x) === ref && x.assumed);
    if (q) return { ref, kind: 'Assumption', title: `Assumption: ${q.topic}`, text: q.defaultAssumption, sub: q.confirmed ? 'Confirmed in review' : 'Not yet confirmed' };
  }
  if (/^RES-\d+$/.test(ref)) {
    const r = p.reconciliations.find((x) => x.id === ref);
    if (r) {
      const res = r.resolution;
      const t = !res ? 'Not yet resolved' : res.type === 'Prevails' ? `${res.prevailing} prevails.` : res.type === 'ClarifiedValue' ? `Clarified value: ${res.value}` : 'Deferred: to be clarified with the department.';
      return { ref, kind: 'Resolution', title: `${r.kind}: ${r.clauses.join(', ')}`, text: `${r.description} ${t}${res?.note ? ' ' + res.note : ''}`, sub: res ? `${res.by}` : undefined };
    }
  }
  if (ref.startsWith('STD-')) {
    const s = standards.find((x) => x.id === ref);
    if (s) return { ref, kind: 'Standard', title: s.name, text: s.summary, sub: s.authority };
  }
  if (ref.startsWith('WF-T')) {
    const t = p.workflow?.transitions.find((x) => x.id === ref);
    if (t) {
      const name = (id: string) => p.workflow!.states.find((s) => s.id === id)?.name ?? id;
      return { ref, kind: 'Transition', title: `${t.action}`, text: `${name(t.from)} to ${name(t.to)} by ${t.actor}${t.slaDays != null ? `, SLA ${t.slaDays} working days` : ''}.`, sub: t.refs.join(', ') };
    }
  }
  if (ref.startsWith('BR-')) {
    const r = p.rules.find((x) => x.id === ref);
    if (r) return { ref, kind: 'Rule', title: r.name, text: r.conditions.map((c) => `${c.label ?? c.attribute} ${c.operator} ${c.value}${c.unit ? ' ' + c.unit : ''}`).join(' AND ') + ` then ${r.outcome}.`, sub: r.refs.join(', ') };
  }
  if (ref.startsWith('FLD-')) {
    for (const e of p.entities) {
      const f = e.fields.find((x) => x.id === ref);
      if (f) return { ref, kind: 'Field', title: `${e.name}: ${f.label}`, text: `${f.type}${f.length ? `(${f.length})` : ''}, ${f.mandatory ? 'mandatory' : 'optional'}, from ${f.valueSource}. ${f.validation ?? ''}`, sub: `PII: ${f.pii}` };
    }
  }
  const req = p.requirements.find((x) => x.id === ref);
  if (req) return { ref, kind: 'Requirement', title: `${req.id} ${req.title}`, text: req.description };
  return undefined;
}

/** All ref IDs that currently exist in the project (used to validate AI output). */
export function validRefs(p: Project): Set<string> {
  const s = new Set<string>();
  allClauses(p).forEach((c) => s.add(c.id));
  answers(p).forEach((a) => s.add(a.id));
  assumptions(p).forEach((a) => s.add(a.id));
  p.reconciliations.forEach((r) => s.add(r.id));
  standards.forEach((x) => s.add(x.id));
  p.workflow?.transitions.forEach((t) => s.add(t.id));
  p.rules.forEach((r) => s.add(r.id));
  p.entities.forEach((e) => e.fields.forEach((f) => s.add(f.id)));
  return s;
}

/** Requirements that cite a ref, directly. */
export function citing(reqs: Requirement[], ref: Ref) {
  return reqs.filter((r) => r.refs.includes(ref));
}

/** Openness helpers for reconciliation gating. */
export function unresolvedFindings(p: Pick<Project, 'reconciliations'>) {
  return p.reconciliations.filter((r) => !r.resolution);
}

/**
 * Validates refs from AI output. ANS-n and ASM-n are interchangeable (the same question answered or assumed).
 * Invalid refs are dropped and returned so they can be raised as issues. `forward` keeps BR-/FLD- refs
 * that will exist once the corresponding artefact is built.
 */
export function normalizeRefs(p: Project, refs: Ref[], opts: { forward?: boolean } = {}) {
  const valid = validRefs(p);
  const kept: Ref[] = [];
  const dropped: Ref[] = [];
  for (const r of refs) {
    let x = r.trim();
    if (!valid.has(x)) {
      const swap = x.startsWith('ANS-') ? x.replace('ANS-', 'ASM-') : x.startsWith('ASM-') ? x.replace('ASM-', 'ANS-') : '';
      if (swap && valid.has(swap)) x = swap;
    }
    if (valid.has(x) || (opts.forward && /^(BR-|FLD-)/.test(x))) {
      if (!kept.includes(x)) kept.push(x);
    } else dropped.push(r);
  }
  return { kept, dropped };
}
