// Task to Sarvam model mapping. Verified against https://docs.sarvam.ai (September 2026):
// - /v1/chat/completions serves only `sarvam-105b` (128K context) and `sarvam-105b-conversations` (32K context).
//   `sarvam-30b` and `sarvam-m` are deprecated and rejected by the API.
// - `reasoning_effort` accepts low | high | max, or null to switch reasoning off. Reasoning tokens count
//   against `max_tokens`, so reasoning tasks get a larger budget than their visible output needs.
// - Speech to text: `saaras:v3` (REST, audio under 30 s). Text translation: `sarvam-translate:v1` (2000 chars per call).
// - Document Intelligence: Sarvam Vision via /doc-ai/v1/job/digitise (PDF up to 10 pages, PNG, JPG).

export type ChatModel = 'sarvam-105b' | 'sarvam-105b-conversations';
export type Reasoning = 'off' | 'low' | 'high';

export type AiTask =
  | 'classify' | 'segment' | 'reconcile' | 'discovery' | 'questions' | 'workflow' | 'fields' | 'rules' | 'permissions'
  | 'narrative' | 'requirements' | 'review' | 'fix' | 'impact' | 'cr' | 'interview';

export type TaskConfig = {
  model: ChatModel;
  reasoning: Reasoning;
  maxTokens: number;
  temperature: number;
  /** Per-attempt timeout for the Sarvam call, in ms. Kept well inside the 300 s route limit. */
  timeoutMs: number;
  label: string;
};

/** Heavy reasoning and drafting. */
const HEAVY: ChatModel = 'sarvam-105b';
/** Fast, simple tasks. Replaces the deprecated sarvam-30b. */
const FAST: ChatModel = 'sarvam-105b-conversations';

export const TASKS: Record<AiTask, TaskConfig> = {
  classify: { label: 'Clause typing', model: FAST, reasoning: 'off', maxTokens: 3000, temperature: 0, timeoutMs: 45_000 },
  segment: { label: 'Clause segmentation fallback', model: HEAVY, reasoning: 'off', maxTokens: 8000, temperature: 0, timeoutMs: 90_000 },
  reconcile: { label: 'Source reconciliation', model: HEAVY, reasoning: 'low', maxTokens: 12000, temperature: 0.1, timeoutMs: 120_000 },
  discovery: { label: 'Discovery and gap checklist', model: HEAVY, reasoning: 'low', maxTokens: 12000, temperature: 0.2, timeoutMs: 120_000 },
  questions: { label: 'Clarifying questions', model: HEAVY, reasoning: 'low', maxTokens: 10000, temperature: 0.3, timeoutMs: 120_000 },
  workflow: { label: 'Workflow proposal', model: HEAVY, reasoning: 'low', maxTokens: 14000, temperature: 0.1, timeoutMs: 120_000 },
  fields: { label: 'Data dictionary from form', model: HEAVY, reasoning: 'off', maxTokens: 8000, temperature: 0, timeoutMs: 90_000 },
  rules: { label: 'Decision tables', model: HEAVY, reasoning: 'low', maxTokens: 10000, temperature: 0, timeoutMs: 120_000 },
  permissions: { label: 'Permission proposal', model: FAST, reasoning: 'off', maxTokens: 4000, temperature: 0, timeoutMs: 45_000 },
  narrative: { label: 'Narrative sections', model: HEAVY, reasoning: 'off', maxTokens: 2500, temperature: 0.3, timeoutMs: 90_000 },
  requirements: { label: 'Requirements per module', model: HEAVY, reasoning: 'off', maxTokens: 8000, temperature: 0.2, timeoutMs: 120_000 },
  review: { label: 'Semantic quality review', model: HEAVY, reasoning: 'low', maxTokens: 12000, temperature: 0.1, timeoutMs: 120_000 },
  fix: { label: 'Fix and short rewrites', model: FAST, reasoning: 'off', maxTokens: 2000, temperature: 0.2, timeoutMs: 45_000 },
  impact: { label: 'Corrigendum impact analysis', model: HEAVY, reasoning: 'low', maxTokens: 12000, temperature: 0.1, timeoutMs: 120_000 },
  cr: { label: 'Vendor CR scope check', model: HEAVY, reasoning: 'low', maxTokens: 12000, temperature: 0.1, timeoutMs: 120_000 },
  interview: { label: 'Stakeholder interview questions', model: FAST, reasoning: 'off', maxTokens: 3000, temperature: 0.3, timeoutMs: 45_000 },
};

export const SPEECH = { model: 'saaras:v3', mode: 'transcribe', maxSeconds: 30, timeoutMs: 60_000 } as const;
export const TRANSLATE = { model: 'sarvam-translate:v1', mode: 'formal', maxChars: 2000, chunkChars: 1500, timeoutMs: 30_000 } as const;
export const VISION = { model: 'sarvam-vision', outputFormat: 'md', maxPages: 10, pollMs: 3000, maxWaitMs: 150_000 } as const;

/** Vercel Hobby with Fluid compute allows up to 300 s per function. */
export const ROUTE_MAX_DURATION = 300;

export function taskConfig(task: string, reasoningOverride?: Reasoning): TaskConfig {
  const base = TASKS[task as AiTask] ?? TASKS.requirements;
  if (!reasoningOverride || reasoningOverride === base.reasoning) return base;
  // Turning reasoning on needs extra token budget for the reasoning trace.
  const maxTokens = reasoningOverride === 'off' ? base.maxTokens : Math.max(base.maxTokens, 12000);
  return { ...base, reasoning: reasoningOverride, maxTokens };
}
