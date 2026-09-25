import type { ClauseType, SourceDoc, SourceKind } from '@/lib/types';
import { detectLanguage, guessClauseType, segment, type Segment } from './segment';

export const kindPrefix: Record<SourceKind, string> = {
  GO: 'GO', Corrigendum: 'COR', Guideline: 'GDL', Minutes: 'MIN', Form: 'FORM', VoiceBrief: 'VB', Interview: 'INT', Other: 'SRC',
};

/** Prefix for a new source, numbering repeated kinds: GO, GO2; COR1, COR2; INT1... */
export function prefixFor(kind: SourceKind, existing: SourceDoc[]) {
  const base = kindPrefix[kind];
  const same = existing.filter((d) => d.kind === kind).length;
  if (kind === 'Corrigendum' || kind === 'Interview') return `${base}${same + 1}`;
  return same === 0 ? base : `${base}${same + 1}`;
}

export type IngestInput = {
  id: string;
  name: string;
  kind: SourceKind;
  text: string;
  prefix: string;
  refNo?: string;
  date?: string;
  authority?: string;
  amends?: string;
  addedAt: string;
  english?: string[]; // translations per segment, when known
  types?: Record<string, ClauseType>; // clause id -> type, when known
  segments?: Segment[]; // pre-computed (e.g. LLM fallback)
};

export function ingest(input: IngestInput): SourceDoc {
  const language = detectLanguage(input.text);
  const segments = input.segments ?? segment(input.text).segments;
  return {
    id: input.id,
    prefix: input.prefix,
    name: input.name,
    kind: input.kind,
    refNo: input.refNo,
    date: input.date,
    authority: input.authority,
    language,
    amends: input.amends,
    addedAt: input.addedAt,
    clauses: segments.map((s, i) => {
      const id = `${input.prefix}-${s.num}`;
      const english = input.english?.[i] ?? (language === 'en' ? s.text : '');
      return {
        id,
        docId: input.id,
        label: s.label,
        original: s.text,
        english,
        type: input.types?.[id] ?? guessClauseType(english || s.text),
      };
    }),
  };
}
