'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useRepo } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { projectTypes } from '@/config/branding';
import type { ProjectType } from '@/lib/types';
import { defaults, type AmbiguousTerm, type ComplianceDef, type ReferenceOverrides } from '@/lib/engine/reference';
import { Badge, Button, Empty, Field, Input, PageHeader, PageSkeleton, Panel, Select, Tabs, td, th } from '@/components/ui';

type Tab = 'compliance' | 'gap' | 'terms' | 'nfr' | 'standards';

export default function StandardsPage() {
  const hydrated = useHydrated();
  const reference = useRepo((s) => s.settings.reference) ?? {};
  const setSettings = useRepo((s) => s.setSettings);
  const log = useRepo((s) => s.log);
  const [tab, setTab] = useState<Tab>('compliance');
  const [type, setType] = useState<ProjectType>('benefit');

  if (!hydrated) return <PageSkeleton />;

  const save = (next: ReferenceOverrides, action: string, target?: string) => {
    setSettings({ reference: next });
    log(action, target);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Standards"
        subtitle="Compliance checklists, gap checklists, ambiguous terms and NFR baselines used by discovery and the quality engine. Edits apply to every project."
      />
      <Tabs
        tabs={[
          { id: 'compliance', label: 'Compliance checklists' },
          { id: 'gap', label: 'Gap checklists' },
          { id: 'terms', label: `Ambiguous terms (${(reference.ambiguous ?? defaults.ambiguous).length})` },
          { id: 'nfr', label: 'NFR baselines' },
          { id: 'standards', label: 'Standards referenced' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {(tab === 'compliance' || tab === 'gap' || tab === 'nfr') && (
        <Field label="Project type" htmlFor="std-type" className="w-96">
          <Select id="std-type" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
            {(Object.keys(projectTypes) as ProjectType[]).map((k) => <option key={k} value={k}>{projectTypes[k]}</option>)}
          </Select>
        </Field>
      )}
      {tab === 'compliance' && <Compliance key={type} type={type} reference={reference} save={save} />}
      {tab === 'gap' && <Gap key={type} type={type} reference={reference} save={save} />}
      {tab === 'terms' && <Terms reference={reference} save={save} />}
      {tab === 'nfr' && <Nfr type={type} />}
      {tab === 'standards' && <StandardsList />}
    </div>
  );
}

type SaveFn = (next: ReferenceOverrides, action: string, target?: string) => void;

function Compliance({ type, reference, save }: { type: ProjectType; reference: ReferenceOverrides; save: SaveFn }) {
  const current = reference.compliance?.[type] ?? defaults.compliance[type] ?? [];
  const [rows, setRows] = useState<ComplianceDef[]>(current);
  const dirty = JSON.stringify(rows) !== JSON.stringify(current);
  const edited = !!reference.compliance?.[type];
  const stdIds = defaults.standards.map((s) => s.id);
  const valid = rows.every((r) => r.title.trim() && r.keyword.trim() && r.std);
  const set = (i: number, k: keyof ComplianceDef, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <Panel
      title={`Compliance checklist: ${projectTypes[type]}`}
      subtitle="An item is satisfied when a requirement cites its standard and mentions its keyword. Used by the Quality page."
      actions={
        <>
          {edited && <Badge tone="navy">Edited</Badge>}
          <Button size="sm" onClick={() => setRows((rs) => [...rs, { id: `CMP-CUSTOM-${rs.length + 1}`, title: '', std: stdIds[0], category: 'Compliance', keyword: '' }])}><Plus className="h-3.5 w-3.5" aria-hidden />Add item</Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-md border border-line">
        <table className="w-full">
          <thead>
            <tr><th className={th + ' w-40'}>ID</th><th className={th}>Item</th><th className={th + ' w-44'}>Standard</th><th className={th + ' w-36'}>Category</th><th className={th + ' w-36'}>Keyword</th><th className={th + ' w-10'}><span className="sr-only">Remove</span></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={td + ' font-mono text-xs'}>{r.id}</td>
                <td className={td}><Input aria-label={`Item ${i + 1}`} value={r.title} onChange={(e) => set(i, 'title', e.target.value)} className="h-7" /></td>
                <td className={td}>
                  <Select aria-label={`Standard for item ${i + 1}`} value={r.std} onChange={(e) => set(i, 'std', e.target.value)} className="h-7 text-xs">
                    {stdIds.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </td>
                <td className={td}><Input aria-label={`Category for item ${i + 1}`} value={r.category} onChange={(e) => set(i, 'category', e.target.value)} className="h-7" /></td>
                <td className={td}><Input aria-label={`Keyword for item ${i + 1}`} value={r.keyword} onChange={(e) => set(i, 'keyword', e.target.value)} className="h-7" /></td>
                <td className={td}><Button variant="ghost" size="sm" aria-label={`Remove ${r.id}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer
        dirty={dirty}
        valid={valid}
        invalidText="Every item needs a title, a standard and a keyword."
        edited={edited}
        onSave={() => { save({ ...reference, compliance: { ...reference.compliance, [type]: rows } }, 'Edited compliance checklist', projectTypes[type]); toast.success('Compliance checklist saved'); }}
        onCancel={() => setRows(current)}
        onRestore={() => { const c = { ...reference.compliance }; delete c[type]; save({ ...reference, compliance: c }, 'Restored compliance checklist', projectTypes[type]); setRows(defaults.compliance[type] ?? []); toast.success('Default checklist restored'); }}
      />
    </Panel>
  );
}

function Gap({ type, reference, save }: { type: ProjectType; reference: ReferenceOverrides; save: SaveFn }) {
  const current = reference.gap?.[type] ?? defaults.gap[type] ?? [];
  const [rows, setRows] = useState<string[]>(current);
  const [add, setAdd] = useState('');
  const dirty = JSON.stringify(rows) !== JSON.stringify(current);
  const edited = !!reference.gap?.[type];
  return (
    <Panel title={`Gap checklist: ${projectTypes[type]}`} subtitle="Topics a complete FRS of this type must cover. Discovery marks each Covered, Partial or Missing." actions={edited ? <Badge tone="navy">Edited</Badge> : undefined}>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1">
        {rows.map((t, i) => (
          <li key={i} className="flex items-center gap-2 border-b border-line py-1 text-sm">
            <span className="w-6 text-xs tabular-nums text-ink-faint">{i + 1}</span>
            <Input aria-label={`Topic ${i + 1}`} value={t} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))} className="h-7 flex-1" />
            <Button variant="ghost" size="sm" aria-label={`Remove ${t}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
          </li>
        ))}
      </ol>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (add.trim()) { setRows((rs) => [...rs, add.trim()]); setAdd(''); } }}>
        <Input aria-label="New topic" placeholder="Add a topic, for example Offline mode" value={add} onChange={(e) => setAdd(e.target.value)} className="max-w-sm" />
        <Button type="submit" disabled={!add.trim()}><Plus className="h-4 w-4" aria-hidden />Add topic</Button>
      </form>
      <Footer
        dirty={dirty}
        valid={rows.every((r) => r.trim()) && rows.length > 0}
        invalidText="Topics cannot be blank, and the list needs at least one topic."
        edited={edited}
        onSave={() => { save({ ...reference, gap: { ...reference.gap, [type]: rows.map((r) => r.trim()) } }, 'Edited gap checklist', projectTypes[type]); toast.success('Gap checklist saved'); }}
        onCancel={() => setRows(current)}
        onRestore={() => { const g = { ...reference.gap }; delete g[type]; save({ ...reference, gap: g }, 'Restored gap checklist', projectTypes[type]); setRows(defaults.gap[type] ?? []); toast.success('Default checklist restored'); }}
      />
    </Panel>
  );
}

function Terms({ reference, save }: { reference: ReferenceOverrides; save: SaveFn }) {
  const current = reference.ambiguous ?? defaults.ambiguous;
  const [rows, setRows] = useState<AmbiguousTerm[]>(current);
  const [q, setQ] = useState('');
  const dirty = JSON.stringify(rows) !== JSON.stringify(current);
  const edited = !!reference.ambiguous;
  const shown = useMemo(() => rows.map((r, i) => ({ r, i })).filter(({ r }) => `${r.term} ${r.hint}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const dupes = rows.map((r) => r.term.trim().toLowerCase()).filter((t, i, a) => t && a.indexOf(t) !== i);
  return (
    <Panel
      title="Ambiguous terms"
      subtitle="Any requirement using one of these terms is flagged on the Quality page, with the hint as the suggested fix."
      actions={
        <>
          {edited && <Badge tone="navy">Edited</Badge>}
          <Button size="sm" onClick={() => { setRows((rs) => [...rs, { term: '', hint: '' }]); setQ(''); }}><Plus className="h-3.5 w-3.5" aria-hidden />Add term</Button>
        </>
      }
    >
      <Input aria-label="Filter terms" placeholder="Filter terms" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-xs" />
      {shown.length === 0 ? (
        <Empty text="No term matches this filter." action={<Button size="sm" onClick={() => setQ('')}>Clear filter</Button>} />
      ) : (
        <div className="overflow-hidden rounded-md border border-line">
          <table className="w-full">
            <thead><tr><th className={th + ' w-56'}>Term</th><th className={th}>Hint shown with the finding</th><th className={th + ' w-10'}><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {shown.map(({ r, i }) => (
                <tr key={i}>
                  <td className={td}><Input aria-label={`Term ${i + 1}`} value={r.term} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))} className="h-7" /></td>
                  <td className={td}><Input aria-label={`Hint for term ${i + 1}`} value={r.hint} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))} className="h-7" /></td>
                  <td className={td}><Button variant="ghost" size="sm" aria-label={`Remove ${r.term || 'term'}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Footer
        dirty={dirty}
        valid={rows.every((r) => r.term.trim() && r.hint.trim()) && dupes.length === 0}
        invalidText={dupes.length ? `Duplicate term: ${dupes[0]}.` : 'Every term needs a hint.'}
        edited={edited}
        onSave={() => { save({ ...reference, ambiguous: rows.map((r) => ({ term: r.term.trim(), hint: r.hint.trim() })) }, 'Edited ambiguous terms', `${rows.length} terms`); toast.success('Ambiguous terms saved'); }}
        onCancel={() => setRows(current)}
        onRestore={() => { const next = { ...reference }; delete next.ambiguous; save(next, 'Restored ambiguous terms'); setRows(defaults.ambiguous); toast.success('Default terms restored'); }}
      />
    </Panel>
  );
}

function Footer({ dirty, valid, invalidText, edited, onSave, onCancel, onRestore }: { dirty: boolean; valid: boolean; invalidText: string; edited: boolean; onSave: () => void; onCancel: () => void; onRestore: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <Button variant="primary" disabled={!dirty || !valid} onClick={onSave}>Save changes</Button>
      <Button disabled={!dirty} onClick={onCancel}>Discard changes</Button>
      <Button variant="ghost" disabled={!edited} onClick={onRestore}>Restore defaults</Button>
      {dirty && !valid && <span className="text-xs text-bad">{invalidText}</span>}
    </div>
  );
}

function Nfr({ type }: { type: ProjectType }) {
  const rows = [...defaults.nfr.common, ...(defaults.nfr.byType[type] ?? [])];
  return (
    <Panel title={`NFR baseline: ${projectTypes[type]}`} subtitle="Added to every generated FRS of this type. Values not stated in the sources are marked proposed, to be confirmed with the department.">
      <div className="overflow-hidden rounded-md border border-line">
        <table className="w-full">
          <thead><tr><th className={th + ' w-36'}>Category</th><th className={th}>Requirement and acceptance criteria</th><th className={th + ' w-36'}>Standards</th></tr></thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.key}>
                <td className={td}>{n.category}</td>
                <td className={td}>
                  <p className="font-medium">{n.title} {n.proposed && <Badge tone="warn" className="ml-1">Proposed, to be confirmed</Badge>}</p>
                  <p className="text-ink-muted">{n.description}</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">{n.acceptance.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </td>
                <td className={td + ' font-mono text-xs'}>{n.refs.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function StandardsList() {
  return (
    <Panel title="Standards referenced" subtitle="Requirements cite these as STD refs; compliance items are satisfied through them.">
      <div className="overflow-hidden rounded-md border border-line">
        <table className="w-full">
          <thead><tr><th className={th + ' w-36'}>Ref</th><th className={th}>Standard</th><th className={th + ' w-48'}>Authority</th></tr></thead>
          <tbody>
            {defaults.standards.map((s) => (
              <tr key={s.id}>
                <td className={td + ' font-mono text-xs'}>{s.id}</td>
                <td className={td}><p className="font-medium">{s.name}</p><p className="text-ink-muted">{s.summary}</p></td>
                <td className={td}>{s.authority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
