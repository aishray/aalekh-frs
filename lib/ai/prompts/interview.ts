import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({ questions: z.array(z.object({ question: z.string(), purpose: z.string() })) });
export const interview: PromptDef<z.infer<typeof schema>> = {
  task: 'interview',
  name: 'interview_questions',
  schema,
  instruction: `Write 6 to 8 interview questions for the stakeholder role in INPUT, covering current volumes, pain points, decisions they take, information and reports they need, exceptions they handle and timelines. One short purpose line each.`,
};
