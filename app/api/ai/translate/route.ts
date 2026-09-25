import { NextResponse } from 'next/server';
import { hasKey, translate } from '@/lib/ai/sarvam';
import { findRecording, wait } from '@/lib/ai/recordings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Translates a list of texts. Recorded translations are looked up by exact source text. */
export async function POST(req: Request) {
  const body = (await req.json()) as { texts: string[]; source: string; target: string; recorded?: boolean; sample?: string };
  const rec = findRecording(body.sample, 'translate');
  const table = (rec?.response as { entries?: Record<string, string> } | undefined)?.entries ?? {};
  const fromRec = body.texts.map((t) => table[t.trim()]);
  if ((body.recorded || !hasKey()) && fromRec.every(Boolean)) {
    await wait(900);
    return NextResponse.json({ data: fromRec, source: 'recorded' });
  }
  if (!hasKey())
    return NextResponse.json({ error: 'Translation needs the AI engine. Add SARVAM_API_KEY to .env.local.' }, { status: 503 });
  try {
    const out: string[] = [];
    for (const t of body.texts) out.push(await translate(t, body.source, body.target));
    return NextResponse.json({ data: out, source: 'live' });
  } catch (e) {
    if (fromRec.every(Boolean)) return NextResponse.json({ data: fromRec, source: 'fallback' });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
