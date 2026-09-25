'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { usePersona } from '@/lib/repo/store';
import { Badge, Button, Empty, ErrorBox, Field, Notice, PageHeader, Panel, Select, Textarea, td, th } from '@/components/ui';
import { RefTag } from '@/components/RefTag';
import { ChangeView } from '@/components/doc/RequirementBlock';
import { applyChange } from '@/lib/engine/changes';
import { diffRequirements, ensureDraft, snapshot } from '@/lib/engine/versioning';
import { qualityFor } from '@/lib/engine/quality';
import { normalizeRefs } from '@/lib/engine/model';
import { runAi } from '@/lib/ai/client';
import { compact, standardBlocks } from '@/lib/ai/context';
import { statusTone } from '@/lib/engine/status';
import type { Comment, ModelSnapshot, Note, Requirement, TrackedChange } from '@/lib/types';
import { fmtDateTime, nowIso, uid } from '@/lib/util';

export default function ReviewPage() {
  const { project: p, update } = useCurrentProject();
  const persona = usePersona();
  const [note, setNote] = useState('');
  const [proposing, setProposing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cmp, setCmp] = useState<string>('');
  const q = useMemo(() => (p.requirements.length ? qualityFor(p) : null), [p]);
  const openHigh = q?.issues.filter((i) => i.status === 'Open' && i.severity === 'High').length ?? 0;
  const pendingChanges = p.changes.filter((c) => c.status === 'Pending');

  const addNote = (x: typeof p, action: string, text: string) => {
    const n: Note = { id: uid('N'), by: persona.name, designation: persona.designation, at: nowIso(), text: text || action, action };
    x.notes.push(n);
  };

  function submit() {
    update('Submitted for review', `v${p.version}`, (x) => {
      x.status = 'In review';
      x.versions.push({ version: x.version, label: 'Submitted for review', createdAt: nowIso(), by: persona.name, snapshot: snapshot(x) });
      x.requirements.forEach((r) => r.status === 'Draft' && (r.status = 'Reviewed'));
      addNote(x, 'Submitted for review', note);
    });
    setNote('');
    toast.success('Submitted to the Joint Director (IT) for review');
  }

  function reviewer(action: 'Forwarded' | 'Changes requested' | 'Noted') {
    update(action === 'Noted' ? 'Added note' : action, `v${p.version}`, (x) => {
      if (action === 'Changes requested') x.status = 'Changes requested';
      addNote(x, action === 'Forwarded' ? 'Forwarded for approval' : action, note);
    });
    setNote('');
    toast.success(action === 'Forwarded' ? 'Forwarded to the Director (IT) for approval' : action === 'Changes requested' ? 'Returned to the author with changes requested' : 'Note added');
  }

  function approve() {
    update('Approved baseline', undefined, (x) => {
      const v = parseFloat(x.version) < 1 ? '1.0' : x.version;
      x.version = v;
      x.status = 'Approved';
      x.requirements.forEach((r) => (r.status = 'Approved'));
      x.baseline = { version: v, approvedBy: persona.name, approvedAt: nowIso(), snapshot: snapshot(x) };
      x.versions.push({ version: v, label: 'Approved baseline', createdAt: nowIso(), by: persona.name, snapshot: snapshot(x) });
      addNote(x, 'Approved', note || `Approved. The FRS v${v} is frozen as the baseline for the RFP and change control.`);
    });
    setNote('');
    toast.success('Approved. Baseline frozen; later edits create a new draft version.');
  }

  async function proposeFix(c: Comment) {
    const r = p.requirements.find((x) => x.id === c.reqId);
    if (!r) return;
    setProposing(c.id);
    setError(null);
    try {
      const { data } = await runAi<{ title: string; description: string; priority: Requirement['priority']; acceptanceCriteria: string[]; refs: string[]; rationale: string }>(
        'fix',
        p,
        { ...standardBlocks(p), INPUT: `Reviewer comment on ${r.id} by ${c.by}, ${c.designation}: "${c.text}"\nCurrent: ${compact(r)}` },
        `CMT-${r.id}`,
      );
      update('Proposed fix from comment', r.id, (x) => {
        const ch: TrackedChange = {
          id: uid('chg'), targetId: r.id, kind: 'Modify', status: 'Pending', createdAt: nowIso(), origin: `Reviewer comment (${c.by})`, reason: data.rationale,
          before: { title: r.title, description: r.description, acceptanceCriteria: r.acceptanceCriteria, refs: r.refs },
          after: { title: data.title, description: data.description, acceptanceCriteria: data.acceptanceCriteria, refs: normalizeRefs(x, data.refs).kept.length ? normalizeRefs(x, data.refs).kept : r.refs, priority: data.priority },
        };
        x.changes.push(ch);
      });
      toast.success('Fix proposed as a tracked change for the author');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProposing(null);
    }
  }

  const decide = (c: TrackedChange, accept: boolean) =>
    update(accept ? 'Accepted tracked change' : 'Rejected tracked change', c.targetId, (x) => {
      const ch = x.changes.find((y) => y.id === c.id)!;
      if (accept) {
        ensureDraft(x);
        applyChange(x, ch);
      } else ch.status = 'Rejected';
    });

  const base: ModelSnapshot | undefined = cmp === 'baseline' ? p.baseline?.snapshot : p.versions.find((v) => `${v.version}|${v.createdAt}` === cmp)?.snapshot;
  const diff = base ? diffRequirements(base.requirements, p.requirements) : null;

  const canSubmit = persona.role === 'Author' && (p.status === 'Draft' || p.status === 'Changes requested') && p.requirements.length > 0;
  const canReview = persona.role === 'Reviewer' && p.status === 'In review';
  const canApprove = persona.role === 'Approver' && p.status === 'In review';

  return (
    <div>
      <PageHeader title="Review and approval" subtitle="File noting in chronological order, comments on requirements, versions with differences, and approval, which freezes the baseline." />
      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <div className="space-y-4">
          <Panel title={<span className="flex items-center gap-2">Status <Badge tone={statusTone(p.status)}>{p.status}</Badge> <Badge>v{p.version}</Badge></span>} subtitle={`Acting as ${persona.name}, ${persona.designation}. Change persona from the top-right menu.`}>
            {p.requirements.length === 0 ? (
              <Empty text="Generate the FRS before submitting it for review." action={<Link href={`/projects/${p.id}/document`}><Button size="sm">Go to Document</Button></Link>} />
            ) : (
              <div className="space-y-3">
                {openHigh > 0 && (canSubmit || canApprove) && <Notice tone="warn">{openHigh} high-severity quality issue{openHigh > 1 ? 's are' : ' is'} open (score {q?.total}). <Link className="underline" href={`/projects/${p.id}/quality`}>Review them</Link> before {canApprove ? 'approving' : 'submitting'}.</Notice>}
                {pendingChanges.length > 0 && <Notice tone="warn">{pendingChanges.length} tracked change{pendingChanges.length > 1 ? 's are' : ' is'} pending a decision.</Notice>}
                {(canSubmit || canReview || canApprove) && (
                  <Field label="Note for the file" htmlFor="rv-note">
                    <Textarea id="rv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={canApprove ? 'Approved.' : canReview ? 'Reviewed. The workflow and eligibility rules are consistent with the GO.' : 'Draft FRS submitted for review. All GO clauses are covered.'} />
                  </Field>
                )}
                <div className="flex flex-wrap gap-2">
                  {canSubmit && <Button variant="primary" onClick={submit}>Submit for review</Button>}
                  {canReview && (
                    <>
                      <Button variant="primary" onClick={() => reviewer('Forwarded')}>Forward to Director (IT)</Button>
                      <Button variant="danger" onClick={() => reviewer('Changes requested')}>Request changes</Button>
                      <Button onClick={() => reviewer('Noted')} disabled={!note.trim()}>Add note only</Button>
                    </>
                  )}
                  {canApprove && <Button variant="success" onClick={approve}>Approve and freeze baseline</Button>}
                </div>
                {!canSubmit && !canReview && !canApprove && (
                  <p className="text-sm text-ink-muted">
                    {p.status === 'Approved'
                      ? `Approved baseline v${p.baseline?.version}. Corrigenda and vendor change requests are assessed on the Changes page.`
                      : p.status === 'In review'
                        ? `Awaiting action by the ${persona.role === 'Author' ? 'Reviewer or Approver' : persona.role === 'Reviewer' ? 'Approver' : 'Reviewer'}. Switch persona to act.`
                        : 'The author submits the draft for review. Switch persona to Author to act.'}
                  </p>
                )}
              </div>
            )}
          </Panel>
          <Panel title={`Comments on requirements (${p.comments.filter((c) => !c.resolved).length} open)`} bodyClass="p-0">
            {error && <div className="p-3"><ErrorBox title="Could not propose a fix" message={error} /></div>}
            {p.comments.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-muted">No comments. Reviewers comment on a requirement from the Document page.</p>
            ) : (
              <ul>
                {p.comments.map((c) => {
                  const pend = p.changes.filter((x) => x.status === 'Pending' && x.targetId === c.reqId && x.origin.startsWith('Reviewer'));
                  return (
                    <li key={c.id} className="border-b border-line px-4 py-3 last:border-0">
                      <div className="flex items-center gap-2 text-sm">
                        <RefTag projectId={p.id} id={c.reqId} />
                        <span className="font-medium">{c.by}</span>
                        <span className="text-xs text-ink-faint">{c.designation} · {fmtDateTime(c.at)}</span>
                        {c.resolved && <Badge tone="ok">Resolved</Badge>}
                      </div>
                      <p className="mt-1 text-sm">{c.text}</p>
                      {!c.resolved && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => proposeFix(c)} loading={proposing === c.id} disabled={pend.length > 0}>Propose fix</Button>
                          <Button size="sm" variant="ghost" onClick={() => update('Resolved comment', c.reqId, (x) => { x.comments.find((y) => y.id === c.id)!.resolved = true; })}>Mark resolved</Button>
                          <Link href={`/projects/${p.id}/document#${c.reqId}`}><Button size="sm" variant="ghost">Open requirement</Button></Link>
                        </div>
                      )}
                      {pend.map((ch) => <ChangeView key={ch.id} c={ch} req={p.requirements.find((r) => r.id === ch.targetId)} onAccept={() => decide(ch, true)} onReject={() => decide(ch, false)} canDecide={persona.role === 'Author'} />)}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Versions and differences" bodyClass="p-0">
            {p.versions.length === 0 && !p.baseline ? (
              <p className="px-4 py-4 text-sm text-ink-muted">A version is recorded each time the FRS is submitted or approved.</p>
            ) : (
              <>
                <table className="w-full">
                  <thead><tr><th className={th}>Version</th><th className={th}>Event</th><th className={th}>By</th><th className={th}>Date</th><th className={th + ' text-right'}>Requirements</th></tr></thead>
                  <tbody>
                    {p.versions.map((v) => <tr key={v.version + v.createdAt}><td className={td}>v{v.version}</td><td className={td}>{v.label}</td><td className={td}>{v.by}</td><td className={td + ' text-xs'}>{fmtDateTime(v.createdAt)}</td><td className={td + ' text-right'}>{v.snapshot.requirements.length}</td></tr>)}
                  </tbody>
                </table>
                <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
                  <label htmlFor="cmp" className="text-xs text-ink-muted">Compare the current draft with</label>
                  <Select id="cmp" className="h-7 w-64 text-xs" value={cmp} onChange={(e) => setCmp(e.target.value)}>
                    <option value="">Select a version</option>
                    {p.baseline && <option value="baseline">Baseline v{p.baseline.version}</option>}
                    {p.versions.map((v) => <option key={v.version + v.createdAt} value={`${v.version}|${v.createdAt}`}>v{v.version}: {v.label}</option>)}
                  </Select>
                </div>
                {diff && base && (
                  <div className="space-y-2 border-t border-line px-4 py-3 text-sm" data-testid="diff">
                    <p><Badge tone="ok">{diff.added.length} added</Badge> <Badge tone="warn">{diff.modified.length} modified</Badge> <Badge tone="bad">{diff.removed.length} removed</Badge></p>
                    {diff.added.length > 0 && <p>Added: {diff.added.join(', ')}</p>}
                    {diff.modified.length > 0 && <p>Modified: {diff.modified.join(', ')}</p>}
                    {diff.removed.length > 0 && <p>Removed: {diff.removed.join(', ')}</p>}
                    <p className="text-xs text-ink-muted">
                      Model: workflow transitions {base.workflow?.transitions.length ?? 0} to {p.workflow?.transitions.length ?? 0}; decision tables {base.rules.length} to {p.rules.length}; sources {base.sources.length} to {p.sources.length}; SLA changes{' '}
                      {(p.workflow?.transitions ?? []).filter((t) => base.workflow?.transitions.find((b) => b.id === t.id && b.slaDays !== t.slaDays)).map((t) => t.id).join(', ') || 'none'}.
                    </p>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
        <Panel title="File noting" subtitle="Chronological, with name, designation and time" className="self-start" bodyClass="bg-noting p-0">
          {p.notes.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-muted">No notes yet. Notes are recorded when the FRS is submitted, reviewed or approved.</p>
          ) : (
            <ol data-testid="noting">
              {p.notes.map((n, i) => (
                <li key={n.id} className="border-b border-line/70 px-4 py-3 font-serif last:border-0">
                  <p className="text-[15px] leading-relaxed"><span className="mr-2 font-sans text-xs text-ink-faint">{i + 1}.</span>{n.text}</p>
                  <p className="mt-1.5 text-right font-sans text-xs">
                    <span className="font-semibold">{n.by}</span>, {n.designation}
                    <br />
                    <span className="text-ink-faint">{fmtDateTime(n.at)}{n.action ? ` · ${n.action}` : ''}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
