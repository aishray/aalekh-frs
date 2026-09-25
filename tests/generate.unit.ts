import { describe, expect, it } from 'vitest';
import { draftedSample, seedProjects } from './helpers';
import { issuesFor, qualityFor } from '@/lib/engine/quality';
import { validRefs } from '@/lib/engine/model';
import { buildLibraryIndex, libraryItems, reqText } from '@/lib/engine/similarity';
import { mergeModelDerived, modelDerived, replaceModule } from '@/lib/engine/generate';

describe('FRS generation for the sample', () => {
  const p = draftedSample();

  it('produces 50 to 80 requirements with unique IDs and valid refs', () => {
    expect(p.requirements.length).toBeGreaterThanOrEqual(50);
    expect(p.requirements.length).toBeLessThanOrEqual(80);
    expect(new Set(p.requirements.map((r) => r.id)).size).toBe(p.requirements.length);
    const valid = validRefs(p);
    for (const r of p.requirements) expect(r.refs.some((x) => valid.has(x)), `${r.id} ${r.refs}`).toBe(true);
  });

  it('shows exactly the demo findings: GO-7.3 uncovered and one ambiguity ("quickly")', () => {
    const issues = issuesFor(p).filter((i) => i.status === 'Open');
    expect(issues.filter((i) => i.type === 'Coverage').map((i) => i.targetIds[0])).toEqual(['GO-7.3']);
    const amb = issues.filter((i) => i.type === 'Ambiguity');
    expect(amb.map((i) => i.message)).toEqual(['FR-GRV-001 uses the ambiguous term "quickly".']);
    expect(issues.filter((i) => ['NoAcceptance', 'NoRefs', 'InvalidRef', 'Duplicate', 'Workflow', 'Compliance'].includes(i.type)).map((i) => i.message)).toEqual([]);
  });

  it('model-derived notifications cite GO-7.2 for the CR scope check', () => {
    const nots = p.requirements.filter((r) => r.module === 'NOT' && r.origin === 'FromModel');
    expect(nots.length).toBe(9);
    expect(nots[0].id).toBe('FR-NOT-001');
    expect(nots.filter((r) => r.refs.includes('GO-7.2')).length).toBeGreaterThanOrEqual(4);
  });

  it('regenerating one module does not change IDs of other modules', () => {
    const before = p.requirements.filter((r) => r.module !== 'APP').map((r) => r.id).sort();
    const again = replaceModule(p.requirements, 'APP', 'FR', p.requirements.filter((r) => r.module === 'APP' && r.origin === 'Generated').slice(0, 3));
    expect(again.filter((r) => r.module !== 'APP').map((r) => r.id).sort()).toEqual(before);
    const merged = mergeModelDerived(p.requirements, modelDerived(p).map((d) => d), '2026-09-26T00:00:00.000Z');
    expect(merged.filter((r) => r.modelKey).map((r) => r.id).sort()).toEqual(p.requirements.filter((r) => r.modelKey && modelDerived(p).some((d) => d.modelKey === r.modelKey)).map((r) => r.id).sort());
  });

  it('suggests FR-APP-011 of Building Plan Approval for the assisted CSC application', () => {
    const lib = libraryItems(seedProjects(), p.id);
    const idx = buildLibraryIndex(lib);
    const csc = p.requirements.find((r) => r.module === 'APP' && r.title.startsWith('Assisted application'))!;
    expect(csc.id).toBe('FR-APP-002');
    const [hit] = idx.query(reqText(csc), 1);
    expect(lib[hit.index].req.id).toBe('FR-APP-011');
    expect(hit.score).toBeGreaterThan(0.4);
    const scores = p.requirements.filter((r) => r.origin === 'Generated').map((r) => ({ id: r.id, s: idx.query(reqText(r), 1)[0].score }));
    console.log('reuse scores', scores.filter((x) => x.s >= 0.4).map((x) => `${x.id}:${x.s.toFixed(2)}`).join(' '));
  });

  it('quality score is computed', () => {
    const q = qualityFor(p);
    console.log('score', q.total, q.parts.map((x) => `${x.key}=${x.value}`).join(' '));
    expect(q.total).toBeGreaterThan(60);
  });
});
