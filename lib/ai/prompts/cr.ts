import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({
  items: z.array(z.object({
    ask: z.string(),
    effort: z.string(),
    classification: z.enum(['In scope', 'Clarification', 'New scope']),
    matchedReqs: z.array(z.string()),
    quotes: z.array(z.string()),
    reasoning: z.string(),
  })),
});
export const cr: PromptDef<z.infer<typeof schema>> = {
  task: 'cr',
  name: 'cr_scope_check',
  schema,
  instruction: `INPUT is a vendor change request. Split it into individual asks with the vendor's effort estimate. For each ask, compare it with the baseline requirements in MODEL (the candidates retrieved for it are listed) and classify: "In scope" when baseline requirements already require it (cite the FR IDs and quote their acceptance criteria verbatim in quotes), "Clarification" when it details an existing requirement without adding functionality, or "New scope" when no requirement covers it. Give one or two sentences of reasoning.`,
};
