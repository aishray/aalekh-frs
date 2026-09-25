import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({ clauses: z.array(z.object({ label: z.string(), text: z.string() })) });
export const segment: PromptDef<z.infer<typeof schema>> = {
  task: 'segment',
  name: 'clause_boundaries',
  schema,
  instruction: `The document in INPUT has no reliable numbering. Split it into self-contained clauses, each stating one obligation, rule, timeline or fact. Keep the original wording and language of each clause exactly; do not translate or summarise. Label each clause with a short heading in English.`,
};
