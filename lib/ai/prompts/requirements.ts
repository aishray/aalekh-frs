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
  instruction: `Write the functional requirements for the module named in INPUT. Each requirement: a short title; a description starting "The system shall"; the actor; MoSCoW priority; 1 to 3 acceptance criteria in Given/When/Then form with concrete values; and refs (clause IDs, ANS, RES, ASM, STD IDs, or model artefacts such as WF-T3, BR-002, FLD-income). Do not repeat requirements listed in INPUT as already generated from the model. Where EXAMPLES contain a similar approved requirement, follow its level of detail. Cover every effective clause relevant to this module.`,
};
