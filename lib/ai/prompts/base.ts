import { z } from 'zod';

export const BASE_SYSTEM = `You are a senior Business Analyst in a State Government IT Department in India, expert in e-Governance projects, ISO/IEC/IEEE 29148 requirements engineering and Government of India standards (GIGW 3.0, DPDP Act 2023, CERT-In directions, Aadhaar Act and UIDAI guidelines, MeitY e-Gov standards, Right to Service Acts).
Rules:
- Use only facts in the provided SOURCES, RESOLUTIONS, ANSWERS and MODEL. Never invent amounts, dates, GO numbers, names or limits.
- Superseded clauses are shown for context only; always use the effective clause.
- If information is missing, record an assumption or open issue instead of guessing.
- Every output item cites at least one valid reference ID from the provided lists.
- Formal, plain Indian government English. "Shall" for mandatory requirements.
- Never use ambiguous terms; state measurable values.
- Output exactly the requested JSON schema.`;

export type Blocks = Partial<Record<'SOURCES' | 'SUPERSEDED' | 'RESOLUTIONS' | 'ANSWERS' | 'ASSUMPTIONS' | 'MODEL' | 'EXAMPLES' | 'INPUT', string>>;

export type PromptDef<T> = {
  task: string; // settings.reasoning key
  name: string;
  instruction: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
};

export function userMessage(instruction: string, blocks: Blocks) {
  const order: (keyof Blocks)[] = ['SOURCES', 'SUPERSEDED', 'RESOLUTIONS', 'ANSWERS', 'ASSUMPTIONS', 'MODEL', 'EXAMPLES', 'INPUT'];
  const parts = order.filter((k) => blocks[k]?.trim()).map((k) => `### ${k}\n${blocks[k]!.trim()}`);
  return `${parts.join('\n\n')}\n\n### TASK\n${instruction}`;
}

export const refs = z.array(z.string());
