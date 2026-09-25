import type { Project } from '@/lib/types';
import { allClauses, answers, assumptions, clauseState, effectiveClauses } from '@/lib/engine/model';

/** `[GO-4.2] (Timeline) text` lines for effective clauses. */
export function sourcesBlock(p: Project, opts: { types?: string[]; includeInfo?: boolean } = {}) {
  return effectiveClauses(p)
    .filter((c) => (opts.types ? opts.types.includes(c.type) : opts.includeInfo !== false || c.type !== 'Info'))
    .map((c) => `[${c.id}] (${c.type}) ${c.english || c.original}`)
    .join('\n');
}

export function supersededBlock(p: Project) {
  return allClauses(p)
    .filter((c) => !clauseState(p, c).effective)
    .map((c) => `[${c.id}] superseded by ${clauseState(p, c).by}: ${c.english || c.original}`)
    .join('\n');
}

export function resolutionsBlock(p: Project) {
  return p.reconciliations
    .filter((r) => r.resolution)
    .map((r) => {
      const res = r.resolution!;
      const what = res.type === 'Prevails' ? `${res.prevailing} prevails` : res.type === 'ClarifiedValue' ? `clarified value: ${res.value}` : 'deferred to the department (open issue)';
      return `[${r.id}] ${r.kind} ${r.clauses.join(', ')}: ${what}.${res.note ? ' ' + res.note : ''}`;
    })
    .join('\n');
}

export function answersBlock(p: Project) {
  return answers(p).map((a) => `[${a.id}] ${a.q.question} Answer: ${a.q.answer}`).join('\n');
}

export function assumptionsBlock(p: Project) {
  return assumptions(p).map((a) => `[${a.id}] ${a.q.topic}: ${a.text}`).join('\n');
}

export function standardBlocks(p: Project) {
  return {
    SOURCES: sourcesBlock(p),
    SUPERSEDED: supersededBlock(p),
    RESOLUTIONS: resolutionsBlock(p),
    ANSWERS: answersBlock(p),
    ASSUMPTIONS: assumptionsBlock(p),
  };
}

export const compact = (v: unknown) => JSON.stringify(v);
