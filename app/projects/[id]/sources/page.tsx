'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, Field, Input, Modal, Notice, PageHeader, Panel, Select, td, th } from '@/components/ui';
import { AddSourceModal } from '@/components/sources/AddSource';
import { RefTag } from '@/components/RefTag';
import { clauseState, COVERAGE_TYPES } from '@/lib/engine/model';
import { translateTexts } from '@/lib/ai/client';
import type { ClauseType, SourceClause } from '@/lib/types';
import { cn, fmtDate, refLabel } from '@/lib/util';

const types: ClauseType[] = ['Mandate', 'Rule', 'Timeline', 'Role', 'Info'];
const kindName: Record<string, string> = { GO: 'GO', Corrigendum: 'Corrigendum', Guideline: 'Guideline', Minutes: 'Minutes', Form: 'Form', VoiceBrief: 'Voice brief', Interview: 'Interview', Other: 'Other' };

export default function SourcesPage() {
  const { project: p, update } = useCurrentProject();
  const params = useSearchParams();
  const focus = params.get('clause');
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | ClauseType>('all');
  const [na, setNa] = useState<SourceClause | null>(null);
  const [naReason, setNaReason] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (focus) {
      const d = p.sources.find((x) => x.clauses.some((c) => c.id === focus));
      if (d) setSel(d.id);
    }
  }, [focus, p.sources]);
  useEffect(() => {
    if (focus) setTimeout(() => rowRef.current?.scrollIntoView({ block: 'center' }), 80);
  }, [focus, sel]);

  const doc = p.sources.find((d) => d.id === sel) ?? p.sources[0];
  const citedBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of p.requirements) for (const ref of r.refs) m.set(ref, (m.get(ref) ?? 0) + 1);
    return m;
  }, [p.requirements]);
  const drafted = p.requirements.length > 0;

  const clauses = doc ? doc.clauses.filter((c) => filter === 'all' || c.type === filter) : [];
  const needsTranslation = doc && doc.language !== 'en' && doc.clauses.some((c) => !c.english);

  async function retranslate() {
    if (!doc) return;
    setTranslating(true);
    try {
      const out = await translateTexts(p, doc.clauses.map((c) => c.original), doc.language, 'en');
      update('Translated source', doc.name, (x) => {
        const d = x.sources.find((s) => s.id === doc.id)!;
        d.clauses.forEach((c, i) => (c.english = out[i] ?? c.english));
      });
      toast.success('Clauses translated to English');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sources and clauses"
        subtitle="Every source is split into citable clauses. Mandate, Rule and Timeline clauses must be covered by a requirement or marked not applicable."
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden />Add source</Button>}
      />
      {warnings.length > 0 && (
        <Notice tone="warn" className="mb-3">
          {warnings.map((w) => <p key={w}>{w}</p>)}
          <button className="mt-1 text-xs underline" onClick={() => setWarnings([])}>Dismiss</button>
        </Notice>
      )}
      {p.sources.length === 0 ? (
        <Empty text="No sources yet. Add the GO, guidelines, minutes, a scanned form or a voice brief." action={<Button variant="primary" onClick={() => setAdding(true)}>Add source</Button>} />
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          <Panel title={`${p.sources.length} sources`} bodyClass="p-0">
            <ul>
              {p.sources.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSel(d.id)}
                    className={cn('w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-canvas', doc?.id === d.id && 'bg-navy-soft')}
                    aria-current={doc?.id === d.id}
                  >
                    <div className="flex items-center gap-1.5">
                      <Badge tone="navy">{d.prefix}</Badge>
                      {kindName[d.kind] !== d.prefix && <Badge>{kindName[d.kind]}</Badge>}
                      {d.language !== 'en' && <Badge tone="warn">{d.language === 'hi' ? 'Hindi' : d.language}</Badge>}
                    </div>
                    <div className="mt-1 text-sm font-medium leading-snug">{d.name}</div>
                    <div className="text-xs text-ink-faint">{[d.refNo, fmtDate(d.date)].filter(Boolean).join(' · ') || 'No reference'} · {d.clauses.length} clauses</div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {doc && (
            <div className="min-w-0 space-y-3">
              <Panel
                title={doc.name}
                subtitle={[doc.refNo && `Ref. ${doc.refNo}`, doc.date && fmtDate(doc.date), doc.authority, doc.amends && `Amends ${p.sources.find((x) => x.id === doc.amends)?.name ?? ''}`].filter(Boolean).join(' · ')}
                actions={
                  <>
                    {needsTranslation && <Button size="sm" onClick={retranslate} loading={translating}>Translate again</Button>}
                    <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-7 w-36 text-xs" aria-label="Filter by clause type">
                      <option value="all">All types</option>
                      {types.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)} aria-label="Remove source"><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </>
                }
                bodyClass="p-0"
              >
                {doc.kind === 'Form' && (
                  <div className="flex items-center gap-3 border-b border-line bg-canvas/50 px-4 py-2 text-xs text-ink-muted">
                    <a href="/samples/application_form.png" target="_blank" className="text-navy underline">View scanned form</a>
                    Fields digitised by Sarvam Document Intelligence. The data dictionary is built from these on the Data page.
                  </div>
                )}
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={th + ' w-24'}>Clause</th>
                      <th className={th}>Text</th>
                      <th className={th + ' w-32'}>Type</th>
                      <th className={th + ' w-44'}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clauses.map((c) => {
                      const st = clauseState(p, c);
                      const mustCover = st.effective && (COVERAGE_TYPES as readonly string[]).includes(c.type);
                      const n = citedBy.get(c.id) ?? 0;
                      return (
                        <tr key={c.id} ref={c.id === focus ? rowRef : undefined} className={cn(c.id === focus && 'bg-mark')} data-clause={c.id}>
                          <td className={td}>
                            <RefTag projectId={p.id} id={c.id} />
                            <div className="mt-0.5 text-[11px] text-ink-faint">{c.label}</div>
                          </td>
                          <td className={cn(td, !st.effective && 'text-ink-faint')}>
                            {doc.language !== 'en' ? (
                              <div className="space-y-1">
                                <p lang={doc.language} className={cn(!st.effective && 'line-through')}>{c.original}</p>
                                <p className="text-ink-muted">{c.english || <span className="text-bad">English translation missing</span>}</p>
                              </div>
                            ) : (
                              <p className={cn(!st.effective && 'line-through')}>{c.original}</p>
                            )}
                          </td>
                          <td className={td}>
                            <Select
                              aria-label={`Type of ${refLabel(c.id)}`}
                              className="h-7 text-xs"
                              value={c.type}
                              onChange={(e) =>
                                update('Changed clause type', `${c.id} to ${e.target.value}`, (x) => {
                                  x.sources.find((d) => d.id === doc.id)!.clauses.find((k) => k.id === c.id)!.type = e.target.value as ClauseType;
                                })
                              }
                            >
                              {types.map((t) => <option key={t}>{t}</option>)}
                            </Select>
                          </td>
                          <td className={td}>
                            {!st.effective ? (
                              <span className="text-xs">
                                <Badge tone="bad">{st.reason === 'superseded' ? 'Superseded' : 'Overridden'}</Badge>
                                <span className="ml-1 text-ink-muted">by</span> <RefTag projectId={p.id} id={st.by!} />
                              </span>
                            ) : c.notApplicable ? (
                              <div className="text-xs">
                                <Badge>Not applicable</Badge>
                                <p className="mt-0.5 text-ink-muted">{c.notApplicable.reason}</p>
                                <button className="text-navy underline" onClick={() => update('Cleared not applicable', c.id, (x) => { delete x.sources.find((d) => d.id === doc.id)!.clauses.find((k) => k.id === c.id)!.notApplicable; })}>Undo</button>
                              </div>
                            ) : mustCover ? (
                              <div className="space-y-1 text-xs">
                                {drafted ? (n > 0 ? <Badge tone="ok">Covered by {n}</Badge> : <Badge tone="bad">Not covered</Badge>) : <Badge tone="navy">Must be covered</Badge>}
                                <div>
                                  <button className="text-navy underline" onClick={() => { setNa(c); setNaReason(''); }}>Mark not applicable</button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-faint">{c.type === 'Info' ? 'Information only' : 'Context'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {clauses.length === 0 && <p className="px-4 py-4 text-sm text-ink-muted">No clauses of this type in this source.</p>}
              </Panel>
            </div>
          )}
        </div>
      )}
      <AddSourceModal
        open={adding}
        onClose={() => setAdding(false)}
        project={p}
        onAdded={(d, w) => {
          update('Added source', `${d.prefix}: ${d.name}`, (x) => { x.sources.push(d); });
          setSel(d.id);
          setWarnings(d.kind === 'Corrigendum' ? [...w, p.baseline ? 'This project has an approved baseline. Run the corrigendum impact analysis on the Changes page.' : 'Run reconciliation again to link the supersessions in this corrigendum.'] : w);
        }}
      />
      <Modal
        open={!!na}
        onClose={() => setNa(null)}
        title={`Mark ${na ? refLabel(na.id) : ''} not applicable`}
        footer={
          <>
            <Button onClick={() => setNa(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={naReason.trim().length < 10}
              onClick={() => {
                update('Marked clause not applicable', na!.id, (x) => {
                  for (const d of x.sources) for (const c of d.clauses) if (c.id === na!.id) c.notApplicable = { reason: naReason.trim() };
                });
                setNa(null);
              }}
            >
              Mark not applicable
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm">{na?.english || na?.original}</p>
        <Field label="Reason (recorded in the traceability matrix)" htmlFor="na-reason" hint="At least 10 characters.">
          <Input id="na-reason" value={naReason} onChange={(e) => setNaReason(e.target.value)} placeholder="Handled offline by the department; no system function required" />
        </Field>
      </Modal>
      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Remove source"
        footer={
          <>
            <Button onClick={() => setConfirmDel(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { update('Removed source', doc!.name, (x) => { x.sources = x.sources.filter((d) => d.id !== doc!.id); }); setSel(null); setConfirmDel(false); }}>Remove</Button>
          </>
        }
      >
        <p className="text-sm">Remove <strong>{doc?.name}</strong>? Requirements that cite its clauses will show invalid references in Quality.</p>
      </Modal>
    </div>
  );
}
