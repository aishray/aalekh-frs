'use client';

import type { ClauseType, Project, SourceDoc, SourceKind } from '@/lib/types';
import { ingest } from '@/lib/engine/ingest';
import { detectLanguage, segment, type Segment } from '@/lib/engine/segment';
import { runAi, translateTexts } from '@/lib/ai/client';
import { nowIso, uid } from '@/lib/util';

export type SourceMeta = {
  name: string;
  kind: SourceKind;
  prefix: string;
  refNo?: string;
  date?: string;
  authority?: string;
  amends?: string;
};

export type PipelineStage = 'segment' | 'translate' | 'classify' | 'done';

/**
 * Deterministic segmentation first (LLM only when fewer than 3 clauses are found), then translation of
 * non-English clauses (Sarvam translate), then AI clause typing. AI failures degrade to rule-based typing
 * and an empty translation, reported as warnings rather than blocking the upload.
 */
export async function buildSource(
  project: Project,
  meta: SourceMeta,
  text: string,
  onStage: (s: PipelineStage) => void,
  preset?: { english?: string[] },
): Promise<{ doc: SourceDoc; warnings: string[] }> {
  const warnings: string[] = [];
  onStage('segment');
  let segs: Segment[];
  const seg = segment(text);
  segs = seg.segments;
  if (seg.needsLlm) {
    try {
      const { data } = await runAi<{ clauses: { label: string; text: string }[] }>('segment', project, { INPUT: text });
      if (data.clauses.length) segs = data.clauses.map((c, i) => ({ num: String(i + 1), label: c.label, text: c.text }));
    } catch (e) {
      warnings.push(`Clause segmentation by AI was not available (${(e as Error).message}) so paragraphs were used.`);
    }
  }
  const language = detectLanguage(text);
  let english = preset?.english;
  if (!english && language !== 'en') {
    onStage('translate');
    try {
      english = await translateTexts(project, segs.map((s) => s.text), language, 'en');
    } catch (e) {
      warnings.push(`Translation to English failed: ${(e as Error).message} Use "Translate again" on the source once the AI engine is available.`);
    }
  }
  const id = uid('src');
  let doc = ingest({ id, ...meta, text, addedAt: nowIso(), english, segments: segs });
  onStage('classify');
  try {
    const { data } = await runAi<{ types: { id: string; type: ClauseType }[] }>('classify', project, {
      INPUT: doc.clauses.map((c) => `[${c.id}] ${c.english || c.original}`).join('\n'),
    });
    const map = new Map(data.types.map((t) => [t.id, t.type]));
    doc = { ...doc, clauses: doc.clauses.map((c) => ({ ...c, type: map.get(c.id) ?? c.type })) };
  } catch (e) {
    warnings.push(`AI clause typing was not available (${(e as Error).message}). Types were set by rules; review them below.`);
  }
  onStage('done');
  return { doc, warnings };
}
