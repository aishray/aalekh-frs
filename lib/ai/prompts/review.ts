import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({
  issues: z.array(z.object({
    type: z.enum(['Conflict', 'Untestable', 'MissingException', 'Contradiction']),
    severity: z.enum(['High', 'Medium', 'Low']),
    message: z.string(),
    targetIds: z.array(z.string()),
    suggestion: z.string(),
  })),
});
export const review: PromptDef<z.infer<typeof schema>> = {
  task: 'review',
  name: 'semantic_review',
  schema,
  instruction: `Review the requirements in MODEL against the SOURCES. Report only: requirements that conflict with each other (Conflict), statements that cannot be tested (Untestable), missing exception or failure flows (MissingException), and requirements that contradict an effective clause (Contradiction). Cite requirement IDs in targetIds and give a concrete suggestion. Do not report ambiguity, coverage or formatting; those are checked separately.`,
};
