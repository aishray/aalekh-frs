import { NextResponse } from 'next/server';
import { chatJSON, hasKey } from '@/lib/ai/sarvam';
import { TASKS, type ChatModel } from '@/lib/ai/models';
import { rateLimit } from '@/lib/ai/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ configured: hasKey() });
}

/** Connection test from Settings: one tiny structured call to each chat model in use. */
export async function POST(req: Request) {
  if (!hasKey()) return NextResponse.json({ ok: false, configured: false, message: 'SARVAM_API_KEY is not set on the server. Add it to the environment and redeploy.', models: [] });
  const limited = rateLimit(req);
  if (limited) return limited;
  const models = Array.from(new Set(Object.values(TASKS).map((t) => t.model))) as ChatModel[];
  const results = await Promise.all(
    models.map(async (model) => {
      const t0 = Date.now();
      try {
        const { data, usage } = await chatJSON(
          [{ role: 'user', content: 'Reply with {"ok": true}.' }],
          { name: 'ping', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } },
          (v) => v as { ok: boolean },
          { model, reasoning: 'off', maxTokens: 50, timeoutMs: 30_000, task: 'status' },
        );
        return { model: usage[0]?.model ?? model, ok: data.ok === true, latencyMs: Date.now() - t0 };
      } catch (e) {
        return { model, ok: false, latencyMs: Date.now() - t0, error: (e as Error).message };
      }
    }),
  );
  const ok = results.every((r) => r.ok);
  const message = results.map((r) => (r.ok ? `Connected to ${r.model} in ${r.latencyMs} ms.` : `${r.model}: ${r.error}`)).join(' ');
  return NextResponse.json({ ok, configured: true, connected: results.filter((r) => r.ok).map((r) => r.model), models: results, message });
}
