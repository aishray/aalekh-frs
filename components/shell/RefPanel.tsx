'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useUi } from '@/lib/repo/ui';
import { useRepo } from '@/lib/repo/store';
import { clauseById, citing, resolveRef, clauseState } from '@/lib/engine/model';
import { Badge } from '@/components/ui';
import { RefTag } from '@/components/RefTag';
import { cn, refLabel } from '@/lib/util';

export function RefPanel() {
  const panel = useUi((s) => s.refPanel);
  const close = useUi((s) => s.closeRef);
  const project = useRepo((s) => (panel ? s.projects.find((p) => p.id === panel.projectId) : undefined));
  const hl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', h);
    const t = setTimeout(() => hl.current?.scrollIntoView({ block: 'center' }), 50);
    return () => {
      window.removeEventListener('keydown', h);
      clearTimeout(t);
    };
  }, [panel, close]);

  if (!panel || !project) return null;
  const r = resolveRef(project, panel.ref);
  const hit = clauseById(project, panel.ref);
  const cited = citing(project.requirements, panel.ref);

  return (
    <aside aria-label={`Reference ${refLabel(panel.ref)}`} className="fixed bottom-0 right-0 top-12 z-40 flex w-[440px] max-w-full flex-col border-l border-line bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-navy">{refLabel(panel.ref)}</span>
          {r && <Badge>{r.kind}</Badge>}
          {r?.state && !r.state.effective && (
            <Badge tone="bad">{r.state.reason === 'superseded' ? `Superseded by ${refLabel(r.state.by!)}` : `Overridden by ${refLabel(r.state.by!)}`}</Badge>
          )}
        </div>
        <button onClick={close} className="rounded p-1 text-ink-muted hover:bg-canvas" aria-label="Close reference panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {!r && <p className="text-bad">This reference does not exist in the project. It may have been removed or mistyped.</p>}
        {r && (
          <div>
            <p className="font-medium text-ink">{r.title}</p>
            {r.sub && <p className="text-xs text-ink-faint">{r.sub}</p>}
            {r.original && (
              <p className="mt-2 rounded bg-mark px-2 py-1.5 font-sans leading-relaxed" lang="hi">
                {r.original}
              </p>
            )}
            <p className={cn('mt-2 leading-relaxed', !r.original && 'rounded bg-mark px-2 py-1.5', r.state && !r.state.effective && 'line-through decoration-bad/60')}>{r.text}</p>
            {r.original && <p className="mt-1 text-xs text-ink-faint">English translation</p>}
          </div>
        )}
        {hit && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-muted">In context: {hit.doc.name}</p>
            <div className="space-y-1.5 rounded border border-line p-2">
              {hit.doc.clauses.map((c) => {
                const st = clauseState(project, c);
                const on = c.id === panel.ref;
                return (
                  <div key={c.id} ref={on ? hl : undefined} className={cn('rounded px-1.5 py-1 text-[13px]', on ? 'bg-mark' : 'text-ink-muted')}>
                    <span className="mr-1 font-mono text-[11px] text-ink-faint">{refLabel(c.id)}</span>
                    <span className={cn(!st.effective && 'line-through')}>{c.english || c.original}</span>
                  </div>
                );
              })}
            </div>
            <Link href={`/projects/${project.id}/sources?clause=${encodeURIComponent(panel.ref)}`} onClick={close} className="mt-2 inline-block text-xs text-navy underline">
              Open in Sources
            </Link>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-muted">Cited by {cited.length} requirement{cited.length === 1 ? '' : 's'}</p>
          {cited.length === 0 ? (
            <p className="text-xs text-ink-faint">No requirement cites this reference yet.</p>
          ) : (
            <ul className="space-y-1">
              {cited.map((q) => (
                <li key={q.id} className="flex gap-2">
                  <RefTag projectId={project.id} id={q.id} />
                  <span className="text-[13px]">{q.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
