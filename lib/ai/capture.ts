import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

// Capture mode for `npm run record`. When AI_CAPTURE_DIR is set, every AI request for a sample project also
// runs live against Sarvam with the identical prompt, and the live response is written to
// <AI_CAPTURE_DIR>/<sample>/<name>.json. The UI keeps using the recording, so the demo state evolves exactly
// as in the demo path while the live model sees the same inputs. Never enabled in production.

const DIR = process.env.AI_CAPTURE_DIR;
const CONCURRENCY = 3;
let running = 0;
const queue: (() => Promise<void>)[] = [];

export const capturing = () => !!DIR;

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
}

export function capture(sample: string | undefined, name: string, request: unknown, fn: () => Promise<{ response: unknown; meta?: Record<string, unknown> }>) {
  if (!DIR || !sample) return;
  const file = path.join(DIR, sample.replace(/[^A-Za-z0-9._-]/g, '_'), `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
  // --resume: keep captures that already succeeded.
  if (process.env.AI_CAPTURE_RESUME && fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).ok) return;
  queue.push(async () => {
    const t0 = Date.now();
    let out: Record<string, unknown>;
    try {
      const { response, meta } = await fn();
      out = { capturedAt: new Date().toISOString(), ms: Date.now() - t0, ok: true, ...meta, response, request };
    } catch (e) {
      out = { capturedAt: new Date().toISOString(), ms: Date.now() - t0, ok: false, error: (e as Error).message, request };
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`[capture] ${path.basename(file)} ${out.ok ? 'ok' : 'FAILED'} in ${out.ms} ms`);
  });
  pump();
}

export function captureQueueSize() {
  return running + queue.length;
}
