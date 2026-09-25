'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { useRepo, usePersona } from '@/lib/repo/store';
import { Badge, Button, ErrorBox, Field, Modal, Notice, PageHeader, Progress, Textarea } from '@/components/ui';
import { RequirementBlock, RequirementEditor, ChangeView } from '@/components/doc/RequirementBlock';
import { Assumptions, DataSection, DocControl, H, Narrative, OpenIssues, PermissionsSection, RulesSection, SignOff, Stakeholders, Traceability, WorkflowSection } from '@/components/doc/Sections';
import { generateModule, generateNarrative, generationBlocked, moduleName, modulesFor, NARRATIVE, regenerateFromModel, reuseSuggestions } from '@/lib/generate/run';
import { applyChange, pendingAdds, pendingFor } from '@/lib/engine/changes';
import { outOfDate } from '@/lib/engine/quality';
import { sortRequirements } from '@/lib/engine/generate';
import { REUSE_THRESHOLD } from '@/lib/engine/similarity';
import { ensureDraft } from '@/lib/engine/versioning';
import type { Requirement, TrackedChange } from '@/lib/types';
import { cn, nowIso, uid } from '@/lib/util';

const FUNCTIONAL = ['REG', 'APP', 'DOC', 'VER', 'BR', 'VAL', 'PAY', 'NOT', 'ESC', 'GRV', 'ADM', 'PRIV'];
const MODEL_MODULES = ['BR', 'VAL', 'ESC', 'PRIV'];

export default function DocumentPage() {
  const { project: p, update } = useCurrentProject();
  const projects = useRepo((s) => s.projects);
  const persona = usePersona();
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [stages, setStages] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ module: string; message: string }[]>([]);
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [busyModule, setBusyModule] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Requirement> | null>(null);
  const [comment, setComment] = useState<{ reqId: string; text: string } | null>(null);
  const blocked = generationBlocked(p);
  const modules = modulesFor(p);

  useEffect(() => {
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }), 200);
  }, []);

  const reuse = useMemo(() => reuseSuggestions(p, projects, REUSE_THRESHOLD), [p, projects]);
  const sorted = useMemo(() => sortRequirements(p.requirements), [p.requirements]);
  const byModule = (m: string) => sorted.filter((r) => r.module === m);
  const stale = p.requirements.filter((r) => outOfDate(p, r).length > 0);

  async function generateAll() {
    setErrors([]);
    const st = ['Assembling requirements from the workflow, rules and data dictionary', 'Adding catalogue integrations and the NFR baseline', ...modules.map((m) => `Generating ${moduleName(m)} requirements with reuse examples`), ...NARRATIVE.map((s) => `Writing ${s === 'asis' ? 'As-Is' : s === 'tobe' ? 'To-Be' : 'Introduction'} section`), 'Validating references and acceptance criteria'];
    setStages(st);
    setRunning(true);
    setStage(0);
    regenerateFromModel(p.id);
    setStage(2);
    const errs: { module: string; message: string }[] = [];
    for (const [i, m] of modules.entries()) {
      setStage(2 + i);
      try {
        await generateModule(p.id, m);
      } catch (e) {
        errs.push({ module: m, message: (e as Error).message });
      }
    }
    for (const [i, s] of NARRATIVE.entries()) {
      setStage(2 + modules.length + i);
      try {
        await generateNarrative(p.id, s, (t) => setStreaming((x) => ({ ...x, [s]: t })));
      } catch (e) {
        errs.push({ module: s, message: (e as Error).message });
      }
      setStreaming((x) => ({ ...x, [s]: '' }));
    }
    setStage(st.length - 1);
    setErrors(errs);
    setRunning(false);
    const n = useRepo.getState().projects.find((x) => x.id === p.id)!.requirements.length;
    if (errs.length) toast.error(`FRS generated with ${errs.length} failed step${errs.length > 1 ? 's' : ''}. Retry them below.`);
    else toast.success(`FRS generated: ${n} requirements, every one cited`);
  }

  async function regenModule(m: string) {
    setBusyModule(m);
    try {
      if (MODEL_MODULES.includes(m) || m === 'INT') regenerateFromModel(p.id, `Regenerated ${m} from the model`);
      else {
        regenerateFromModel(p.id);
        await generateModule(p.id, m);
      }
      setErrors((e) => e.filter((x) => x.module !== m));
      toast.success(`${moduleName(m)} regenerated. Other modules keep their IDs.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyModule(null);
    }
  }

  async function regenSection(s: string) {
    setBusyModule(s);
    try {
      await generateNarrative(p.id, s, (t) => setStreaming((x) => ({ ...x, [s]: t })));
      setErrors((e) => e.filter((x) => x.module !== s));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStreaming((x) => ({ ...x, [s]: '' }));
      setBusyModule(null);
    }
  }

  const decide = (c: TrackedChange, accept: boolean) =>
    update(accept ? 'Accepted tracked change' : 'Rejected tracked change', `${c.targetId}: ${c.reason}`, (x) => {
      const ch = x.changes.find((y) => y.id === c.id)!;
      if (accept) {
        ensureDraft(x);
        applyChange(x, ch);
      } else ch.status = 'Rejected';
    });

  function adoptReuse(r: Requirement) {
    const s = reuse.get(r.id);
    if (!s) return;
    update('Proposed reuse', `${r.id} from ${s.item.req.id}`, (x) => {
      x.changes.push({
        id: uid('chg'), targetId: r.id, kind: 'Modify', status: 'Pending', createdAt: nowIso(), origin: 'Reuse library',
        reason: `Adopt ${s.item.req.id} from ${s.item.projectName} (approved), keeping this project's references`,
        before: { title: r.title, description: r.description, acceptanceCriteria: r.acceptanceCriteria, refs: r.refs },
        after: { title: s.item.req.title, description: s.item.req.description, acceptanceCriteria: s.item.req.acceptanceCriteria, refs: r.refs, origin: 'Reused', reusedFrom: `${s.item.req.id}, ${s.item.projectName}` },
      });
    });
    toast('Reuse proposed as a tracked change. Review and accept it below the requirement.');
  }

  function saveEdit(v: Partial<Requirement>) {
    if (!v.id) {
      update('Added requirement', v.title, (x) => {
        ensureDraft(x);
        const c: TrackedChange = { id: uid('chg'), targetId: 'NEW', kind: 'Add', status: 'Pending', createdAt: nowIso(), origin: 'Manual', reason: 'Added by author', after: { ...v, origin: 'Manual' } };
        applyChange(x, c);
      });
    } else {
      update('Edited requirement', v.id, (x) => {
        ensureDraft(x);
        const r = x.requirements.find((y) => y.id === v.id)!;
        Object.assign(r, v, { generatedAt: nowIso(), status: 'Draft', origin: r.origin === 'FromModel' ? 'Manual' : r.origin, modelKey: undefined });
      });
    }
    setEdit(null);
  }

  const toc = [
    ['control', '1', 'Document control'], ['introduction', '2', 'Introduction'], ['asis', '3', 'As-Is process'], ['tobe', '4', 'To-Be process'],
    ['stakeholders', '5', 'Stakeholders and roles'], ['workflow', '6', 'Application workflow'], ['functional', '7', 'Functional requirements'],
    ['data', '8', 'Data dictionary'], ['rules', '9', 'Business rules'], ['permissions', '10', 'Role-permission matrix'], ['integrations', '11', 'Integration requirements'],
    ['reports', '12', 'Reports and MIS'], ['nfr', '13', 'Non-functional requirements'], ['assumptions', '14', 'Assumptions'], ['openissues', '15', 'Open issues'],
    ['traceability', '16', 'Traceability matrix'], ['signoff', '17', 'Sign-off'],
  ];

  const renderReqs = (list: Requirement[]) =>
    list.map((r) => (
      <RequirementBlock
        key={r.id}
        p={p}
        r={r}
        pending={pendingFor(p, r.id)}
        reuse={reuse.get(r.id)}
        onEdit={() => setEdit(r)}
        onUseReuse={() => adoptReuse(r)}
        onAccept={(c) => decide(c, true)}
        onReject={(c) => decide(c, false)}
        onComment={() => setComment({ reqId: r.id, text: '' })}
      />
    ));

  const moduleBlock = (m: string, n: string) => {
    const list = byModule(m);
    const adds = pendingAdds(p, m);
    if (!list.length && !adds.length) return null;
    const llm = !MODEL_MODULES.includes(m);
    return (
      <section key={m} className="mb-4" id={`mod-${m}`}>
        <div className="mb-1 flex items-center justify-between border-b border-line pb-1">
          <h3 className="font-serif text-base font-semibold">{n} {moduleName(m)} <span className="font-sans text-xs font-normal text-ink-faint">({list.length})</span></h3>
          <Button size="sm" variant="ghost" onClick={() => regenModule(m)} loading={busyModule === m} disabled={running}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />{llm ? 'Regenerate module' : 'Refresh from model'}
          </Button>
        </div>
        {renderReqs(list)}
        {adds.map((c) => <ChangeView key={c.id} c={c} onAccept={() => decide(c, true)} onReject={() => decide(c, false)} />)}
      </section>
    );
  };

  const functionalModules = FUNCTIONAL.filter((m) => byModule(m).length || pendingAdds(p, m).length);

  return (
    <div>
      <PageHeader
        title="FRS document"
        subtitle="Assembled from the requirements model. Narrative and per-module requirements are generated; workflow, data, rules, permissions and traceability come straight from the model. Click any reference to see its clause."
        actions={
          <>
            {p.requirements.length > 0 && <Button onClick={() => setEdit({ module: 'APP', kind: 'FR', priority: 'Must', refs: [], acceptanceCriteria: [] })}><Plus className="h-4 w-4" aria-hidden />Add requirement</Button>}
            {p.requirements.length > 0 && <Link href={`/projects/${p.id}/export`}><Button>Export</Button></Link>}
            <Button variant={p.requirements.length ? 'secondary' : 'primary'} onClick={generateAll} loading={running} disabled={!!blocked}>{p.requirements.length ? 'Regenerate all' : 'Generate FRS'}</Button>
          </>
        }
      />
      {blocked && <Notice tone="warn" className="mb-4">{blocked} <Link href={`/projects/${p.id}/reconcile`} className="underline">Go to Reconcile</Link></Notice>}
      {running && <div className="mb-4 max-w-2xl"><Progress stages={stages} current={stage} /></div>}
      {errors.length > 0 && (
        <div className="mb-4">
          <ErrorBox
            title="Some parts could not be generated"
            message={errors.map((e) => `${moduleName(e.module)}: ${e.message}`).join(' ')}
            action={<div className="flex flex-wrap gap-2">{errors.map((e) => <Button key={e.module} size="sm" onClick={() => (NARRATIVE.includes(e.module as 'asis') ? regenSection(e.module) : regenModule(e.module))}>Retry {moduleName(e.module)}</Button>)}</div>}
          />
        </div>
      )}
      {stale.length > 0 && !running && (
        <Notice tone="warn" className="mb-4">
          {stale.length} requirement{stale.length > 1 ? 's are' : ' is'} out of date because the workflow, rules or answers they cite changed.{' '}
          <button className="underline" onClick={() => { regenerateFromModel(p.id, 'Refreshed requirements from the model'); toast.success('Model-derived requirements refreshed'); }}>Refresh model-derived requirements</button>
        </Notice>
      )}
      {!p.requirements.length && !running ? (
        !blocked && (
          <div className="rounded-md border border-dashed border-line bg-white px-6 py-8">
            <p className="text-sm text-ink-muted">The model is ready: {p.workflow ? `${p.workflow.transitions.length} workflow transitions` : 'no workflow yet'}, {p.rules.length} decision tables, {p.entities.reduce((s, e) => s + e.fields.length, 0)} data fields, {p.questions.filter((q) => q.answer || q.assumed).length} answers and assumptions. Generate the FRS from it.</p>
            <Button variant="primary" className="mt-3" onClick={generateAll}>Generate FRS</Button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-[200px_1fr] gap-5">
          <nav aria-label="Document sections" className="sticky top-16 self-start text-sm">
            <ol className="space-y-0.5">
              {toc.map(([id, n, t]) => (
                <li key={id}><a href={`#sec-${id}`} className="block rounded px-2 py-0.5 text-ink-muted hover:bg-white hover:text-ink"><span className="mr-1 text-ink-faint">{n}</span>{t}</a></li>
              ))}
            </ol>
            <div className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
              <p>{p.requirements.length} requirements</p>
              <p>{p.changes.filter((c) => c.status === 'Pending').length} pending tracked changes</p>
              {p.status !== 'Approved' && <Badge tone="warn" className="mt-1">Draft, not approved</Badge>}
            </div>
          </nav>
          <div className={cn('doc min-w-0 rounded-md border border-line bg-white px-8 py-6')}>
            {p.status !== 'Approved' && <p className="mb-4 text-center font-sans text-xs font-semibold tracking-wide text-bad">DRAFT: NOT APPROVED</p>}
            <p className="text-center font-serif text-sm text-ink-muted">Government of Rajyapradesh · {p.department} Department</p>
            <h1 className="mb-6 text-center font-serif text-2xl font-semibold">Functional Requirements Specification<br /><span className="text-xl">{p.name}</span></h1>
            <H id="control" n="1">Document control</H>
            <DocControl p={p} />
            {NARRATIVE.map((s, i) => (
              <div key={s}>
                <H id={s} n={String(i + 2)}>
                  <span className="flex items-center justify-between">
                    {s === 'introduction' ? 'Introduction' : s === 'asis' ? 'As-Is process' : 'To-Be process'}
                    <Button size="sm" variant="ghost" className="font-sans" onClick={() => regenSection(s)} loading={busyModule === s} disabled={running}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Regenerate</Button>
                  </span>
                </H>
                <Narrative p={p} text={streaming[s] || p.sections[s]} />
              </div>
            ))}
            <H id="stakeholders" n="5">Stakeholders and roles</H>
            <Stakeholders p={p} />
            <H id="workflow" n="6">Application workflow</H>
            <WorkflowSection p={p} />
            <H id="functional" n="7">Functional requirements</H>
            {functionalModules.map((m, i) => moduleBlock(m, `7.${i + 1}`))}
            <H id="data" n="8">Data dictionary</H>
            <DataSection p={p} />
            <H id="rules" n="9">Business rules</H>
            <RulesSection p={p} />
            <H id="permissions" n="10">Role-permission matrix</H>
            <PermissionsSection p={p} />
            <H id="integrations" n="11">Integration requirements</H>
            {moduleBlock('INT', '11.1') ?? <p className="font-sans text-sm text-ink-faint">No integrations identified.</p>}
            <H id="reports" n="12">Reports and MIS</H>
            {moduleBlock('RPT', '12.1') ?? <p className="font-sans text-sm text-ink-faint">No reports specified.</p>}
            <H id="nfr" n="13">Non-functional requirements</H>
            {moduleBlock('NFR', '13.1')}
            <H id="assumptions" n="14">Assumptions</H>
            <Assumptions p={p} />
            <H id="openissues" n="15">Open issues</H>
            <OpenIssues p={p} />
            <H id="traceability" n="16">Traceability matrix</H>
            <Traceability p={p} />
            <H id="signoff" n="17">Sign-off</H>
            <SignOff p={p} />
          </div>
        </div>
      )}
      {edit && (
        <RequirementEditor
          r={edit}
          isNew={!edit.id}
          modules={[...FUNCTIONAL.filter((m) => !MODEL_MODULES.includes(m)), 'RPT', 'NFR']}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
          onDelete={edit.id ? () => { update('Deleted requirement', edit.id, (x) => { ensureDraft(x); x.requirements = x.requirements.filter((r) => r.id !== edit.id); }); setEdit(null); } : undefined}
        />
      )}
      <Modal
        open={!!comment}
        onClose={() => setComment(null)}
        title={`Comment on ${comment?.reqId}`}
        footer={
          <>
            <Button onClick={() => setComment(null)}>Cancel</Button>
            <Button variant="primary" disabled={!comment?.text.trim()} onClick={() => { update('Commented', comment!.reqId, (x) => { x.comments.push({ id: uid('C'), reqId: comment!.reqId, by: persona.name, designation: persona.designation, at: nowIso(), text: comment!.text.trim() }); }); setComment(null); toast.success('Comment added. It appears on the Review page.'); }}>Add comment</Button>
          </>
        }
      >
        <Field label={`As ${persona.name}, ${persona.designation}`} htmlFor="cmt"><Textarea id="cmt" rows={3} value={comment?.text ?? ''} onChange={(e) => setComment((c) => c && { ...c, text: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}
