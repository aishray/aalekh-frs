'use client';

import { AlignmentType, Document, Packer } from 'docx';
import type { Project } from '@/lib/types';
import { branding } from '@/config/branding';
import { orgLine } from './org';
import { sortRequirements } from '@/lib/engine/generate';
import { moduleName } from '@/lib/generate/run';
import { assumptions } from '@/lib/engine/model';
import { docStyles, heading, pageFooter, pageHeader, para, table } from './docxkit';
import { reqRows } from './frs';

/** RFP scope annexure generated from the same model as the FRS, so the two cannot drift apart. */
export async function rfpDocx(p: Project) {
  const reqs = sortRequirements(p.requirements);
  const mods = Array.from(new Set(reqs.filter((r) => r.kind === 'FR').map((r) => r.module)));
  const nfr = reqs.filter((r) => r.kind === 'NFR');
  const body = [
    para(`Annexure to the RFP: Scope of Work`, { alignment: AlignmentType.CENTER, bold: true, size: 30, color: '1D3F6E' }),
    para(`${p.name}, ${p.department} Department, Government of ${branding.state}. Derived from FRS v${p.version} (${p.status}).`, { alignment: AlignmentType.CENTER }),
    heading('1. Scope of work', 1),
    para(`The selected agency shall design, develop, test, deploy, operate and maintain the system described in the FRS. The functional scope comprises the following modules:`),
    table(['Module', 'Features'], mods.map((m) => [moduleName(m), reqs.filter((r) => r.module === m).map((r) => `${r.id} ${r.title}`).join('\n')]), [25, 75]),
    heading('2. Functional requirements', 1),
    para('The agency shall meet every requirement below. Acceptance criteria are binding and will be used in user acceptance testing.'),
    table(['ID', 'Requirement and acceptance criteria', 'Priority', 'Source'], reqRows(reqs.filter((r) => r.kind !== 'NFR'), (s) => s), [13, 62, 9, 16]),
    heading('3. Service levels', 1),
    table(['ID', 'Service level', 'Measure'], nfr.map((r) => [r.id, r.title, `${r.description}\n${r.acceptanceCriteria.join('\n')}`]), [12, 28, 60]),
    heading('4. Deliverables and acceptance', 1),
    table(['Deliverable', 'Acceptance'], [
      ['Software requirements and design documents', 'Approved by the Directorate of IT'],
      ['Application source code and deployment scripts', 'Delivered to the department repository; builds reproducibly'],
      ['User acceptance testing', `All ${reqs.length} requirements pass their acceptance criteria in UAT`],
      ['Security audit', 'Safe-to-host certificate from a CERT-In empanelled auditor with all high and medium findings closed'],
      ['GIGW compliance', 'GIGW 3.0 and WCAG 2.1 AA compliance certificate'],
      ['Training and manuals', 'User manuals in Hindi and English; training of officers of every role'],
      ['Operations and maintenance', 'Service levels in section 3 met each month'],
    ], [40, 60]),
    heading('5. Assumptions', 1),
    ...(assumptions(p).length ? [table(['ID', 'Assumption'], assumptions(p).map((a) => [a.id, a.text]), [12, 88])] : [para('None.')]),
    para('Any requirement not listed in this annexure is outside the scope of the contract and will be handled through the change control procedure.', { spacing: { before: 200 } }),
  ];
  return Packer.toBlob(new Document({
    styles: docStyles,
    sections: [{ headers: { default: pageHeader(`RFP scope annexure: ${p.name}`, p.status !== 'Approved') }, footers: { default: pageFooter(`${orgLine()} · File ${p.fileNo}`) }, children: body }],
  }));
}
