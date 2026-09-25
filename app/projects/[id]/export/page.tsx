'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, FileText, FileType2, Languages } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { useRepo } from '@/lib/repo/store';
import { Badge, Button, Empty, ErrorBox, PageHeader, Panel } from '@/components/ui';
import { buildFrsDocx } from '@/lib/export/frs';
import { fullWorkbook, uatWorkbook } from '@/lib/export/excel';
import { frsMarkdown } from '@/lib/export/markdown';
import { changeNoteDocx, crNoteDocx } from '@/lib/export/notes';
import { translateTexts } from '@/lib/ai/client';
import { uatTests } from '@/lib/engine/uat';
import type { Project } from '@/lib/types';
import { download } from '@/lib/util';

/** Every string the Word builder passes through its translate function. */
function hindiStrings(p: Project) {
  const s = new Set<string>();
  const add = (x?: string) => x && x.trim() && s.add(x);
  ['Functional Requirements Specification', 'File number', 'Version', 'Prepared by', 'DRAFT: NOT APPROVED', 'Approved baseline', 'Version history', 'Date', 'By', 'Description', 'Working draft', 'Contents',
    'Document control', 'Introduction', 'As-Is process', 'To-Be process', 'Stakeholders and roles', 'Application workflow', 'Functional requirements', 'Data dictionary', 'Business rules', 'Role-permission matrix',
    'Integration requirements', 'Reports and MIS', 'Non-functional requirements', 'Assumptions', 'Open issues', 'Sign-off', 'Appendix A. Traceability matrix', 'Item', 'Details', 'Department', 'Project type',
    'Version and status', 'Sources', 'Role', 'Responsibility', 'Source', 'From', 'Action (actor)', 'To', 'Escalation', 'Notification', 'Requirement and acceptance criteria', 'Priority', 'Field', 'Type', 'Mandatory',
    'Validation', 'Source of value', 'Yes', 'No', 'Condition', 'Operator', 'Value', 'Outcome', 'Otherwise', 'renewal', 'Action', 'Topic', 'Assumption', 'Status', 'Confirmed', 'To be confirmed', 'Issue', 'Clauses',
    'Name', 'Designation', 'Signature and date', 'Reviewed by', 'Approved by', 'Accepted by', 'Approved', 'Clause', 'Requirements', 'Covered', 'Not covered', 'Context', 'Not applicable', 'Superseded by', 'Overridden by',
    'Senior Systems Analyst, Directorate of IT', 'Joint Director (IT)', 'Director (IT)', 'Not generated.', 'None.', 'Not built.'].forEach(add);
  Object.values(p.sections).forEach((t) => t.split(/\n\s*\n/).forEach((x) => add(x.replace(/\[([A-Z][A-Z0-9]*-[A-Za-z0-9.()-]+)\]/g, '($1)'))));
  p.requirements.forEach((r) => { add(r.title); add(r.description); r.acceptanceCriteria.forEach(add); });
  p.discovery?.roles.forEach((r) => { add(r.name); add(r.description); });
  p.workflow?.states.forEach((x) => add(x.name));
  p.workflow?.transitions.forEach((t) => { add(t.action); add(t.actor); add(t.escalation?.to); add(t.notification?.template); });
  p.rules.forEach((r) => { add(r.name); add(r.outcome); add(r.failOutcome); r.conditions.forEach((c) => add(c.label)); });
  p.entities.forEach((e) => e.fields.forEach((f) => { add(f.label); add(f.validation); }));
  p.questions.forEach((q) => { add(q.topic); add(q.defaultAssumption); });
  p.reconciliations.forEach((r) => add(r.description));
  return Array.from(s);
}

export default function ExportPage() {
  const { project: p } = useCurrentProject();
  const log = useRepo((s) => s.log);
  const [busy, setBusy] = useState<string | null>(null);
  const [hindi, setHindi] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slug = `${p.fileNo.replace(/\//g, '-')}-v${p.version}`;

  async function go(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      log('Exported', key, p.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportHindi() {
    const texts = hindiStrings(p);
    setHindi({ done: 0, total: texts.length });
    const map = new Map<string, string>();
    const batch = 40;
    for (let i = 0; i < texts.length; i += batch) {
      const part = texts.slice(i, i + batch);
      const out = await translateTexts(p, part, 'en', 'hi');
      part.forEach((t, j) => map.set(t, out[j] || t));
      setHindi({ done: Math.min(i + batch, texts.length), total: texts.length });
    }
    const blob = await buildFrsDocx(p, { t: (s) => map.get(s) ?? s, language: 'hi' });
    download(`FRS-${slug}-hi.docx`, blob);
    setHindi(null);
  }

  if (!p.requirements.length)
    return (
      <div>
        <PageHeader title="Export" />
        <Empty text="Generate the FRS before exporting." action={<Link href={`/projects/${p.id}/document`}><Button variant="primary">Go to Document</Button></Link>} />
      </div>
    );

  const Row = ({ k, icon: Icon, title, detail, action }: { k: string; icon: typeof FileText; title: string; detail: string; action: () => Promise<void> }) => (
    <li className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
      <Icon className="h-5 w-5 shrink-0 text-navy" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-ink-muted">{detail}</p>
      </div>
      <Button onClick={() => go(k, action)} loading={busy === k} disabled={!!busy && busy !== k}>Download</Button>
    </li>
  );

  return (
    <div>
      <PageHeader title="Export" subtitle="Every export is generated from the same model, so the FRS, test cases, traceability and notes stay consistent." />
      {error && <div className="mb-4"><ErrorBox title="Export failed" message={error} /></div>}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="FRS document" bodyClass="p-0">
          <ul>
            <Row k="Word FRS" icon={FileText} title="FRS in Word (.docx)" detail={`Cover page, version history, contents, all sections, requirement tables, workflow diagram and table, data dictionary, decision tables, permission matrix, traceability appendix and sign-off.${p.status !== 'Approved' ? ' Marked DRAFT until approved.' : ''}`} action={async () => download(`FRS-${slug}.docx`, await buildFrsDocx(p))} />
            <li className="flex items-center gap-4 border-b border-line px-4 py-3">
              <Languages className="h-5 w-5 shrink-0 text-navy" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-medium">FRS in Hindi (.docx)</p>
                <p className="text-xs text-ink-muted">Translated with Sarvam, preserving requirement IDs, clause IDs and acronyms. Devanagari set in Nirmala UI.</p>
                {hindi && <p className="mt-1 text-xs text-navy">Translating {hindi.done} of {hindi.total} passages</p>}
              </div>
              <Button onClick={() => go('Hindi FRS', exportHindi)} loading={busy === 'Hindi FRS'} disabled={!!busy && busy !== 'Hindi FRS'}>Download</Button>
            </li>
            <Row k="Markdown" icon={FileType2} title="Markdown copy (.md)" detail="Plain text version for version control or wikis." action={async () => download(`FRS-${slug}.md`, frsMarkdown(p), 'text/markdown')} />
          </ul>
        </Panel>
        <Panel title="Workbooks" bodyClass="p-0">
          <ul>
            <Row k="UAT Excel" icon={FileSpreadsheet} title="UAT test cases (.xlsx)" detail={`${uatTests(p).length} test cases: from acceptance criteria, decision-table boundaries and workflow paths. Columns: TC ID, Req ID, precondition, steps, test data, expected result.`} action={async () => download(`UAT-${slug}.xlsx`, await uatWorkbook(p))} />
            <Row k="Full Excel" icon={FileSpreadsheet} title="Traceability, requirements, coverage, UAT and data dictionary (.xlsx)" detail="One workbook with a sheet for each." action={async () => download(`FRS-workbook-${slug}.xlsx`, await fullWorkbook(p))} />
          </ul>
        </Panel>
        <Panel title="Change control notes" className="col-span-2" bodyClass="p-0">
          {p.impacts.length === 0 && p.crs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-muted">Change notes for corrigenda and assessment notes for vendor change requests appear here once they are run on the Changes page.</p>
          ) : (
            <ul>
              {p.impacts.map((imp) => {
                const cor = p.sources.find((d) => d.id === imp.corrigendumDocId);
                return <Row key={imp.id} k={imp.id} icon={FileText} title={`Change note: ${cor?.name}`} detail={`${imp.affected.length} affected items, ${imp.status === 'Applied' ? 'applied' : 'awaiting decision'}`} action={async () => download(`Change-note-${slug}-${cor?.prefix}.docx`, await changeNoteDocx(p, imp))} />;
              })}
              {p.crs.map((c) => <Row key={c.id} k={c.id} icon={FileText} title={`CR assessment note: ${c.title}`} detail={c.items.map((i) => i.classification).join(', ')} action={async () => download(`CR-assessment-${c.id}.docx`, await crNoteDocx(p, c))} />)}
            </ul>
          )}
        </Panel>
      </div>
      <p className="mt-4 text-xs text-ink-faint">Status of this export: <Badge>{p.status}</Badge> v{p.version}</p>
    </div>
  );
}
