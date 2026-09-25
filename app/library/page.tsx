'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRepo } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { Badge, Empty, Input, PageHeader, PageSkeleton, Panel, Select, Tabs } from '@/components/ui';
import { buildLibraryIndex, libraryItems } from '@/lib/engine/similarity';
import { moduleName } from '@/lib/generate/run';
import catalogue from '@/data/catalogue.json';

export default function LibraryPage() {
  const hydrated = useHydrated();
  const projects = useRepo((s) => s.projects);
  const [tab, setTab] = useState<'library' | 'catalogue'>('library');
  const [q, setQ] = useState('');
  const [mod, setMod] = useState('');
  const items = useMemo(() => libraryItems(projects), [projects]);
  const index = useMemo(() => buildLibraryIndex(items), [items]);
  const results = useMemo(() => {
    const base = q.trim() ? index.query(q, 60).filter((h) => h.score > 0.05).map((h) => ({ ...items[h.index], score: h.score })) : items.map((i) => ({ ...i, score: 0 }));
    return base.filter((r) => !mod || r.req.module === mod);
  }, [q, mod, index, items]);
  const modules = Array.from(new Set(items.map((i) => i.req.module))).sort();

  if (!hydrated) return <PageSkeleton />;
  return (
    <div>
      <PageHeader title="Reuse library" subtitle="Requirements from approved FRSs, and standard e-Gov components with pre-written integration requirements. During generation, similar approved requirements are offered with Use this." />
      <Tabs tabs={[{ id: 'library', label: `Approved requirements (${items.length})` }, { id: 'catalogue', label: `e-Gov component catalogue (${catalogue.length})` }]} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'library' ? (
          <>
            <div className="mb-3 flex gap-2">
              <Input aria-label="Search the library" className="max-w-md" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, for example: assisted application with OTP consent" />
              <Select aria-label="Module" className="w-56" value={mod} onChange={(e) => setMod(e.target.value)}>
                <option value="">All modules</option>
                {modules.map((m) => <option key={m} value={m}>{moduleName(m)}</option>)}
              </Select>
            </div>
            {results.length === 0 ? (
              <Empty text="No approved requirement matches this search." />
            ) : (
              <div className="space-y-2">
                {results.slice(0, 60).map((r) => (
                  <div key={r.projectId + r.req.id} className="rounded-md border border-line bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs font-semibold text-navy">{r.req.id}</span>
                      <span className="font-medium">{r.req.title}</span>
                      <Badge>{moduleName(r.req.module)}</Badge>
                      <Link href={`/projects/${r.projectId}/document#${r.req.id}`} className="text-xs text-navy underline">{r.projectName}</Link>
                      {q.trim() && <span className="ml-auto text-xs text-ink-faint">{Math.round(r.score * 100)}% match</span>}
                    </div>
                    <p className="mt-1 text-sm">{r.req.description}</p>
                    <ul className="ml-4 mt-1 list-disc text-xs text-ink-muted">{r.req.acceptanceCriteria.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {catalogue.map((c) => (
              <Panel key={c.id} title={c.name} subtitle={c.provider}>
                <p className="text-sm text-ink-muted">{c.summary}</p>
                <p className="mt-2 text-xs font-semibold text-ink-muted">Integration requirement template</p>
                <p className="text-sm font-medium">{c.template.title}</p>
                <p className="text-sm">{c.template.description}</p>
                <ul className="ml-4 mt-1 list-disc text-xs text-ink-muted">{c.template.acceptance.map((a) => <li key={a}>{a}</li>)}</ul>
                {c.questions.length > 0 && (
                  <>
                    <p className="mt-2 text-xs font-semibold text-ink-muted">Questions to ask the department</p>
                    <ul className="ml-4 list-disc text-xs">{c.questions.map((x) => <li key={x}>{x}</li>)}</ul>
                  </>
                )}
                <div className="mt-2 flex flex-wrap gap-1">{c.keywords.map((k) => <Badge key={k}>{k}</Badge>)}{c.refs.map((r) => <Badge key={r} tone="navy">{r}</Badge>)}</div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
