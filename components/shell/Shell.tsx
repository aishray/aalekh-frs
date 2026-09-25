'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { toast } from 'sonner';
import { LayoutDashboard, FolderKanban, Library, ShieldCheck, History, Settings, Search, ChevronDown, Check } from 'lucide-react';
import { branding, personas } from '@/config/branding';
import { useRepo, usePersona } from '@/lib/repo/store';
import { useUi } from '@/lib/repo/ui';
import { useHydrated } from '@/lib/repo/hydrated';
import { cn, refLabel } from '@/lib/util';
import { RefPanel } from './RefPanel';
import { setReferenceOverrides } from '@/lib/engine/reference';
import { Modal } from '@/components/ui';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/library', label: 'Reuse library', icon: Library },
  { href: '/standards', label: 'Standards', icon: ShieldCheck },
  { href: '/activity', label: 'Activity log', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const setSearch = useUi((s) => s.setSearch);
  const setPresenter = useUi((s) => s.setPresenter);
  const resetSample = useRepo((s) => s.resetSample);
  const reference = useRepo((s) => s.settings.reference);
  setReferenceOverrides(reference); // engines read the effective checklists and terms synchronously

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch(true);
        return;
      }
      if (typing || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'R') {
        e.preventDefault();
        resetSample();
        toast.success('Sample project reset to its sources');
        router.push('/projects/pms-scholarship');
      } else if (e.key === 'P') {
        e.preventDefault();
        setPresenter(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [setSearch, setPresenter, resetSample, router]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-white px-3">
        <Link href="/" className="flex w-[196px] shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-navy font-serif text-base font-semibold text-white">{branding.monogram}</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-ink">{branding.product}</span>
            <span className="block text-[11px] text-ink-faint">Directorate of IT, {branding.state}</span>
          </span>
        </Link>
        <button
          onClick={() => setSearch(true)}
          className="flex h-8 w-full max-w-md items-center gap-2 rounded border border-line bg-canvas px-2.5 text-sm text-ink-faint hover:border-ink-faint"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">Search projects, requirement IDs, clauses</span>
          <kbd className="rounded border border-line bg-white px-1 text-[11px]">Ctrl K</kbd>
        </button>
        <div className="ml-auto">{hydrated && <PersonaMenu />}</div>
      </header>
      <nav aria-label="Main" className="fixed bottom-0 left-0 top-12 z-20 w-[212px] border-r border-line bg-white px-2 py-3">
        <ul className="space-y-0.5">
          {nav.map((n) => {
            const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={cn('flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm', active ? 'bg-navy-soft font-medium text-navy' : 'text-ink-muted hover:bg-canvas hover:text-ink')}
                >
                  <n.icon className="h-4 w-4" aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="absolute inset-x-3 bottom-3 text-[11px] leading-snug text-ink-faint">
          <p>Shift+P presenter notes</p>
          <p>Shift+R reset sample project</p>
        </div>
      </nav>
      <main className="pl-[212px] pt-12">
        <div className="mx-auto max-w-[1280px] px-6 py-5">{children}</div>
      </main>
      {hydrated && <SearchPalette />}
      <RefPanel />
      <PresenterNotes />
    </div>
  );
}

function PersonaMenu() {
  const persona = usePersona();
  const setPersona = useRepo((s) => s.setPersona);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded border border-line px-2 py-1 text-left hover:bg-canvas"
        data-testid="persona-menu"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-soft text-xs font-semibold text-navy">{persona.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
        <span className="leading-tight">
          <span className="block text-xs font-semibold">{persona.name}</span>
          <span className="block text-[11px] text-ink-faint">{persona.role}: {persona.designation.split(',')[0]}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-72 rounded-md border border-line bg-white py-1 shadow-lg">
          <p className="px-3 py-1 text-[11px] text-ink-faint">Act as (changes the actions available in Review and Change control)</p>
          {personas.map((p) => (
            <button
              key={p.id}
              role="menuitemradio"
              aria-checked={p.id === persona.id}
              onClick={() => {
                setPersona(p.id);
                setOpen(false);
                toast(`Now acting as ${p.name}, ${p.designation}`);
              }}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-canvas"
            >
              <Check className={cn('mt-0.5 h-3.5 w-3.5', p.id === persona.id ? 'text-navy' : 'invisible')} aria-hidden />
              <span>
                <span className="block text-sm font-medium">{p.name} <span className="font-normal text-ink-faint">({p.role})</span></span>
                <span className="block text-xs text-ink-muted">{p.designation}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPalette() {
  const open = useUi((s) => s.search);
  const setOpen = useUi((s) => s.setSearch);
  const projects = useRepo((s) => s.projects);
  const router = useRouter();
  const [q, setQ] = useState('');
  const openRef = useUi((s) => s.openRef);

  const items = useMemo(() => {
    if (!open) return { projects: [], reqs: [], clauses: [] };
    const needle = q.trim().toLowerCase();
    const match = (s: string) => !needle || s.toLowerCase().includes(needle);
    return {
      projects: projects.filter((p) => match(`${p.name} ${p.fileNo} ${p.department}`)).slice(0, 8),
      reqs: needle ? projects.flatMap((p) => p.requirements.filter((r) => match(`${r.id} ${r.title}`)).map((r) => ({ p, r }))).slice(0, 12) : [],
      clauses: needle ? projects.flatMap((p) => p.sources.flatMap((d) => d.clauses.filter((c) => match(`${c.id} ${refLabel(c.id)} ${c.english}`)).map((c) => ({ p, c })))).slice(0, 12) : [],
    };
  }, [open, q, projects]);

  if (!open) return null;
  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 pt-24" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-md border border-line bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <Command shouldFilter={false} label="Search" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Type a project, FR-NOT-001, GO 4.2 or a word" className="h-11 w-full border-b border-line px-4 text-sm outline-none" />
          <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-sm text-ink-muted">Nothing matches. Try a requirement ID such as FR-APP-011.</Command.Empty>
            {items.projects.length > 0 && (
              <Command.Group heading="Projects" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-ink-faint">
                {items.projects.map((p) => (
                  <Command.Item key={p.id} value={`p-${p.id}`} onSelect={() => go(`/projects/${p.id}`)} className="flex cursor-pointer justify-between rounded px-2 py-1.5 text-sm aria-selected:bg-navy-soft">
                    <span>{p.name}</span>
                    <span className="text-xs text-ink-faint">{p.fileNo}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {items.reqs.length > 0 && (
              <Command.Group heading="Requirements" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-ink-faint">
                {items.reqs.map(({ p, r }) => (
                  <Command.Item key={p.id + r.id} value={`r-${p.id}-${r.id}`} onSelect={() => go(`/projects/${p.id}/document#${r.id}`)} className="flex cursor-pointer gap-2 rounded px-2 py-1.5 text-sm aria-selected:bg-navy-soft">
                    <span className="font-mono text-xs text-navy">{r.id}</span>
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="truncate text-xs text-ink-faint">{p.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {items.clauses.length > 0 && (
              <Command.Group heading="Source clauses" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-ink-faint">
                {items.clauses.map(({ p, c }) => (
                  <Command.Item
                    key={p.id + c.id}
                    value={`c-${p.id}-${c.id}`}
                    onSelect={() => {
                      go(`/projects/${p.id}/sources?clause=${encodeURIComponent(c.id)}`);
                      openRef(p.id, c.id);
                    }}
                    className="flex cursor-pointer gap-2 rounded px-2 py-1.5 text-sm aria-selected:bg-navy-soft"
                  >
                    <span className="font-mono text-xs text-navy">{refLabel(c.id)}</span>
                    <span className="flex-1 truncate">{c.english || c.original}</span>
                    <span className="truncate text-xs text-ink-faint">{p.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function PresenterNotes() {
  const open = useUi((s) => s.presenter);
  const setOpen = useUi((s) => s.setPresenter);
  const points = [
    'Every requirement traces to its source: click any reference such as GO 4.2 to see the clause.',
    'Conflicts are resolved before drafting, not discovered by the vendor after award.',
    'Workflows and eligibility rules are testable tables, not prose: boundary tests are generated automatically.',
    'Compliance (GIGW, DPDP, CERT-In, Aadhaar) and Right to Service timelines are checked automatically.',
    'After approval, corrigenda and vendor change requests are assessed against the baseline, with the FR IDs to prove it.',
    'Runs on Sarvam, an Indian sovereign AI provider; deployable in the State Data Centre with open-weight models.',
    'Next step: a pilot on two live projects, measuring drafting time and change-request reduction.',
  ];
  const path = [
    'Dashboard: items needing attention across 8 projects',
    'Scholarship project, Sources: GO, corrigendum, minutes, Hindi voice brief, scanned form',
    'Reconcile: resolve 15 vs 10 day conflict (GO prevails), accept corrigendum, defer Annexure A',
    'Discovery: missing payment failure handling and appeal; answer two questions',
    'Workflow: RTS check 30 of 30 days. Rules: tester with income ₹3,00,001',
    'Document: generate FRS, click GO 4.2, show reused requirement',
    'Quality: draft requirement for GO 7.3, fix "quickly", score rises',
    'Review as Director: approve v1.0. Changes: add Corrigendum 2, then vendor CR-07',
    'Export: Word FRS and UAT test cases in Excel',
  ];
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Presenter notes" wide>
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <h3 className="mb-2 font-semibold">Key messages</h3>
          <ul className="list-disc space-y-1.5 pl-4">{points.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Demo path (3 to 4 minutes)</h3>
          <ol className="list-decimal space-y-1.5 pl-4">{path.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      </div>
    </Modal>
  );
}
