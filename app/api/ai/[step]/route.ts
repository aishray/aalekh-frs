import { NextResponse } from 'next/server';
import { prompts } from '@/lib/ai/prompts';
import { BASE_SYSTEM, userMessage, type Blocks } from '@/lib/ai/prompts/base';
import { AiError, chatJSON, hasKey } from '@/lib/ai/sarvam';
import { findRecording, replayDelay, wait } from '@/lib/ai/recordings';
import { ROUTE_BUDGET_MS, taskConfig, type Reasoning } from '@/lib/ai/models';
import { rateLimit, readJson } from '@/lib/ai/guard';
import { capture } from '@/lib/ai/capture';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Body = {
  recorded?: boolean;
  sample?: string;
  variant?: string;
  blocks?: Blocks;
  reasoning?: Reasoning;
};

const REASONING = new Set<Reasoning>(['off', 'low', 'high']);

export async function POST(req: Request, { params }: { params: { step: string } }) {
  const t0 = Date.now();
  const step = params.step;
  const def = prompts[step];
  if (!def) return NextResponse.json({ error: `Unknown AI step "${step}".` }, { status: 404 });
  const { body, error } = await readJson<Body>(req);
  if (error || !body) return error;

  const cfg = taskConfig(def.task, body.reasoning && REASONING.has(body.reasoning) ? body.reasoning : undefined);
  const live = async (deadline: number) => {
    const { data, usage } = await chatJSON(
      [
        { role: 'system', content: BASE_SYSTEM },
        { role: 'user', content: userMessage(def.instruction, body.blocks ?? {}) },
      ],
      { name: def.name, schema: z.toJSONSchema(def.schema) as object },
      (v) => def.schema.parse(v),
      { model: cfg.model, reasoning: cfg.reasoning, maxTokens: Math.max(cfg.maxTokens, def.maxTokens ?? 0), temperature: cfg.temperature, timeoutMs: cfg.timeoutMs, deadline, task: step },
    );
    return { data, usage };
  };

  const rec = findRecording(body.sample, step, body.variant);
  if (body.recorded && rec) {
    capture(body.sample, body.variant ? `${step}.${body.variant}` : step, { step, variant: body.variant, blocks: body.blocks }, async () => {
      const { data, usage } = await live(Date.now() + ROUTE_BUDGET_MS);
      return { response: data, meta: { model: cfg.model, reasoning: cfg.reasoning, usage } };
    });
    await wait(replayDelay(step, rec));
    return NextResponse.json({ data: rec.response, source: 'recorded' });
  }

  if (!hasKey()) {
    if (rec) {
      await wait(replayDelay(step, rec));
      return NextResponse.json({ data: rec.response, source: 'fallback', note: 'AI engine not configured; used the recorded response.' });
    }
    return NextResponse.json(
      { error: 'The AI engine is not configured, and there is no recorded response for this step. Add SARVAM_API_KEY to the server environment, or turn on recorded responses for the sample project in Settings.' },
      { status: 503 },
    );
  }

  const limited = rateLimit(req);
  if (limited) {
    if (rec) return NextResponse.json({ data: rec.response, source: 'fallback', note: 'Live AI limit reached; used the recorded response.' });
    return limited;
  }

  try {
    const { data, usage } = await live(t0 + ROUTE_BUDGET_MS);
    return NextResponse.json({ data, source: 'live', model: cfg.model, usage });
  } catch (e) {
    // Live failures fall back silently to recordings where they exist.
    if (rec) return NextResponse.json({ data: rec.response, source: 'fallback', note: (e as Error).message });
    const status = e instanceof AiError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
