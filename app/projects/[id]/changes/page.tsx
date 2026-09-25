'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Plus } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { usePersona } from '@/lib/repo/store';
import { Badge, Button, Empty, ErrorBox, Notice, PageHeader, Panel, Progress, Tabs, Textarea, td, th, type Tone } from '@/components/ui';
import { RefTag, Refs } from '@/components/RefTag';
import { AddSourceModal } from '@/components/sources/AddSource';
import { corrigendumSupersessions, directImpact } from '@/lib/engine/impact';
import { crCandidates, enforceCr } from '@/lib/engine/cr';
import { ensureDraft } from '@/lib/engine/versioning';
import { clauseById } from '@/lib/engine/model';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { compact } from '@/lib/ai/context';
import { changeNoteDocx, crNoteDocx } from '@/lib/export/notes';
import type { CrAssessment, CrItem, ImpactAnalysis, ImpactItem, Project, TrackedChange } from '@/lib/types';
import { download, fmtDate, fmtDateTime, nextId, nowIso, uid } from '@/lib/util';

type ImpactOut = { affected: (ImpactItem & { newDescription: string | null; newAcceptanceCriteria: string[] | null; newSlaDays: number | null })[]; timelineImpact: string };
const clsTone: Record<CrItem['classification'], Tone> = { 'In scope': 'ok', Clarification: 'navy', 'New scope': 'bad' };

export default function ChangesPage() {
  const { project: p } = useCurrentProject();
  const [tab, setTab] = useState<'corrigendum' | 'cr'>('corrigendum');
  if (!p.baseline)
    return (
      <div>
        <PageHeader title="Baseline and change control" subtitle="After approval, corrigenda and vendor change requests are assessed against the frozen baseline." />
        <Empty text="There is no approved baseline yet. The Director approves the FRS on the Review page, which freezes the baseline." action={<Link href={`/projects/${p.id}/review`}><Button variant="primary">Go to Review</Button></Link>} />
      </div>
    );
  return (
    <div>
      <PageHeader title="Baseline and change control" subtitle="Corrigendum impact analysis and vendor change-request scope checks, both against the frozen baseline." />
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-ok/30 bg-ok-soft px-4 py-3 text-sm">
        <span><strong>Baseline v{p.baseline.version}</strong> approved by {p.baseline.approvedBy} on {fmtDate(p.baseline.approvedAt)}</span>
        <span className="text-ink-muted">{p.baseline.snapshot.requirements.length} requirements frozen</span>
        {p.status !== 'Approved' && <Badge tone="warn">Working draft v{p.version} in progress</Badge>}
      </div>
      <Tabs tabs={[{ id: 'corrigendum', label: 'Corrigendum impact analysis' }, { id: 'cr', label: 'Vendor change request scope check' }]} value={tab} onChange={setTab} />
      <div className="mt-4">{tab === 'corrigendum' ? <Corrigendum p={p} /> : <VendorCr p={p} />}</div>
    </div>
  );
}

function Corrigendum({ p }: { p: Project }) {
  const { update } = useCurrentProject();
  const persona = usePersona();
  const ai = useAiRun();
  const [adding, setAdding] = useState(false);
  const newCors = p.sources.filter((d) => d.kind === 'Corrigendum' && d.addedAt > p.baseline!.approvedAt);
  const pending = newCors.filter((d) => !p.impacts.some((i) => i.corrigendumDocId === d.id));

  async function analyse(docId: string) {
    const cor = p.sources.find((d) => d.id === docId)!;
    const sup = corrigendumSupersessions(p, cor);
    if (!sup.length) {
      toast.error('This corrigendum does not name any paragraph of the amended document, so no supersession could be linked. Run reconciliation instead.');
      return;
    }
    const direct = directImpact(p, sup.map((s) => s.old));
    const out = await ai.run(['Linking the corrigendum to the clauses it supersedes', 'Tracing requirements, tests, rules, transitions and fields that cite them', 'Finding items that depend on them semantically', 'Proposing updated text'], () =>
      runAi<ImpactOut>(
        'impact',
        p,
        {
          SOURCES: sup.map((s) => `[${s.old}] superseded by [${s.by}]: ${clauseById(p, s.old)?.clause.english} NOW: ${clauseById(p, s.by)?.clause.english}`).join('\n'),
          MODEL: compact({
            direct: direct.filter((d) => d.kind !== 'Test').map((d) => ({ id: d.targetId, kind: d.kind, reason: d.reason, text: p.requirements.find((r) => r.id === d.targetId) })),
            related: p.requirements.filter((r) => r.module === (p.requirements.find((x) => x.id === direct[0]?.targetId)?.module ?? 'GRV')).map((r) => ({ id: r.id, title: r.title, text: r.description })),
          }),
          INPUT: `Corrigendum ${cor.refNo ?? cor.name}: ${cor.clauses.map((c) => c.english).join(' ')}`,
        },
        cor.prefix,
      ),
    );
    if (!out) return;
    // Deterministic items are always listed; the AI adds proposed text and semantic dependencies. Unknown targets are dropped.
    const exists = (i: ImpactItem) => (i.kind === 'Test' ? direct.some((d) => d.targetId === i.targetId) || p.requirements.some((r) => i.targetId.startsWith(`TC-${r.id}-`)) : i.kind === 'Requirement' ? p.requirements.some((r) => r.id === i.targetId) : true);
    const byId = new Map(out.data.affected.filter(exists).map((a) => [a.targetId, a]));
    const affected: ImpactItem[] = [
      ...direct.map((d) => ({ ...d, proposedChange: byId.get(d.targetId)?.proposedChange ?? 'Review against the new clause.' })),
      ...out.data.affected.filter(exists).filter((a) => !direct.some((d) => d.targetId === a.targetId)).map((a) => ({ targetId: a.targetId, kind: a.kind, reason: `${a.reason} (semantic dependency)`, proposedChange: a.proposedChange })),
    ];
    const impact: ImpactAnalysis & { proposals?: ImpactOut['affected'] } = { id: nextId(p.impacts.map((i) => i.id), 'IMP'), corrigendumDocId: docId, supersessions: sup, affected, timelineImpact: out.data.timelineImpact, status: 'Open', createdAt: nowIso(), proposals: out.data.affected.filter(exists) };
    update('Ran corrigendum impact analysis', `${cor.prefix}: ${affected.length} items`, (x) => { x.impacts.push(impact); });
    toast.success(`${affected.length} affected items found`);
  }

  function apply(imp: ImpactAnalysis & { proposals?: ImpactOut['affected'] }) {
    update('Applied corrigendum impact', imp.id, (x) => {
      ensureDraft(x);
      for (const s of imp.supersessions) {
        for (const d of x.sources) for (const c of d.clauses) if (c.id === s.old) c.supersededBy = s.by;
        x.reconciliations.push({ id: nextId(x.reconciliations.map((r) => r.id), 'RES'), kind: 'Supersession', clauses: [s.old, s.by], description: `${s.by} supersedes ${s.old} (accepted in impact analysis ${imp.id}).`, resolution: { type: 'Prevails', prevailing: s.by, by: `${persona.name}, ${persona.designation}`, at: nowIso() } });
        x.stamps[s.old] = nowIso();
      }
      for (const a of imp.proposals ?? []) {
        const r = x.requirements.find((y) => y.id === a.targetId);
        if (a.kind === 'Requirement' && r && (a.newDescription || a.newAcceptanceCriteria)) {
          const refs = r.refs.map((ref) => imp.supersessions.find((s) => s.old === ref)?.by ?? ref);
          const bySup = imp.supersessions.filter((s) => r.refs.includes(s.old) || a.reason.includes(s.old)).map((s) => s.by);
          const ch: TrackedChange = {
            id: uid('chg'), targetId: r.id, kind: 'Modify', status: 'Pending', createdAt: nowIso(), origin: `Corrigendum impact ${imp.id}`, reason: a.proposedChange,
            before: { title: r.title, description: r.description, acceptanceCriteria: r.acceptanceCriteria, refs: r.refs },
            after: { description: a.newDescription ?? r.description, acceptanceCriteria: a.newAcceptanceCriteria ?? r.acceptanceCriteria, refs: Array.from(new Set([...refs, ...bySup])) },
          };
          x.changes.push(ch);
        }
        if (a.kind === 'Transition' && a.newSlaDays != null) {
          const t = x.workflow?.transitions.find((y) => y.id === a.targetId);
          if (t) {
            t.slaDays = a.newSlaDays;
            x.stamps[t.id] = nowIso();
          }
        }
      }
      x.impacts.find((i) => i.id === imp.id)!.status = 'Applied';
    });
    toast.success('Supersession recorded and proposed changes added as tracked changes in the Document');
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Corrigenda received after the baseline"
        actions={<Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Add corrigendum</Button>}
      >
        {newCors.length === 0 ? (
          <p className="text-sm text-ink-muted">No corrigendum has been received since the baseline. Add one to see which requirements, tests and SLAs it affects.</p>
        ) : (
          <ul className="space-y-2">
            {newCors.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span><Badge tone="navy">{d.prefix}</Badge> {d.name} {d.refNo && <span className="text-ink-faint">({d.refNo}, {fmtDate(d.date)})</span>}</span>
                {pending.includes(d) ? <Button size="sm" variant="primary" onClick={() => analyse(d.id)} loading={ai.busy}>Run impact analysis</Button> : <Badge tone="ok">Analysed</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {ai.busy && <div className="max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <ErrorBox title="Impact analysis could not run" message={ai.error} />}
      {p.impacts.slice().reverse().map((imp) => {
        const cor = p.sources.find((d) => d.id === imp.corrigendumDocId);
        const groups = ['Requirement', 'Test', 'Rule', 'Transition', 'Field'] as const;
        return (
          <Panel
            key={imp.id}
            title={<span className="flex items-center gap-2">{imp.id}: impact of {cor?.name} <Badge tone={imp.status === 'Open' ? 'warn' : 'ok'}>{imp.status === 'Open' ? 'Awaiting decision' : 'Applied'}</Badge></span>}
            subtitle={`Analysed ${fmtDateTime(imp.createdAt)}`}
            actions={
              <>
                <Button size="sm" onClick={async () => download(`Change-note-${p.fileNo.replace(/\//g, '-')}-${cor?.prefix}.docx`, await changeNoteDocx(p, imp))}><FileText className="h-3.5 w-3.5" aria-hidden />Change note (Word)</Button>
                {imp.status === 'Open' && <Button size="sm" variant="primary" onClick={() => apply(imp)}>Apply as tracked changes</Button>}
              </>
            }
            bodyClass="p-0"
          >
            <div className="border-b border-line px-4 py-3 text-sm" data-testid="impact">
              {imp.supersessions.map((s) => (
                <p key={s.old}>
                  <RefTag projectId={p.id} id={s.by} /> supersedes <RefTag projectId={p.id} id={s.old} />: <span className="text-ink-muted line-through">{clauseById(p, s.old)?.clause.english}</span> <span className="ins">{clauseById(p, s.by)?.clause.english}</span>
                </p>
              ))}
              <p className="mt-2"><span className="font-medium">Timeline and effort impact:</span> {imp.timelineImpact}</p>
            </div>
            <table className="w-full">
              <thead><tr><th className={th}>Affected item</th><th className={th}>Kind</th><th className={th}>Why</th><th className={th}>Proposed change</th></tr></thead>
              <tbody>
                {groups.flatMap((g) => imp.affected.filter((a) => a.kind === g)).map((a) => (
                  <tr key={a.targetId}>
                    <td className={td}>{a.kind === 'Test' ? <span className="font-mono text-xs">{a.targetId}</span> : <RefTag projectId={p.id} id={a.targetId} />}</td>
                    <td className={td}>{a.kind}</td>
                    <td className={td + ' text-xs'}>{a.reason}</td>
                    <td className={td}>{a.proposedChange}</td>
                  </tr>
                ))}
                {imp.affected.length === 0 && <tr><td className={td} colSpan={4}>Nothing in the baseline cites the superseded clauses.</td></tr>}
              </tbody>
            </table>
            {imp.status === 'Applied' && <p className="px-4 py-2 text-sm text-ink-muted">Proposed text changes are pending as tracked changes. <Link href={`/projects/${p.id}/document`} className="text-navy underline">Review them in the Document</Link></p>}
          </Panel>
        );
      })}
      <AddSourceModal open={adding} onClose={() => setAdding(false)} project={p} defaultKind="Corrigendum" onAdded={(d) => update('Added source', `${d.prefix}: ${d.name}`, (x) => { x.sources.push(d); })} />
    </div>
  );
}

function VendorCr({ p }: { p: Project }) {
  const { update } = useCurrentProject();
  const ai = useAiRun();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const baseReqs = p.baseline!.snapshot.requirements;
  const candidates = useMemo(() => (text.trim() ? crCandidates(text, baseReqs) : []), [text, baseReqs]);

  async function loadSample() {
    const r = await fetch('/samples/vendor_cr_07.txt');
    if (r.ok) {
      setText(await r.text());
      setTitle('CR-07 from M/s Techsys Solutions');
    }
  }

  async function check() {
    const out = await ai.run(['Splitting the request into individual asks', 'Retrieving matching baseline requirements', 'Comparing each ask with the acceptance criteria', 'Classifying scope'], () =>
      runAi<{ items: CrItem[] }>(
        'cr',
        p,
        {
          MODEL: compact(candidates.map((c) => ({ ask: c.ask, candidates: c.hits.map((h) => { const r = baseReqs.find((x) => x.id === h.id)!; return { id: r.id, title: r.title, text: r.description, ac: r.acceptanceCriteria }; }) }))),
          INPUT: text,
        },
        text.includes('CR-07') ? undefined : 'custom',
      ),
    );
    if (!out) return;
    const items = enforceCr(out.data.items, baseReqs);
    const a: CrAssessment = { id: nextId(p.crs.map((c) => c.id), 'CRA'), title: title.trim() || `Change request assessed ${fmtDate(nowIso())}`, vendorText: text, items, createdAt: nowIso() };
    update('Assessed vendor change request', `${a.title}: ${items.filter((i) => i.classification === 'New scope').length} new scope`, (x) => { x.crs.push(a); });
    setText('');
    setTitle('');
  }

  return (
    <div className="space-y-4">
      <Panel title="Check a vendor change request against the baseline" subtitle="Each ask is matched to baseline requirements. Asks already in scope cite FR IDs and quote their acceptance criteria, so no additional cost is justified.">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input aria-label="Title" className="h-8 flex-1 rounded border border-line px-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Change request number and vendor" />
            {p.sample === 'scholarship' && <button className="text-sm text-navy underline" onClick={loadSample}>Load sample CR-07</button>}
            <label className="cursor-pointer text-sm text-navy underline">
              Upload text file
              <input type="file" accept=".txt,.md" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
            </label>
          </div>
          <Textarea aria-label="Vendor change request text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the vendor's change request" />
          <Button variant="primary" onClick={check} loading={ai.busy} disabled={!text.trim()}>Check scope</Button>
        </div>
        {ai.busy && <div className="mt-3 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
        {ai.error && <div className="mt-3"><ErrorBox title="The scope check could not run" message={ai.error} /></div>}
      </Panel>
      {p.crs.slice().reverse().map((c) => (
        <Panel
          key={c.id}
          title={<span className="flex items-center gap-2">{c.id}: {c.title}</span>}
          subtitle={`Assessed ${fmtDateTime(c.createdAt)} · ${c.items.filter((i) => i.classification === 'In scope').length} in scope, ${c.items.filter((i) => i.classification === 'Clarification').length} clarification, ${c.items.filter((i) => i.classification === 'New scope').length} new scope`}
          actions={<Button size="sm" onClick={async () => download(`CR-assessment-${c.id}.docx`, await crNoteDocx(p, c))}><FileText className="h-3.5 w-3.5" aria-hidden />Assessment note (Word)</Button>}
          bodyClass="p-0"
        >
          <table className="w-full" data-testid="cr-result">
            <thead><tr><th className={th}>Ask</th><th className={th}>Classification</th><th className={th}>Baseline requirements and acceptance criteria</th></tr></thead>
            <tbody>
              {c.items.map((i, n) => (
                <tr key={n} data-classification={i.classification}>
                  <td className={td + ' w-[30%]'}>{i.ask}{i.effort && <div className="text-xs text-ink-faint">Vendor estimate: {i.effort}</div>}</td>
                  <td className={td + ' w-36'}><Badge tone={clsTone[i.classification]}>{i.classification === 'In scope' ? 'Already in scope' : i.classification === 'New scope' ? 'New scope' : 'Clarification of existing scope'}</Badge></td>
                  <td className={td}>
                    {i.matchedReqs.length > 0 && <Refs projectId={p.id} refs={i.matchedReqs} />}
                    {i.quotes.map((q) => <p key={q} className="mt-1 border-l-2 border-navy/30 pl-2 text-xs text-ink-muted">{q}</p>)}
                    <p className="mt-1 text-sm">{i.reasoning}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
      {p.crs.length === 0 && !ai.busy && <Notice>No change request assessed yet.</Notice>}
    </div>
  );
}
