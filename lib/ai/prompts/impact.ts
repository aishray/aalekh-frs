import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({
  affected: z.array(z.object({
    targetId: z.string(),
    kind: z.enum(['Requirement', 'Rule', 'Test', 'Field', 'Transition']),
    reason: z.string(),
    proposedChange: z.string(),
    newDescription: z.string().nullable(),
    newAcceptanceCriteria: z.array(z.string()).nullable(),
    newSlaDays: z.number().nullable(),
  })),
  timelineImpact: z.string(),
});
export const impact: PromptDef<z.infer<typeof schema>> = {
  task: 'impact',
  name: 'impact_analysis',
  schema,
  instruction: `A corrigendum in INPUT supersedes the clauses listed. MODEL lists the baseline items that cite those clauses directly and other items that may depend on them. For each affected item give the reason, the proposed change in one sentence, and the new text where it changes (newDescription and newAcceptanceCriteria for requirements, newSlaDays for workflow transitions). Add items that depend semantically even if they do not cite the clause. Finish with a qualitative timeline and effort impact.`,
};
