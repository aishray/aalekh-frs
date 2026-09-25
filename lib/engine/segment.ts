import type { ClauseType } from '@/lib/types';

export type Segment = { num: string; label: string; text: string };

const SUB = /^(\d+(?:\.\d+)+)[.)]?\s+(.+)$/; // 4.2 text
const TOP = /^(\d+)[.)]\s+(.+)$/; // 4. Heading  |  1. In paragraph ...
const PARA = /^(?:para(?:graph)?)\s+(\d+(?:\.\d+)*)[:.)-]?\s*(.*)$/i;
const ITEM = /^item\s+(\d+)\s*[:.)-]\s*(.+)$/i;
const FIELD = /^field\s+(\d+)\s*[:.)-]\s*(.+)$/i;
const ROMAN = /^\(([ivxlc]+|[a-z])\)\s+(.+)$/i;

// A short line without a full stop is a heading, not a clause body ("3. Eligibility").
function isHeading(text: string) {
  return text.length <= 60 && !/[.:;]$/.test(text.trim()) && text.split(/\s+/).length <= 7;
}

/**
 * Deterministic clause segmentation. Detects numbered paragraphs (4.2, Para 7, (iii), Item 3, Field 12)
 * and headings. Text after a blank line that does not start a new numbered clause is treated as trailing
 * matter (signature blocks) and dropped, except when it follows a heading with no body yet.
 */
export function segmentNumbered(raw: string): Segment[] {
  const lines = raw.replace(/\r/g, '').split('\n');
  const out: Segment[] = [];
  let current: Segment | null = null;
  let pendingHeading: { num: string; label: string } | null = null;
  let parentNum = '';
  let sawBlank = false;

  const push = (s: Segment) => {
    out.push(s);
    current = s;
    sawBlank = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      sawBlank = true;
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(SUB))) {
      pendingHeading = null;
      push({ num: m[1], label: `Para ${m[1]}`, text: m[2] });
      continue;
    }
    if ((m = line.match(PARA))) {
      pendingHeading = null;
      push({ num: m[1], label: `Para ${m[1]}`, text: m[2] });
      continue;
    }
    if ((m = line.match(ITEM))) {
      pendingHeading = null;
      push({ num: m[1], label: `Item ${m[1]}`, text: m[2] });
      continue;
    }
    if ((m = line.match(FIELD))) {
      pendingHeading = null;
      push({ num: m[1], label: `Field ${m[1]}`, text: m[2] });
      continue;
    }
    if ((m = line.match(ROMAN)) && (parentNum || current)) {
      const base = parentNum || (current as Segment | null)?.num || '';
      pendingHeading = null;
      push({ num: `${base}(${m[1].toLowerCase()})`, label: `Para ${base}(${m[1].toLowerCase()})`, text: m[2] });
      continue;
    }
    if ((m = line.match(TOP))) {
      parentNum = m[1];
      if (isHeading(m[2])) {
        pendingHeading = { num: m[1], label: m[2] };
        current = null;
        sawBlank = false;
      } else {
        pendingHeading = null;
        push({ num: m[1], label: `Para ${m[1]}`, text: m[2] });
      }
      continue;
    }
    // Unnumbered line.
    if (pendingHeading) {
      push({ num: pendingHeading.num, label: `Para ${pendingHeading.num} ${pendingHeading.label}`, text: line });
      pendingHeading = null;
      continue;
    }
    const cur = current as Segment | null;
    if (cur && !sawBlank) {
      cur.text += ' ' + line;
    }
  }
  return out;
}

export function segmentParagraphs(raw: string): Segment[] {
  const text = raw.replace(/\r/g, '').trim();
  let blocks = text.split(/\n\s*\n/).map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (blocks.length < 3) blocks = text.split('\n').map((b) => b.trim()).filter(Boolean);
  return blocks.map((b, i) => ({ num: String(i + 1), label: `Paragraph ${i + 1}`, text: b }));
}

/** Numbered first, then paragraphs. Returns `needsLlm` when fewer than 3 clauses are found either way. */
export function segment(raw: string): { segments: Segment[]; method: 'numbered' | 'paragraphs'; needsLlm: boolean } {
  const numbered = segmentNumbered(raw);
  if (numbered.length >= 3) return { segments: numbered, method: 'numbered', needsLlm: false };
  const paras = segmentParagraphs(raw);
  return { segments: paras, method: 'paragraphs', needsLlm: paras.length < 3 };
}

/** Heuristic pre-classification, used when the AI engine is unavailable and as the initial value before AI typing. */
export function guessClauseType(text: string): ClauseType {
  const t = text.toLowerCase();
  if (/within\s+\d+\s+(working\s+)?days|not later than|\bby \d{1,2} [a-z]+|\d+\s+working days/.test(t)) return 'Timeline';
  if (/not exceed|at least|eligib|domicile|\brs\.?\s*\d|₹|%|shall be studying|recognised/.test(t)) return 'Rule';
  if (/\bshall\b|\bmust\b|mandatory|shall be provided/.test(t)) return 'Mandate';
  if (/officer|operator|authority|nodal/.test(t)) return 'Role';
  return 'Info';
}

export function detectLanguage(text: string): string {
  const deva = (text.match(/[ऀ-ॿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return deva > latin ? 'hi' : 'en';
}
