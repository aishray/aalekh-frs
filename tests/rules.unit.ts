import { describe, expect, it } from 'vitest';
import rec from '@/data/recorded/scholarship/rules.json';
import { boundaryTests, evaluate } from '@/lib/engine/rules';
import type { DecisionTable } from '@/lib/types';

const tables: DecisionTable[] = rec.response.tables.map((t, i) => ({
  ...t,
  id: `BR-${String(i + 1).padStart(3, '0')}`,
  appliesTo: t.appliesTo as 'All' | 'Renewal',
  conditions: t.conditions.map((c) => ({ ...c, operator: c.operator as '=', unit: c.unit ?? undefined })),
}));

describe('decision tables', () => {
  it('income boundary tests use the corrigendum value, not the GO value', () => {
    const tests = boundaryTests(tables).filter((t) => t.reqId === 'BR-002');
    expect(tests.map((t) => t.data.annualFamilyIncome)).toEqual(['₹3,00,000', '₹2,99,999', '₹3,00,001']);
    expect(tests[2].expected).toContain('Ineligible');
    expect(tests[0].expected).toBe('Eligible on income');
    expect(JSON.stringify(tests)).not.toContain('2,50,000');
    expect(tests[0].refs).toEqual(['COR1-1']);
  });

  it('rule tester: income 3,00,001 fails BR-002 citing COR1-1', () => {
    const r = evaluate(tables, { domicileState: 'Rajyapradesh', annualFamilyIncome: '300001', courseLevel: 'Post-matric', institutionRecognised: 'Yes' }, 'Fresh');
    const failed = r.filter((x) => x.applicable && !x.pass);
    expect(failed.map((f) => f.table.id)).toEqual(['BR-002']);
    expect(failed[0].table.refs).toEqual(['COR1-1']);
    expect(r.find((x) => x.table.id === 'BR-004')!.applicable).toBe(false);
  });

  it('generates a compact set with sequential IDs', () => {
    const t = boundaryTests(tables);
    expect(t.length).toBe(2 + 3 + 4 + 3);
    expect(t[0].id).toBe('TC-BR-001');
  });
});
