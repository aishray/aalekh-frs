import type { Project, Reconciliation } from '@/lib/types';
import { nextId } from '@/lib/util';

export type Finding = Pick<Reconciliation, 'kind' | 'clauses' | 'description'>;

const PARA_REF = /paragraph\s+(\d+(?:\.\d+)*)/gi;
const ANNEX_REF = /\b(Annexure|Appendix|Schedule)\s+([A-Z0-9]{1,3})\b/g;

/** Supersessions from corrigendum metadata, and references to annexures that were not provided. */
export function detectDeterministic(p: Project): Finding[] {
  const out: Finding[] = [];
  for (const cor of p.sources.filter((d) => d.kind === 'Corrigendum' && d.amends)) {
    const target = p.sources.find((d) => d.id === cor.amends);
    if (!target) continue;
    for (const c of cor.clauses) {
      const text = c.english || c.original;
      for (const m of Array.from(text.matchAll(PARA_REF))) {
        const old = `${target.prefix}-${m[1]}`;
        if (target.clauses.some((x) => x.id === old)) {
          const oldText = target.clauses.find((x) => x.id === old)!.english;
          out.push({ kind: 'Supersession', clauses: [old, c.id], description: `${c.id} (${cor.refNo ?? cor.name}) amends ${old}. Earlier: "${oldText}" Now: "${text}"` });
        }
      }
    }
  }
  const names = p.sources.map((d) => `${d.name} ${d.refNo ?? ''}`.toLowerCase());
  for (const d of p.sources) {
    for (const c of d.clauses) {
      for (const m of Array.from((c.english || c.original).matchAll(ANNEX_REF))) {
        const label = `${m[1]} ${m[2]}`;
        if (!names.some((n) => n.includes(label.toLowerCase())))
          out.push({ kind: 'MissingReference', clauses: [c.id], description: `${c.id} refers to "${label}", which is not among the sources provided.` });
      }
    }
  }
  return out;
}

const key = (f: Finding) => `${f.kind}|${[...f.clauses].sort().join(',')}`;

/**
 * Merges new findings into existing reconciliations. Existing records (and their resolutions and RES ids)
 * are kept; new findings get the next RES-n. AI findings win over deterministic ones for the description.
 */
export function mergeFindings(existing: Reconciliation[], ai: Finding[], det: Finding[]): { all: Reconciliation[]; added: number } {
  const byKey = new Map<string, Finding>();
  for (const f of ai) byKey.set(key(f), f);
  for (const f of det) if (!byKey.has(key(f))) byKey.set(key(f), f);
  const all = existing.slice();
  const have = new Set(existing.map((r) => key(r)));
  let added = 0;
  for (const [k, f] of Array.from(byKey.entries())) {
    if (have.has(k)) continue;
    all.push({ id: nextId(all.map((r) => r.id), 'RES'), kind: f.kind, clauses: f.clauses, description: f.description });
    added++;
  }
  return { all, added };
}
