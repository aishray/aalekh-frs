import ambiguousDefault from '@/data/ambiguous-terms.json';
import checklistsDefault from '@/data/checklists.json';
import nfrDefault from '@/data/nfr-baseline.json';
import standardsDefault from '@/data/standards.json';
import type { ProjectType } from '@/lib/types';

// Reference data used by the quality engine and discovery. Defaults ship in data/*.json; edits made on the
// Standards page are stored in the repository (settings.reference) and applied here, so every engine reads
// the same effective lists.

export type AmbiguousTerm = { term: string; hint: string };
export type ComplianceDef = { id: string; title: string; std: string; category: string; keyword: string };
export type StandardDef = { id: string; name: string; authority: string; summary: string };
export type NfrDef = { key: string; category: string; title: string; description: string; acceptance: string[]; refs: string[]; proposed?: boolean };

export type ReferenceOverrides = {
  ambiguous?: AmbiguousTerm[];
  compliance?: Partial<Record<ProjectType, ComplianceDef[]>>;
  gap?: Partial<Record<ProjectType, string[]>>;
};

export const defaults = {
  ambiguous: ambiguousDefault as AmbiguousTerm[],
  compliance: checklistsDefault.compliance as Record<ProjectType, ComplianceDef[]>,
  gap: checklistsDefault.gap as Record<ProjectType, string[]>,
  standards: standardsDefault as StandardDef[],
  nfr: nfrDefault as { common: NfrDef[]; byType: Record<ProjectType, NfrDef[]> },
};

let overrides: ReferenceOverrides = {};
let version = 0;

export function setReferenceOverrides(o: ReferenceOverrides | undefined) {
  const next = o ?? {};
  if (JSON.stringify(next) === JSON.stringify(overrides)) return;
  overrides = structuredClone(next);
  version++;
}

/** Changes whenever the overrides change; use in memo dependencies. */
export const referenceVersion = () => version;

export const ambiguousTerms = (): AmbiguousTerm[] => overrides.ambiguous ?? defaults.ambiguous;
export const complianceItems = (type: ProjectType): ComplianceDef[] => overrides.compliance?.[type] ?? defaults.compliance[type] ?? [];
export const gapTopics = (type: ProjectType): string[] => overrides.gap?.[type] ?? defaults.gap[type] ?? [];
export const isEdited = (key: keyof ReferenceOverrides, type?: ProjectType) =>
  key === 'ambiguous' ? !!overrides.ambiguous : !!(type ? (overrides[key] as Record<string, unknown> | undefined)?.[type] : overrides[key]);
