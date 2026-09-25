import { NextResponse } from 'next/server';
import { digitise, hasKey } from '@/lib/ai/sarvam';
import { findRecording, wait } from '@/lib/ai/recordings';
import { capture } from '@/lib/ai/capture';
import { fileTooLarge, rateLimit } from '@/lib/ai/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Sarvam Document Intelligence (Sarvam Vision) for scanned forms and PDFs. Uses the same SARVAM_API_KEY. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  const recorded = form.get('recorded') === 'true';
  const sample = String(form.get('sample') ?? '') || undefined;
  const language = String(form.get('language') ?? '') || 'en-IN';
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  const big = fileTooLarge(file);
  if (big) return big;
  const name = (file as File).name || 'document';
  const rec = findRecording(sample, 'digitise', name.replace(/\.[a-z]+$/i, ''));
  if ((recorded || !hasKey()) && rec) {
    const bytes = await file.arrayBuffer();
    capture(sample, `digitise.${name.replace(/\.[a-z]+$/i, '')}`, { file: name, language }, async () => ({ response: { text: await digitise(new Blob([bytes]), name, language) } }));
    await wait(3200);
    return NextResponse.json({ data: (rec.response as { text: string }).text, source: 'recorded' });
  }
  if (!hasKey())
    return NextResponse.json({ error: 'Scanned documents need Sarvam Document Intelligence. Add SARVAM_API_KEY to the server environment, or paste the text of the document instead.' }, { status: 503 });
  const limited = rateLimit(req, 2);
  if (limited) return limited;
  try {
    return NextResponse.json({ data: await digitise(file, name, language), source: 'live' });
  } catch (e) {
    if (rec) return NextResponse.json({ data: (rec.response as { text: string }).text, source: 'fallback' });
    return NextResponse.json({ error: `${(e as Error).message}` }, { status: 502 });
  }
}
