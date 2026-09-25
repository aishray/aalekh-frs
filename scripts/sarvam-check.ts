// npm run sarvam:check: one small real call to each Sarvam API this app uses.
// Prints success, latency and model. Credit use is minimal (tiny prompts, a 17 s clip, a 1-page form).
import fs from 'node:fs';
import path from 'node:path';
import { chatJSON, translate, transcribe, digitise, chat } from '../lib/ai/sarvam';
import { SPEECH, TRANSLATE, VISION, TASKS, type ChatModel } from '../lib/ai/models';

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');

type Row = { api: string; model: string; ok: boolean; ms: number; detail: string };
const rows: Row[] = [];

async function check(api: string, model: string, fn: () => Promise<string>) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    rows.push({ api, model, ok: true, ms: Date.now() - t0, detail });
  } catch (e) {
    rows.push({ api, model, ok: false, ms: Date.now() - t0, detail: (e as Error).message });
  }
  const r = rows[rows.length - 1];
  console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${api.padEnd(28)} ${r.model.padEnd(26)} ${String(r.ms).padStart(6)} ms  ${r.detail}`);
}

async function main() {
  if (!process.env.SARVAM_API_KEY) {
    console.error('SARVAM_API_KEY is not set. Add it to .env.local or the environment.');
    process.exit(1);
  }
  console.log(`Sarvam API check against ${process.env.SARVAM_BASE_URL ?? 'https://api.sarvam.ai'}\n`);
  const models = Array.from(new Set(Object.values(TASKS).map((t) => t.model))) as ChatModel[];
  for (const model of models) {
    await check('Chat, JSON schema', model, async () => {
      const { data, usage } = await chatJSON(
        [{ role: 'user', content: 'Classify: "The District Social Welfare Officer shall decide within 15 days." as Mandate, Rule, Timeline, Role or Info.' }],
        { name: 'clause_type', schema: { type: 'object', properties: { type: { type: 'string', enum: ['Mandate', 'Rule', 'Timeline', 'Role', 'Info'] } }, required: ['type'], additionalProperties: false } },
        (v) => v as { type: string },
        { model, reasoning: 'off', maxTokens: 60, task: 'check' },
      );
      return `type=${data.type}; served by ${usage[0].model}; tokens ${usage[0].promptTokens} in / ${usage[0].completionTokens} out`;
    });
  }
  await check('Chat, reasoning low', 'sarvam-105b', async () => {
    const r = await chat([{ role: 'user', content: 'A GO allows 15 working days for institution verification and 15 for district approval. What is the total? Answer with a number only.' }], { model: 'sarvam-105b', reasoning: 'low', maxTokens: 4000, task: 'check' });
    if (!r.content.trim()) throw new Error(`no answer after ${r.usage.completionTokens} tokens (finish=${r.finish}); reasoning used the whole budget`);
    return `answer=${r.content.trim()}; finish=${r.finish}; tokens ${r.usage.promptTokens} in / ${r.usage.completionTokens} out`;
  });
  await check('Speech to text', SPEECH.model, async () => {
    const f = path.join('public', 'samples', 'voice_brief_hi.wav');
    const { transcript, language } = await transcribe(new Blob([fs.readFileSync(f)], { type: 'audio/wav' }), 'voice_brief_hi.wav');
    return `language=${language}; "${transcript.slice(0, 60)}..."`;
  });
  await check('Text translation', TRANSLATE.model, async () => {
    const out = await translate('आवेदन अस्वीकार होने पर छात्र को SMS में कारण बताया जाए (GO-5.3)।', 'hi', 'en');
    return `"${out}"`;
  });
  await check('Document Intelligence', VISION.model, async () => {
    const f = path.join('public', 'samples', 'application_form.png');
    const text = await digitise(new Blob([fs.readFileSync(f)], { type: 'image/png' }), 'application_form.png', 'en-IN');
    return `${text.length} chars; "${text.replace(/\s+/g, ' ').slice(0, 60)}..."`;
  });
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed} of ${rows.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}

main();
