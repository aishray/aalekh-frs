'use client';

import { AlignmentType, Document, ImageRun, Packer, PageBreak, Paragraph } from 'docx';
import type { Project, Requirement } from '@/lib/types';
import { branding, projectTypes } from '@/config/branding';
import { assumptions, clauseState, coverageClauses } from '@/lib/engine/model';
import { fmtValue } from '@/lib/engine/rules';
import { sortRequirements } from '@/lib/engine/generate';
import { moduleName } from '@/lib/generate/run';
import { renderWorkflowSvg } from '@/components/WorkflowDiagram';
import { fmtDate } from '@/lib/util';
import { docStyles, heading, pageFooter, pageHeader, para, run, table } from './docxkit';

/** Mermaid SVG to PNG bytes, for embedding the workflow diagram in Word. */
export async function workflowPng(p: Project): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  if (!p.workflow) return null;
  try {
    const svg = await renderWorkflowSvg(p.workflow, 'wfdocx');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const el = doc.documentElement;
    const vb = (el.getAttribute('viewBox') ?? '0 0 1200 500').split(/\s+/).map(Number);
    const w = vb[2] || 1200;
    const h = vb[3] || 500;
    el.setAttribute('width', String(w));
    el.setAttribute('height', String(h));
    const xml = new XMLSerializer().serializeToString(el);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    await img.decode();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png'));
    return { data: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
  } catch {
    return null; // The workflow table is complete without the diagram.
  }
}

export type Translate = (s: string) => string;
const same: Translate = (s) => s;
const stripRefs = (s: string) => s.replace(/\[([A-Z][A-Z0-9]*-[A-Za-z0-9.()-]+)\]/g, '($1)');

export function reqRows(reqs: Requirement[], t: Translate) {
  return reqs.map((r) => [
    r.id,
    [
      para(t(r.title), { bold: true, size: 19 }),
      para(t(r.description), { size: 19 }),
      ...r.acceptanceCriteria.map((a, i) => para(`AC${i + 1}. ${t(a)}`, { size: 17, color: '4A5565' })),
    ],
    r.priority,
    r.refs.join(', '),
  ]);
}

export async function buildFrsDocx(p: Project, opts: { t?: Translate; language?: 'en' | 'hi' } = {}): Promise<Blob> {
  const t = opts.t ?? same;
  const draft = p.status !== 'Approved';
  const reqs = sortRequirements(p.requirements);
  const png = await workflowPng(p);
  const body: (Paragraph | ReturnType<typeof table>)[] = [];
  const H = (s: string, l: 1 | 2 | 3 = 1) => body.push(heading(t(s), l));
  const P = (s: string) => body.push(para(t(stripRefs(s))));
  let n = 0;
  const sec = (title: string) => H(`${++n}. ${title}`);

  // Cover page
  body.push(
    para(`Government of ${branding.state}`, { alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 120 }, size: 26 }),
    para(`${p.department} Department`, { alignment: AlignmentType.CENTER, size: 24 }),
    para(t('Functional Requirements Specification'), { alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 }, bold: true, size: 40, color: '1D3F6E' }),
    para(p.name, { alignment: AlignmentType.CENTER, bold: true, size: 32 }),
    para(`${t('File number')}: ${p.fileNo}`, { alignment: AlignmentType.CENTER, spacing: { before: 600 } }),
    para(`${t('Version')} ${p.version} · ${fmtDate(p.updatedAt)}`, { alignment: AlignmentType.CENTER }),
    para(`${t('Prepared by')} ${branding.directorate}`, { alignment: AlignmentType.CENTER }),
    ...(draft ? [para(t('DRAFT: NOT APPROVED'), { alignment: AlignmentType.CENTER, spacing: { before: 600 }, bold: true, size: 28, color: 'B3362D' })] : [para(`${t('Approved baseline')} v${p.baseline?.version}, ${fmtDate(p.baseline?.approvedAt)}`, { alignment: AlignmentType.CENTER, spacing: { before: 600 }, bold: true, color: '1F7A4D' })]),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // Version history and contents
  H('Version history');
  body.push(table([t('Version'), t('Date'), t('By'), t('Description')], p.versions.length ? p.versions.map((v) => [v.version, fmtDate(v.createdAt), v.by, t(v.label)]) : [[p.version, fmtDate(p.updatedAt), p.owner, t('Working draft')]], [15, 20, 25, 40]));
  const toc = ['Document control', 'Introduction', 'As-Is process', 'To-Be process', 'Stakeholders and roles', 'Application workflow', 'Functional requirements', 'Data dictionary', 'Business rules', 'Role-permission matrix', 'Integration requirements', 'Reports and MIS', 'Non-functional requirements', 'Assumptions', 'Open issues', 'Sign-off', 'Appendix A. Traceability matrix'];
  H('Contents');
  toc.forEach((x, i) => body.push(para(`${i < 16 ? `${i + 1}. ` : ''}${t(x)}`, { spacing: { after: 40 } })));
  body.push(new Paragraph({ children: [new PageBreak()] }));

  sec('Document control');
  body.push(table([t('Item'), t('Details')], [
    [t('Department'), `${p.department}, Government of ${branding.state}`],
    [t('File number'), p.fileNo],
    [t('Project type'), t(projectTypes[p.type])],
    [t('Version and status'), `${p.version} (${t(p.status)})`],
    [t('Sources'), p.sources.map((d) => `${d.prefix}: ${d.name}${d.refNo ? ` (${d.refNo})` : ''}`).join('\n')],
  ], [30, 70]));

  for (const [key, title] of [['introduction', 'Introduction'], ['asis', 'As-Is process'], ['tobe', 'To-Be process']] as const) {
    sec(title);
    (p.sections[key] ?? t('Not generated.')).split(/\n\s*\n/).forEach((x) => P(x));
  }

  sec('Stakeholders and roles');
  body.push(table([t('Role'), t('Responsibility'), t('Source')], (p.discovery?.roles ?? []).map((r) => [t(r.name), t(r.description), r.refs.join(', ')]), [25, 55, 20]));

  sec('Application workflow');
  if (p.workflow) {
    if (png) {
      // Fit within the A4 text area: at most 620 x 820 px.
      const k = Math.min(620 / png.width, 820 / png.height, 1);
      body.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: png.data, transformation: { width: Math.round(png.width * k), height: Math.round(png.height * k) } })] }));
    }
    const nm = (id: string) => t(p.workflow!.states.find((s) => s.id === id)?.name ?? id);
    body.push(table(['ID', t('From'), t('Action (actor)'), t('To'), 'SLA', t('Escalation'), t('Notification'), t('Source')], p.workflow.transitions.map((x) => [x.id, nm(x.from), `${t(x.action)} (${t(x.actor)})`, nm(x.to), x.slaDays != null ? `${x.slaDays}` : '', x.escalation ? `${t(x.escalation.to)}, ${x.escalation.afterDays}` : '', x.notification ? `${x.notification.channel}: ${t(x.notification.template)}` : '', x.refs.join(', ')]), [7, 12, 18, 12, 6, 13, 20, 12]));
    if (p.workflow.rtsDays) P(`Notified service timeline: ${p.workflow.rtsDays} working days (${p.workflow.rtsRef ?? 'STD-RTS'}).`);
  } else P('No workflow designed.');

  sec('Functional requirements');
  const functional = ['REG', 'APP', 'DOC', 'VER', 'BR', 'VAL', 'PAY', 'NOT', 'ESC', 'GRV', 'ADM', 'PRIV'];
  let m = 0;
  for (const mod of functional) {
    const list = reqs.filter((r) => r.module === mod);
    if (!list.length) continue;
    H(`${n}.${++m} ${moduleName(mod)}`, 2);
    body.push(table(['ID', t('Requirement and acceptance criteria'), t('Priority'), t('Source')], reqRows(list, t), [13, 62, 9, 16]));
  }

  sec('Data dictionary');
  if (p.entities.length)
    for (const e of p.entities) {
      H(e.name, 2);
      body.push(table([t('Field'), t('Type'), t('Mandatory'), t('Validation'), t('Source of value'), 'PII'], e.fields.map((f) => [`${t(f.label)}\n${f.id}`, `${f.type}${f.length ? `(${f.length})` : ''}`, f.mandatory ? t('Yes') : t('No'), t(f.validation ?? ''), `${f.valueSource}${f.masterList ? ` (${f.masterList})` : ''}`, f.pii]), [20, 10, 9, 33, 16, 12]));
    }
  else P('Not built.');

  sec('Business rules');
  for (const r of p.rules) {
    H(`${r.id} ${t(r.name)}${r.appliesTo === 'Renewal' ? ` (${t('renewal')})` : ''}`, 2);
    body.push(table([t('Condition'), t('Operator'), t('Value')], [...r.conditions.map((c) => [t(c.label ?? c.attribute), c.operator, fmtValue(c.value, c.unit)]), [t('Outcome'), '', t(r.outcome)], [t('Otherwise'), '', t(r.failOutcome)]], [45, 15, 40]));
    P(`Source: ${r.refs.join(', ')}`);
  }
  if (!p.rules.length) P('No decision tables.');

  sec('Role-permission matrix');
  if (p.permissions) body.push(table([t('Action'), ...p.permissions.roles.map((r) => `${t(r.name)} (${t(r.jurisdiction)})`)], p.permissions.actions.map((a) => [t(a), ...p.permissions!.roles.map((r) => (p.permissions!.grants[r.id]?.includes(a) ? t('Yes') : ''))])));
  else P('Not built.');

  for (const [title, pred] of [['Integration requirements', (r: Requirement) => r.kind === 'IR'], ['Reports and MIS', (r: Requirement) => r.module === 'RPT'], ['Non-functional requirements', (r: Requirement) => r.kind === 'NFR']] as const) {
    sec(title);
    const list = reqs.filter(pred);
    if (list.length) body.push(table(['ID', t('Requirement and acceptance criteria'), t('Priority'), t('Source')], reqRows(list, t), [13, 62, 9, 16]));
    else P('None.');
  }

  sec('Assumptions');
  const asm = assumptions(p);
  if (asm.length) body.push(table(['ID', t('Topic'), t('Assumption'), t('Status')], asm.map((a) => [a.id, t(a.q.topic), t(a.text), a.q.confirmed ? t('Confirmed') : t('To be confirmed')]), [10, 20, 55, 15]));
  else P('None.');

  sec('Open issues');
  const open = p.reconciliations.filter((r) => r.resolution?.type === 'Deferred');
  if (open.length) body.push(table(['ID', t('Issue'), t('Clauses')], open.map((r) => [r.id, t(r.description), r.clauses.join(', ')]), [10, 70, 20]));
  else P('None.');

  sec('Sign-off');
  body.push(table([t('Role'), t('Name'), t('Designation'), t('Signature and date')], [
    [t('Prepared by'), 'Ravi Kumar', t('Senior Systems Analyst, Directorate of IT'), ''],
    [t('Reviewed by'), 'Anita Deshmukh', t('Joint Director (IT)'), ''],
    [t('Approved by'), 'S. Raghavan', t('Director (IT)'), p.baseline ? `${t('Approved')} ${fmtDate(p.baseline.approvedAt)}` : ''],
    [t('Accepted by'), '', `${p.department}`, ''],
  ], [20, 22, 33, 25]));

  body.push(new Paragraph({ children: [new PageBreak()] }));
  H('Appendix A. Traceability matrix');
  const must = new Set(coverageClauses(p).map((c) => c.id));
  body.push(table([t('Clause'), t('Type'), t('Status'), t('Requirements')], p.sources.flatMap((d) => d.clauses).filter((c) => c.type !== 'Info').map((c) => {
    const st = clauseState(p, c);
    const by = p.requirements.filter((r) => r.refs.includes(c.id)).map((r) => r.id);
    return [c.id, t(c.type), !st.effective ? `${t(st.reason === 'superseded' ? 'Superseded by' : 'Overridden by')} ${st.by}` : c.notApplicable ? `${t('Not applicable')}: ${t(c.notApplicable.reason)}` : must.has(c.id) ? (by.length ? t('Covered') : t('Not covered')) : t('Context'), by.join(', ')];
  }), [14, 12, 24, 50]));

  const doc = new Document({
    creator: branding.directorate,
    title: `FRS: ${p.name}`,
    styles: docStyles,
    sections: [{
      properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1000 } } },
      headers: { default: pageHeader(`FRS: ${p.name} · v${p.version}`, draft) },
      footers: { default: pageFooter(`${branding.directorate}, ${branding.state} · File ${p.fileNo}`) },
      children: body,
    }],
  });
  return Packer.toBlob(doc);
}

export { run };
