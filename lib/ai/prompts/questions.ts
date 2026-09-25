import { z } from 'zod';
import type { PromptDef } from './base';

const schema = z.object({
  questions: z.array(z.object({
    topic: z.string(),
    question: z.string(),
    whyItMatters: z.string(),
    suggestedAnswers: z.array(z.string()),
    defaultAssumption: z.string(),
  })),
});
export const questions: PromptDef<z.infer<typeof schema>> = {
  task: 'questions',
  name: 'clarifying_questions',
  schema,
  instruction: `Write 5 to 8 clarifying questions for the department, only for checklist topics marked Partial or Missing in INPUT. For each: the topic, the question, why it matters for development (one sentence), 2 to 4 suggested answers, and the default assumption the Directorate will record if unanswered. Never ask what the sources already answer.`,
};
