import { z } from 'zod';
import { refs, type PromptDef } from './base';

const schema = z.object({
  tables: z.array(z.object({
    name: z.string(),
    appliesTo: z.enum(['All', 'Renewal']),
    conditions: z.array(z.object({
      attribute: z.string(),
      label: z.string(),
      operator: z.enum(['<=', '<', '>=', '>', '=', '!=', 'in']),
      value: z.string(),
      unit: z.string().nullable(),
    })),
    outcome: z.string(),
    failOutcome: z.string(),
    refs,
  })),
});
export const rules: PromptDef<z.infer<typeof schema>> = {
  task: 'rules',
  name: 'decision_tables',
  schema,
  instruction: `Convert every effective Rule clause into a decision table: one table per rule, named after what it tests (for example "Annual family income"), with at least one condition. Each condition: attribute in camelCase, a short label, operator, value, unit.
Operators: a maximum ("up to", "not exceeding", "at most") is "<="; a minimum ("at least", "not less than") is ">="; a fixed value is "=". Numeric values are plain numbers without currency symbols, commas or words (300000, 75); put the unit (INR, %, years) in unit. A yes or no condition uses "=" with "Yes".
Give the outcome when all conditions hold, the outcome when any fails, and refs. Use the effective value after corrigenda and resolutions, and cite the clause that sets it (the corrigendum clause, not the superseded one). appliesTo is "All" for rules that apply to every application; use "Renewal" only when the clause itself says the rule applies to renewals (for example an attendance requirement for renewal).`,
};
