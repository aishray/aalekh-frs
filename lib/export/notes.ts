'use client';

import { AlignmentType, Document, Packer } from 'docx';
import type { CrAssessment, ImpactAnalysis, Project } from '@/lib/types';
import { branding } from '@/config/branding';
import { orgLine } from './org';
import { clauseById } from '@/lib/engine/model';
import { fmtDate, nowIso } from '@/lib/util';
import { docStyles, heading, pageFooter, para, table } from './docxkit';

function frame(p: Project, title: string, children: ReturnType<typeof para | typeof table>[]) {
  return Packer.toBlob(
    new Document({
      styles: docStyles,
      creator: orgLine(),
      title,
      sections: [{
        properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1000 } } },
        footers: { default: pageFooter(`${orgLine()} · File ${p.fileNo}`) },
        children: [
          para(`Government of ${branding.state}`, { alignment: AlignmentType.CENTER, bold: true }),
          para(orgLine(), { alignment: AlignmentType.CENTER }),
          para(`File No. ${p.fileNo}                                   Date: ${fmtDate(nowIso())}`, { spacing: { before: 200, after: 200 } }),
          heading(title, 1),
          ...children,
        ],
      }],
    }),
  );
}

/** Change note for a corrigendum, for approval. */
export function changeNoteDocx(p: Project, imp: ImpactAnalysis) {
  const cor = p.sources.find((d) => d.id === imp.corrigendumDocId);
  const reqs = imp.affected.filter((a) => a.kind === 'Requirement');
  const tests = imp.affected.filter((a) => a.kind === 'Test');
  const other = imp.affected.filter((a) => a.kind !== 'Requirement' && a.kind !== 'Test');
  return frame(p, `Change note: ${cor?.name ?? 'Corrigendum'}`, [
    para(`Subject: Impact of ${cor?.refNo ? `Corrigendum No. ${cor.refNo}` : cor?.name}${cor?.date ? ` dated ${fmtDate(cor.date)}` : ''} on the approved FRS for ${p.name} (baseline v${p.baseline?.version}).`, { bold: true }),
    heading('1. Reference', 2),
    ...imp.supersessions.map((s) => para(`${s.by} supersedes ${s.old}. Earlier: "${clauseById(p, s.old)?.clause.english}" Now: "${clauseById(p, s.by)?.clause.english}"`)),
    heading('2. Affected requirements', 2),
    reqs.length ? table(['Requirement', 'Why affected', 'Proposed change'], reqs.map((a) => [a.targetId, a.reason, a.proposedChange]), [18, 37, 45]) : para('No requirement is affected.'),
    heading('3. Affected test cases', 2),
    tests.length ? table(['Test case', 'Why affected', 'Proposed change'], tests.map((a) => [a.targetId, a.reason, a.proposedChange]), [22, 38, 40]) : para('No test case is affected.'),
    heading('4. Other affected items', 2),
    other.length ? table(['Item', 'Kind', 'Why affected', 'Proposed change'], other.map((a) => [a.targetId, a.kind, a.reason, a.proposedChange]), [15, 12, 33, 40]) : para('No workflow transition, business rule or data field is affected.'),
    heading('5. Impact on timeline and effort', 2),
    para(imp.timelineImpact),
    heading('6. Recommendation', 2),
    para(`The changes above may be approved and incorporated in FRS v${p.version === p.baseline?.version ? `${p.version} (next draft)` : p.version}, and communicated to the implementing agency as a clarification of the baseline.`),
    para('Submitted for approval.', { spacing: { before: 400 } }),
    para('Ravi Kumar, Senior Systems Analyst', { alignment: AlignmentType.RIGHT }),
    para('Joint Director (IT)          Director (IT)', { spacing: { before: 500 } }),
  ]);
}

/** One-page CR assessment note for the file. */
export function crNoteDocx(p: Project, c: CrAssessment) {
  const inScope = c.items.filter((i) => i.classification === 'In scope');
  const newScope = c.items.filter((i) => i.classification === 'New scope');
  const effort = (xs: typeof c.items) => xs.map((i) => parseInt(i.effort ?? '', 10) || 0).reduce((a, b) => a + b, 0);
  return frame(p, `Assessment of change request: ${c.title}`, [
    para(`The change request was examined against the approved FRS for ${p.name}, baseline v${p.baseline?.version} dated ${fmtDate(p.baseline?.approvedAt)}.`),
    table(['Ask', 'Assessment', 'Baseline requirement and acceptance criteria', 'Reasoning'], c.items.map((i) => [`${i.ask}${i.effort ? `\n(${i.effort})` : ''}`, i.classification === 'In scope' ? 'Already in scope' : i.classification === 'New scope' ? 'New scope' : 'Clarification of existing scope', i.matchedReqs.length ? `${i.matchedReqs.join(', ')}\n${i.quotes.join('\n')}` : 'None', i.reasoning]), [22, 13, 38, 27]),
    heading('Conclusion', 2),
    para(`${inScope.length} of ${c.items.length} asks (${effort(inScope)} person-days claimed) are already required by the baseline and do not justify additional cost. ${newScope.length} ask${newScope.length === 1 ? ' is' : 's are'} new scope (${effort(newScope)} person-days claimed) and may be considered as a genuine change request after a decision by the department.`),
    para('Placed for orders.', { spacing: { before: 400 } }),
    para('Joint Director (IT)', { alignment: AlignmentType.RIGHT }),
  ]);
}
