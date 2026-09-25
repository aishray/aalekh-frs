import { NextResponse } from 'next/server';
import { hasKey, transcribe, translate } from '@/lib/ai/sarvam';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Speech to text (saaras:v3), then translation to English. */
export async function POST(req: Request) {
  if (!hasKey())
    return NextResponse.json({ error: 'Voice transcription needs the AI engine. Add SARVAM_API_KEY to .env.local, or paste the transcript as text.' }, { status: 503 });
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No audio file received.' }, { status: 400 });
  try {
    const name = (file as File).name || 'audio.webm';
    const { transcript, language } = await transcribe(file, name);
    const english = language === 'en' ? transcript : await translate(transcript, language, 'en');
    return NextResponse.json({ data: { transcript, language, english }, source: 'live' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
