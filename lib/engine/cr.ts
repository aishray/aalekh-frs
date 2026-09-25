import type { CrItem, Requirement } from '@/lib/types';
import { TfIdf, reqText } from './similarity';

/** Candidate baseline requirements for each line of a vendor change request (similarity retrieval). */
export function crCandidates(text: string, reqs: Requirement[], k = 6) {
  const idx = new TfIdf(reqs.map(reqText));
  const asks = text.split(/\n+/).map((l) => l.trim()).filter((l) => /^\(?\d+[.)]|^[a-z][.)]|^[-•]/i.test(l));
  const lines = asks.length ? asks : [text];
  return lines.map((ask) => ({ ask, hits: idx.query(ask, k).filter((h) => h.score > 0.08).map((h) => ({ id: reqs[h.index].id, score: h.score })) }));
}

/** Matched IDs must exist in the baseline; quotes are the matched requirements' own acceptance criteria, verbatim. */
export function enforceCr(items: CrItem[], reqs: Requirement[]): CrItem[] {
  const byId = new Map(reqs.map((r) => [r.id, r]));
  return items.map((i) => {
    const matched = i.matchedReqs.filter((id) => byId.has(id));
    const classification = matched.length === 0 && i.classification !== 'New scope' ? 'New scope' : i.classification;
    return { ...i, classification, matchedReqs: classification === 'New scope' ? [] : matched, quotes: classification === 'New scope' ? [] : matched.slice(0, 3).map((id) => `${id}: ${byId.get(id)!.acceptanceCriteria[0] ?? byId.get(id)!.description}`) };
  });
}
