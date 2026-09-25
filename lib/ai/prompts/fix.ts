import { z } from 'zod';
import { refs, type PromptDef } from './base';

const schema = z.object({
  title: z.string(),
  description: z.string(),
  actor: z.string(),
  priority: z.enum(['Must', 'Should', 'Could', "Won't"]),
  acceptanceCriteria: z.array(z.string()),
  refs,
  module: z.string(),
  rationale: z.string(),
});
export const fix: PromptDef<z.infer<typeof schema>> = {
  task: 'fix',
  name: 'requirement_change',
  schema,
  instruction: `INPUT describes an issue and, if it concerns an existing requirement, its current text. Propose the corrected requirement (or a new requirement if INPUT asks to draft one), keeping the existing ID's module, the "shall" form, measurable values from the sources, Given/When/Then acceptance criteria, and valid refs. Explain the change in one sentence in rationale.`,
};
