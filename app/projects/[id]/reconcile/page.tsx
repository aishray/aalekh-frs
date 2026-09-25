'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { usePersona } from '@/lib/repo/store';
import { Badge, Button, Empty, ErrorBox, Field, Input, Notice, PageHeader, Panel, Progress, type Tone } from '@/components/ui';
import { RefTag } from '@/components/RefTag';
import { clauseById, unresolvedFindings } from '@/lib/engine/model';
import { detectDeterministic, mergeFindings, type Finding } from '@/lib/engine/reconcile';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { sourcesBlock } from '@/lib/ai/context';
import type { Project, Reconciliation, Resolution } from '@/lib/types';
import { cn, fmtDateTime, nowIso, refLabel } from '@/lib/util';

const kindTone: Record<Reconciliation['kind'], Tone> = { Conflict: 'bad', Supersession: 'navy', Duplicate: 'neutral', MissingReference: 'warn' };
const kindLabel: Record<Reconciliation['kind'], string> = { Conflict: 'Conflict', Supersession: 'Supersession', Duplicate: 'Duplicate', MissingReference: 'Gap by reference' };

export default function ReconcilePage() {
  const { project: p, update } = useCurrentProject();
  const ai = useAiRun();
  const open = unresolvedFindings(p);
  const stale = p.reconciledAt && p.sources.some((d) => d.addedAt > p.reconciledAt!);

  async function runReconcile() {
    const out = await ai.run(['Comparing Mandate, Rule and Timeline clauses', 'Linking corrigenda to the clauses they amend', 'Checking references to annexures and forms', 'Preparing findings'], async () => {
      const det = detectDeterministic(p);
      const cor = p.sources
        .filter((d) => d.kind === 'Corrigendum')
        .map((d) => `${d.prefix} (${d.refNo ?? d.name}) amends ${p.sources.find((x) => x.id === d.amends)?.prefix ?? 'unknown'}`)
        .join('\n');
      const docs = p.sources.map((d) => `${d.prefix}: ${d.kind}, ${d.name}${d.refNo ? ', ' + d.refNo : ''}`).join('\n');
      const r = await runAi<{ findings: Finding[] }>('reconcile', p, {
        SOURCES: sourcesBlock(p, { types: ['Mandate', 'Rule', 'Timeline'] }),
        INPUT: `Documents provided:\n${docs}\n\nCorrigenda:\n${cor || 'none'}`,
      });
      const valid = new Set(p.sources.flatMap((d) => d.clauses.map((c) => c.id)));
      const ai = r.data.findings.filter((f) => f.clauses.length && f.clauses.every((c) => valid.has(c)));
      return { det, ai, source: r.source };
    });
    if (!out) return;
    let added = 0;
    update('Ran reconciliation', undefined, (x) => {
      const m = mergeFindings(x.reconciliations, out.ai, out.det);
      x.reconciliations = m.all;
      x.reconciledAt = nowIso();
      added = m.added;
    });
    toast.success(added ? `${added} new finding${added > 1 ? 's' : ''} to resolve before drafting` : 'No new findings');
  }

  return (
    <div>
      <PageHeader
        title="Source reconciliation"
        subtitle="Conflicts, supersessions by corrigenda, duplicates and references to missing annexures are resolved before drafting, so the FRS is not built on contradictory sources."
        actions={
          <Button variant={p.reconciledAt && !stale ? 'secondary' : 'primary'} onClick={runReconcile} loading={ai.busy}>
            {p.reconciledAt ? 'Run again' : 'Run reconciliation'}
          </Button>
        }
      />
      {ai.busy && <div className="mb-4 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <div className="mb-4"><ErrorBox title="Reconciliation could not run" message={ai.error} action={<Button size="sm" onClick={runReconcile}>Try again</Button>} /></div>}
      {stale && !ai.busy && <Notice tone="warn" className="mb-4">Sources were added after the last run. Run reconciliation again to check them.</Notice>}
      {!p.reconciledAt && !ai.busy ? (
        <Empty text={`${p.sources.length} sources with ${p.sources.reduce((s, d) => s + d.clauses.length, 0)} clauses are ready to be compared.`} action={<Button variant="primary" onClick={runReconcile}>Run reconciliation</Button>} />
      ) : p.reconciledAt ? (
        <>
          <div className={cn('mb-4 rounded-md border px-4 py-3 text-sm', open.length ? 'border-warn/40 bg-warn-soft' : 'border-ok/30 bg-ok-soft')} data-testid="reconcile-gate">
            {open.length ? (
              <span><strong>Drafting is blocked.</strong> Resolve or defer {open.length} finding{open.length > 1 ? 's' : ''} below. Deferred findings become open issues in the FRS.</span>
            ) : (
              <span>
                <strong>All findings resolved.</strong> Drafting will use only effective clauses. Last run {fmtDateTime(p.reconciledAt)}.{' '}
                <Link href={`/projects/${p.id}/discovery`} className="text-navy underline">Continue to Discovery</Link>
              </span>
            )}
          </div>
          {p.reconciliations.length === 0 ? (
            <Empty text="No conflicts, supersessions or missing references were found." />
          ) : (
            <div className="space-y-3">
              {p.reconciliations.map((r) => <FindingCard key={r.id} p={p} r={r} update={update} />)}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function FindingCard({ p, r, update }: { p: Project; r: Reconciliation; update: ReturnType<typeof useCurrentProject>['update'] }) {
  const persona = usePersona();
  const [prevail, setPrevail] = useState<string>(r.kind === 'Supersession' ? r.clauses[r.clauses.length - 1] : r.clauses[0]);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'Prevails' | 'ClarifiedValue' | 'Deferred'>(r.kind === 'MissingReference' ? 'Deferred' : 'Prevails');

  function resolve(res: Omit<Resolution, 'by' | 'at'>) {
    update('Resolved finding', `${r.id} (${r.kind})`, (x) => {
      const rec = x.reconciliations.find((y) => y.id === r.id)!;
      rec.resolution = { ...res, by: `${persona.name}, ${persona.designation}`, at: nowIso() };
      if (r.kind === 'Supersession' && res.type === 'Prevails' && res.prevailing) {
        for (const d of x.sources) for (const c of d.clauses) if (r.clauses.includes(c.id) && c.id !== res.prevailing) c.supersededBy = res.prevailing;
      }
      x.stamps[r.id] = nowIso();
      for (const c of r.clauses) x.stamps[c] = nowIso();
    });
    toast.success(`${r.id} resolved`);
  }

  function reopen() {
    update('Reopened finding', r.id, (x) => {
      const rec = x.reconciliations.find((y) => y.id === r.id)!;
      delete rec.resolution;
      for (const d of x.sources) for (const c of d.clauses) if (r.clauses.includes(c.id) && r.kind === 'Supersession') delete c.supersededBy;
      x.stamps[r.id] = nowIso();
    });
  }

  const res = r.resolution;
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-faint">{r.id}</span>
          <Badge tone={kindTone[r.kind]}>{kindLabel[r.kind]}</Badge>
          {res ? <Badge tone={res.type === 'Deferred' ? 'warn' : 'ok'}>{res.type === 'Deferred' ? 'Deferred: open issue' : 'Resolved'}</Badge> : <Badge tone="warn">Needs resolution</Badge>}
        </span>
      }
    >
      <p className="mb-3 text-sm">{r.description}</p>
      <div className={cn('mb-3 grid gap-2', r.clauses.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {r.clauses.map((id) => {
          const hit = clauseById(p, id);
          const lost = res && r.kind !== 'MissingReference' && res.type === 'Prevails' && res.prevailing !== id;
          return (
            <div key={id} className={cn('rounded border border-line px-3 py-2 text-sm', res?.prevailing === id && 'border-ok/50 bg-ok-soft/40')}>
              <div className="mb-1 flex items-center gap-2">
                <RefTag projectId={p.id} id={id} />
                <span className="text-xs text-ink-faint">{hit?.doc.name}{hit?.doc.date ? `, ${hit.doc.date}` : ''}</span>
                {res?.prevailing === id && <Badge tone="ok">Prevails</Badge>}
              </div>
              <p className={cn(lost && 'text-ink-faint line-through')}>{hit?.clause.english || hit?.clause.original}</p>
            </div>
          );
        })}
      </div>
      {res ? (
        <div className="flex items-start justify-between gap-3 rounded bg-noting px-3 py-2 text-sm">
          <div>
            <p>
              {res.type === 'Prevails' && <><strong>{refLabel(res.prevailing!)}</strong> prevails{r.kind === 'Supersession' ? '; the earlier clause is superseded and used for context only.' : '.'}</>}
              {res.type === 'ClarifiedValue' && <>Clarified value: <strong>{res.value}</strong></>}
              {res.type === 'Deferred' && <>To be clarified with the department. Recorded as an open issue in the FRS.</>}
              {res.note && <span className="text-ink-muted"> {res.note}</span>}
            </p>
            <p className="text-xs text-ink-faint">{res.by} · {fmtDateTime(res.at)} · citable as {r.id}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={reopen}>Change</Button>
        </div>
      ) : (
        <div className="space-y-2 rounded border border-line bg-canvas/50 p-3" data-testid={`resolve-${r.id}`}>
          <div className="flex flex-wrap gap-4 text-sm">
            {r.kind !== 'MissingReference' && (
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === 'Prevails'} onChange={() => setMode('Prevails')} />
                {r.kind === 'Supersession' ? 'Accept supersession' : 'One clause prevails'}
              </label>
            )}
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === 'ClarifiedValue'} onChange={() => setMode('ClarifiedValue')} />
              Enter clarified value
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === 'Deferred'} onChange={() => setMode('Deferred')} />
              To be clarified with department
            </label>
          </div>
          {mode === 'Prevails' && r.kind !== 'Supersession' && (
            <div className="flex gap-3 text-sm">
              {r.clauses.map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input type="radio" name={`prev-${r.id}`} checked={prevail === c} onChange={() => setPrevail(c)} />
                  {refLabel(c)} prevails
                </label>
              ))}
            </div>
          )}
          {mode === 'ClarifiedValue' && (
            <Field label="Clarified value" htmlFor={`val-${r.id}`}>
              <Input id={`val-${r.id}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Institution verification within 10 working days" />
            </Field>
          )}
          <Field label="Note (optional)" htmlFor={`note-${r.id}`}>
            <Input id={`note-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={r.kind === 'Conflict' ? 'The GO is the statutory instrument; minutes cannot override it' : ''} />
          </Field>
          <Button
            variant="primary"
            size="sm"
            disabled={mode === 'ClarifiedValue' && !value.trim()}
            onClick={() =>
              resolve(
                mode === 'Prevails'
                  ? { type: 'Prevails', prevailing: r.kind === 'Supersession' ? r.clauses[r.clauses.length - 1] : prevail, note: note || undefined }
                  : mode === 'ClarifiedValue'
                    ? { type: 'ClarifiedValue', value: value.trim(), note: note || undefined }
                    : { type: 'Deferred', note: note || undefined },
              )
            }
          >
            {mode === 'Deferred' ? 'Defer as open issue' : 'Record resolution'}
          </Button>
        </div>
      )}
    </Panel>
  );
}
