import { NextResponse } from 'next/server';
import { hasKey, translate } from '@/lib/ai/sarvam';
import { findRecording, wait } from '@/lib/ai/recordings';
import { capture } from '@/lib/ai/capture';
import { MAX_TRANSLATE_CHARS, rateLimit, readJson } from '@/lib/ai/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Translates a list of texts. Recorded translations are looked up by exact source text. */
export async function POST(req: Request) {
  const { body, error } = await readJson<{ texts: string[]; source: string; target: string; recorded?: boolean; sample?: string }>(req, 512 * 1024);
  if (error || !body) return error;
  if (!Array.isArray(body.texts)) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  const rec = findRecording(body.sample, 'translate');
  const table = (rec?.response as { entries?: Record<string, string> } | undefined)?.entries ?? {};
  const fromRec = body.texts.map((t) => table[t.trim()]);
  if ((body.recorded || !hasKey()) && fromRec.every(Boolean)) {
    capture(body.sample, 'translate', { source: body.source, target: body.target }, async () => {
      const entries: Record<string, string> = {};
      for (const t of body.texts) entries[t.trim()] = await translate(t, body.source, body.target);
      return { response: { entries } };
    });
    await wait(900);
    return NextResponse.json({ data: fromRec, source: 'recorded' });
  }
  if (!hasKey())
    return NextResponse.json({ error: 'Translation needs the AI engine. Add SARVAM_API_KEY to the server environment.' }, { status: 503 });
  const chars = body.texts.reduce((n, t) => n + t.length, 0);
  if (chars > MAX_TRANSLATE_CHARS)
    return NextResponse.json({ error: `The text to translate is ${chars.toLocaleString('en-IN')} characters; the limit per request is ${MAX_TRANSLATE_CHARS.toLocaleString('en-IN')}. Translate one section at a time.` }, { status: 413 });
  const limited = rateLimit(req);
  if (limited) return limited;
  try {
    // Up to 4 translations in parallel.
    const out: string[] = new Array(body.texts.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, body.texts.length) }, async () => {
        while (next < body.texts.length) {
          const i = next++;
          out[i] = await translate(body.texts[i], body.source, body.target);
        }
      }),
    );
    return NextResponse.json({ data: out, source: 'live' });
  } catch (e) {
    if (fromRec.every(Boolean)) return NextResponse.json({ data: fromRec, source: 'fallback' });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
