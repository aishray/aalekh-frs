import 'server-only';

// Sarvam AI client. Server only: SARVAM_API_KEY never reaches the browser.
// Endpoints follow the project brief (Section 9). They could not be verified against docs.sarvam.ai from the
// build environment (network egress blocked); see README "Sarvam integration" before going live.

const BASE = process.env.SARVAM_BASE_URL ?? 'https://api.sarvam.ai';
const TIMEOUT_MS = 60_000;

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
  if (!k) throw new AiError('The AI engine is not configured. Add SARVAM_API_KEY to .env.local and restart the server.', 503, 'no_key');
  return k;
}

function plain(status: number, body: string) {
  if (status === 401 || status === 403) return 'The Sarvam API key was rejected. Check SARVAM_API_KEY in .env.local.';
  if (status === 429) return 'Sarvam rate limit reached. Wait a minute and try again.';
  if (status === 413) return 'The request was too large for the AI engine. Try a smaller document or section.';
  if (status >= 500) return 'The Sarvam service is temporarily unavailable. Try again shortly.';
  return `The AI engine returned an error (${status}). ${body.slice(0, 200)}`;
}

/** fetch with 60 s timeout and one retry on 429/5xx or network failure. */
async function call(path: string, init: RequestInit & { json?: unknown }, attempt = 0): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = { 'api-subscription-key': key(), ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  try {
    const res = await fetch(path.startsWith('http') ? path : BASE + path, { ...init, headers, body, signal: ctrl.signal });
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      return call(path, init, 1);
    }
    if (!res.ok) throw new AiError(plain(res.status, await res.text().catch(() => '')), res.status);
    return res;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (attempt === 0) return call(path, init, 1);
    const aborted = (e as Error).name === 'AbortError';
    throw new AiError(aborted ? 'The AI engine did not respond within 60 seconds.' : 'Could not reach the Sarvam API. Check the network connection.', 504, 'network');
  } finally {
    clearTimeout(t);
  }
}

export type ChatOpts = {
  model?: string;
  reasoning?: 'off' | 'low' | 'medium';
  maxTokens?: number;
  temperature?: number;
};

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

function chatBody(messages: Msg[], o: ChatOpts, extra: Record<string, unknown> = {}) {
  return {
    model: o.model ?? 'sarvam-105b',
    messages,
    max_tokens: o.maxTokens ?? 6000,
    temperature: o.temperature ?? 0.2,
    reasoning_effort: !o.reasoning || o.reasoning === 'off' ? null : o.reasoning,
    ...extra,
  };
}

function stripFences(s: string) {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

/**
 * Structured output: response_format json_schema, then validate with `parse`.
 * On a validation failure, retries once with a correction message.
 */
export async function chatJSON<T>(
  messages: Msg[],
  schema: { name: string; schema: object },
  parse: (v: unknown) => T,
  o: ChatOpts = {},
): Promise<T> {
  const run = async (msgs: Msg[]) => {
    const res = await call('/v1/chat/completions', {
      method: 'POST',
      json: chatBody(msgs, o, { response_format: { type: 'json_schema', json_schema: { name: schema.name, schema: schema.schema, strict: true } } }),
    });
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    return content;
  };
  const first = await run(messages);
  try {
    return parse(JSON.parse(stripFences(first)));
  } catch (err) {
    const second = await run([
      ...messages,
      { role: 'assistant', content: first },
      { role: 'user', content: `Your previous output did not match the required JSON schema (${(err as Error).message.slice(0, 300)}). Return only valid JSON that matches the schema exactly.` },
    ]);
    try {
      return parse(JSON.parse(stripFences(second)));
    } catch (e2) {
      throw new AiError('The AI engine returned output that does not match the expected structure, twice. Try again, or use recorded responses.', 502, 'schema');
    }
  }
}

/** Streams plain text content deltas (OpenAI-compatible SSE). */
export async function chatStream(messages: Msg[], o: ChatOpts = {}): Promise<ReadableStream<Uint8Array>> {
  const res = await call('/v1/chat/completions', { method: 'POST', json: chatBody(messages, o, { stream: true }) });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';
  return new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read();
      if (done) return ctrl.close();
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
          if (delta) ctrl.enqueue(enc.encode(delta)); // reasoning_content is ignored
        } catch {
          /* partial line */
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

const LANG: Record<string, string> = { hi: 'hi-IN', en: 'en-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', od: 'od-IN' };

/** Protects IDs (FR-APP-001, GO-4.2) and acronyms from translation by swapping them for placeholders. */
function protect(text: string) {
  const keep: string[] = [];
  const out = text.replace(/\b(?:[A-Z]{2,}[A-Z0-9]*-[A-Za-z0-9.-]+|[A-Z]{2,}[A-Z0-9]*)\b/g, (m) => {
    keep.push(m);
    return `⟦${keep.length - 1}⟧`;
  });
  return { out, restore: (s: string) => s.replace(/⟦\s*(\d+)\s*⟧/g, (_, i) => keep[+i] ?? '') };
}

function chunks(text: string, max = 900) {
  const parts: string[] = [];
  let cur = '';
  for (const sentence of text.split(/(?<=[.!?।])\s+|\n+/)) {
    if ((cur + ' ' + sentence).length > max && cur) {
      parts.push(cur);
      cur = sentence;
    } else cur = cur ? cur + ' ' + sentence : sentence;
  }
  if (cur) parts.push(cur);
  return parts;
}

export async function translate(text: string, source: string, target: string): Promise<string> {
  if (!text.trim()) return text;
  const { out, restore } = protect(text);
  const done: string[] = [];
  for (const c of chunks(out)) {
    const res = await call('/translate', {
      method: 'POST',
      json: { input: c, source_language_code: LANG[source] ?? source, target_language_code: LANG[target] ?? target, model: 'sarvam-translate:v1', mode: 'formal' },
    });
    const data = await res.json();
    done.push(data.translated_text ?? '');
  }
  return restore(done.join(' '));
}

export async function transcribe(file: Blob, filename: string): Promise<{ transcript: string; language: string }> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('model', 'saaras:v3');
  form.append('language_code', 'unknown');
  const res = await call('/speech-to-text', { method: 'POST', body: form });
  const data = await res.json();
  const lang = String(data.language_code ?? 'hi-IN').slice(0, 2);
  return { transcript: data.transcript ?? '', language: lang };
}

/** Document Intelligence async job: create, upload, start, poll, download. */
export async function digitise(file: Blob, filename: string, language = 'hi-IN'): Promise<string> {
  const job = await (await call('/doc-digitization/job/v1', { method: 'POST', json: { job_parameters: { language, output_format: 'md' } } })).json();
  const jobId: string = job.job_id;
  const up = await (await call('/doc-digitization/job/v1/upload-files', { method: 'POST', json: { job_id: jobId, files: [filename] } })).json();
  const url: string | undefined = up?.upload_urls?.[filename]?.file_url;
  if (!url) throw new AiError('Document Intelligence did not return an upload URL.');
  const put = await fetch(url, { method: 'PUT', body: file, headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/octet-stream' } });
  if (!put.ok) throw new AiError('Upload to Document Intelligence failed.');
  await call(`/doc-digitization/job/v1/${jobId}/start`, { method: 'POST', json: {} });
  const started = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await (await call(`/doc-digitization/job/v1/${jobId}/status`, { method: 'GET' })).json();
    const state = String(st.job_state ?? '').toLowerCase();
    if (state === 'completed' || state === 'partiallycompleted') break;
    if (state === 'failed') throw new AiError('Document Intelligence could not read this document. Paste the text instead.');
    if (Date.now() - started > 120_000) throw new AiError('Document Intelligence is taking longer than 2 minutes. Paste the text instead.', 504);
  }
  const dl = await (await call(`/doc-digitization/job/v1/${jobId}/download-files`, { method: 'POST', json: {} })).json();
  const urls: string[] = Object.values(dl?.download_urls ?? {}).map((x) => (x as { file_url: string }).file_url);
  const texts = await Promise.all(urls.map(async (u) => (await fetch(u)).text()));
  return texts.join('\n\n');
}
