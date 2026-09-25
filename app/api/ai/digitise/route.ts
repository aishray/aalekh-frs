import { NextResponse } from 'next/server';
import { digitise, hasKey } from '@/lib/ai/sarvam';
import { findRecording, wait } from '@/lib/ai/recordings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sarvam Document Intelligence for scanned forms and PDFs. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  const recorded = form.get('recorded') === 'true';
  const sample = String(form.get('sample') ?? '') || undefined;
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  const name = (file as File).name || 'document';
  const rec = findRecording(sample, 'digitise', name.replace(/\.[a-z]+$/i, ''));
  if ((recorded || !hasKey()) && rec) {
    await wait(3200);
    return NextResponse.json({ data: (rec.response as { text: string }).text, source: 'recorded' });
  }
  if (!hasKey())
    return NextResponse.json({ error: 'Scanned documents need Sarvam Document Intelligence. Add SARVAM_API_KEY to .env.local, or paste the text of the document instead.' }, { status: 503 });
  try {
    return NextResponse.json({ data: await digitise(file, name), source: 'live' });
  } catch (e) {
    if (rec) return NextResponse.json({ data: (rec.response as { text: string }).text, source: 'fallback' });
    return NextResponse.json({ error: `${(e as Error).message} You can paste the text instead.` }, { status: 502 });
  }
}
