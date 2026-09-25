import { z } from 'zod';
import { refs, type PromptDef } from './base';

const item = z.object({ text: z.string(), refs });
const schema = z.object({
  objective: z.string(),
  objectiveRefs: refs,
  scopeIn: z.array(item),
  scopeOut: z.array(item),
  roles: z.array(z.object({ name: z.string(), description: z.string(), refs })),
  channels: z.array(item),
  entities: z.array(item),
  integrations: z.array(z.object({ name: z.string(), refs })),
  modules: z.array(z.object({ code: z.enum(['REG', 'APP', 'DOC', 'VER', 'PAY', 'NOT', 'GRV', 'ADM', 'RPT']), name: z.string(), refs })),
  checklist: z.array(z.object({ topic: z.string(), status: z.enum(['Covered', 'Partial', 'Missing']), refs, note: z.string() })),
});
export const discovery: PromptDef<z.infer<typeof schema>> = {
  task: 'discovery',
  name: 'discovery',
  schema,
  maxTokens: 6000,
  instruction: `Analyse the effective sources and extract: the objective, scope in and out, stakeholders and roles, channels (portal, mobile, CSC, offline), key entities, integrations mentioned, and candidate modules (codes REG, APP, DOC, VER, PAY, NOT, GRV, ADM, RPT; only relevant ones). Every item cites clause IDs.
Then assess each topic of the CHECKLIST in INPUT as Covered (the sources state it fully; cite refs), Partial (mentioned but details missing; say what is missing in note) or Missing (not addressed; refs empty). Return the checklist topics in the same order.`,
};
