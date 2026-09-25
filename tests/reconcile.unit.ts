import { describe, expect, it } from 'vitest';
import { buildScholarshipProject } from '@/lib/seed/scholarship';
import { detectDeterministic, mergeFindings } from '@/lib/engine/reconcile';
import rec from '@/data/recorded/scholarship/reconcile.json';
import type { Finding } from '@/lib/engine/reconcile';

describe('reconciliation', () => {
  it('detects the corrigendum supersession and the missing annexure deterministically', () => {
    const p = buildScholarshipProject();
    const det = detectDeterministic(p);
    expect(det.map((f) => `${f.kind}:${f.clauses.join(',')}`).sort()).toEqual(['MissingReference:GO-4.3', 'Supersession:GO-3.2,COR1-1']);
  });

  it('merges with recorded AI findings into exactly one conflict, one supersession, one missing reference', () => {
    const p = buildScholarshipProject();
    const { all } = mergeFindings([], rec.response.findings as Finding[], detectDeterministic(p));
    expect(all.map((r) => r.kind)).toEqual(['Supersession', 'Conflict', 'MissingReference']);
    expect(all.map((r) => r.id)).toEqual(['RES-1', 'RES-2', 'RES-3']);
    const again = mergeFindings(all, rec.response.findings as Finding[], detectDeterministic(p));
    expect(again.added).toBe(0);
  });
});
