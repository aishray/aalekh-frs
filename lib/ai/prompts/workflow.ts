import { z } from 'zod';
import { refs, type PromptDef } from './base';

const schema = z.object({
  states: z.array(z.object({ id: z.string(), name: z.string(), terminal: z.boolean() })),
  transitions: z.array(z.object({
    from: z.string(),
    to: z.string(),
    action: z.string(),
    actor: z.string(),
    conditions: refs,
    slaDays: z.number().nullable(),
    escalation: z.object({ afterDays: z.number(), to: z.string() }).nullable(),
    notification: z.object({ channel: z.enum(['SMS', 'Email', 'In-app']), recipient: z.string(), template: z.string() }).nullable(),
    refs,
  })),
  rtsDays: z.number().nullable(),
  rtsRef: z.string().nullable(),
});
export const workflow: PromptDef<z.infer<typeof schema>> = {
  task: 'workflow',
  name: 'workflow',
  schema,
  maxTokens: 6000,
  instruction: `Propose the application lifecycle as a state machine from the sources, resolutions and answers. States start with Draft and Submitted. For every transition give: from and to state IDs, action name, actor role ("System" for automatic steps, "Applicant" for applicant actions), conditions (business rule IDs from MODEL, if any), SLA in working days taken from the sources (null for System and Applicant actions), escalation (to whom, after how many days) where an SLA exists, notification (channel, recipient, template text; include {reason} in every rejection template), and refs. Also return the notified service timeline in working days (rtsDays) and its clause (rtsRef).`,
};
