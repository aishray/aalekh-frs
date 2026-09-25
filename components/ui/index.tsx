'use client';

import React from 'react';
import { cn } from '@/lib/util';
import { Loader2, X, AlertTriangle } from 'lucide-react';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md';
  loading?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        variant === 'primary' && 'border-navy bg-navy text-white hover:bg-navy-hover',
        variant === 'secondary' && 'border-line bg-white text-ink hover:bg-canvas',
        variant === 'ghost' && 'border-transparent bg-transparent text-ink-muted hover:bg-canvas hover:text-ink',
        variant === 'danger' && 'border-bad bg-white text-bad hover:bg-bad-soft',
        variant === 'success' && 'border-ok bg-ok text-white hover:opacity-90',
        className,
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Panel({ title, actions, children, className, bodyClass, id, subtitle }: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-md border border-line bg-panel', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

const tones = {
  neutral: 'bg-canvas text-ink-muted border-line',
  navy: 'bg-navy-soft text-navy border-navy/20',
  ok: 'bg-ok-soft text-ok border-ok/20',
  warn: 'bg-warn-soft text-warn border-warn/25',
  bad: 'bg-bad-soft text-bad border-bad/20',
};
export type Tone = keyof typeof tones;

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-px text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className, htmlFor }: { label: string; hint?: string; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-muted">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export const inputCls =
  'h-8 w-full rounded border border-line bg-white px-2 text-sm text-ink placeholder:text-ink-faint focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cn(inputCls, className)} />;
});

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(inputCls, 'h-auto min-h-[72px] py-1.5 leading-snug', className)} />;
}

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cn(inputCls, 'pr-6', className)}>
      {children}
    </select>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-line/70', className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-72" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line bg-white px-5 py-6">
      <p className="text-sm text-ink-muted">{text}</p>
      {action}
    </div>
  );
}

export function ErrorBox({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-bad">{title}</p>
        <p className="text-sm text-ink">{message}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'navy', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-md border px-3 py-2 text-sm', tones[tone], className)}>{children}</div>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-md border border-line bg-panel px-4 py-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={cn('mt-0.5 text-2xl font-semibold tabular-nums', tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-6 pt-16" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('w-full rounded-md border border-line bg-white shadow-lg', wide ? 'max-w-4xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-canvas" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-2.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn('-mb-px border-b-2 px-3 py-2 text-sm', value === t.id ? 'border-navy font-medium text-navy' : 'border-transparent text-ink-muted hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-3xl text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Staged progress for AI steps, so users see what is happening. */
export function Progress({ stages, current }: { stages: string[]; current: number }) {
  return (
    <ol className="space-y-1.5 rounded-md border border-line bg-white p-3 text-sm" aria-live="polite">
      {stages.map((s, i) => (
        <li key={s} className={cn('flex items-center gap-2', i < current ? 'text-ok' : i === current ? 'text-ink' : 'text-ink-faint')}>
          {i < current ? <span aria-hidden>✓</span> : i === current ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <span aria-hidden className="inline-block w-3.5 text-center">·</span>}
          {s}
        </li>
      ))}
    </ol>
  );
}

export const th = 'border-b border-line bg-canvas px-2.5 py-1.5 text-left text-xs font-semibold text-ink-muted';
export const td = 'border-b border-line px-2.5 py-1.5 align-top text-sm';
