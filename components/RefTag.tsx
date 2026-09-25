'use client';

import { useUi } from '@/lib/repo/ui';
import { cn, refLabel } from '@/lib/util';

export function RefTag({ projectId, id, invalid, className }: { projectId: string; id: string; invalid?: boolean; className?: string }) {
  const openRef = useUi((s) => s.openRef);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openRef(projectId, id);
      }}
      title={invalid ? 'Reference not found in this project' : 'Open reference'}
      className={cn(
        'inline-flex items-center rounded border px-1 py-px font-mono text-[11px] leading-4 transition-colors',
        invalid ? 'border-bad/40 bg-bad-soft text-bad line-through' : 'border-navy/25 bg-navy-soft text-navy hover:border-navy hover:bg-white',
        className,
      )}
    >
      {refLabel(id)}
    </button>
  );
}

export function Refs({ projectId, refs, valid }: { projectId: string; refs: string[]; valid?: Set<string> }) {
  if (!refs.length) return <span className="text-xs text-ink-faint">No refs</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {refs.map((r) => (
        <RefTag key={r} projectId={projectId} id={r} invalid={valid ? !valid.has(r) && !r.startsWith('FR-') && !r.startsWith('NFR-') && !r.startsWith('IR-') : false} />
      ))}
    </span>
  );
}

/** Renders text with inline [GO-4.2] markers as clickable tags. */
export function RefText({ projectId, text }: { projectId: string; text: string }) {
  const parts = text.split(/(\[[A-Z][A-Z0-9]*-[A-Za-z0-9.()-]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([A-Z][A-Z0-9]*-[A-Za-z0-9.()-]+)\]$/);
        return m ? <RefTag key={i} projectId={projectId} id={m[1]} className="mx-0.5 align-baseline" /> : <span key={i}>{part}</span>;
      })}
    </>
  );
}
