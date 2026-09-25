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
  instruction: `Propose the application lifecycle as a state machine from the sources, resolutions and answers. Model only the application; grievances are a separate process and must not appear as states.
States: short lowercase IDs (for example "draft", "inst_verify") with display names. Start with Draft and Submitted. Include a state for each verification or approval level in the sources, Returned for correction (with a transition back to Submitted), Rejected, Sanctioned, the payment states, Payment failed (with a transition to retry the payment) and a terminal Closed state. Every non-terminal state needs an outgoing transition.
Transitions: from and to must be state IDs from states. Give the action name, actor role ("System" for automatic steps, "Applicant" for applicant actions), conditions (business rule IDs from MODEL, if any), SLA in working days from the sources or resolutions on the officer action that the timeline governs (null for System and Applicant actions), escalation to the next-level officer after the SLA for every transition that has an SLA, notification (channel, recipient, template text; include {reason} in every rejection or return template), and refs. The approval and rejection transitions of the same level carry the same SLA.
Also return the notified service timeline in working days (rtsDays) and its clause (rtsRef).`,
};
