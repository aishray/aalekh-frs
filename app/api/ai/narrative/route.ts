import { narrativeInstructions, NARRATIVE_SYSTEM_SUFFIX } from '@/lib/ai/prompts/narrative';
import { BASE_SYSTEM, userMessage, type Blocks } from '@/lib/ai/prompts/base';
import { chatStream, hasKey } from '@/lib/ai/sarvam';
import { findRecording, wait } from '@/lib/ai/recordings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function POST(req: Request) {
  const body = (await req.json()) as { section: string; recorded?: boolean; sample?: string; blocks?: Blocks; model?: string };
  const instruction = narrativeInstructions[body.section];
  if (!instruction) return new Response(`Unknown section "${body.section}".`, { status: 404 });
  const rec = findRecording(body.sample, 'narrative', body.section);
  const text = rec ? String((rec.response as { text: string }).text) : undefined;
  if (body.recorded && text) return replay(text, 'recorded');
  if (!hasKey()) {
    if (text) return replay(text, 'fallback');
    return new Response('The AI engine is not configured, and there is no recorded response for this section. Add SARVAM_API_KEY to .env.local.', { status: 503 });
  }
  try {
    const stream = await chatStream(
      [
        { role: 'system', content: `${BASE_SYSTEM}\n${NARRATIVE_SYSTEM_SUFFIX}` },
        { role: 'user', content: userMessage(instruction, body.blocks ?? {}) },
      ],
      { model: body.model, reasoning: 'off', maxTokens: 2000 },
    );
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-AI-Source': 'live' } });
  } catch (e) {
    if (text) return replay(text, 'fallback');
    return new Response((e as Error).message, { status: 502 });
  }
}
