import 'server-only';
import { SPEECH, TRANSLATE, VISION, type ChatModel, type Reasoning } from './models';

// Sarvam AI client. Server only: SARVAM_API_KEY never reaches the browser.
// Verified against https://docs.sarvam.ai/api-reference (September 2026). Auth for every API is the
// `api-subscription-key` header.

const BASE = process.env.SARVAM_BASE_URL ?? 'https://api.sarvam.ai';
const DEFAULT_TIMEOUT_MS = 60_000;

export class AiError extends Error {
  constructor(message: string, public status = 502, public code = 'ai_error') {
    super(message);
  }
}

export function hasKey() {
  return !!process.env.SARVAM_API_KEY;
}

function key() {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new AiError('The AI engine is not configured. Add SARVAM_API_KEY to the server environment and restart.', 503, 'no_key');
  return k;
}

/** Sarvam error bodies are `{ error: { message, code } }` (model APIs) or RFC 7807 `{ title, detail }` (Document AI). */
function detail(body: string) {
  try {
    const j = JSON.parse(body);
    return String(j?.error?.message ?? j?.detail ?? j?.title ?? j?.message ?? '').slice(0, 240);
  } catch {
    return body.slice(0, 240);
  }
}

function plain(status: number, body: string) {
  const d = detail(body);
  if (/allowlist|egress/i.test(body)) return `The network blocked the call to Sarvam (${d.trim()}). Allow api.sarvam.ai in the network settings.`;
  if (status === 401 || status === 403) return 'The Sarvam API key was rejected. Check SARVAM_API_KEY on the server.';
  if (status === 402) return 'The Sarvam account has no credits left for this API. Top up credits on dashboard.sarvam.ai.';
  if (status === 429) return 'Sarvam rate limit reached. Wait a minute and try again.';
  if (status === 413) return 'The request was too large for the AI engine. Try a smaller document or section.';
  if (status >= 500) return `The Sarvam service is temporarily unavailable (${status}). Try again shortly.`;
  return `The AI engine returned an error (${status}). ${d}`;
}

type CallInit = RequestInit & { json?: unknown; timeoutMs?: number; label?: string };

/** fetch with a timeout and one retry on 429/5xx or network failure (not on timeout, to stay inside the route limit). */
async function call(path: string, init: CallInit, attempt = 0): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers: Record<string, string> = { 'api-subscription-key': key(), ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  try {
    const res = await fetch(path.startsWith('http') ? path : BASE + path, { method: init.method, headers, body, signal: ctrl.signal });
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await res.body?.cancel().catch(() => undefined);
      await new Promise((r) => setTimeout(r, res.status === 429 ? 3000 : 1500));
      return call(path, init, 1);
    }
    if (!res.ok) throw new AiError(plain(res.status, await res.text().catch(() => '')), res.status, `http_${res.status}`);
    return res;
  } catch (e) {
    if (e instanceof AiError) throw e;
    const aborted = (e as Error).name === 'AbortError';
    if (aborted) throw new AiError(`The AI engine did not respond within ${Math.round(timeoutMs / 1000)} seconds.`, 504, 'timeout');
    if (attempt === 0) return call(path, init, 1);
    throw new AiError('Could not reach the Sarvam API. Check the network connection.', 504, 'network');
  } finally {
    clearTimeout(t);
  }
}

export type ChatOpts = {
  model?: ChatModel;
  reasoning?: Reasoning;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Label for the usage log line. */
  task?: string;
};

export type Usage = { model: string; promptTokens: number; completionTokens: number; reasoningTokens?: number; latencyMs: number };

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

function chatBody(messages: Msg[], o: ChatOpts, extra: Record<string, unknown> = {}) {
  return {
    model: o.model ?? 'sarvam-105b',
    messages,
    max_tokens: o.maxTokens ?? 4000,
    temperature: o.temperature ?? 0.2,
    reasoning_effort: !o.reasoning || o.reasoning === 'off' ? null : o.reasoning,
    ...extra,
  };
}

/** One JSON line per call so token spend is visible in server logs. */
export function logUsage(task: string, u: Usage) {
  console.log(
    JSON.stringify({ at: new Date().toISOString(), ai: task, model: u.model, ms: u.latencyMs, in: u.promptTokens, out: u.completionTokens, reasoning: u.reasoningTokens ?? null }),
  );
}

function toUsage(data: { model?: string; usage?: Record<string, unknown> }, fallbackModel: string, t0: number): Usage {
  const u = (data.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } | null };
  return {
    model: data.model ?? fallbackModel,
    promptTokens: u.prompt_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? undefined,
    latencyMs: Date.now() - t0,
  };
}

function stripFences(s: string) {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (m) return m[1];
  // Some responses wrap the JSON in a sentence; take the outermost object.
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return a > 0 && b > a ? t.slice(a, b + 1) : t;
}

/** Plain chat call; returns the assistant content (reasoning_content is ignored). */
export async function chat(messages: Msg[], o: ChatOpts = {}, extra: Record<string, unknown> = {}): Promise<{ content: string; finish: string; usage: Usage }> {
  const t0 = Date.now();
  const res = await call('/v1/chat/completions', { method: 'POST', json: chatBody(messages, o, extra), timeoutMs: o.timeoutMs });
  const data = await res.json();
  const choice = data?.choices?.[0];
  const usage = toUsage(data, o.model ?? 'sarvam-105b', t0);
  logUsage(o.task ?? 'chat', usage);
  return { content: choice?.message?.content ?? '', finish: choice?.finish_reason ?? '', usage };
}

/**
 * Structured output: response_format json_schema, then validate with `parse`.
 * On a validation failure (or output truncated by max_tokens), retries once with a correction message.
 */
export async function chatJSON<T>(
  messages: Msg[],
  schema: { name: string; schema: object },
  parse: (v: unknown) => T,
  o: ChatOpts = {},
): Promise<{ data: T; usage: Usage[] }> {
  const usages: Usage[] = [];
  const rf = { response_format: { type: 'json_schema', json_schema: { name: schema.name.replace(/[^A-Za-z0-9_-]/g, '_'), schema: schema.schema, strict: true } } };
  const run = async (msgs: Msg[], opts: ChatOpts) => {
    const r = await chat(msgs, opts, rf);
    usages.push(r.usage);
    return r;
  };
  const first = await run(messages, o);
  let problem: string;
  try {
    if (!first.content.trim()) throw new Error(first.finish === 'length' ? 'output was cut off by max_tokens' : 'empty output');
    return { data: parse(JSON.parse(stripFences(first.content))), usage: usages };
  } catch (err) {
    problem = (err as Error).message.slice(0, 300);
  }
  // Retry: if the reasoning trace used up the token budget, retry without reasoning.
  const truncated = first.finish === 'length';
  const retryOpts: ChatOpts = truncated ? { ...o, reasoning: 'off' } : o;
  const second = await run(
    first.content.trim()
      ? [
          ...messages,
          { role: 'assistant', content: first.content },
          { role: 'user', content: `Your previous output did not match the required JSON schema (${problem}). Return only valid JSON that matches the schema exactly.` },
        ]
      : messages,
    retryOpts,
  );
  try {
    return { data: parse(JSON.parse(stripFences(second.content))), usage: usages };
  } catch {
    throw new AiError('The AI engine returned output that does not match the expected structure, twice. Try again, or use recorded responses.', 502, 'schema');
  }
}

/** Streams plain text content deltas (OpenAI-compatible SSE). Logs usage when the stream ends. */
export async function chatStream(messages: Msg[], o: ChatOpts = {}): Promise<ReadableStream<Uint8Array>> {
  const t0 = Date.now();
  const res = await call('/v1/chat/completions', { method: 'POST', json: chatBody(messages, o, { stream: true }), timeoutMs: o.timeoutMs });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';
  let chars = 0;
  let usage: Record<string, unknown> | undefined;
  let model = o.model ?? 'sarvam-105b';
  const handle = (ctrl: ReadableStreamDefaultController<Uint8Array>, line: string) => {
    const l = line.trim();
    if (!l.startsWith('data:')) return;
    const payload = l.slice(5).trim();
    if (payload === '[DONE]') return;
    try {
      const j = JSON.parse(payload);
      if (j.usage) usage = j.usage;
      if (j.model) model = j.model;
      const delta = j?.choices?.[0]?.delta?.content; // reasoning_content is ignored
      if (delta) {
        chars += delta.length;
        ctrl.enqueue(enc.encode(delta));
      }
    } catch {
      /* partial line */
    }
  };
  return new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) {
        if (buf) handle(ctrl, buf);
        const u = toUsage({ model, usage }, model, t0);
        if (!usage) u.completionTokens = Math.round(chars / 4); // estimate when the stream carries no usage
        logUsage(o.task ?? 'stream', u);
        return ctrl.close();
      }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) handle(ctrl, line);
    },
    cancel() {
      reader.cancel();
    },
  });
}

const LANG: Record<string, string> = { hi: 'hi-IN', en: 'en-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', od: 'od-IN', ur: 'ur-IN', as: 'as-IN' };
export const langCode = (l: string) => LANG[l] ?? l;

/** Protects IDs (FR-APP-001, GO-4.2) and acronyms from translation by swapping them for placeholders. */
function protect(text: string) {
  const keep: string[] = [];
  const out = text.replace(/\b(?:[A-Z]{2,}[A-Z0-9]*-[A-Za-z0-9.-]*[A-Za-z0-9]|[A-Z]{2,}[A-Z0-9]*)\b/g, (m) => {
    keep.push(m);
    return `{${keep.length - 1}}`;
  });
  // `{n}` placeholders survive sarvam-translate in both directions (tested September 2026); `[n]` did not.
  return { out, restore: (s: string) => s.replace(/\{\s*(\d+)\s*\}/g, (whole, i) => keep[+i] ?? whole) };
}

function chunks(text: string, max: number = TRANSLATE.chunkChars) {
  const parts: string[] = [];
  let cur = '';
  for (const sentence of text.split(/(?<=[.!?।])\s+|\n+/)) {
    if ((cur + ' ' + sentence).length > max && cur) {
      parts.push(cur);
      cur = sentence;
    } else cur = cur ? cur + ' ' + sentence : sentence;
  }
  if (cur) parts.push(cur);
  // A single sentence longer than the API limit is hard-split.
  return parts.flatMap((p) => (p.length <= TRANSLATE.maxChars ? [p] : p.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g')) ?? []));
}

/** Text translation (sarvam-translate:v1, formal). Long text is chunked; IDs and acronyms are preserved. */
export async function translate(text: string, source: string, target: string): Promise<string> {
  if (!text.trim()) return text;
  const { out, restore } = protect(text);
  const done: string[] = [];
  const t0 = Date.now();
  let chars = 0;
  for (const c of chunks(out)) {
    chars += c.length;
    const res = await call('/translate', {
      method: 'POST',
      timeoutMs: TRANSLATE.timeoutMs,
      json: { input: c, source_language_code: langCode(source), target_language_code: langCode(target), model: TRANSLATE.model, mode: TRANSLATE.mode, numerals_format: 'international' },
    });
    const data = await res.json();
    done.push(data.translated_text ?? '');
  }
  console.log(JSON.stringify({ at: new Date().toISOString(), ai: 'translate', model: TRANSLATE.model, ms: Date.now() - t0, chars }));
  return restore(done.join(' '));
}

/** Speech to text (saaras:v3, REST, audio under 30 s). Language is auto-detected. */
export async function transcribe(file: Blob, filename: string, mode: 'transcribe' | 'translate' = 'transcribe'): Promise<{ transcript: string; language: string }> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('model', SPEECH.model);
  form.append('mode', mode);
  form.append('language_code', 'unknown');
  const t0 = Date.now();
  const res = await call('/speech-to-text', { method: 'POST', body: form, timeoutMs: SPEECH.timeoutMs });
  const data = await res.json();
  console.log(JSON.stringify({ at: new Date().toISOString(), ai: 'stt', model: SPEECH.model, mode, ms: Date.now() - t0, bytes: file.size }));
  const lang = String(data.language_code ?? 'hi-IN').slice(0, 2);
  return { transcript: data.transcript ?? '', language: lang };
}

type DocPage = { page_num?: number; page_number?: number; content?: string; blocks?: { text?: string; reading_order?: number; layout_tag?: string }[] };

/** The docs describe `pages[].content`; the live API (September 2026) returns `pages[].blocks[]` in reading order. Both are handled. */
function pageTexts(results: { documents?: { pages?: DocPage[] }[] }) {
  return (results.documents ?? [])
    .flatMap((d) => d.pages ?? [])
    .sort((a, b) => (a.page_num ?? a.page_number ?? 0) - (b.page_num ?? b.page_number ?? 0))
    .map((p) =>
      p.content ??
      [...(p.blocks ?? [])]
        .sort((a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0))
        .map((b) => (b.text ?? '').trim())
        .filter(Boolean)
        .join('\n'),
    );
}

const DOC_TYPES: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip' };

/**
 * Document Intelligence (Sarvam Vision): create-and-start a digitise job with the file in the same multipart
 * request, poll status until terminal, then read per-page Markdown from the results endpoint.
 */
export async function digitise(file: Blob, filename: string, language = 'en-IN', timeoutMs: number = VISION.maxWaitMs): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const type = DOC_TYPES[ext];
  if (!type) throw new AiError('Document Intelligence accepts PDF, PNG, JPG or ZIP files. Paste the text instead.', 400, 'format');
  const form = new FormData();
  form.append('file', new Blob([await file.arrayBuffer()], { type }), filename);
  form.append('language', langCode(language));
  form.append('output_format', VISION.outputFormat);
  const t0 = Date.now();
  const job = await (await call('/doc-ai/v1/job/digitise', { method: 'POST', body: form, timeoutMs: 60_000 })).json();
  const jobId: string = job.job_id;
  if (!jobId) throw new AiError('Document Intelligence did not return a job ID.');
  let status = String(job.status ?? '');
  let pages = 0;
  while (!['completed', 'partially_completed', 'failed', 'rejected'].includes(status)) {
    if (Date.now() - t0 > timeoutMs) throw new AiError(`Document Intelligence is taking longer than ${Math.round(timeoutMs / 1000)} seconds. Paste the text instead.`, 504, 'timeout');
    await new Promise((r) => setTimeout(r, VISION.pollMs));
    const st = await (await call(`/doc-ai/v1/job/${jobId}/status`, { method: 'GET', timeoutMs: 20_000 })).json();
    status = String(st.status ?? '').toLowerCase();
    pages = st.usage?.pages_total ?? pages;
  }
  if (status === 'failed' || status === 'rejected') throw new AiError('Document Intelligence could not read this document. Paste the text instead.', 422, 'doc_failed');
  const results = await (await call(`/doc-ai/v1/job/${jobId}/results`, { method: 'GET', timeoutMs: 30_000 })).json();
  const text = pageTexts(results).join('\n\n').trim();
  console.log(JSON.stringify({ at: new Date().toISOString(), ai: 'digitise', model: VISION.model, ms: Date.now() - t0, pages, status, chars: text.length }));
  if (!text) throw new AiError('Document Intelligence returned no text for this document. Paste the text instead.', 422, 'doc_empty');
  return text;
}
