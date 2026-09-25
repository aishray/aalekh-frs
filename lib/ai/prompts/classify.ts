import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({ types: z.array(z.object({ id: z.string(), type: z.enum(['Mandate', 'Rule', 'Timeline', 'Role', 'Info']) })) });
export const classify: PromptDef<z.infer<typeof schema>> = {
  task: 'classify',
  name: 'clause_types',
  schema,
  instruction: `Assign a clause type to every clause in INPUT:
- Mandate: something the system or department must do.
- Rule: an eligibility, calculation or validation condition.
- Timeline: a time limit or service level.
- Role: defines who does something, with no other obligation.
- Info: background, objective or other non-binding text.
Return one entry per clause ID.`,
};
