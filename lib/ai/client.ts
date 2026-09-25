'use client';

import { useRepo, type AiTask } from '@/lib/repo/store';
import type { Project } from '@/lib/types';
import type { Blocks } from './prompts/base';

export type AiSource = 'recorded' | 'live' | 'fallback';
export class ClientAiError extends Error {}

function settings() {
  return useRepo.getState().settings;
}

async function errorText(res: Response) {
  try {
    const j = await res.clone().json();
    return j.error ?? res.statusText;
  } catch {
    return (await res.text()) || `Request failed (${res.status}).`;
  }
}

export async function runAi<T>(step: AiTask, project: Project, blocks: Blocks, variant?: string): Promise<{ data: T; source: AiSource }> {
  const s = settings();
  let res: Response;
  try {
    res = await fetch(`/api/ai/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recorded: s.recorded, sample: project.sample, variant, blocks, model: s.model, reasoning: s.reasoning[step] }),
    });
  } catch {
    throw new ClientAiError('Could not reach the application server. Check that it is running.');
  }
  if (!res.ok) throw new ClientAiError(await errorText(res));
  const j = await res.json();
  return { data: j.data as T, source: j.source as AiSource };
}

export async function streamNarrative(project: Project, section: string, blocks: Blocks, onText: (full: string) => void): Promise<string> {
  const s = settings();
  const res = await fetch('/api/ai/narrative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, recorded: s.recorded, sample: project.sample, blocks, model: s.model }),
  }).catch(() => {
    throw new ClientAiError('Could not reach the application server.');
  });
  if (!res.ok || !res.body) throw new ClientAiError(await errorText(res));
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onText(full);
  }
  return full.trim();
}

export async function translateTexts(project: Project | undefined, texts: string[], source: string, target: string): Promise<string[]> {
  const s = settings();
  const res = await fetch('/api/ai/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, source, target, recorded: s.recorded, sample: project?.sample }),
  }).catch(() => {
    throw new ClientAiError('Could not reach the application server.');
  });
  if (!res.ok) throw new ClientAiError(await errorText(res));
  return (await res.json()).data;
}

export async function digitiseFile(project: Project | undefined, file: File): Promise<string> {
  const s = settings();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('recorded', String(s.recorded));
  if (project?.sample) fd.append('sample', project.sample);
  const res = await fetch('/api/ai/digitise', { method: 'POST', body: fd }).catch(() => {
    throw new ClientAiError('Could not reach the application server.');
  });
  if (!res.ok) throw new ClientAiError(await errorText(res));
  return (await res.json()).data;
}

export async function transcribeAudio(file: Blob, name: string): Promise<{ transcript: string; language: string; english: string }> {
  const fd = new FormData();
  fd.append('file', file, name);
  const res = await fetch('/api/ai/transcribe', { method: 'POST', body: fd }).catch(() => {
    throw new ClientAiError('Could not reach the application server.');
  });
  if (!res.ok) throw new ClientAiError(await errorText(res));
  return (await res.json()).data;
}
