'use client';

import { useState } from 'react';
import { Pencil, Check, X, MessageSquare } from 'lucide-react';
import type { Project, Requirement, TrackedChange } from '@/lib/types';
import { Badge, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { Refs } from '@/components/RefTag';
import { outOfDate } from '@/lib/engine/quality';
import { wordDiff } from '@/lib/engine/changes';
import { cn, refLabel } from '@/lib/util';
import type { LibraryItem } from '@/lib/engine/similarity';

export function Diff({ a, b }: { a: string; b: string }) {
  return (
    <>
      {wordDiff(a, b).map((s, i) => (
        <span key={i} className={s.op === 'del' ? 'del' : s.op === 'ins' ? 'ins' : undefined}>{s.t}</span>
      ))}
    </>
  );
}

/** A pending tracked change rendered as strikethrough red and underline green, with Accept and Reject. */
export function ChangeView({ c, req, onAccept, onReject, canDecide = true }: { c: TrackedChange; req?: Requirement; onAccept: () => void; onReject: () => void; canDecide?: boolean }) {
  const before = c.before ?? req ?? {};
  const after = c.after ?? {};
  return (
    <div className="my-2 rounded border border-warn/40 bg-warn-soft/40 p-3 font-sans text-sm" data-testid={`change-${c.id}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge tone="warn">Tracked change</Badge>
        <span className="text-xs text-ink-muted">{c.origin}: {c.reason}</span>
      </div>
      {c.kind === 'Add' ? (
        <div className="ins rounded px-1.5 py-1 no-underline">
          <p className="font-semibold">{after.title}</p>
          <p>{after.description}</p>
          <ul className="ml-4 list-disc">{after.acceptanceCriteria?.map((a) => <li key={a}>{a}</li>)}</ul>
          {after.refs && <p className="text-xs">Refs: {after.refs.map(refLabel).join(', ')}</p>}
        </div>
      ) : c.kind === 'Remove' ? (
        <p className="del">{before.title}: {before.description}</p>
      ) : (
        <div className="space-y-1">
          {after.title && after.title !== before.title && <p className="font-semibold"><Diff a={before.title ?? ''} b={after.title} /></p>}
          {after.description && <p><Diff a={before.description ?? ''} b={after.description} /></p>}
          {after.acceptanceCriteria && (
            <ul className="ml-4 list-disc">
              {after.acceptanceCriteria.map((a, i) => <li key={i}><Diff a={before.acceptanceCriteria?.[i] ?? ''} b={a} /></li>)}
            </ul>
          )}
          {after.refs && after.refs.join() !== (before.refs ?? []).join() && <p className="text-xs">Refs: <Diff a={(before.refs ?? []).map(refLabel).join(', ')} b={after.refs.map(refLabel).join(', ')} /></p>}
        </div>
      )}
      {canDecide && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="success" onClick={onAccept}><Check className="h-3.5 w-3.5" aria-hidden />Accept</Button>
          <Button size="sm" onClick={onReject}><X className="h-3.5 w-3.5" aria-hidden />Reject</Button>
        </div>
      )}
    </div>
  );
}

export function RequirementBlock({
  p,
  r,
  pending,
  reuse,
  onEdit,
  onUseReuse,
  onAccept,
  onReject,
  onComment,
  locked,
}: {
  p: Project;
  r: Requirement;
  pending: TrackedChange[];
  reuse?: { item: LibraryItem; score: number };
  onEdit: () => void;
  onUseReuse?: () => void;
  onAccept: (c: TrackedChange) => void;
  onReject: (c: TrackedChange) => void;
  onComment?: () => void;
  locked?: boolean;
}) {
  const ood = outOfDate(p, r);
  const comments = p.comments.filter((c) => c.reqId === r.id && !c.resolved).length;
  return (
    <article id={r.id} className="scroll-mt-28 border-b border-line py-3 last:border-0" data-req={r.id}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-[92px] shrink-0 font-mono text-xs font-semibold text-navy">{r.id}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="font-serif text-[15px] font-semibold text-ink">{r.title}</h4>
            <Badge tone={r.priority === 'Must' ? 'navy' : 'neutral'}>{r.priority}</Badge>
            {r.origin === 'FromModel' && <Badge title="Generated from the model (workflow, rules, data, catalogue or NFR baseline)">From model</Badge>}
            {r.origin === 'Reused' && <Badge tone="ok" title={r.reusedFrom}>Reused</Badge>}
            {r.origin === 'Manual' && <Badge>Manual</Badge>}
            {ood.length > 0 && <Badge tone="warn" title={`${ood.join(', ')} changed after generation`}>Out of date, regenerate</Badge>}
            {comments > 0 && <Badge tone="navy">{comments} comment{comments > 1 ? 's' : ''}</Badge>}
          </div>
          <p className="mt-1 font-serif text-[15px] leading-relaxed">{r.description}</p>
          {r.acceptanceCriteria.length > 0 && (
            <div className="mt-1.5">
              <p className="text-xs font-semibold text-ink-muted">Acceptance criteria</p>
              <ol className="ml-4 list-decimal font-serif text-[14px] leading-relaxed text-ink">
                {r.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}
              </ol>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {r.actor && <span>Actor: {r.actor}</span>}
            <span className="flex items-center gap-1">Source: <Refs projectId={p.id} refs={r.refs} /></span>
          </div>
          {pending.map((c) => <ChangeView key={c.id} c={c} req={r} onAccept={() => onAccept(c)} onReject={() => onReject(c)} canDecide={!locked} />)}
          {reuse && r.origin === 'Generated' && !locked && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-canvas px-2.5 py-1.5 text-xs" data-testid={`reuse-${r.id}`}>
              <span className="text-ink-muted">Similar approved requirement:</span>
              <span className="font-mono text-navy">{reuse.item.req.id}</span>
              <span>in {reuse.item.projectName}</span>
              <span className="text-ink-faint">({Math.round(reuse.score * 100)}% match)</span>
              <span className="truncate text-ink-muted" title={reuse.item.req.description}>"{reuse.item.req.title}"</span>
              <button onClick={onUseReuse} className="ml-auto font-medium text-navy underline">Use this</button>
            </div>
          )}
        </div>
        {!locked && (
          <div className="flex shrink-0 gap-1">
            {onComment && <button onClick={onComment} className="rounded p-1 text-ink-muted hover:bg-canvas" aria-label={`Comment on ${r.id}`}><MessageSquare className="h-3.5 w-3.5" /></button>}
            <button onClick={onEdit} className="rounded p-1 text-ink-muted hover:bg-canvas" aria-label={`Edit ${r.id}`}><Pencil className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </article>
  );
}

export function RequirementEditor({ r, modules, onClose, onSave, onDelete, isNew }: { r: Partial<Requirement>; modules: string[]; onClose: () => void; onSave: (r: Partial<Requirement>) => void; onDelete?: () => void; isNew?: boolean }) {
  const [v, setV] = useState({ ...r, ac: (r.acceptanceCriteria ?? []).join('\n'), refsText: (r.refs ?? []).join(', ') });
  const valid = (v.title ?? '').trim() && (v.description ?? '').trim();
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add requirement' : `Edit ${r.id}`}
      wide
      footer={
        <>
          {onDelete && <Button variant="danger" className="mr-auto" onClick={onDelete}>Delete requirement</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ ...r, title: v.title?.trim(), description: v.description?.trim(), module: v.module, kind: v.kind, priority: v.priority, actor: v.actor || undefined, acceptanceCriteria: v.ac.split('\n').map((x) => x.trim()).filter(Boolean), refs: v.refsText.split(',').map((x) => x.trim()).filter(Boolean) })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-4 gap-3">
        {isNew && (
          <Field label="Module" htmlFor="rq-mod">
            <Select id="rq-mod" value={v.module} onChange={(e) => setV({ ...v, module: e.target.value, kind: e.target.value === 'NFR' ? 'NFR' : 'FR' })}>{modules.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
        )}
        <Field label="Title" htmlFor="rq-title" className={isNew ? 'col-span-3' : 'col-span-4'}><Input id="rq-title" value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Requirement" htmlFor="rq-desc" className="col-span-4" hint='State it as "The system shall ..." with measurable values.'><Textarea id="rq-desc" rows={3} value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <Field label="Acceptance criteria (one per line, Given/When/Then)" htmlFor="rq-ac" className="col-span-4"><Textarea id="rq-ac" rows={4} value={v.ac} onChange={(e) => setV({ ...v, ac: e.target.value })} /></Field>
        <Field label="Priority" htmlFor="rq-pr"><Select id="rq-pr" value={v.priority ?? 'Must'} onChange={(e) => setV({ ...v, priority: e.target.value as Requirement['priority'] })}><option>Must</option><option>Should</option><option>Could</option><option>{"Won't"}</option></Select></Field>
        <Field label="Actor" htmlFor="rq-actor"><Input id="rq-actor" value={v.actor ?? ''} onChange={(e) => setV({ ...v, actor: e.target.value })} /></Field>
        <Field label="Refs (comma separated)" htmlFor="rq-refs" className="col-span-2"><Input id="rq-refs" value={v.refsText} onChange={(e) => setV({ ...v, refsText: e.target.value })} placeholder="GO-4.2, ANS-1, WF-T3" /></Field>
      </div>
      <p className={cn('mt-2 text-xs text-ink-faint')}>Edits by the author are saved directly and recorded in the activity log. AI and reviewer proposals always arrive as tracked changes.</p>
    </Modal>
  );
}
