import {
  AlignmentType, BorderStyle, Footer, Header, HeadingLevel, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  type IParagraphOptions,
} from 'docx';

// Latin text in Cambria; Devanagari (complex script) in Nirmala UI.
export const FONT = { ascii: 'Cambria', hAnsi: 'Cambria', cs: 'Nirmala UI', eastAsia: 'Cambria' };
const DEVA = /[ऀ-ॿ]/;

export function run(text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string; strike?: boolean; underline?: boolean } = {}) {
  return new TextRun({
    text,
    font: DEVA.test(text) ? { ascii: 'Nirmala UI', hAnsi: 'Nirmala UI', cs: 'Nirmala UI', eastAsia: 'Nirmala UI' } : FONT,
    bold: o.bold,
    italics: o.italics,
    size: o.size ?? 21,
    color: o.color,
    strike: o.strike,
    underline: o.underline ? {} : undefined,
  });
}

export function para(text: string | TextRun[], o: IParagraphOptions & { bold?: boolean; size?: number; color?: string } = {}) {
  const children = typeof text === 'string' ? [run(text, { bold: o.bold, size: o.size, color: o.color })] : text;
  return new Paragraph({ spacing: { after: 100, line: 276 }, ...o, children });
}

export function heading(text: string, level: 1 | 2 | 3 = 1) {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
  const size = { 1: 30, 2: 25, 3: 22 }[level];
  return new Paragraph({ heading: map[level], spacing: { before: level === 1 ? 320 : 200, after: 120 }, keepNext: true, children: [run(text, { bold: true, size, color: '1D3F6E' })] });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9CED6' };
const borders = { top: border, bottom: border, left: border, right: border };

export function cell(content: string | Paragraph[], o: { header?: boolean; width?: number; shade?: string } = {}) {
  const children = typeof content === 'string' ? content.split('\n').map((line) => new Paragraph({ spacing: { after: 40 }, children: [run(line, { bold: o.header, size: 18 })] })) : content;
  return new TableCell({
    children,
    borders,
    width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
    shading: o.header || o.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: o.shade ?? 'EEF1F5' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
  });
}

export function table(headers: string[], rows: (string | Paragraph[])[][], widths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { header: true, width: widths?.[i] })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, { width: widths?.[i] })) })),
    ],
  });
}

export function pageHeader(text: string, draft: boolean) {
  return new Header({
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(text, { size: 16, color: '6B7584' }), ...(draft ? [run('   DRAFT: NOT APPROVED', { size: 16, bold: true, color: 'B3362D' })] : [])] }),
    ],
  });
}

export function pageFooter(text: string) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run(`${text}   Page `, { size: 16, color: '6B7584' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '6B7584', font: FONT }), run(' of ', { size: 16, color: '6B7584' }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '6B7584', font: FONT })],
      }),
    ],
  });
}

export const docStyles = {
  default: { document: { run: { font: FONT, size: 21 } } },
};
