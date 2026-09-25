import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'data', 'recorded');

export type Recording = { response: unknown; delayMs?: number; matchText?: string };

function safe(s: string) {
  return s.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function findRecording(sample: string | undefined, step: string, variant?: string): Recording | undefined {
  if (!sample) return undefined;
  const dir = path.join(ROOT, safe(sample));
  const names = variant ? [`${safe(step)}.${safe(variant)}.json`] : [`${safe(step)}.json`];
  for (const n of names) {
    const f = path.join(dir, n);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')) as Recording;
  }
  return undefined;
}

/** Recorded mode replays with realistic timing so it is indistinguishable in the UI. */
export function replayDelay(step: string, rec?: Recording) {
  if (rec?.delayMs != null) return rec.delayMs;
  const base: Record<string, number> = { classify: 900, reconcile: 2600, discovery: 3200, questions: 2200, workflow: 2800, fields: 3000, rules: 2000, permissions: 1500, requirements: 2200, review: 3000, fix: 1600, impact: 2800, cr: 2600, interview: 1500, segment: 1200 };
  return base[step] ?? 1500;
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
