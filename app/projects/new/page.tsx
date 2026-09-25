'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Check, FileText, Plus } from 'lucide-react';
import { useRepo, usePersona } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { projectTypes } from '@/config/branding';
import type { ProjectType } from '@/lib/types';
import { emptyProject } from '@/lib/seed/helpers';
import { gapTopics, complianceItems } from '@/lib/engine/reference';
import { AddSourceModal } from '@/components/sources/AddSource';
import { Badge, Button, Empty, ErrorBox, Field, Input, Notice, PageHeader, PageSkeleton, Panel, Select, Textarea, td, th } from '@/components/ui';
import { cn, nowIso, uid } from '@/lib/util';

const typeHelp: Record<ProjectType, string> = {
  benefit: 'Scholarships, pensions and other schemes where citizens apply and receive a payment (DBT).',
  permit: 'Building plans, trade permissions and other applications that end in an approval or certificate.',
  grievance: 'Complaints and cases routed across offices with SLAs and escalation.',
  mis: 'Dashboards and reports built from departmental data.',
  licence: 'Licences with issue, renewal, suspension and fee payment.',
};

export default function NewProjectPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const createdId = params.get('id');
  const project = useRepo((s) => s.projects.find((p) => p.id === createdId));
  const projects = useRepo((s) => s.projects);
  const addProject = useRepo((s) => s.addProject);
  const update = useRepo((s) => s.update);
  const persona = usePersona();
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [fileNo, setFileNo] = useState('');
  const [type, setType] = useState<ProjectType>('benefit');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!hydrated) return <PageSkeleton />;

  const step = !createdId ? 1 : 2;

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !department.trim() || !fileNo.trim()) return setError('Enter the project name, department and file number.');
    if (projects.some((p) => p.fileNo.trim().toLowerCase() === fileNo.trim().toLowerCase())) return setError(`File number ${fileNo.trim()} is already used by another project.`);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';
    const id = `${slug}-${uid('p').slice(-4)}`;
    const now = nowIso();
    const p = emptyProject({ id, name: name.trim(), department: department.trim(), fileNo: fileNo.trim(), type, status: 'Draft', version: '0.1', owner: persona.name, createdAt: now, updatedAt: now, description: description.trim() });
    p.reconciledAt = undefined; // reconciliation runs once sources are added
    addProject(p);
    router.replace(`/projects/new?id=${id}`);
  }

  if (createdId && !project)
    return (
      <div>
        <PageHeader title="New project" />
        <ErrorBox title="This project no longer exists" message="It may have been deleted when data was reset. Start again to create a new project." action={<Link href="/projects/new"><Button size="sm">Start again</Button></Link>} />
      </div>
    );

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="New project" subtitle="Create the FRS project, choose its type and add the source documents received from the department." />
      <ol className="flex items-center gap-2 text-sm" aria-label="Steps">
        {['Project details and type', 'Add sources', 'Start analysis'].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold', i + 1 < step ? 'border-ok bg-ok text-white' : i + 1 === step ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink-faint')}>
              {i + 1 < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={i + 1 === step ? 'font-semibold text-ink' : 'text-ink-muted'}>{s}</span>
            {i < 2 && <span className="mx-1 h-px w-10 bg-line" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form onSubmit={create} className="space-y-4">
          <Panel title="Project details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project name" htmlFor="np-name" className="col-span-2">
                <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Online Widow Pension Sanction" autoFocus />
              </Field>
              <Field label="Line department" htmlFor="np-dept">
                <Input id="np-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Social Welfare" />
              </Field>
              <Field label="File number" htmlFor="np-file">
                <Input id="np-file" value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="IT/SW/2026/0150" />
              </Field>
              <Field label="Purpose (optional)" htmlFor="np-desc" className="col-span-2">
                <Textarea id="np-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences on what the department wants to achieve." />
              </Field>
            </div>
          </Panel>
          <Panel title="Project type" subtitle="Drives the gap checklist, compliance checklist, NFR baseline and FRS template.">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Project type">
              {(Object.keys(projectTypes) as ProjectType[]).map((k) => (
                <label key={k} className={cn('flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 text-sm', type === k ? 'border-navy bg-navy-soft' : 'border-line bg-white hover:border-navy/50')}>
                  <input type="radio" name="np-type" value={k} checked={type === k} onChange={() => setType(k)} className="mt-0.5 accent-navy" />
                  <span>
                    <span className="block font-medium">{projectTypes[k]}</span>
                    <span className="block text-xs text-ink-muted">{typeHelp[k]}</span>
                    <span className="mt-1 block text-xs text-ink-faint">{gapTopics(k).length} checklist topics, {complianceItems(k).length} compliance items</span>
                  </span>
                </label>
              ))}
            </div>
          </Panel>
          {error && <ErrorBox title="Cannot create the project" message={error} />}
          <div className="flex gap-2">
            <Button type="submit" variant="primary">Create project and add sources<ArrowRight className="h-4 w-4" aria-hidden /></Button>
            <Link href="/projects"><Button type="button">Cancel</Button></Link>
          </div>
        </form>
      )}

      {step === 2 && project && (
        <>
          <Notice tone="ok">Project <strong>{project.name}</strong> created with file number {project.fileNo}. Add the GO, guidelines, corrigenda, minutes, a scanned form or a voice brief. Each is split into citable clauses.</Notice>
          <Panel
            title={`Sources (${project.sources.length})`}
            actions={<Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Add source</Button>}
          >
            {project.sources.length === 0 ? (
              <Empty text="No sources yet. Start with the Government Order." action={<Button variant="primary" onClick={() => setAdding(true)}>Add source</Button>} />
            ) : (
              <div className="overflow-hidden rounded-md border border-line">
                <table className="w-full">
                  <thead><tr><th className={th}>Source</th><th className={th}>Type</th><th className={th}>Reference</th><th className={th + ' text-right'}>Clauses</th><th className={th}>Language</th></tr></thead>
                  <tbody>
                    {project.sources.map((d) => (
                      <tr key={d.id}>
                        <td className={td}><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-ink-faint" aria-hidden />{d.name}</span></td>
                        <td className={td}><Badge>{d.prefix}</Badge></td>
                        <td className={td + ' text-ink-muted'}>{d.refNo ?? ''}</td>
                        <td className={td + ' text-right tabular-nums'}>{d.clauses.length}</td>
                        <td className={td}>{d.language === 'en' ? 'English' : d.language === 'hi' ? 'Hindi, with English translation' : d.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={!project.sources.length} onClick={() => { toast.success('Next: reconcile the sources before drafting'); router.push(`/projects/${project.id}/reconcile`); }}>
              Continue to reconciliation<ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <Link href={`/projects/${project.id}`}><Button>Open project overview</Button></Link>
            {!project.sources.length && <span className="text-xs text-ink-muted">Add at least one source to continue.</span>}
          </div>
          <AddSourceModal open={adding} onClose={() => setAdding(false)} project={project} onAdded={(d) => update(project.id, 'Added source', `${d.prefix}: ${d.name}`, (x) => { x.sources.push(d); })} />
        </>
      )}
    </div>
  );
}
