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
  instruction: `Convert every effective Rule clause into a decision table: one table per rule, with conditions (attribute in camelCase, label, operator, value as a plain number or text without currency symbols or commas, unit), the outcome when all conditions hold, the outcome when any fails, and refs. Use the effective value after corrigenda and resolutions, citing the clause that sets it.`,
};
