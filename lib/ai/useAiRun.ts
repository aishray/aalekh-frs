'use client';

import { useCallback, useRef, useState } from 'react';
import type { AiSource } from './client';

/** Runs an async AI task with staged progress text that advances while the call is in flight. */
export function useAiRun() {
  const [stages, setStages] = useState<string[]>([]);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<AiSource | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(async <T,>(st: string[], fn: () => Promise<T>, stepMs = 800): Promise<T | undefined> => {
    setStages(st);
    setStage(0);
    setBusy(true);
    setError(null);
    timer.current = setInterval(() => setStage((s) => Math.min(s + 1, st.length - 1)), stepMs);
    try {
      const out = await fn();
      const src = (out as { source?: AiSource } | undefined)?.source;
      if (src) setSource(src);
      return out;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  }, []);

  return { run, busy, stage, stages, error, setError, source };
}
