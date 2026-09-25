import type { Project } from '@/lib/types';
import { unresolvedFindings } from './model';
import { qualityFor } from './quality';

export type NextStep = { title: string; detail: string; href: string; cta: string };

export function nextStep(p: Project): NextStep {
  const b = `/projects/${p.id}`;
  if (!p.sources.length) return { title: 'Add source documents', detail: 'Upload the GO, guidelines, corrigenda, minutes or a voice brief. Each source is split into citable clauses.', href: `${b}/sources`, cta: 'Add sources' };
  const drafted = p.requirements.length > 0;
  if (!drafted && !p.reconciledAt) return { title: 'Reconcile sources', detail: 'Detect conflicts, supersessions by corrigenda and missing annexures before drafting.', href: `${b}/reconcile`, cta: 'Run reconciliation' };
  const un = unresolvedFindings(p).length;
  if (!drafted && un) return { title: `Resolve ${un} source finding${un > 1 ? 's' : ''}`, detail: 'Drafting is blocked until every conflict, supersession and missing reference is resolved or deferred.', href: `${b}/reconcile`, cta: 'Resolve findings' };
  if (!drafted && !p.discovery) return { title: 'Run discovery', detail: 'Extract objectives, roles and integrations, and check the sources against the checklist for this project type.', href: `${b}/discovery`, cta: 'Run discovery' };
  const open = p.questions.filter((q) => !q.answer && !q.assumed).length;
  if (!drafted && open) return { title: `Answer ${open} clarifying question${open > 1 ? 's' : ''}`, detail: 'Unanswered questions can be recorded as assumptions, which must be confirmed in review.', href: `${b}/discovery`, cta: 'Answer questions' };
  if (!drafted && !p.workflow) return { title: 'Design the workflow', detail: 'Propose the application state machine with actors, SLAs, escalations and notifications.', href: `${b}/workflow`, cta: 'Open workflow designer' };
  if (!drafted && !p.rules.length) return { title: 'Build decision tables', detail: 'Convert eligibility clauses into testable decision tables with boundary tests.', href: `${b}/rules`, cta: 'Open rules' };
  if (!p.requirements.length) return { title: 'Generate the FRS', detail: 'Assemble the document from the model and generate requirements per module.', href: `${b}/document`, cta: 'Generate FRS' };
  const q = qualityFor(p);
  const high = q.issues.filter((i) => i.status === 'Open' && i.severity === 'High').length;
  if (high && p.status !== 'Approved') return { title: `Fix ${high} high-severity quality issue${high > 1 ? 's' : ''}`, detail: `Quality score ${q.total} of 100. Coverage gaps, missing criteria and workflow defects are listed with fixes.`, href: `${b}/quality`, cta: 'Open quality' };
  if (p.status === 'Draft' || p.status === 'Changes requested') return { title: 'Submit for review', detail: `Quality score ${q.total} of 100. Send the draft to the Joint Director (IT) with a note.`, href: `${b}/review`, cta: 'Open review' };
  if (p.status === 'In review') return { title: 'Review and approve', detail: 'The reviewer forwards the draft; the Director approves it, which freezes the baseline.', href: `${b}/review`, cta: 'Open review' };
  return { title: 'Baseline approved: manage change', detail: 'Assess corrigenda and vendor change requests against the baseline, and export deliverables.', href: `${b}/changes`, cta: 'Open change control' };
}

export function modelCompleteness(p: Project) {
  return [
    { label: 'Sources and clauses', done: p.sources.length > 0, detail: `${p.sources.length} sources, ${p.sources.reduce((s, d) => s + d.clauses.length, 0)} clauses`, href: 'sources' },
    { label: 'Reconciliation', done: !!p.reconciledAt && unresolvedFindings(p).length === 0, detail: p.reconciledAt ? `${p.reconciliations.length} findings, ${unresolvedFindings(p).length} open` : 'Not run', href: 'reconcile' },
    { label: 'Discovery and questions', done: !!p.discovery, detail: p.discovery ? `${p.questions.filter((q) => q.answer || q.assumed).length} of ${p.questions.length} questions closed` : 'Not run', href: 'discovery' },
    { label: 'Workflow', done: !!p.workflow, detail: p.workflow ? `${p.workflow.states.length} states, ${p.workflow.transitions.length} transitions` : 'Not designed', href: 'workflow' },
    { label: 'Data dictionary', done: p.entities.length > 0, detail: p.entities.length ? `${p.entities.reduce((s, e) => s + e.fields.length, 0)} fields` : 'Not built', href: 'data' },
    { label: 'Business rules', done: p.rules.length > 0, detail: p.rules.length ? `${p.rules.length} decision tables` : 'Not built', href: 'rules' },
    { label: 'Roles and permissions', done: !!p.permissions, detail: p.permissions ? `${p.permissions.roles.length} roles` : 'Not built', href: 'roles' },
    { label: 'Requirements', done: p.requirements.length > 0, detail: `${p.requirements.length} requirements`, href: 'document' },
  ];
}
