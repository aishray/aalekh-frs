import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({
  findings: z.array(z.object({
    kind: z.enum(['Conflict', 'Supersession', 'Duplicate', 'MissingReference']),
    clauses: z.array(z.string()),
    description: z.string(),
  })),
});
export const reconcile: PromptDef<z.infer<typeof schema>> = {
  task: 'reconcile',
  name: 'reconciliation',
  schema,
  instruction: `Compare the Mandate, Rule and Timeline clauses in SOURCES across documents and report:
- Conflict: two clauses state incompatible values for the same thing (cite both clause IDs).
- Supersession: a corrigendum clause replaces an earlier clause (cite the old clause first, then the corrigendum clause). INPUT lists which document each corrigendum amends.
- Duplicate: the same mandate stated in two places.
- MissingReference: a clause refers to an annexure, form or document that is not among the sources (cite that clause only).
Describe each finding in one or two sentences with the exact values. Report only real findings; return an empty list if there are none.`,
};
