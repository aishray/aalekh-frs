import { NextResponse } from 'next/server';
import { captureQueueSize, capturing } from '@/lib/ai/capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Used by `npm run record` to wait for live captures to finish. Not available unless AI_CAPTURE_DIR is set. */
export async function GET() {
  if (!capturing()) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ pending: captureQueueSize() });
}
