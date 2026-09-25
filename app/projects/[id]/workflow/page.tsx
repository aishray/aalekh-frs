'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Panel, Progress, Select, Textarea, td, th } from '@/components/ui';
import { Refs, RefTag } from '@/components/RefTag';
import { WorkflowDiagram } from '@/components/WorkflowDiagram';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { compact, standardBlocks } from '@/lib/ai/context';
import { normalizeRefs, unresolvedFindings } from '@/lib/engine/model';
import { CLOCK_PAUSED_ACTORS, rtsCheck, validateWorkflow } from '@/lib/engine/workflow';
import { outOfDate } from '@/lib/engine/quality';
import type { WfTransition, Workflow } from '@/lib/types';
import { cn, nextId, nowIso } from '@/lib/util';

type Proposal = Omit<Workflow, 'transitions'> & { transitions: (Omit<WfTransition, 'id' | 'slaDays' | 'escalation' | 'notification'> & { slaDays: number | null; escalation: WfTransition['escalation'] | null; notification: WfTransition['notification'] | null })[] };

export default function WorkflowPage() {
  const { project: p, update } = useCurrentProject();
  const ai = useAiRun();
  const [edit, setEdit] = useState<WfTransition | null>(null);
  const [stateEdit, setStateEdit] = useState(false);
  const wf = p.workflow;
  const findings = useMemo(() => (wf ? validateWorkflow(wf) : []), [wf]);
  const rts = useMemo(() => (wf ? rtsCheck(wf) : null), [wf]);
  const blocked = !p.reconciledAt || unresolvedFindings(p).length > 0;
  const stale = p.requirements.filter((r) => r.origin === 'FromModel' && r.refs.some((x) => x.startsWith('WF-T')) && outOfDate(p, r).length > 0);

  async function propose() {
    const out = await ai.run(['Reading timelines, roles and resolutions', 'Laying out states and transitions', 'Assigning actors, SLAs and escalations', 'Adding notifications for every stage'], () =>
      runAi<Proposal>('workflow', p, { ...standardBlocks(p), MODEL: compact({ roles: p.discovery?.roles.map((r) => r.name), rules: p.rules.map((r) => ({ id: r.id, name: r.name })) }) }),
    );
    if (!out) return;
    const d = out.data;
    update(wf ? 'Replaced workflow with AI proposal' : 'Proposed workflow', `${d.states.length} states, ${d.transitions.length} transitions`, (x) => {
      x.workflow = {
        states: d.states,
        rtsDays: d.rtsDays ?? undefined,
        rtsRef: d.rtsRef ?? undefined,
        transitions: d.transitions.map((t, i) => ({
          ...t,
          id: `WF-T${i + 1}`,
          slaDays: t.slaDays ?? undefined,
          escalation: t.escalation ?? undefined,
          notification: t.notification ?? undefined,
          refs: normalizeRefs(x, t.refs).kept,
          conditions: normalizeRefs(x, t.conditions, { forward: true }).kept,
        })),
      };
      const at = nowIso();
      x.workflow.transitions.forEach((t) => (x.stamps[t.id] = at));
    });
    toast.success('Workflow proposed. Review the SLAs and the Right to Service check.');
  }

  function saveTransition(t: WfTransition) {
    update(edit?.id ? 'Edited workflow transition' : 'Added workflow transition', `${t.id} ${t.action}`, (x) => {
      const w = x.workflow!;
      const i = w.transitions.findIndex((y) => y.id === t.id);
      if (i >= 0) w.transitions[i] = t;
      else w.transitions.push(t);
      x.stamps[t.id] = nowIso();
    });
    setEdit(null);
  }

  const nameOf = (id: string) => wf?.states.find((s) => s.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Workflow designer"
        subtitle="The application lifecycle as an explicit state machine with actors, conditions, SLAs, escalations and notifications. Requirements for verification actions, notifications and escalations are generated from this model."
        actions={
          <>
            {wf && <Button onClick={() => setEdit({ id: nextId(wf.transitions.map((t) => t.id), 'WF-T'), from: wf.states[0].id, to: wf.states[1]?.id ?? wf.states[0].id, action: '', actor: '', conditions: [], refs: [] })}><Plus className="h-4 w-4" aria-hidden />Add transition</Button>}
            <Button variant={wf ? 'secondary' : 'primary'} onClick={propose} loading={ai.busy} disabled={blocked}>{wf ? 'Propose again' : 'Propose workflow'}</Button>
          </>
        }
      />
      {blocked && <Notice tone="warn" className="mb-4">Resolve reconciliation findings first, so the workflow uses the effective timelines. <Link className="underline" href={`/projects/${p.id}/reconcile`}>Go to Reconcile</Link></Notice>}
      {ai.busy && <div className="mb-4 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <div className="mb-4"><ErrorBox title="The workflow could not be proposed" message={ai.error} action={<Button size="sm" onClick={propose}>Try again</Button>} /></div>}
      {!wf && !ai.busy ? (
        !blocked && <Empty text="No workflow yet. The AI engine proposes one from the sources, answers and resolutions; you then edit it." action={<Button variant="primary" onClick={propose}>Propose workflow</Button>} />
      ) : wf ? (
        <div className="space-y-4">
          {rts && (
            <div data-testid="rts" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3', rts.ok ? 'border-ok/30 bg-ok-soft' : 'border-bad/30 bg-bad-soft')}>
              <div>
                <p className={cn('text-sm font-semibold', rts.ok ? 'text-ok' : 'text-bad')}>Right to Service check: {rts.message}</p>
                <p className="text-xs text-ink-muted">
                  Longest path {rts.from} to {rts.to}: {rts.path.map((t) => `${t.id} (${CLOCK_PAUSED_ACTORS.includes(t.actor) ? 'with applicant, clock paused' : `${t.slaDays ?? 0}d`})`).join(' + ') || 'none'}.
                  Time with the applicant is excluded from the clock.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="rts-days" className="text-xs text-ink-muted">Notified timeline</label>
                <Input id="rts-days" type="number" min={1} className="h-7 !w-16" value={wf.rtsDays ?? ''} onChange={(e) => update('Changed notified RTS timeline', e.target.value, (x) => { x.workflow!.rtsDays = e.target.value ? +e.target.value : undefined; })} />
                <span className="text-xs text-ink-muted">working days</span>
                {wf.rtsRef && <RefTag projectId={p.id} id={wf.rtsRef} />}
              </div>
            </div>
          )}
          {stale.length > 0 && <Notice tone="warn">{stale.length} requirement{stale.length > 1 ? 's' : ''} generated from this workflow are out of date. <Link href={`/projects/${p.id}/document`} className="underline">Regenerate in Document</Link></Notice>}
          <Panel title="Validation" subtitle="Checked on every change" bodyClass={findings.length ? 'p-0' : undefined}>
            {findings.length === 0 ? (
              <p className="text-sm text-ok">Every non-terminal state has an exit, every state is reachable from Draft, every officer action has an SLA, and every rejection notifies the reason.</p>
            ) : (
              <ul data-testid="wf-findings">
                {findings.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 border-b border-line px-4 py-2 text-sm last:border-0">
                    <Badge tone={f.severity === 'High' ? 'bad' : 'warn'}>{f.severity}</Badge>
                    {f.message}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="State diagram" actions={<Button size="sm" onClick={() => setStateEdit(true)}>Edit states</Button>}>
            <WorkflowDiagram wf={wf} highlight={rts && !rts.ok ? rts.path.map((t) => t.from) : []} />
          </Panel>
          <Panel title={`Transitions (${wf.transitions.length})`} bodyClass="p-0">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>ID</th><th className={th}>From and to</th><th className={th}>Action and actor</th><th className={th}>SLA</th><th className={th}>Escalation</th><th className={th}>Notification</th><th className={th}>Refs</th><th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {wf.transitions.map((t) => (
                  <tr key={t.id} data-transition={t.id}>
                    <td className={td}><RefTag projectId={p.id} id={t.id} /></td>
                    <td className={td + ' text-xs'}>{nameOf(t.from)}<div className="text-ink-faint">to {nameOf(t.to)}</div></td>
                    <td className={td}><div className="font-medium">{t.action}</div><div className="text-xs text-ink-muted">{t.actor}</div>{t.conditions.length > 0 && <div className="mt-0.5"><Refs projectId={p.id} refs={t.conditions} /></div>}</td>
                    <td className={td + ' tabular-nums'}>{t.slaDays != null ? `${t.slaDays} days` : <span className="text-ink-faint">None</span>}</td>
                    <td className={td + ' text-xs'}>{t.escalation ? `To ${t.escalation.to} after ${t.escalation.afterDays} days` : <span className="text-ink-faint">None</span>}</td>
                    <td className={td + ' max-w-[260px] text-xs'}>{t.notification ? <><Badge>{t.notification.channel}</Badge> <span className="text-ink-muted">to {t.notification.recipient}:</span> {t.notification.template}</> : <span className="text-ink-faint">None</span>}</td>
                    <td className={td}><Refs projectId={p.id} refs={t.refs} /></td>
                    <td className={td}>
                      <button onClick={() => setEdit(t)} className="rounded p-1 text-ink-muted hover:bg-canvas" aria-label={`Edit ${t.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      ) : null}
      {edit && wf && <TransitionEditor wf={wf} t={edit} onClose={() => setEdit(null)} onSave={saveTransition} onDelete={(id) => { update('Deleted workflow transition', id, (x) => { x.workflow!.transitions = x.workflow!.transitions.filter((y) => y.id !== id); x.stamps[id] = nowIso(); }); setEdit(null); }} />}
      {stateEdit && wf && <StatesEditor wf={wf} onClose={() => setStateEdit(false)} onSave={(states) => { update('Edited workflow states', `${states.length} states`, (x) => { x.workflow!.states = states; }); setStateEdit(false); }} />}
    </div>
  );
}

function TransitionEditor({ wf, t, onClose, onSave, onDelete }: { wf: Workflow; t: WfTransition; onClose: () => void; onSave: (t: WfTransition) => void; onDelete: (id: string) => void }) {
  const [v, setV] = useState<WfTransition>(structuredClone(t));
  const exists = wf.transitions.some((x) => x.id === t.id);
  const set = (patch: Partial<WfTransition>) => setV((x) => ({ ...x, ...patch }));
  return (
    <Modal
      open
      onClose={onClose}
      title={`${exists ? 'Edit' : 'Add'} transition ${t.id}`}
      wide
      footer={
        <>
          {exists && <Button variant="danger" onClick={() => onDelete(t.id)} className="mr-auto"><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!v.action.trim() || !v.actor.trim()} onClick={() => onSave(v)}>Save transition</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="From state" htmlFor="t-from"><Select id="t-from" value={v.from} onChange={(e) => set({ from: e.target.value })}>{wf.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="To state" htmlFor="t-to"><Select id="t-to" value={v.to} onChange={(e) => set({ to: e.target.value })}>{wf.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Action" htmlFor="t-action"><Input id="t-action" value={v.action} onChange={(e) => set({ action: e.target.value })} /></Field>
        <Field label="Actor role" htmlFor="t-actor" hint="Use System for automatic steps and Applicant for applicant actions."><Input id="t-actor" value={v.actor} onChange={(e) => set({ actor: e.target.value })} /></Field>
        <Field label="SLA (working days)" htmlFor="t-sla"><Input id="t-sla" type="number" min={0} value={v.slaDays ?? ''} onChange={(e) => set({ slaDays: e.target.value === '' ? undefined : +e.target.value })} /></Field>
        <Field label="Conditions (rule IDs, comma separated)" htmlFor="t-cond"><Input id="t-cond" value={v.conditions.join(', ')} onChange={(e) => set({ conditions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
        <Field label="Escalate to" htmlFor="t-esc-to"><Input id="t-esc-to" value={v.escalation?.to ?? ''} onChange={(e) => set({ escalation: e.target.value ? { to: e.target.value, afterDays: v.escalation?.afterDays ?? v.slaDays ?? 1 } : undefined })} placeholder="No escalation" /></Field>
        <Field label="Escalate after (days)" htmlFor="t-esc-days"><Input id="t-esc-days" type="number" min={1} disabled={!v.escalation} value={v.escalation?.afterDays ?? ''} onChange={(e) => v.escalation && set({ escalation: { ...v.escalation, afterDays: +e.target.value } })} /></Field>
        <Field label="Notification channel" htmlFor="t-ch">
          <Select id="t-ch" value={v.notification?.channel ?? ''} onChange={(e) => set({ notification: e.target.value ? { channel: e.target.value as 'SMS', recipient: v.notification?.recipient ?? 'Applicant', template: v.notification?.template ?? '' } : undefined })}>
            <option value="">No notification</option><option>SMS</option><option>Email</option><option>In-app</option>
          </Select>
        </Field>
        <Field label="Recipient" htmlFor="t-rcp"><Input id="t-rcp" disabled={!v.notification} value={v.notification?.recipient ?? ''} onChange={(e) => v.notification && set({ notification: { ...v.notification, recipient: e.target.value } })} /></Field>
        <Field label="Message template" htmlFor="t-tpl" className="col-span-2" hint="Use {no}, {reason}, {date}. Every rejection must include {reason}."><Textarea id="t-tpl" rows={2} disabled={!v.notification} value={v.notification?.template ?? ''} onChange={(e) => v.notification && set({ notification: { ...v.notification, template: e.target.value } })} /></Field>
        <Field label="Refs (comma separated)" htmlFor="t-refs" className="col-span-2"><Input id="t-refs" value={v.refs.join(', ')} onChange={(e) => set({ refs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
      </div>
    </Modal>
  );
}

function StatesEditor({ wf, onClose, onSave }: { wf: Workflow; onClose: () => void; onSave: (s: Workflow['states']) => void }) {
  const [states, setStates] = useState(structuredClone(wf.states));
  const used = new Set(wf.transitions.flatMap((t) => [t.from, t.to]));
  return (
    <Modal open onClose={onClose} title="Edit states" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(states.filter((s) => s.name.trim()))}>Save states</Button></>}>
      <table className="w-full">
        <thead><tr><th className={th}>Name</th><th className={th}>Terminal</th><th className={th}></th></tr></thead>
        <tbody>
          {states.map((s, i) => (
            <tr key={s.id}>
              <td className={td}><Input aria-label={`State ${i + 1} name`} value={s.name} onChange={(e) => setStates((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} /></td>
              <td className={td}><input type="checkbox" aria-label={`${s.name} is terminal`} checked={s.terminal} onChange={(e) => setStates((x) => x.map((y, j) => (j === i ? { ...y, terminal: e.target.checked } : y)))} /></td>
              <td className={td}>
                <button disabled={used.has(s.id)} title={used.has(s.id) ? 'Used by a transition' : 'Remove state'} onClick={() => setStates((x) => x.filter((_, j) => j !== i))} className="rounded p-1 text-ink-muted hover:bg-canvas disabled:opacity-30" aria-label={`Remove ${s.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button size="sm" className="mt-2" onClick={() => setStates((x) => [...x, { id: `s${Date.now().toString(36)}`, name: 'New state', terminal: false }])}><Plus className="h-3.5 w-3.5" aria-hidden />Add state</Button>
    </Modal>
  );
}
