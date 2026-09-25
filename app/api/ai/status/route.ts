import { NextResponse } from 'next/server';
import { chatJSON, hasKey } from '@/lib/ai/sarvam';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ configured: hasKey() });
}

/** Connection test from Settings: a tiny structured call. */
export async function POST(req: Request) {
  const { model } = (await req.json().catch(() => ({}))) as { model?: string };
  if (!hasKey()) return NextResponse.json({ ok: false, message: 'SARVAM_API_KEY is not set on the server. Add it to .env.local and restart.' });
  const t0 = Date.now();
  try {
    const r = await chatJSON(
      [{ role: 'user', content: 'Reply with {"ok": true}.' }],
      { name: 'ping', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } },
      (v) => v as { ok: boolean },
      { model, reasoning: 'off', maxTokens: 50 },
    );
    return NextResponse.json({ ok: r.ok === true, message: `Connected to ${model ?? 'sarvam-105b'} in ${Date.now() - t0} ms.` });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message });
  }
}
