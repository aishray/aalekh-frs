import { narrativeInstructions, NARRATIVE_SYSTEM_SUFFIX } from '@/lib/ai/prompts/narrative';
import { BASE_SYSTEM, userMessage, type Blocks } from '@/lib/ai/prompts/base';
import { chatStream, hasKey } from '@/lib/ai/sarvam';
import { findRecording, wait } from '@/lib/ai/recordings';
import { ROUTE_BUDGET_MS, TASKS } from '@/lib/ai/models';
import { rateLimit, readJson } from '@/lib/ai/guard';
import { capture } from '@/lib/ai/capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function replay(text: string, source: string) {
  const enc = new TextEncoder();
  const words = text.split(/(\s+)/);
  return new Response(
    new ReadableStream({
      async start(ctrl) {
        await wait(700);
        for (let i = 0; i < words.length; i += 6) {
          ctrl.enqueue(enc.encode(words.slice(i, i + 6).join('')));
          await wait(35);
        }
        ctrl.close();
      },
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-AI-Source': source } },
  );
}

/** Narrative FRS sections, streamed so long sections never hit the function time limit. */
export async function POST(req: Request) {
  const t0 = Date.now();
  const { body, error } = await readJson<{ section: string; recorded?: boolean; sample?: string; blocks?: Blocks }>(req);
  if (error || !body) return error;
  const instruction = narrativeInstructions[body.section];
  if (!instruction) return new Response(`Unknown section "${body.section}".`, { status: 404 });
  const rec = findRecording(body.sample, 'narrative', body.section);
  const text = rec ? String((rec.response as { text: string }).text) : undefined;
  const cfg = TASKS.narrative;
  const messages = [
    { role: 'system' as const, content: `${BASE_SYSTEM}\n${NARRATIVE_SYSTEM_SUFFIX}` },
    { role: 'user' as const, content: userMessage(instruction, body.blocks ?? {}) },
  ];
  const opts = { model: cfg.model, reasoning: cfg.reasoning, maxTokens: cfg.maxTokens, temperature: cfg.temperature, timeoutMs: cfg.timeoutMs, deadline: t0 + ROUTE_BUDGET_MS, task: `narrative.${body.section}` };
  if (body.recorded && text) {
    capture(body.sample, `narrative.${body.section}`, { section: body.section, blocks: body.blocks }, async () => {
      const stream = await chatStream(messages, { ...opts, deadline: Date.now() + ROUTE_BUDGET_MS });
      return { response: { text: (await new Response(stream).text()).trim() }, meta: { model: cfg.model } };
    });
    return replay(text, 'recorded');
  }
  if (!hasKey()) {
    if (text) return replay(text, 'fallback');
    return new Response('The AI engine is not configured, and there is no recorded response for this section. Add SARVAM_API_KEY to the server environment.', { status: 503 });
  }
  const limited = rateLimit(req);
  if (limited) return text ? replay(text, 'fallback') : new Response((await limited.json()).error, { status: 429 });
  try {
    const stream = await chatStream(messages, opts);
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-AI-Source': 'live' } });
  } catch (e) {
    if (text) return replay(text, 'fallback');
    return new Response((e as Error).message, { status: 502 });
  }
}
