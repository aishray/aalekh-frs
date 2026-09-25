import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/lib/seed';
import { allClauses, validRefs } from '@/lib/engine/model';
import { issuesFor, qualityFor } from '@/lib/engine/quality';
import { rtsCheck } from '@/lib/engine/workflow';

describe('seed data', () => {
  const { projects } = buildSeed();

  it('has 8 projects with unique ids', () => {
    expect(projects).toHaveLength(8);
    expect(new Set(projects.map((p) => p.id)).size).toBe(8);
  });

  it('sample scholarship ships with sources only', () => {
    const p = projects.find((x) => x.sample === 'scholarship')!;
    expect(p.sources.map((d) => d.prefix)).toEqual(['GO', 'COR1', 'MIN', 'VB', 'FORM']);
    expect(p.requirements).toHaveLength(0);
    const ids = allClauses(p).map((c) => c.id);
    expect(ids).toContain('GO-9');
    expect(ids).toContain('COR1-1');
    expect(ids).toContain('VB-3');
    expect(ids).toContain('FORM-12');
    const vb = p.sources.find((d) => d.prefix === 'VB')!;
    expect(vb.language).toBe('hi');
    expect(vb.clauses[0].english).toMatch(/mobile application/);
    expect(allClauses(p).find((c) => c.id === 'GO-7.3')!.type).toBe('Timeline');
  });

  it('every seeded requirement cites a valid ref and has acceptance criteria', () => {
    for (const p of projects) {
      const valid = validRefs(p);
      for (const r of p.requirements) {
        expect(r.acceptanceCriteria.length, `${p.id} ${r.id}`).toBeGreaterThan(0);
        expect(r.refs.some((x) => valid.has(x)), `${p.id} ${r.id} ${r.refs}`).toBe(true);
      }
    }
  });

  it('building plan approval has about 60 requirements and a compliant RTS path', () => {
    const p = projects.find((x) => x.id === 'obpa')!;
    expect(p.requirements.length).toBeGreaterThanOrEqual(55);
    expect(new Set(p.requirements.map((r) => r.id)).size).toBe(p.requirements.length);
    expect(rtsCheck(p.workflow!).ok).toBe(true);
    const q = qualityFor(p);
    expect(q.total).toBeGreaterThan(80);
    expect(issuesFor(p).filter((i) => i.type === 'Coverage')).toHaveLength(0);
  });

  it('mandi price app shows an ambiguity', () => {
    const p = projects.find((x) => x.id === 'mandi')!;
    expect(issuesFor(p).some((i) => i.type === 'Ambiguity' && i.message.includes('quickly'))).toBe(true);
  });
});
