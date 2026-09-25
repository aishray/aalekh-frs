'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, ErrorBox, Field, Input, Notice, PageHeader, Panel, Progress, Select, Tabs, Textarea, td, th, type Tone } from '@/components/ui';
import { Refs } from '@/components/RefTag';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { standardBlocks } from '@/lib/ai/context';
import { ansId, asmId, unresolvedFindings, validRefs } from '@/lib/engine/model';
import { guessClauseType } from '@/lib/engine/segment';
import { prefixFor } from '@/lib/engine/ingest';
import { gapTopics } from '@/lib/engine/reference';
import catalogue from '@/data/catalogue.json';
import type { Discovery, Project, Question, SourceDoc } from '@/lib/types';
import { nowIso, uid } from '@/lib/util';

const statusTone: Record<string, Tone> = { Covered: 'ok', Partial: 'warn', Missing: 'bad' };

function matchCatalogue(name: string) {
  const n = name.toLowerCase();
  return catalogue.find((c) => c.keywords.some((k) => n.includes(k)))?.id;
}

export default function DiscoveryPage() {
  const { project: p, update } = useCurrentProject();
  const ai = useAiRun();
  const [tab, setTab] = useState<'analysis' | 'questions' | 'interview'>('analysis');
  const blocked = !p.reconciledAt || unresolvedFindings(p).length > 0;
  const topics: string[] = gapTopics(p.type);

  async function runDiscovery() {
    const out = await ai.run(
      ['Reading effective clauses, resolutions and answers', 'Extracting objective, scope, roles and integrations', 'Checking the sources against the project-type checklist', 'Drafting clarifying questions for gaps'],
      async () => {
        const blocks = standardBlocks(p);
        const d = await runAi<Omit<Discovery, 'integrations'> & { integrations: { name: string; refs: string[] }[] }>('discovery', p, { ...blocks, INPUT: `CHECKLIST for project type "${p.type}":\n${topics.map((t) => `- ${t}`).join('\n')}` });
        const gaps = d.data.checklist.filter((c) => c.status !== 'Covered');
        const q = await runAi<{ questions: Omit<Question, 'id'>[] }>('questions', p, {
          ...blocks,
          INPUT: `Checklist topics that are Partial or Missing:\n${gaps.map((g) => `- ${g.topic} (${g.status})${g.note ? ': ' + g.note : ''}`).join('\n')}`,
        });
        return { d: d.data, q: q.data.questions, source: d.source };
      },
      1000,
    );
    if (!out) return;
    const valid = validRefs(p);
    const clean = (r: string[]) => r.filter((x) => valid.has(x));
    // Deterministic side of the checklist: every topic of the project type appears exactly once, in order.
    const byTopic = new Map(out.d.checklist.map((c) => [c.topic.toLowerCase(), c]));
    const checklist = topics.map((t) => {
      const c = byTopic.get(t.toLowerCase());
      return c ? { ...c, refs: clean(c.refs), status: c.status === 'Covered' && clean(c.refs).length === 0 ? ('Partial' as const) : c.status } : { topic: t, status: 'Missing' as const, refs: [], note: 'Not assessed by the AI engine; treated as missing.' };
    });
    update('Ran discovery', `${out.q.length} questions`, (x) => {
      x.discovery = {
        ...out.d,
        objectiveRefs: clean(out.d.objectiveRefs),
        integrations: out.d.integrations.map((i) => ({ ...i, refs: clean(i.refs), catalogueId: matchCatalogue(i.name) })),
        checklist,
      };
      const kept = x.questions.filter((q) => q.answer || q.assumed);
      const keptTopics = new Set(kept.map((q) => q.topic));
      let n = Math.max(0, ...x.questions.map((q) => parseInt(q.id.slice(2), 10) || 0));
      x.questions = [...kept, ...out.q.filter((q) => !keptTopics.has(q.topic)).map((q) => ({ ...q, id: `Q-${++n}` }))];
    });
    setTab('analysis');
    toast.success('Discovery complete');
  }

  const d = p.discovery;
  const openQ = p.questions.filter((q) => !q.answer && !q.assumed).length;

  return (
    <div>
      <PageHeader
        title="Requirements discovery"
        subtitle="Structured understanding of the sources, a gap check against what a complete e-Gov FRS must cover, and clarifying questions only where the sources are silent."
        actions={<Button variant={d ? 'secondary' : 'primary'} onClick={runDiscovery} loading={ai.busy} disabled={blocked}>{d ? 'Run again' : 'Run discovery'}</Button>}
      />
      {blocked && (
        <Notice tone="warn" className="mb-4">
          Discovery uses only effective clauses, so reconciliation must be complete first.{' '}
          <Link href={`/projects/${p.id}/reconcile`} className="underline">Go to Reconcile</Link>
        </Notice>
      )}
      {ai.busy && <div className="mb-4 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <div className="mb-4"><ErrorBox title="Discovery could not run" message={ai.error} action={<Button size="sm" onClick={runDiscovery}>Try again</Button>} /></div>}
      {!d && !ai.busy ? (
        !blocked && <Empty text="Run discovery to extract objectives, roles and integrations and to find what the sources do not cover." action={<Button variant="primary" onClick={runDiscovery}>Run discovery</Button>} />
      ) : d ? (
        <>
          <Tabs
            tabs={[
              { id: 'analysis', label: 'Analysis and gap checklist' },
              { id: 'questions', label: <span>Questions and assumptions {openQ > 0 && <Badge tone="warn" className="ml-1">{openQ} open</Badge>}</span> },
              { id: 'interview', label: 'Stakeholder interview' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="mt-4">
            {tab === 'analysis' && <Analysis p={p} d={d} onQuestions={() => setTab('questions')} />}
            {tab === 'questions' && <Questions p={p} update={update} />}
            {tab === 'interview' && <Interview p={p} update={update} />}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Analysis({ p, d, onQuestions }: { p: Project; d: Discovery; onQuestions: () => void }) {
  const answeredTopics = new Map(p.questions.filter((q) => q.answer || q.assumed).map((q) => [q.topic, q]));
  const list = (items: { text: string; refs: string[] }[]) => (
    <ul className="space-y-1.5">
      {items.map((i) => <li key={i.text} className="text-sm">{i.text} <Refs projectId={p.id} refs={i.refs} /></li>)}
    </ul>
  );
  const counts = { Covered: 0, Partial: 0, Missing: 0 } as Record<string, number>;
  d.checklist.forEach((c) => counts[c.status]++);
  return (
    <div className="grid grid-cols-[1fr_1.15fr] gap-4">
      <div className="space-y-4">
        <Panel title="Objective"><p className="text-sm">{d.objective} <Refs projectId={p.id} refs={d.objectiveRefs} /></p></Panel>
        <Panel title="Scope">
          <p className="mb-1 text-xs font-semibold text-ink-muted">In scope</p>
          {list(d.scopeIn)}
          <p className="mb-1 mt-3 text-xs font-semibold text-ink-muted">Out of scope</p>
          {list(d.scopeOut)}
        </Panel>
        <Panel title="Stakeholders and roles" bodyClass="p-0">
          <table className="w-full">
            <tbody>
              {d.roles.map((r) => (
                <tr key={r.name}><td className={td + ' w-44 font-medium'}>{r.name}</td><td className={td}>{r.description} <Refs projectId={p.id} refs={r.refs} /></td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Channels, entities and integrations">
          <p className="mb-1 text-xs font-semibold text-ink-muted">Channels</p>
          {list(d.channels)}
          <p className="mb-1 mt-3 text-xs font-semibold text-ink-muted">Key entities</p>
          {list(d.entities)}
          <p className="mb-1 mt-3 text-xs font-semibold text-ink-muted">Integrations</p>
          <ul className="space-y-1.5">
            {d.integrations.map((i) => (
              <li key={i.name} className="text-sm">
                {i.name} <Refs projectId={p.id} refs={i.refs} />{' '}
                {i.catalogueId ? <Badge tone="ok" title="A standard integration template from the e-Gov component catalogue will be used">Catalogue template</Badge> : <Badge>Custom</Badge>}
              </li>
            ))}
          </ul>
          <p className="mb-1 mt-3 text-xs font-semibold text-ink-muted">Candidate modules</p>
          <div className="flex flex-wrap gap-1.5">{d.modules.map((m) => <Badge key={m.code} tone="navy">{m.code} {m.name}</Badge>)}</div>
        </Panel>
      </div>
      <Panel
        title="Gap checklist"
        subtitle={`${counts.Covered} covered, ${counts.Partial} partial, ${counts.Missing} missing`}
        actions={<Button size="sm" onClick={onQuestions}>Answer questions</Button>}
        bodyClass="p-0"
      >
        <table className="w-full" data-testid="checklist">
          <thead><tr><th className={th}>Topic</th><th className={th}>Status</th><th className={th}>Sources</th></tr></thead>
          <tbody>
            {d.checklist.map((c) => {
              const q = answeredTopics.get(c.topic);
              return (
                <tr key={c.topic} className={c.status === 'Missing' && !q ? 'bg-bad-soft/40' : undefined}>
                  <td className={td}>
                    <div className="font-medium">{c.topic}</div>
                    {c.note && <div className="text-xs text-ink-muted">{c.note}</div>}
                  </td>
                  <td className={td}>
                    <Badge tone={statusTone[c.status]}>{c.status}</Badge>
                    {q && <div className="mt-1"><Badge tone={q.assumed ? 'warn' : 'ok'}>{q.assumed ? `Assumed ${asmId(q)}` : `Answered ${ansId(q)}`}</Badge></div>}
                  </td>
                  <td className={td}><Refs projectId={p.id} refs={q ? [...c.refs, q.assumed ? asmId(q) : ansId(q)] : c.refs} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Questions({ p, update }: { p: Project; update: ReturnType<typeof useCurrentProject>['update'] }) {
  if (!p.questions.length) return <Empty text="No clarifying questions: the sources cover every checklist topic." />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Answers are stored as ANS-n and cited by requirements. Questions left unanswered can be recorded as assumptions (ASM-n), which appear in the FRS and must be confirmed in review.</p>
      {p.questions.map((q) => <QuestionCard key={q.id} p={p} q={q} update={update} />)}
    </div>
  );
}

function QuestionCard({ p, q, update }: { p: Project; q: Question; update: ReturnType<typeof useCurrentProject>['update'] }) {
  const [text, setText] = useState(q.answer ?? '');
  const done = q.answer || q.assumed;
  const set = (fn: (x: Question) => void, action: string, target: string) =>
    update(action, target, (x) => {
      const y = x.questions.find((k) => k.id === q.id)!;
      fn(y);
      x.stamps[ansId(q)] = nowIso();
      x.stamps[asmId(q)] = nowIso();
    });
  return (
    <Panel
      title={<span className="flex items-center gap-2"><span className="font-mono text-xs text-ink-faint">{q.id}</span><Badge>{q.topic}</Badge>{q.answer && !q.assumed && <Badge tone="ok">Answered, citable as {ansId(q)}</Badge>}{q.assumed && <Badge tone="warn">Assumption {asmId(q)}{q.confirmed ? ', confirmed' : ''}</Badge>}</span>}
    >
      <p className="text-sm font-medium" data-testid={`question-${q.id}`}>{q.question}</p>
      <p className="mt-0.5 text-xs text-ink-muted">Why it matters: {q.whyItMatters}</p>
      {done ? (
        <div className="mt-2 flex items-start justify-between gap-3 rounded bg-noting px-3 py-2 text-sm">
          <p>{q.assumed ? <><span className="text-ink-muted">Assumed:</span> {q.defaultAssumption}</> : q.answer}</p>
          <Button size="sm" variant="ghost" onClick={() => set((y) => { delete y.answer; y.assumed = false; y.confirmed = false; }, 'Reopened question', q.id)}>Change</Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {q.suggestedAnswers.map((s) => (
              <button key={s} onClick={() => setText(s)} className="rounded border border-line bg-white px-2 py-1 text-left text-xs hover:border-navy hover:text-navy">{s}</button>
            ))}
          </div>
          <Textarea aria-label={`Answer to ${q.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Type the department's answer, or pick a suggestion" />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => set((y) => { y.answer = text.trim(); y.assumed = false; }, 'Answered question', `${q.id} as ${ansId(q)}`)}>Save answer</Button>
            <Button size="sm" onClick={() => set((y) => { y.assumed = true; delete y.answer; }, 'Recorded assumption', asmId(q))}>Use default assumption</Button>
            <span className="text-xs text-ink-faint">Default: {q.defaultAssumption}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Interview({ p, update }: { p: Project; update: ReturnType<typeof useCurrentProject>['update'] }) {
  const roles = useMemo(() => p.discovery?.roles.map((r) => r.name).filter((r) => r !== 'Applicant') ?? [], [p.discovery]);
  const [role, setRole] = useState(roles.find((r) => /district/i.test(r)) ?? roles[0] ?? '');
  const [who, setWho] = useState('');
  const [qs, setQs] = useState<{ question: string; purpose: string; answer: string }[]>([]);
  const ai = useAiRun();

  async function generate() {
    const out = await ai.run(['Preparing a role-specific question set'], () =>
      runAi<{ questions: { question: string; purpose: string }[] }>('interview', p, { ...standardBlocks(p), INPUT: `Stakeholder role: ${role}` }, role === 'District Social Welfare Officer' ? undefined : role),
    );
    if (out) setQs(out.data.questions.map((q) => ({ ...q, answer: '' })));
  }

  function save() {
    const answered = qs.filter((q) => q.answer.trim());
    const prefix = prefixFor('Interview', p.sources);
    const docId = uid('src');
    const doc: SourceDoc = {
      id: docId, prefix, name: `Interview with ${role}${who ? ` (${who})` : ''}`, kind: 'Interview', language: 'en', date: nowIso().slice(0, 10), authority: role, addedAt: nowIso(),
      clauses: answered.map((q, i) => {
        const text = `${q.question} Answer: ${q.answer.trim()}`;
        return { id: `${prefix}-${i + 1}`, docId, label: `Question ${i + 1}`, original: text, english: text, type: guessClauseType(q.answer) };
      }),
    };
    update('Recorded interview', doc.name, (x) => { x.sources.push(doc); });
    toast.success(`Saved as source ${prefix} with ${answered.length} citable clauses`);
    setQs([]);
  }

  return (
    <div className="space-y-4">
      <Panel title="Interview a stakeholder" subtitle="Generate a role-specific question set to use in a meeting. Answers are saved as a new source (INT-n clauses) that requirements can cite.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Role" htmlFor="iv-role" className="w-72">
            <Select id="iv-role" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</Select>
          </Field>
          <Field label="Name and office (optional)" htmlFor="iv-who" className="w-72">
            <Input id="iv-who" value={who} onChange={(e) => setWho(e.target.value)} placeholder="DSWO, Nagarpur" />
          </Field>
          <Button onClick={generate} loading={ai.busy} disabled={!role}>Generate questions</Button>
        </div>
        {ai.error && <div className="mt-3"><ErrorBox title="Could not generate questions" message={ai.error} /></div>}
      </Panel>
      {qs.length > 0 && (
        <Panel title={`Questions for ${role}`} actions={<Button variant="primary" size="sm" disabled={!qs.some((q) => q.answer.trim())} onClick={save}>Save answers as source</Button>}>
          <ol className="space-y-3">
            {qs.map((q, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{i + 1}. {q.question}</p>
                <p className="mb-1 text-xs text-ink-faint">{q.purpose}</p>
                <Textarea aria-label={`Answer ${i + 1}`} rows={2} value={q.answer} onChange={(e) => setQs((s) => s.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
