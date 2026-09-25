'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, ErrorBox, Field, Input, Notice, PageHeader, Panel, Progress, Select, Tabs, td, th } from '@/components/ui';
import { Refs, RefTag } from '@/components/RefTag';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { standardBlocks, sourcesBlock } from '@/lib/ai/context';
import { normalizeRefs, unresolvedFindings } from '@/lib/engine/model';
import { boundaryTests, evaluate, fmtValue, NUMERIC } from '@/lib/engine/rules';
import type { Condition, DecisionTable } from '@/lib/types';
import { cn, nowIso } from '@/lib/util';

type Proposal = { tables: (Omit<DecisionTable, 'id' | 'conditions'> & { conditions: (Omit<Condition, 'unit'> & { unit: string | null })[] })[] };

export default function RulesPage() {
  const { project: p, update } = useCurrentProject();
  const ai = useAiRun();
  const [tab, setTab] = useState<'tables' | 'tests' | 'tester'>('tables');
  const tests = useMemo(() => boundaryTests(p.rules), [p.rules]);
  const blocked = !p.reconciledAt || unresolvedFindings(p).length > 0;

  async function build() {
    const out = await ai.run(['Reading effective Rule clauses after corrigenda', 'Building decision tables', 'Generating boundary test cases'], () =>
      runAi<Proposal>('rules', p, { ...standardBlocks(p), SOURCES: sourcesBlock(p, { types: ['Rule'] }) }),
    );
    if (!out) return;
    update('Built decision tables', `${out.data.tables.length} tables`, (x) => {
      x.rules = out.data.tables.map((t, i) => ({
        ...t,
        id: `BR-${String(i + 1).padStart(3, '0')}`,
        refs: normalizeRefs(x, t.refs).kept,
        conditions: t.conditions.map((c) => ({ ...c, unit: c.unit ?? undefined })),
      }));
      x.rules.forEach((r) => (x.stamps[r.id] = nowIso()));
    });
    toast.success('Decision tables built with boundary tests');
  }

  return (
    <div>
      <PageHeader
        title="Business rules"
        subtitle="Eligibility and calculation rules as decision tables, using the effective values after corrigenda. Boundary test cases are generated automatically."
        actions={<Button variant={p.rules.length ? 'secondary' : 'primary'} onClick={build} loading={ai.busy} disabled={blocked}>{p.rules.length ? 'Rebuild from sources' : 'Build decision tables'}</Button>}
      />
      {blocked && <Notice tone="warn" className="mb-4">Resolve reconciliation first, so rules use the corrigendum values. <Link className="underline" href={`/projects/${p.id}/reconcile`}>Go to Reconcile</Link></Notice>}
      {ai.busy && <div className="mb-4 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <div className="mb-4"><ErrorBox title="Decision tables could not be built" message={ai.error} action={<Button size="sm" onClick={build}>Try again</Button>} /></div>}
      {!p.rules.length && !ai.busy ? (
        !blocked && <Empty text="No decision tables yet. They are built from the effective Rule clauses." action={<Button variant="primary" onClick={build}>Build decision tables</Button>} />
      ) : p.rules.length ? (
        <>
          <Tabs tabs={[{ id: 'tables', label: `Decision tables (${p.rules.length})` }, { id: 'tests', label: `Boundary tests (${tests.length})` }, { id: 'tester', label: 'Rule tester' }]} value={tab} onChange={setTab} />
          <div className="mt-4">
            {tab === 'tables' && (
              <div className="grid grid-cols-2 gap-4">
                {p.rules.map((r) => <TableCard key={r.id} r={r} projectId={p.id} onChange={(c, i) => update('Edited business rule', `${r.id} ${c.label ?? c.attribute}`, (x) => { x.rules.find((y) => y.id === r.id)!.conditions[i] = c; x.stamps[r.id] = nowIso(); })} />)}
              </div>
            )}
            {tab === 'tests' && (
              <Panel title="Boundary test cases" subtitle="Numeric conditions: at the limit, just below and just above. Other conditions: true and false. Other inputs are held at passing values." bodyClass="p-0">
                <table className="w-full">
                  <thead><tr><th className={th}>Test</th><th className={th}>Rule</th><th className={th}>Case</th><th className={th}>Test data</th><th className={th}>Expected</th></tr></thead>
                  <tbody>
                    {tests.map((t) => (
                      <tr key={t.id}>
                        <td className={td + ' font-mono text-xs'}>{t.id}</td>
                        <td className={td}><RefTag projectId={p.id} id={t.reqId} /></td>
                        <td className={td}>{t.title}</td>
                        <td className={td + ' text-xs'}>{Object.entries(t.data).map(([k, v]) => <div key={k}><span className="text-ink-faint">{k}:</span> {v}</div>)}</td>
                        <td className={cn(td, t.expected.startsWith('Ineligible') ? 'text-bad' : 'text-ok')}>{t.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}
            {tab === 'tester' && <Tester rules={p.rules} projectId={p.id} />}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TableCard({ r, projectId, onChange }: { r: DecisionTable; projectId: string; onChange: (c: Condition, i: number) => void }) {
  return (
    <Panel title={<span className="flex items-center gap-2"><RefTag projectId={projectId} id={r.id} />{r.name}{r.appliesTo === 'Renewal' && <Badge tone="navy">Renewal only</Badge>}</span>} actions={<Refs projectId={projectId} refs={r.refs} />} bodyClass="p-0">
      <table className="w-full">
        <thead><tr><th className={th}>Condition</th><th className={th + ' w-20'}>Operator</th><th className={th + ' w-36'}>Value</th></tr></thead>
        <tbody>
          {r.conditions.map((c, i) => (
            <tr key={i}>
              <td className={td}>{c.label ?? c.attribute}<div className="font-mono text-[11px] text-ink-faint">{c.attribute}</div></td>
              <td className={td}>
                <Select aria-label="Operator" className="h-7 text-xs" value={c.operator} onChange={(e) => onChange({ ...c, operator: e.target.value as Condition['operator'] }, i)}>
                  {['<=', '<', '>=', '>', '=', '!=', 'in'].map((o) => <option key={o}>{o}</option>)}
                </Select>
              </td>
              <td className={td}>
                <div className="flex items-center gap-1">
                  <Input aria-label={`${c.label ?? c.attribute} value`} className="h-7 text-xs" defaultValue={c.value} onBlur={(e) => e.target.value !== c.value && onChange({ ...c, value: (NUMERIC.includes(c.operator) ? e.target.value.replace(/[₹,\s]/g, '') : e.target.value.trim()) || c.value }, i)} />
                  {c.unit && <span className="text-xs text-ink-faint">{c.unit}</span>}
                </div>
              </td>
            </tr>
          ))}
          <tr><td className={td + ' text-ok'} colSpan={3}>All hold: {r.outcome}</td></tr>
          <tr><td className={td + ' text-bad'} colSpan={3}>Any fails: {r.failOutcome}</td></tr>
        </tbody>
      </table>
    </Panel>
  );
}

function Tester({ rules, projectId }: { rules: DecisionTable[]; projectId: string }) {
  const attrs = useMemo(() => {
    const m = new Map<string, Condition>();
    rules.forEach((r) => r.conditions.forEach((c) => !m.has(c.attribute) && m.set(c.attribute, c)));
    return Array.from(m.values());
  }, [rules]);
  const [type, setType] = useState<'Fresh' | 'Renewal'>('Fresh');
  const [input, setInput] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof evaluate> | null>(null);
  const failed = result?.filter((r) => r.applicable && !r.pass) ?? [];

  return (
    <div className="grid grid-cols-[360px_1fr] gap-4">
      <Panel title="Sample applicant">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setResult(evaluate(rules, input, type)); }}>
          <Field label="Application type" htmlFor="rt-type">
            <Select id="rt-type" value={type} onChange={(e) => setType(e.target.value as 'Fresh')}><option>Fresh</option><option>Renewal</option></Select>
          </Field>
          {attrs.map((c) => (
            <Field key={c.attribute} label={`${c.label ?? c.attribute}${c.unit ? ` (${c.unit === 'INR' ? '₹' : c.unit})` : ''}`} htmlFor={`rt-${c.attribute}`}>
              {c.operator === '=' && /^(yes|no)$/i.test(c.value) ? (
                <Select id={`rt-${c.attribute}`} value={input[c.attribute] ?? ''} onChange={(e) => setInput({ ...input, [c.attribute]: e.target.value })}><option value="">Select</option><option>Yes</option><option>No</option></Select>
              ) : (
                <Input id={`rt-${c.attribute}`} inputMode={NUMERIC.includes(c.operator) ? 'decimal' : undefined} value={input[c.attribute] ?? ''} onChange={(e) => setInput({ ...input, [c.attribute]: e.target.value.replace(/[₹,]/g, '') })} />
              )}
            </Field>
          ))}
          <Button type="submit" variant="primary">Check eligibility</Button>
        </form>
      </Panel>
      <Panel title="Result">
        {!result ? (
          <p className="text-sm text-ink-muted">Enter sample values and check eligibility. Each rule shows whether it passed, with the reason and its source clause.</p>
        ) : (
          <div className="space-y-3" data-testid="rule-result">
            <div className={cn('rounded-md border px-4 py-3', failed.length ? 'border-bad/30 bg-bad-soft' : 'border-ok/30 bg-ok-soft')}>
              <p className={cn('text-base font-semibold', failed.length ? 'text-bad' : 'text-ok')}>
                {failed.length ? `Ineligible: ${failed.map((f) => f.table.id).join(', ')}` : 'Eligible: all applicable rules pass'}
              </p>
              {failed.map((f) => (
                <p key={f.table.id} className="text-sm">
                  {f.failed.map((x) => `${x.c.label ?? x.c.attribute} ${x.value ? fmtValue(x.value, x.c.unit) : 'not entered'} does not satisfy ${x.c.operator} ${fmtValue(x.c.value, x.c.unit)}`).join('; ')}. Rule {f.table.id}, source{' '}
                  {f.table.refs.map((r) => <RefTag key={r} projectId={projectId} id={r} className="mx-0.5" />)}
                </p>
              ))}
            </div>
            <ul className="space-y-1.5">
              {result.map((r) => (
                <li key={r.table.id} className="flex items-center gap-2 text-sm">
                  {!r.applicable ? <span className="w-4" /> : r.pass ? <CheckCircle2 className="h-4 w-4 text-ok" aria-label="Pass" /> : <XCircle className="h-4 w-4 text-bad" aria-label="Fail" />}
                  <RefTag projectId={projectId} id={r.table.id} />
                  <span>{r.table.name}</span>
                  <span className="text-ink-muted">{!r.applicable ? 'Not applicable to fresh applications' : r.pass ? r.table.outcome : r.table.failOutcome}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
