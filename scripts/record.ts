// npm run record: runs the scholarship demo path against the live Sarvam API and saves the responses.
//
// How it works: the production server starts with AI_CAPTURE_DIR set, and the Playwright demo path runs in
// recorded mode (RECORD=1 adds the interview and scanned-form steps). Every AI request therefore evolves the
// project state exactly as in the demo, while the server also sends the identical prompt to Sarvam and writes
// the live response to data/recorded/_live/<sample>/<name>.json (with model, latency, token usage and the
// request blocks). Nothing in data/recorded/<sample>/ changes until you promote a capture:
//
//   npm run record                        capture live responses (builds first; add --no-build to skip)
//   npm run record -- --resume            keep successful captures and only capture the rest
//   npm run record -- --summary           print the capture table again
//   npm run record -- --promote a b ...   copy captures a, b (e.g. reconcile requirements.PAY) into the recordings
//
// Promote only captures that meet the acceptance criteria in CLAUDE.md; record hand adjustments in
// data/recorded/README.md.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE = 'scholarship';
const LIVE = path.join('data', 'recorded', '_live');
const REC = path.join('data', 'recorded', SAMPLE);
const PORT = 3100;
const args = process.argv.slice(2);

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');

type Capture = { ok: boolean; ms: number; model?: string; reasoning?: string; error?: string; usage?: { promptTokens: number; completionTokens: number }[]; response?: unknown };

function summary() {
  const dir = path.join(LIVE, SAMPLE);
  if (!fs.existsSync(dir)) return console.log('No captures yet. Run npm run record.');
  let tin = 0;
  let tout = 0;
  console.log(`${'capture'.padEnd(34)} ${'result'.padEnd(6)} ${'model'.padEnd(26)} ${'reason'.padEnd(6)} ${'seconds'.padStart(7)} ${'tokens in/out'.padStart(14)}`);
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Capture;
    const i = (c.usage ?? []).reduce((n, u) => n + u.promptTokens, 0);
    const o = (c.usage ?? []).reduce((n, u) => n + u.completionTokens, 0);
    tin += i;
    tout += o;
    console.log(`${f.replace(/\.json$/, '').padEnd(34)} ${(c.ok ? 'ok' : 'FAIL').padEnd(6)} ${(c.model ?? '').padEnd(26)} ${(c.reasoning ?? '').padEnd(6)} ${(c.ms / 1000).toFixed(1).padStart(7)} ${`${i}/${o}`.padStart(14)}${c.ok ? '' : `  ${c.error}`}`);
  }
  console.log(`\nTotal chat tokens: ${tin} in, ${tout} out.`);
}

function promote(names: string[]) {
  for (const n of names) {
    const src = path.join(LIVE, SAMPLE, `${n}.json`);
    if (!fs.existsSync(src)) {
      console.error(`No capture named ${n}.`);
      process.exitCode = 1;
      continue;
    }
    const c = JSON.parse(fs.readFileSync(src, 'utf8')) as Capture & { capturedAt: string };
    if (!c.ok) {
      console.error(`Capture ${n} failed (${c.error}); not promoted.`);
      process.exitCode = 1;
      continue;
    }
    fs.writeFileSync(path.join(REC, `${n}.json`), JSON.stringify({ provenance: 'live', model: c.model, recordedAt: c.capturedAt, response: c.response }, null, 2) + '\n');
    console.log(`Promoted ${n}.`);
  }
  spawnSync('npx', ['tsx', 'scripts/index-recordings.ts'], { stdio: 'inherit' });
}

async function waitFor(url: string, ms: number) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return r;
    } catch {
      /* not up yet */
    }
    if (Date.now() - t0 > ms) throw new Error(`Timed out waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function record() {
  if (!process.env.SARVAM_API_KEY) {
    console.error('SARVAM_API_KEY is not set. Add it to .env.local.');
    process.exit(1);
  }
  if (!args.includes('--no-build') && spawnSync('npm', ['run', 'build'], { stdio: 'inherit' }).status !== 0) process.exit(1);
  const resume = args.includes('--resume');
  if (!resume) fs.rmSync(path.join(LIVE, SAMPLE), { recursive: true, force: true });
  const server: ChildProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    env: { ...process.env, AI_CAPTURE_DIR: path.resolve(LIVE), AI_RATE_LIMIT: '100000', ...(resume ? { AI_CAPTURE_RESUME: '1' } : {}) },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  try {
    await waitFor(`http://localhost:${PORT}/`, 60_000);
    const test = spawnSync('npx', ['playwright', 'test', 'e2e/demo-path.e2e.ts'], { stdio: 'inherit', env: { ...process.env, RECORD: '1' } });
    if (test.status !== 0) console.error('The demo path did not complete; captures so far are kept.');
    const t0 = Date.now();
    for (;;) {
      const { pending } = (await (await fetch(`http://localhost:${PORT}/api/ai/capture`)).json()) as { pending: number };
      if (!pending) break;
      if (Date.now() - t0 > 20 * 60_000) {
        console.error(`Gave up waiting with ${pending} captures still running.`);
        break;
      }
      process.stdout.write(`\rWaiting for ${pending} live calls to finish...   `);
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log('');
  } finally {
    server.kill('SIGTERM');
  }
  summary();
}

if (args.includes('--summary')) summary();
else if (args.includes('--promote')) promote(args.slice(args.indexOf('--promote') + 1).filter((a) => !a.startsWith('--')));
else record();
