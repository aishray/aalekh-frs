import { NextResponse } from 'next/server';
import { prompts } from '@/lib/ai/prompts';
import { BASE_SYSTEM, userMessage, type Blocks } from '@/lib/ai/prompts/base';
import { AiError, chatJSON, hasKey } from '@/lib/ai/sarvam';
import { findRecording, replayDelay, wait } from '@/lib/ai/recordings';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  recorded?: boolean;
  sample?: string;
  variant?: string;
  blocks?: Blocks;
  model?: 'sarvam-105b' | 'sarvam-30b';
  reasoning?: 'off' | 'low' | 'medium';
};

export async function POST(req: Request, { params }: { params: { step: string } }) {
  const step = params.step;
  const def = prompts[step];
  if (!def) return NextResponse.json({ error: `Unknown AI step "${step}".` }, { status: 404 });
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const rec = findRecording(body.sample, step, body.variant);
  if (body.recorded && rec) {
    await wait(replayDelay(step, rec));
    return NextResponse.json({ data: rec.response, source: 'recorded' });
  }

  if (!hasKey()) {
    if (rec) {
      await wait(replayDelay(step, rec));
      return NextResponse.json({ data: rec.response, source: 'fallback', note: 'AI engine not configured; used the recorded response.' });
    }
    return NextResponse.json(
      { error: 'The AI engine is not configured, and there is no recorded response for this step. Add SARVAM_API_KEY to .env.local, or turn on recorded responses for the sample project in Settings.' },
      { status: 503 },
    );
  }

  try {
    const jsonSchema = z.toJSONSchema(def.schema) as object;
    const data = await chatJSON(
      [
        { role: 'system', content: BASE_SYSTEM },
        { role: 'user', content: userMessage(def.instruction, body.blocks ?? {}) },
      ],
      { name: def.name, schema: jsonSchema },
      (v) => def.schema.parse(v),
      { model: body.model, reasoning: body.reasoning, maxTokens: def.maxTokens ?? 4000 },
    );
    return NextResponse.json({ data, source: 'live' });
  } catch (e) {
    // Live failures fall back silently to recordings where they exist.
    if (rec) return NextResponse.json({ data: rec.response, source: 'fallback', note: (e as Error).message });
    const status = e instanceof AiError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
