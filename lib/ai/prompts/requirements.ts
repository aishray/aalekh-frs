import { z } from 'zod';
import { refs, type PromptDef } from './base';

const schema = z.object({
  requirements: z.array(z.object({
    title: z.string(),
    description: z.string(),
    actor: z.string(),
    priority: z.enum(['Must', 'Should', 'Could', "Won't"]),
    acceptanceCriteria: z.array(z.string()),
    refs,
  })),
});
export const requirements: PromptDef<z.infer<typeof schema>> = {
  task: 'requirements',
  name: 'requirements',
  schema,
  maxTokens: 8000,
  instruction: `Write the functional requirements for the module named in INPUT that are not already generated from the model. Return between 2 and 8 requirements, never more than 8.
The model already generates, and you must not write: one notification requirement per workflow transition, one escalation requirement per SLA, one requirement per workflow action, field validation requirements, and one requirement per decision table. The ones already generated are listed in INPUT; do not restate, split or rephrase them.
Each requirement: a short title; a description starting "The system shall"; the actor; MoSCoW priority; 1 to 3 acceptance criteria in Given/When/Then form with concrete values; and refs (clause IDs, ANS, RES, ASM, STD IDs, or model artefacts such as WF-T3, BR-002, FLD-income). One requirement per distinct capability; merge closely related behaviour into one requirement. Where EXAMPLES contain a similar approved requirement, follow its level of detail. Cover the effective clauses relevant to this module that the listed requirements do not already cover.`,
};
