import 'server-only';
import { NextResponse } from 'next/server';

// Protects the public deployment from draining Sarvam credits.
// - Rate limit: 30 live AI calls per 10 minutes per client IP. Recorded replays are free and not counted.
//   The counter lives in the function instance's memory, so on Vercel it is per instance (Fluid compute reuses
//   instances, which makes it effective in practice). Tune with AI_RATE_LIMIT / AI_RATE_WINDOW_MIN.
// - Input caps: JSON bodies and uploaded files are size-limited before any work is done.

const LIMIT = Number(process.env.AI_RATE_LIMIT ?? 30);
const WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MIN ?? 10) * 60_000;

export const MAX_JSON_BYTES = 256 * 1024;
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
export const MAX_TRANSLATE_CHARS = 60_000;

const hits = new Map<string, number[]>();

export function clientIp(req: Request) {
  const h = req.headers;
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
}

/** Returns a 429 response when the caller is over the limit, otherwise records the hit and returns null. */
export function rateLimit(req: Request, cost = 1): NextResponse | null {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length + cost > LIMIT) {
    const retry = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(ip, recent);
    return NextResponse.json(
      { error: `Live AI limit reached: ${LIMIT} calls per ${WINDOW_MS / 60_000} minutes from one address. Try again in ${Math.ceil(retry / 60)} minutes, or use recorded responses for the sample project.` },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    );
  }
  for (let i = 0; i < cost; i++) recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return null;
}

/** Reads a JSON body with a size cap. */
export async function readJson<T>(req: Request, max = MAX_JSON_BYTES): Promise<{ body?: T; error?: NextResponse }> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > max) return { error: tooLarge(max) };
  const text = await req.text();
  if (text.length > max) return { error: tooLarge(max) };
  try {
    return { body: JSON.parse(text) as T };
  } catch {
    return { error: NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) };
  }
}

export function tooLarge(max: number) {
  return NextResponse.json({ error: `The request is larger than ${Math.round(max / 1024)} KB. Send a smaller document or section.` }, { status: 413 });
}

export function fileTooLarge(file: Blob) {
  return file.size > MAX_FILE_BYTES
    ? NextResponse.json({ error: `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Upload a smaller file or paste the text.` }, { status: 413 })
    : null;
}
