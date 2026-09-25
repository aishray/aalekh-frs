import type { DataEntity, Field } from '@/lib/types';
import validations from '@/data/validations.json';

const camel = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');

/**
 * Deterministic enrichment after AI extraction: standard validations by field label, Aadhaar never stored in full,
 * e-KYC fields read-only, stable FLD IDs.
 */
export function enrichFields(entities: { name: string; fields: Omit<Field, "id">[] }[]): DataEntity[] {
  const used = new Set<string>();
  return entities.map((e, i) => ({
    id: `ENT-${i + 1}`,
    name: e.name,
    fields: e.fields.map((f) => {
      const label = f.label.toLowerCase();
      const std = validations.find((v) => v.match.some((m) => (m === 'pin' ? /\bpin\b/.test(label) : label.includes(m))));
      let id = `FLD-${f.name || camel(f.label)}`;
      while (used.has(id)) id += '2';
      used.add(id);
      const out: Field = {
        ...f,
        id,
        type: f.type || std?.type || 'String',
        length: f.length ?? std?.length,
        validation: f.validation || std?.validation,
        pii: std && 'pii' in std && std.pii ? (std.pii as Field['pii']) : f.pii,
        readOnly: f.valueSource === 'Aadhaar eKYC' || undefined,
      };
      if (out.pii === 'Aadhaar') out.validation = validations.find((v) => v.key === 'aadhaar')!.validation;
      return out;
    }),
  }));
}
