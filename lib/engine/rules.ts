import type { Condition, DecisionTable, TestCase } from '@/lib/types';

export const NUMERIC = ['<=', '<', '>=', '>'];

export function fmtValue(v: string | number, unit?: string | null) {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  if (unit === 'INR' && !isNaN(n)) return '₹' + n.toLocaleString('en-IN');
  if (unit === '%') return `${v}%`;
  return unit ? `${v} ${unit}` : String(v);
}

function step(c: Condition) {
  if (c.unit === '%') return 0.1;
  const n = Number(c.value);
  return Number.isInteger(n) ? 1 : 0.01;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function evalCondition(c: Condition, raw: string | undefined): boolean {
  if (raw == null || raw === '') return false;
  if (NUMERIC.includes(c.operator)) {
    const a = Number(String(raw).replace(/,/g, ''));
    const b = Number(c.value);
    if (isNaN(a)) return false;
    return c.operator === '<=' ? a <= b : c.operator === '<' ? a < b : c.operator === '>=' ? a >= b : a > b;
  }
  const norm = (s: string) => s.trim().toLowerCase();
  if (c.operator === 'in') return c.value.split(',').map(norm).includes(norm(raw));
  if (c.operator === '!=') return norm(raw) !== norm(c.value);
  return norm(raw) === norm(c.value);
}

/** A value that satisfies the condition, used as the baseline for other variations. */
export function passValue(c: Condition): string {
  if (NUMERIC.includes(c.operator)) {
    const b = Number(c.value);
    const s = step(c);
    return String(c.operator === '<' ? round(b - s) : c.operator === '>' ? round(b + s) : b);
  }
  if (c.operator === 'in') return c.value.split(',')[0].trim();
  if (c.operator === '!=') return `Not ${c.value}`;
  return c.value;
}

export function failValue(c: Condition): string {
  if (c.operator === '=' && /^yes$/i.test(c.value)) return 'No';
  if (c.operator === '=' && /^no$/i.test(c.value)) return 'Yes';
  if (c.operator === '!=') return c.value;
  if (c.attribute.toLowerCase().includes('course')) return 'Pre-matric';
  if (c.attribute.toLowerCase().includes('state')) return 'Other state';
  return `Other than ${c.value}`;
}

export type RuleResult = { table: DecisionTable; pass: boolean; failed: { c: Condition; value: string | undefined }[]; applicable: boolean };

export function evaluate(tables: DecisionTable[], input: Record<string, string>, applicationType: 'Fresh' | 'Renewal'): RuleResult[] {
  return tables.map((t) => {
    const applicable = t.appliesTo !== 'Renewal' || applicationType === 'Renewal';
    const failed = applicable ? t.conditions.filter((c) => !evalCondition(c, input[c.attribute])).map((c) => ({ c, value: input[c.attribute] })) : [];
    return { table: t, applicable, pass: failed.length === 0, failed };
  });
}

/**
 * Boundary test generation: for each numeric condition, the limit, just inside and just outside;
 * for each equality or boolean condition, a true and a false case. Other conditions of the table are held
 * at passing values, giving a compact set rather than the full cartesian product.
 */
export function boundaryTests(tables: DecisionTable[]): TestCase[] {
  const out: TestCase[] = [];
  let n = 0;
  const id = () => `TC-BR-${String(++n).padStart(3, '0')}`;
  for (const t of tables) {
    const base: Record<string, string> = Object.fromEntries(t.conditions.map((c) => [c.attribute, passValue(c)]));
    const pre = t.appliesTo === 'Renewal' ? 'A renewal application with all other conditions met' : 'A fresh application with all other conditions met';
    const push = (c: Condition, value: string, why: string) => {
      const data = { ...base, [c.attribute]: value };
      const pass = t.conditions.every((k) => evalCondition(k, data[k.attribute]));
      out.push({
        id: id(),
        reqId: t.id,
        title: `${t.name}: ${c.label ?? c.attribute} ${why}`,
        precondition: pre,
        steps: [`Enter ${c.label ?? c.attribute} as ${fmtValue(value, c.unit)}`, 'Submit the application for eligibility check'],
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, fmtValue(v, t.conditions.find((x) => x.attribute === k)?.unit)])),
        expected: pass ? t.outcome : `${t.failOutcome} (${t.id})`,
        refs: t.refs,
      });
    };
    for (const c of t.conditions) {
      if (NUMERIC.includes(c.operator)) {
        const b = Number(c.value);
        const s = step(c);
        push(c, String(b), 'at the limit');
        push(c, String(round(b - s)), 'just below the limit');
        push(c, String(round(b + s)), 'just above the limit');
      } else {
        push(c, passValue(c), 'meets the condition');
        push(c, failValue(c), 'does not meet the condition');
      }
    }
  }
  return out;
}
