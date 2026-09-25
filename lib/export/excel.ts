'use client';

import ExcelJS from 'exceljs';
import type { Project } from '@/lib/types';
import { clauseState, coverageClauses } from '@/lib/engine/model';
import { coverageFor } from '@/lib/engine/quality';
import { uatTests } from '@/lib/engine/uat';
import { sortRequirements } from '@/lib/engine/generate';

function sheet(wb: ExcelJS.Workbook, name: string, cols: { header: string; key: string; width: number }[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols;
  ws.getRow(1).font = { bold: true, color: { argb: 'FF16202E' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F5' } };
  rows.forEach((r) => ws.addRow(r));
  ws.eachRow((row) => row.eachCell((c) => (c.alignment = { wrapText: true, vertical: 'top' })));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

export function addUat(wb: ExcelJS.Workbook, p: Project) {
  sheet(wb, 'UAT test cases', [
    { header: 'TC ID', key: 'id', width: 20 }, { header: 'Req ID', key: 'req', width: 18 }, { header: 'Title', key: 'title', width: 32 },
    { header: 'Precondition', key: 'pre', width: 40 }, { header: 'Steps', key: 'steps', width: 45 }, { header: 'Test data', key: 'data', width: 30 },
    { header: 'Expected result', key: 'exp', width: 45 }, { header: 'Source', key: 'refs', width: 20 }, { header: 'Result (Pass/Fail)', key: 'res', width: 14 },
  ], uatTests(p).map((t) => ({ id: t.id, req: t.reqId, title: t.title ?? '', pre: t.precondition, steps: t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), data: Object.entries(t.data).map(([k, v]) => `${k}: ${v}`).join('\n'), exp: t.expected, refs: (t.refs ?? []).join(', '), res: '' })));
}

export async function uatWorkbook(p: Project) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aalekh FRS';
  addUat(wb, p);
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function fullWorkbook(p: Project) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aalekh FRS';
  const reqs = sortRequirements(p.requirements);
  const must = new Set(coverageClauses(p).map((c) => c.id));
  sheet(wb, 'Traceability', [
    { header: 'Clause', key: 'c', width: 12 }, { header: 'Source', key: 's', width: 30 }, { header: 'Type', key: 't', width: 11 }, { header: 'Clause text', key: 'x', width: 60 },
    { header: 'Status', key: 'st', width: 22 }, { header: 'Requirements', key: 'r', width: 40 },
  ], p.sources.flatMap((d) => d.clauses.map((c) => {
    const st = clauseState(p, c);
    return { c: c.id, s: d.name, t: c.type, x: c.english || c.original, st: !st.effective ? `${st.reason} by ${st.by}` : c.notApplicable ? `Not applicable: ${c.notApplicable.reason}` : must.has(c.id) ? 'Must be covered' : 'Context', r: reqs.filter((r) => r.refs.includes(c.id)).map((r) => r.id).join(', ') };
  })));
  sheet(wb, 'Requirements', [
    { header: 'ID', key: 'id', width: 14 }, { header: 'Module', key: 'm', width: 8 }, { header: 'Title', key: 't', width: 32 }, { header: 'Requirement', key: 'd', width: 60 },
    { header: 'Acceptance criteria', key: 'ac', width: 60 }, { header: 'Priority', key: 'p', width: 9 }, { header: 'Actor', key: 'a', width: 18 }, { header: 'Refs', key: 'r', width: 24 }, { header: 'Origin', key: 'o', width: 11 },
  ], reqs.map((r) => ({ id: r.id, m: r.module, t: r.title, d: r.description, ac: r.acceptanceCriteria.join('\n'), p: r.priority, a: r.actor ?? '', r: r.refs.join(', '), o: r.origin })));
  sheet(wb, 'Coverage', [{ header: 'Clause', key: 'c', width: 12 }, { header: 'Type', key: 't', width: 11 }, { header: 'Text', key: 'x', width: 70 }, { header: 'Covered', key: 'v', width: 10 }, { header: 'Covered by', key: 'b', width: 40 }],
    coverageFor(p).map((c) => ({ c: c.clauseId, t: c.type, x: c.text, v: c.covered ? 'Yes' : 'No', b: c.na ? `Not applicable: ${c.na}` : c.by.join(', ') })));
  addUat(wb, p);
  sheet(wb, 'Data dictionary', [
    { header: 'Entity', key: 'e', width: 18 }, { header: 'Field ID', key: 'id', width: 22 }, { header: 'Label', key: 'l', width: 28 }, { header: 'Original label', key: 'lo', width: 22 },
    { header: 'Type', key: 't', width: 10 }, { header: 'Length', key: 'n', width: 8 }, { header: 'Mandatory', key: 'm', width: 10 }, { header: 'Validation', key: 'v', width: 50 },
    { header: 'Source of value', key: 's', width: 16 }, { header: 'Master list', key: 'ml', width: 16 }, { header: 'PII', key: 'pii', width: 12 }, { header: 'Refs', key: 'r', width: 18 },
  ], p.entities.flatMap((e) => e.fields.map((f) => ({ e: e.name, id: f.id, l: f.label, lo: f.labelOriginal ?? '', t: f.type, n: f.length ?? '', m: f.mandatory ? 'Yes' : 'No', v: f.validation ?? '', s: f.valueSource, ml: f.masterList ?? '', pii: f.pii, r: f.refs.join(', ') }))));
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
