'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Button, Empty, ErrorBox, Input, Notice, PageHeader, Panel, Tabs, td, th } from '@/components/ui';
import { RefTag, Refs } from '@/components/RefTag';
import { uatTests } from '@/lib/engine/uat';
import { DEFAULT_WEIGHTS, screenInventory, sizeEstimate } from '@/lib/engine/deliverables';
import { uatWorkbook } from '@/lib/export/excel';
import { rfpDocx } from '@/lib/export/rfp';
import { sortRequirements } from '@/lib/engine/generate';
import { moduleName } from '@/lib/generate/run';
import { download } from '@/lib/util';

const labels: Record<string, string> = { screens: 'Screens', entities: 'Data entities', integrations: 'Integrations', reports: 'Reports', transitions: 'Workflow transitions' };

export default function DeliverablesPage() {
  const { project: p, update } = useCurrentProject();
  const [tab, setTab] = useState<'uat' | 'rfp' | 'screens' | 'estimate'>('uat');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tests = useMemo(() => uatTests(p), [p]);
  const screens = useMemo(() => screenInventory(p), [p]);
  const est = useMemo(() => sizeEstimate(p, p.estimateWeights), [p]);
  const slug = `${p.fileNo.replace(/\//g, '-')}-v${p.version}`;

  async function go(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (!p.requirements.length)
    return (
      <div>
        <PageHeader title="Deliverables" />
        <Empty text="Generate the FRS first. Test cases, the RFP annexure, screens and the size estimate are derived from it." action={<Link href={`/projects/${p.id}/document`}><Button variant="primary">Go to Document</Button></Link>} />
      </div>
    );

  const setWeight = (k: string, v: number) => update('Changed estimate weight', `${k} = ${v}`, (x) => { x.estimateWeights = { ...DEFAULT_WEIGHTS, ...x.estimateWeights, [k]: v }; });
  const fr = sortRequirements(p.requirements);

  return (
    <div>
      <PageHeader title="Downstream deliverables" subtitle="Generated from the same model as the FRS, so test cases, RFP scope and estimates stay consistent with it." />
      {error && <div className="mb-4"><ErrorBox title="Export failed" message={error} /></div>}
      <Tabs tabs={[{ id: 'uat', label: `UAT test cases (${tests.length})` }, { id: 'rfp', label: 'RFP scope annexure' }, { id: 'screens', label: `Screen inventory (${screens.length})` }, { id: 'estimate', label: 'Indicative size estimate' }]} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'uat' && (
          <Panel title="UAT test cases" subtitle="From acceptance criteria, decision-table boundaries, and workflow paths (happy path, rejection, return for correction, payment failure, SLA escalation)" actions={<Button size="sm" onClick={() => go('uat', async () => download(`UAT-${slug}.xlsx`, await uatWorkbook(p)))} loading={busy === 'uat'}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />Export to Excel</Button>} bodyClass="p-0">
            <div className="max-h-[640px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0"><tr><th className={th}>TC ID</th><th className={th}>Req</th><th className={th}>Precondition</th><th className={th}>Steps</th><th className={th}>Test data</th><th className={th}>Expected result</th></tr></thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t.id}>
                      <td className={td + ' whitespace-nowrap font-mono text-xs'}>{t.id}</td>
                      <td className={td + ' text-xs'}>{t.reqId.includes(',') ? t.reqId : <RefTag projectId={p.id} id={t.reqId} />}</td>
                      <td className={td + ' text-xs'}>{t.precondition}</td>
                      <td className={td + ' text-xs'}><ol className="list-decimal pl-4">{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></td>
                      <td className={td + ' text-xs'}>{Object.entries(t.data).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</td>
                      <td className={td + ' text-xs'}>{t.expected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        {tab === 'rfp' && (
          <Panel title="RFP scope annexure" subtitle="Scope of work, the functional requirements table, service levels from the NFRs, deliverables and acceptance, and assumptions" actions={<Button size="sm" variant="primary" onClick={() => go('rfp', async () => download(`RFP-annexure-${slug}.docx`, await rfpDocx(p)))} loading={busy === 'rfp'}><FileText className="h-3.5 w-3.5" aria-hidden />Export to Word</Button>}>
            <p className="mb-3 text-sm text-ink-muted">RFPs are often written separately from the FRS and drift from it. This annexure is generated from the same requirements, so the vendor contracts for exactly what was approved.</p>
            <table className="w-full">
              <thead><tr><th className={th}>Module</th><th className={th + ' text-right'}>Requirements</th><th className={th}>Examples</th></tr></thead>
              <tbody>
                {Array.from(new Set(fr.map((r) => r.module))).map((m) => {
                  const list = fr.filter((r) => r.module === m);
                  return <tr key={m}><td className={td}>{moduleName(m)}</td><td className={td + ' text-right tabular-nums'}>{list.length}</td><td className={td + ' text-xs text-ink-muted'}>{list.slice(0, 3).map((r) => r.title).join('; ')}</td></tr>;
                })}
              </tbody>
            </table>
          </Panel>
        )}
        {tab === 'screens' && (
          <Panel title="Screen inventory" subtitle="Derived from roles, workflow actions, data entities, reports and masters, with the requirements each screen serves" bodyClass="p-0">
            <table className="w-full">
              <thead><tr><th className={th}>ID</th><th className={th}>Role</th><th className={th}>Screen</th><th className={th}>Purpose</th><th className={th}>Serves</th></tr></thead>
              <tbody>
                {screens.map((s) => <tr key={s.id}><td className={td + ' font-mono text-xs'}>{s.id}</td><td className={td}>{s.role}</td><td className={td + ' font-medium'}>{s.name}</td><td className={td + ' text-xs'}>{s.purpose}</td><td className={td}>{s.reqs.length ? <Refs projectId={p.id} refs={s.reqs.slice(0, 8)} /> : <span className="text-xs text-ink-faint">None</span>}{s.reqs.length > 8 && <span className="text-xs text-ink-faint"> and {s.reqs.length - 8} more</span>}</td></tr>)}
              </tbody>
            </table>
          </Panel>
        )}
        {tab === 'estimate' && (
          <div className="grid grid-cols-[1.3fr_1fr] gap-4">
            <Panel title="Counting method" subtitle="Edit the weights to match the Directorate's past projects" bodyClass="p-0">
              <table className="w-full">
                <thead><tr><th className={th}>Item</th><th className={th + ' text-right'}>Count</th><th className={th + ' w-28'}>Weight (points)</th><th className={th + ' text-right'}>Points</th></tr></thead>
                <tbody>
                  {est.rows.map((r) => (
                    <tr key={r.key}>
                      <td className={td}>{labels[r.key]}</td>
                      <td className={td + ' text-right tabular-nums'}>{r.count}</td>
                      <td className={td}><Input aria-label={`${labels[r.key]} weight`} type="number" min={0} className="h-7 text-xs" value={r.weight} onChange={(e) => setWeight(r.key, Number(e.target.value) || 0)} /></td>
                      <td className={td + ' text-right tabular-nums'}>{r.points}</td>
                    </tr>
                  ))}
                  <tr><td className={td + ' font-semibold'} colSpan={3}>Complexity points</td><td className={td + ' text-right font-semibold tabular-nums'}>{est.points}</td></tr>
                  <tr>
                    <td className={td} colSpan={2}>Productivity (points per person-month)</td>
                    <td className={td}><Input aria-label="Productivity" type="number" min={1} className="h-7 text-xs" value={est.productivity} onChange={(e) => setWeight('productivity', Math.max(1, Number(e.target.value) || 1))} /></td>
                    <td className={td}></td>
                  </tr>
                </tbody>
              </table>
            </Panel>
            <div className="space-y-3">
              <div className="rounded-md border border-line bg-white px-5 py-4">
                <p className="text-xs text-ink-muted">Indicative effort</p>
                <p className="text-3xl font-semibold tabular-nums">{est.low} to {est.high} <span className="text-base font-normal text-ink-muted">person-months</span></p>
                <p className="mt-1 text-xs text-ink-faint">Points divided by productivity, with a range of minus 20% to plus 25%.</p>
              </div>
              <Notice tone="warn"><strong>Indicative, for planning only.</strong> This is not a quote or a cost estimate for tendering. It helps judge the order of magnitude and compare change requests against the baseline.</Notice>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
