'use client';

import type { Project, Requirement } from '@/lib/types';
import { Badge, td, th } from '@/components/ui';
import { RefTag, Refs, RefText } from '@/components/RefTag';
import { WorkflowDiagram } from '@/components/WorkflowDiagram';
import { assumptions, clauseState, coverageClauses } from '@/lib/engine/model';
import { fmtValue } from '@/lib/engine/rules';
import { branding, projectTypes } from '@/config/branding';
import { fmtDate } from '@/lib/util';

export function H({ id, n, children }: { id: string; n: string; children: React.ReactNode }) {
  return (
    <h2 id={`sec-${id}`} className="mb-2 mt-8 scroll-mt-28 border-b border-line pb-1 font-serif text-xl font-semibold text-ink first:mt-0">
      <span className="mr-2 text-ink-faint">{n}</span>
      {children}
    </h2>
  );
}

export function DocControl({ p }: { p: Project }) {
  const rows: [string, string][] = [
    ['Document', `Functional Requirements Specification: ${p.name}`],
    ['Department', `${p.department}, Government of ${branding.state}`],
    ['Prepared by', `${branding.directorate}`],
    ['File number', p.fileNo],
    ['Project type', projectTypes[p.type]],
    ['Version', `${p.version} (${p.status})`],
    ['Baseline', p.baseline ? `v${p.baseline.version}, approved by ${p.baseline.approvedBy} on ${fmtDate(p.baseline.approvedAt)}` : 'Not yet approved'],
  ];
  return (
    <div className="space-y-3">
      <table className="w-full font-sans text-sm">
        <tbody>{rows.map(([k, v]) => <tr key={k}><td className={td + ' w-44 text-ink-muted'}>{k}</td><td className={td}>{v}</td></tr>)}</tbody>
      </table>
      <p className="text-xs font-semibold text-ink-muted">Version history</p>
      <table className="w-full font-sans text-sm">
        <thead><tr><th className={th}>Version</th><th className={th}>Date</th><th className={th}>By</th><th className={th}>Description</th></tr></thead>
        <tbody>
          {p.versions.length === 0 ? (
            <tr><td className={td} colSpan={4}>v{p.version} working draft</td></tr>
          ) : (
            p.versions.map((v) => <tr key={v.version + v.createdAt}><td className={td}>v{v.version}</td><td className={td}>{fmtDate(v.createdAt)}</td><td className={td}>{v.by}</td><td className={td}>{v.label}</td></tr>)
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Narrative({ p, text }: { p: Project; text?: string }) {
  if (!text) return <p className="font-sans text-sm text-ink-faint">Not generated yet.</p>;
  return (
    <div className="space-y-3 font-serif text-[15px] leading-relaxed">
      {text.split(/\n\s*\n/).map((para, i) => <p key={i}><RefText projectId={p.id} text={para} /></p>)}
    </div>
  );
}

export function Stakeholders({ p }: { p: Project }) {
  const roles = p.discovery?.roles ?? [];
  if (!roles.length) return <p className="font-sans text-sm text-ink-faint">Run discovery to list stakeholders and roles.</p>;
  return (
    <table className="w-full font-sans text-sm">
      <thead><tr><th className={th}>Role</th><th className={th}>Responsibility</th><th className={th}>Jurisdiction</th><th className={th}>Source</th></tr></thead>
      <tbody>
        {roles.map((r) => (
          <tr key={r.name}>
            <td className={td + ' font-medium'}>{r.name}</td>
            <td className={td}>{r.description}</td>
            <td className={td}>{p.permissions?.roles.find((x) => x.name === r.name)?.jurisdiction ?? ''}</td>
            <td className={td}><Refs projectId={p.id} refs={r.refs} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WorkflowSection({ p }: { p: Project }) {
  const wf = p.workflow;
  if (!wf) return <p className="font-sans text-sm text-ink-faint">No workflow designed yet.</p>;
  const name = (id: string) => wf.states.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="space-y-3 font-sans">
      <div className="max-h-[420px] overflow-auto rounded border border-line p-2"><WorkflowDiagram wf={wf} /></div>
      <table className="w-full text-sm">
        <thead><tr><th className={th}>ID</th><th className={th}>From</th><th className={th}>Action (actor)</th><th className={th}>To</th><th className={th}>SLA</th><th className={th}>Escalation</th><th className={th}>Source</th></tr></thead>
        <tbody>
          {wf.transitions.map((t) => (
            <tr key={t.id}>
              <td className={td + ' font-mono text-xs'}>{t.id}</td>
              <td className={td}>{name(t.from)}</td>
              <td className={td}>{t.action} <span className="text-ink-muted">({t.actor})</span></td>
              <td className={td}>{name(t.to)}</td>
              <td className={td}>{t.slaDays != null ? `${t.slaDays} days` : ''}</td>
              <td className={td}>{t.escalation ? `${t.escalation.to} after ${t.escalation.afterDays} days` : ''}</td>
              <td className={td}><Refs projectId={p.id} refs={t.refs} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DataSection({ p }: { p: Project }) {
  if (!p.entities.length) return <p className="font-sans text-sm text-ink-faint">The data dictionary has not been built yet (Model, Data).</p>;
  return (
    <div className="space-y-3 font-sans">
      {p.entities.map((e) => (
        <div key={e.id}>
          <p className="mb-1 text-sm font-semibold">{e.name}</p>
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Field</th><th className={th}>Type</th><th className={th}>Mandatory</th><th className={th}>Validation</th><th className={th}>Source of value</th><th className={th}>PII</th></tr></thead>
            <tbody>
              {e.fields.map((f) => (
                <tr key={f.id}>
                  <td className={td}>{f.label}<div className="font-mono text-[11px] text-ink-faint">{f.id}</div></td>
                  <td className={td}>{f.type}{f.length ? `(${f.length})` : ''}</td>
                  <td className={td}>{f.mandatory ? 'Yes' : 'No'}</td>
                  <td className={td + ' text-xs'}>{f.validation}</td>
                  <td className={td}>{f.valueSource}{f.masterList ? ` (${f.masterList})` : ''}</td>
                  <td className={td}>{f.pii !== 'None' ? <Badge tone={f.pii === 'Aadhaar' || f.pii === 'Sensitive' ? 'bad' : 'warn'}>{f.pii}</Badge> : 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function RulesSection({ p }: { p: Project }) {
  if (!p.rules.length) return <p className="font-sans text-sm text-ink-faint">No decision tables yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 font-sans">
      {p.rules.map((r) => (
        <div key={r.id} className="rounded border border-line">
          <div className="flex items-center justify-between border-b border-line bg-canvas px-2.5 py-1.5 text-sm font-semibold"><span>{r.id} {r.name}{r.appliesTo === 'Renewal' ? ' (renewal)' : ''}</span><Refs projectId={p.id} refs={r.refs} /></div>
          <table className="w-full text-sm">
            <tbody>
              {r.conditions.map((c, i) => <tr key={i}><td className={td}>{c.label ?? c.attribute}</td><td className={td + ' w-12 text-center'}>{c.operator}</td><td className={td}>{fmtValue(c.value, c.unit)}</td></tr>)}
              <tr><td className={td + ' text-ok'} colSpan={3}>Then: {r.outcome}</td></tr>
              <tr><td className={td + ' text-bad'} colSpan={3}>Else: {r.failOutcome}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function PermissionsSection({ p }: { p: Project }) {
  const m = p.permissions;
  if (!m) return <p className="font-sans text-sm text-ink-faint">The role-permission matrix has not been built yet (Model, Roles).</p>;
  return (
    <div className="overflow-x-auto font-sans">
      <table className="w-full text-xs">
        <thead><tr><th className={th}>Action</th>{m.roles.map((r) => <th key={r.id} className={th + ' text-center'}>{r.name}<div className="font-normal">{r.jurisdiction}</div></th>)}</tr></thead>
        <tbody>
          {m.actions.map((a) => (
            <tr key={a}><td className={td}>{a}</td>{m.roles.map((r) => <td key={r.id} className={td + ' text-center'}>{m.grants[r.id]?.includes(a) ? 'Yes' : ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Assumptions({ p }: { p: Project }) {
  const a = assumptions(p);
  if (!a.length) return <p className="font-sans text-sm text-ink-faint">No assumptions recorded.</p>;
  return (
    <table className="w-full font-sans text-sm">
      <thead><tr><th className={th}>ID</th><th className={th}>Topic</th><th className={th}>Assumption</th><th className={th}>Status</th></tr></thead>
      <tbody>{a.map((x) => <tr key={x.id}><td className={td}><RefTag projectId={p.id} id={x.id} /></td><td className={td}>{x.q.topic}</td><td className={td}>{x.text}</td><td className={td}>{x.q.confirmed ? <Badge tone="ok">Confirmed</Badge> : <Badge tone="warn">To be confirmed</Badge>}</td></tr>)}</tbody>
    </table>
  );
}

export function OpenIssues({ p }: { p: Project }) {
  const deferred = p.reconciliations.filter((r) => r.resolution?.type === 'Deferred');
  if (!deferred.length) return <p className="font-sans text-sm text-ink-faint">No open issues.</p>;
  return (
    <table className="w-full font-sans text-sm">
      <thead><tr><th className={th}>ID</th><th className={th}>Issue</th><th className={th}>Clauses</th><th className={th}>Owner</th></tr></thead>
      <tbody>{deferred.map((r) => <tr key={r.id}><td className={td}><RefTag projectId={p.id} id={r.id} /></td><td className={td}>{r.description}</td><td className={td}><Refs projectId={p.id} refs={r.clauses} /></td><td className={td}>{p.department} Department</td></tr>)}</tbody>
    </table>
  );
}

export function Traceability({ p }: { p: Project }) {
  const clauses = coverageClauses(p);
  const all = p.sources.flatMap((d) => d.clauses).filter((c) => c.type !== 'Info');
  return (
    <table className="w-full font-sans text-sm" data-testid="traceability">
      <thead><tr><th className={th}>Clause</th><th className={th}>Type</th><th className={th}>Status</th><th className={th}>Requirements</th></tr></thead>
      <tbody>
        {all.map((c) => {
          const st = clauseState(p, c);
          const by = p.requirements.filter((r) => r.refs.includes(c.id)).map((r) => r.id);
          const must = clauses.some((x) => x.id === c.id);
          return (
            <tr key={c.id}>
              <td className={td}><RefTag projectId={p.id} id={c.id} /></td>
              <td className={td}>{c.type}</td>
              <td className={td}>{!st.effective ? <Badge>{st.reason === 'superseded' ? `Superseded by ${st.by}` : `Overridden by ${st.by}`}</Badge> : c.notApplicable ? <Badge>Not applicable: {c.notApplicable.reason}</Badge> : must ? (by.length ? <Badge tone="ok">Covered</Badge> : <Badge tone="bad">Not covered</Badge>) : <Badge>Context</Badge>}</td>
              <td className={td}>{by.length ? <span className="flex flex-wrap gap-1">{by.map((id) => <RefTag key={id} projectId={p.id} id={id} />)}</span> : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SignOff({ p }: { p: Project }) {
  const rows = [
    ['Prepared by', 'Ravi Kumar', 'Senior Systems Analyst, Directorate of IT'],
    ['Reviewed by', 'Anita Deshmukh', 'Joint Director (IT)'],
    ['Approved by', 'S. Raghavan', 'Director (IT)'],
    ['Accepted by', '', `Nodal officer, ${p.department} Department`],
  ];
  return (
    <table className="w-full font-sans text-sm">
      <thead><tr><th className={th}>Role</th><th className={th}>Name</th><th className={th}>Designation</th><th className={th}>Signature and date</th></tr></thead>
      <tbody>{rows.map(([a, b, c]) => <tr key={a}><td className={td}>{a}</td><td className={td}>{b}</td><td className={td}>{c}</td><td className={td + ' h-10'}>{a === 'Approved by' && p.baseline ? `Approved ${fmtDate(p.baseline.approvedAt)}` : ''}</td></tr>)}</tbody>
    </table>
  );
}

export function reqsFor(p: Project, pred: (r: Requirement) => boolean) {
  return p.requirements.filter(pred);
}
