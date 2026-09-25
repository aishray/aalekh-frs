'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Panel, Progress, Select, Tabs, td, th, type Tone } from '@/components/ui';
import { RefTag, Refs } from '@/components/RefTag';
import { ChangeView } from '@/components/doc/RequirementBlock';
import { complianceFor, coverageFor, qualityFor } from '@/lib/engine/quality';
import { applyChange } from '@/lib/engine/changes';
import { ensureDraft } from '@/lib/engine/versioning';
import { asmId, clauseById, normalizeRefs } from '@/lib/engine/model';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { compact, standardBlocks } from '@/lib/ai/context';
import type { Issue, Requirement, TrackedChange } from '@/lib/types';
import { cn, nowIso, uid } from '@/lib/util';

type FixOut = { title: string; description: string; actor: string; priority: Requirement['priority']; acceptanceCriteria: string[]; refs: string[]; module: string; rationale: string };
const sevTone: Record<string, Tone> = { High: 'bad', Medium: 'warn', Low: 'neutral' };
const FIXABLE: Issue['type'][] = ['Ambiguity', 'Untestable', 'Contradiction', 'Conflict', 'NoAcceptance', 'NoRefs'];
const DRAFTABLE: Issue['type'][] = ['Coverage', 'MissingException'];

export default function QualityPage() {
  const { project: p, update } = useCurrentProject();
  const review = useAiRun();
  const [tab, setTab] = useState<'issues' | 'coverage' | 'compliance'>('issues');
  const [filter, setFilter] = useState('open');
  const [fixing, setFixing] = useState<string | null>(null);
  const [na, setNa] = useState<{ clause: string; reason: string } | null>(null);
  const [dismiss, setDismiss] = useState<{ issue: Issue; note: string } | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const q = useMemo(() => qualityFor(p), [p]);
  const coverage = useMemo(() => coverageFor(p), [p]);
  const compliance = useMemo(() => complianceFor(p), [p]);

  if (!p.requirements.length)
    return (
      <div>
        <PageHeader title="Quality and compliance" subtitle="Deterministic checks run on every change; the full review adds semantic checks." />
        <Empty text="Generate the FRS first. Quality is measured on the requirements." action={<Link href={`/projects/${p.id}/document`}><Button variant="primary">Go to Document</Button></Link>} />
      </div>
    );

  const sevRank = { High: 0, Medium: 1, Low: 2 } as const;
  const issues = q.issues
    .filter((i) => (filter === 'open' ? i.status === 'Open' : filter === 'closed' ? i.status !== 'Open' : true))
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  const pendingFor = (issueId: string) => p.changes.filter((c) => c.issueId === issueId && c.status === 'Pending');

  async function runReview() {
    const out = await review.run(['Reading requirements and effective sources', 'Checking for conflicting and untestable requirements', 'Looking for missing exception flows', 'Checking requirements against effective clauses'], () =>
      runAi<{ issues: Omit<Issue, 'id' | 'category' | 'status' | 'source'>[] }>('review', p, {
        ...standardBlocks(p),
        MODEL: compact(p.requirements.map((r) => ({ id: r.id, title: r.title, text: r.description, ac: r.acceptanceCriteria, refs: r.refs }))),
      }),
    );
    if (!out) return;
    const ids = new Set(p.requirements.map((r) => r.id));
    const cat: Record<string, Issue['category']> = { Conflict: 'Clarity', Contradiction: 'Clarity', Untestable: 'Testability', MissingException: 'Completeness' };
    update('Ran full review', `${out.data.issues.length} findings`, (x) => {
      x.reviewIssues = [
        ...x.reviewIssues.filter((i) => !i.id.startsWith('REV-')),
        ...out.data.issues.map((i, n) => ({ ...i, id: `REV-${n + 1}`, targetIds: i.targetIds.filter((t) => ids.has(t)), category: cat[i.type] ?? 'Clarity', status: 'Open' as const, source: 'Review' as const })),
      ];
      for (const k of Object.keys(x.issueState)) if (k.startsWith('REV-')) delete x.issueState[k];
    });
    toast.success(out.data.issues.length ? `Full review found ${out.data.issues.length} semantic issue${out.data.issues.length > 1 ? 's' : ''}` : 'Full review found no semantic issues');
  }

  async function fix(i: Issue) {
    setFixing(i.id);
    setFixError(null);
    const draft = DRAFTABLE.includes(i.type);
    const target = draft ? undefined : p.requirements.find((r) => r.id === i.targetIds[0]);
    const clause = i.type === 'Coverage' ? clauseById(p, i.targetIds[0]) : undefined;
    try {
      const { data } = await runAi<FixOut>(
        'fix',
        p,
        {
          ...standardBlocks(p),
          MODEL: compact(p.requirements.filter((r) => i.targetIds.includes(r.id) || (target && r.module === target.module)).map((r) => ({ id: r.id, title: r.title, text: r.description, ac: r.acceptanceCriteria, refs: r.refs }))),
          INPUT: draft
            ? `Draft a new requirement. Issue: ${i.message}${clause ? `\nClause ${clause.clause.id}: ${clause.clause.english}` : ''}\nSuggestion: ${i.suggestion}`
            : `Fix requirement ${target?.id}. Issue: ${i.message} Suggestion: ${i.suggestion}\nCurrent: ${compact(target)}`,
        },
        i.id,
      );
      const refs = normalizeRefs(p, data.refs).kept;
      update(draft ? 'Drafted requirement for issue' : 'Proposed fix for issue', i.id, (x) => {
        const c: TrackedChange = draft
          ? { id: uid('chg'), targetId: 'NEW', kind: 'Add', status: 'Pending', createdAt: nowIso(), origin: 'Quality fix', issueId: i.id, reason: data.rationale, after: { title: data.title, description: data.description, actor: data.actor, priority: data.priority, acceptanceCriteria: data.acceptanceCriteria, refs, module: data.module, kind: data.module === 'NFR' ? 'NFR' : 'FR', origin: 'Generated' } }
          : { id: uid('chg'), targetId: target!.id, kind: 'Modify', status: 'Pending', createdAt: nowIso(), origin: 'Quality fix', issueId: i.id, reason: data.rationale, before: { title: target!.title, description: target!.description, acceptanceCriteria: target!.acceptanceCriteria, refs: target!.refs }, after: { title: data.title, description: data.description, acceptanceCriteria: data.acceptanceCriteria, refs: refs.length ? refs : target!.refs, priority: data.priority } };
        x.changes.push(c);
      });
    } catch (e) {
      setFixError((e as Error).message);
    } finally {
      setFixing(null);
    }
  }

  const decide = (c: TrackedChange, accept: boolean) =>
    update(accept ? 'Accepted tracked change' : 'Rejected tracked change', `${c.targetId}: ${c.reason}`, (x) => {
      const ch = x.changes.find((y) => y.id === c.id)!;
      if (accept) {
        ensureDraft(x);
        applyChange(x, ch);
        toast.success(ch.kind === 'Add' ? `${ch.targetId} added` : `${ch.targetId} updated`);
      } else ch.status = 'Rejected';
    });

  function actions(i: Issue) {
    if (i.status !== 'Open') return <Badge tone={i.status === 'Fixed' ? 'ok' : 'neutral'}>{i.status}</Badge>;
    const hasPending = pendingFor(i.id).length > 0;
    return (
      <div className="flex flex-wrap gap-1.5">
        {FIXABLE.includes(i.type) && i.targetIds[0]?.match(/^(FR|NFR|IR)-/) && <Button size="sm" variant="primary" onClick={() => fix(i)} loading={fixing === i.id} disabled={hasPending}>Fix</Button>}
        {DRAFTABLE.includes(i.type) && <Button size="sm" variant="primary" onClick={() => fix(i)} loading={fixing === i.id} disabled={hasPending}>Draft requirement</Button>}
        {i.type === 'Coverage' && <Button size="sm" onClick={() => setNa({ clause: i.targetIds[0], reason: '' })}>Mark not applicable</Button>}
        {i.type === 'Workflow' && <Link href={`/projects/${p.id}/workflow`}><Button size="sm">Open workflow</Button></Link>}
        {i.type === 'Permission' && <Link href={`/projects/${p.id}/roles`}><Button size="sm">Open roles</Button></Link>}
        {i.type === 'OutOfDate' && <Link href={`/projects/${p.id}/document#${i.targetIds[0]}`}><Button size="sm">Open in document</Button></Link>}
        {i.type === 'Compliance' && <Link href={`/projects/${p.id}/document#sec-nfr`}><Button size="sm">Open NFRs</Button></Link>}
        {i.type === 'OpenIssue' && <Link href={`/projects/${p.id}/reconcile`}><Button size="sm">Open reconciliation</Button></Link>}
        {i.type === 'Assumption' && (
          <Button size="sm" onClick={() => update('Confirmed assumption', i.targetIds[0], (x) => { const qq = x.questions.find((k) => asmId(k) === i.targetIds[0]); if (qq) qq.confirmed = true; })}>Confirm</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setDismiss({ issue: i, note: '' })}>Dismiss</Button>
      </div>
    );
  }

  const scoreTone = q.total >= 90 ? 'text-ok' : q.total >= 75 ? 'text-warn' : 'text-bad';
  return (
    <div>
      <PageHeader
        title="Quality and compliance"
        subtitle="Deterministic checks run on every change: ambiguity, acceptance criteria, references, coverage of every effective clause, workflow, permissions and compliance. The full review adds semantic checks by the AI engine."
        actions={<Button variant="primary" onClick={runReview} loading={review.busy}>Run full review</Button>}
      />
      {review.busy && <div className="mb-4 max-w-lg"><Progress stages={review.stages} current={review.stage} /></div>}
      {review.error && <div className="mb-4"><ErrorBox title="The full review could not run" message={`${review.error} Deterministic checks below are unaffected.`} /></div>}
      {fixError && <div className="mb-4"><ErrorBox title="The fix could not be proposed" message={fixError} /></div>}
      <div className="mb-4 grid grid-cols-[220px_1fr] gap-4">
        <div className="rounded-md border border-line bg-white px-5 py-4" data-testid="score" title="Computed in code from the open issues, not by the AI engine, so it is stable and explainable. Hover each part for its formula.">
          <p className="text-xs text-ink-muted">Quality score</p>
          <p className={cn('text-5xl font-semibold tabular-nums', scoreTone)} data-testid="score-total">{q.total}</p>
          <p className="text-xs text-ink-faint">out of 100, computed from issues</p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {q.parts.map((x) => (
            <div key={x.key} className="group relative rounded-md border border-line bg-white px-3 py-3" tabIndex={0} aria-describedby={`f-${x.key}`}>
              <p className="text-xs text-ink-muted">{x.label}</p>
              <p className="text-xl font-semibold tabular-nums">{x.value}<span className="text-sm font-normal text-ink-faint"> / {x.max}</span></p>
              <div className="mt-1.5 h-1.5 rounded bg-canvas"><div className={cn('h-1.5 rounded', x.value / x.max >= 0.9 ? 'bg-ok' : x.value / x.max >= 0.7 ? 'bg-warn' : 'bg-bad')} style={{ width: `${(100 * x.value) / x.max}%` }} /></div>
              <p className="mt-1 text-[11px] leading-tight text-ink-faint">{x.detail}</p>
              <div id={`f-${x.key}`} role="tooltip" className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-64 rounded border border-line bg-ink px-2.5 py-2 text-xs text-white shadow group-hover:block group-focus:block">{x.formula}</div>
            </div>
          ))}
        </div>
      </div>
      <Tabs
        tabs={[
          { id: 'issues', label: `Issues (${q.issues.filter((i) => i.status === 'Open').length} open)` },
          { id: 'coverage', label: `Coverage (${coverage.filter((c) => c.covered).length} of ${coverage.length})` },
          { id: 'compliance', label: `Compliance (${compliance.filter((c) => c.satisfied).length} of ${compliance.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'issues' && (
          <Panel
            title="Issues"
            actions={<Select aria-label="Issue filter" className="h-7 w-32 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="open">Open</option><option value="closed">Fixed or dismissed</option><option value="all">All</option></Select>}
            bodyClass="p-0"
          >
            {issues.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ok">{filter === 'open' ? 'No open issues. Every effective clause is covered and every requirement is testable and traced.' : 'None.'}</p>
            ) : (
              <table className="w-full" data-testid="issues">
                <thead><tr><th className={th + ' w-20'}>Severity</th><th className={th + ' w-32'}>Check</th><th className={th}>Issue</th><th className={th + ' w-56'}>Action</th></tr></thead>
                <tbody>
                  {issues.map((i) => (
                    <tr key={i.id} data-issue={i.id}>
                      <td className={td}><Badge tone={sevTone[i.severity]}>{i.severity}</Badge></td>
                      <td className={td}><div>{i.type === 'MissingException' ? 'Missing exception flow' : i.type === 'OutOfDate' ? 'Out of date' : i.type === 'NoAcceptance' ? 'No acceptance criteria' : i.type === 'InvalidRef' ? 'Invalid reference' : i.type === 'OpenIssue' ? 'Open issue' : i.type}</div><div className="text-[11px] text-ink-faint">{i.source === 'Review' ? 'Full review' : 'Rule check'} · {i.category}</div></td>
                      <td className={td}>
                        <p>{i.message}</p>
                        <p className="text-xs text-ink-muted">Suggestion: {i.suggestion}</p>
                        {i.targetIds.length > 0 && <div className="mt-1"><Refs projectId={p.id} refs={i.targetIds.filter((t) => !t.startsWith('WFV'))} /></div>}
                        {pendingFor(i.id).map((c) => <ChangeView key={c.id} c={c} req={p.requirements.find((r) => r.id === c.targetId)} onAccept={() => decide(c, true)} onReject={() => decide(c, false)} />)}
                      </td>
                      <td className={td}>{actions(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}
        {tab === 'coverage' && (
          <Panel title="Coverage of effective Mandate, Rule and Timeline clauses" subtitle="Superseded and overridden clauses are excluded; clauses marked not applicable count as covered with their reason." bodyClass="p-0">
            <table className="w-full">
              <thead><tr><th className={th}>Clause</th><th className={th}>Type</th><th className={th}>Text</th><th className={th}>Covered by</th></tr></thead>
              <tbody>
                {coverage.map((c) => (
                  <tr key={c.clauseId} className={c.covered ? undefined : 'bg-bad-soft/40'}>
                    <td className={td}><RefTag projectId={p.id} id={c.clauseId} /></td>
                    <td className={td}>{c.type}</td>
                    <td className={td}>{c.text}</td>
                    <td className={td}>{c.na ? <span className="text-xs">Not applicable: {c.na}</span> : c.by.length ? <Refs projectId={p.id} refs={c.by} /> : <Badge tone="bad">Not covered</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
        {tab === 'compliance' && (
          <Panel title="Compliance checklist for this project type" subtitle="An item is satisfied when a requirement cites the standard and addresses it. Edit checklists on the Standards page." bodyClass="p-0">
            <table className="w-full">
              <thead><tr><th className={th}>Item</th><th className={th}>Standard</th><th className={th}>Status</th><th className={th}>Satisfied by</th></tr></thead>
              <tbody>
                {compliance.map((c) => (
                  <tr key={c.id}>
                    <td className={td}>{c.title}{c.note && <div className="text-xs text-bad">{c.note}</div>}</td>
                    <td className={td}><RefTag projectId={p.id} id={c.std} /></td>
                    <td className={td}>{c.satisfied ? <Badge tone="ok">Satisfied</Badge> : <Badge tone="bad">Not satisfied</Badge>}</td>
                    <td className={td}>{c.by.length ? <Refs projectId={p.id} refs={c.by} /> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
      <Modal
        open={!!na}
        onClose={() => setNa(null)}
        title={`Mark ${na?.clause} not applicable`}
        footer={<><Button onClick={() => setNa(null)}>Cancel</Button><Button variant="primary" disabled={(na?.reason.trim().length ?? 0) < 10} onClick={() => { update('Marked clause not applicable', na!.clause, (x) => { for (const d of x.sources) for (const c of d.clauses) if (c.id === na!.clause) c.notApplicable = { reason: na!.reason.trim() }; }); setNa(null); }}>Mark not applicable</Button></>}
      >
        <p className="mb-2 text-sm">{na && clauseById(p, na.clause)?.clause.english}</p>
        <Field label="Reason" htmlFor="na-r" hint="At least 10 characters. Recorded in the traceability matrix."><Input id="na-r" value={na?.reason ?? ''} onChange={(e) => setNa((x) => x && { ...x, reason: e.target.value })} /></Field>
      </Modal>
      <Modal
        open={!!dismiss}
        onClose={() => setDismiss(null)}
        title="Dismiss issue"
        footer={<><Button onClick={() => setDismiss(null)}>Cancel</Button><Button variant="primary" disabled={!dismiss?.note.trim()} onClick={() => { update('Dismissed issue', dismiss!.issue.id, (x) => { x.issueState[dismiss!.issue.id] = { status: 'Dismissed', note: dismiss!.note.trim() }; }); setDismiss(null); }}>Dismiss</Button></>}
      >
        <p className="mb-2 text-sm">{dismiss?.issue.message}</p>
        <Field label="Reason for dismissing (recorded in the activity log)" htmlFor="dm-n"><Input id="dm-n" value={dismiss?.note ?? ''} onChange={(e) => setDismiss((x) => x && { ...x, note: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}
