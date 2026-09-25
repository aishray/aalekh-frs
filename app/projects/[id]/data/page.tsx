'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, ErrorBox, Notice, PageHeader, Panel, Progress, Select, td, th, type Tone } from '@/components/ui';
import { Refs } from '@/components/RefTag';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { standardBlocks, sourcesBlock } from '@/lib/ai/context';
import { enrichFields } from '@/lib/engine/fields';
import { normalizeRefs } from '@/lib/engine/model';
import type { DataEntity, Field, MasterList, PiiClass, ValueSource } from '@/lib/types';
import { nowIso } from '@/lib/util';

const piiTone: Record<PiiClass, Tone> = { Aadhaar: 'bad', Sensitive: 'bad', Financial: 'warn', Personal: 'navy', None: 'neutral' };
const piis: PiiClass[] = ['Personal', 'Sensitive', 'Aadhaar', 'Financial', 'None'];
const sources: ValueSource[] = ['Applicant', 'Aadhaar eKYC', 'DigiLocker', 'Master', 'System'];

export default function DataPage() {
  const { project: p, update } = useCurrentProject();
  const ai = useAiRun();
  const forms = p.sources.filter((d) => d.kind === 'Form');

  async function build() {
    const out = await ai.run(['Reading the digitised form fields', 'Assigning types, lengths and validations', 'Classifying personal data', 'Applying the standard validation library'], () =>
      runAi<{ entities: (Omit<DataEntity, 'id' | 'fields'> & { fields: (Omit<Field, 'id' | 'length' | 'validation' | 'masterList' | 'labelOriginal'> & { length: number | null; validation: string | null; masterList: string | null; labelOriginal: string | null })[] })[]; masters: MasterList[] }>('fields', p, {
        ...standardBlocks(p),
        INPUT: forms.flatMap((d) => d.clauses.map((c) => `[${c.id}] ${c.original}${c.english && c.english !== c.original ? ` (${c.english})` : ''}`)).join('\n'),
        SOURCES: sourcesBlock(p, { types: ['Rule', 'Mandate'] }),
      }),
    );
    if (!out) return;
    update('Built data dictionary', `${out.data.entities.reduce((s, e) => s + e.fields.length, 0)} fields`, (x) => {
      x.entities = enrichFields(
        out.data.entities.map((e) => ({
          name: e.name,
          fields: e.fields.map((f) => ({ ...f, length: f.length ?? undefined, validation: f.validation ?? undefined, masterList: f.masterList ?? undefined, labelOriginal: f.labelOriginal ?? undefined, refs: normalizeRefs(x, f.refs, { forward: true }).kept })),
        })),
      );
      x.masters = out.data.masters;
      x.entities.forEach((e) => e.fields.forEach((f) => (x.stamps[f.id] = nowIso())));
    });
    toast.success('Data dictionary built. Aadhaar and sensitive fields generate privacy requirements.');
  }

  function edit(fid: string, patch: Partial<Field>) {
    update('Edited data field', fid, (x) => {
      for (const e of x.entities) {
        const f = e.fields.find((y) => y.id === fid);
        if (f) Object.assign(f, patch, patch.valueSource ? { readOnly: patch.valueSource === 'Aadhaar eKYC' || undefined } : {});
      }
      x.stamps[fid] = nowIso();
    });
  }

  const all = p.entities.flatMap((e) => e.fields);
  const sensitive = all.filter((f) => f.pii === 'Aadhaar' || f.pii === 'Sensitive');

  return (
    <div>
      <PageHeader
        title="Data dictionary"
        subtitle="Field-level specification from the scanned paper form and the sources: types, validations, where each value comes from, master lists and personal data classification."
        actions={<Button variant={p.entities.length ? 'secondary' : 'primary'} onClick={build} loading={ai.busy} disabled={!forms.length}>{p.entities.length ? 'Rebuild from form' : 'Build from form'}</Button>}
      />
      {!forms.length && <Notice tone="warn" className="mb-4">Add the existing paper application form as a source (type Paper form). Scans are read by Sarvam Document Intelligence. <Link href={`/projects/${p.id}/sources`} className="underline">Go to Sources</Link></Notice>}
      {ai.busy && <div className="mb-4 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <div className="mb-4"><ErrorBox title="The data dictionary could not be built" message={ai.error} action={<Button size="sm" onClick={build}>Try again</Button>} /></div>}
      {!p.entities.length && !ai.busy ? (
        forms.length > 0 && <Empty text={`${forms.reduce((s, d) => s + d.clauses.length, 0)} form fields are digitised and ready.`} action={<Button variant="primary" onClick={build}>Build from form</Button>} />
      ) : p.entities.length ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="rounded-md border border-line bg-white px-4 py-3"><p className="text-xs text-ink-muted">Fields</p><p className="text-2xl font-semibold">{all.length}</p></div>
            <div className="rounded-md border border-line bg-white px-4 py-3"><p className="text-xs text-ink-muted">From Aadhaar e-KYC (read-only)</p><p className="text-2xl font-semibold">{all.filter((f) => f.valueSource === 'Aadhaar eKYC').length}</p></div>
            <div className="rounded-md border border-line bg-white px-4 py-3"><p className="text-xs text-ink-muted">From DigiLocker</p><p className="text-2xl font-semibold">{all.filter((f) => f.valueSource === 'DigiLocker').length}</p></div>
            <div className="rounded-md border border-bad/30 bg-bad-soft px-4 py-3"><p className="text-xs text-ink-muted">Aadhaar or sensitive</p><p className="text-2xl font-semibold text-bad">{sensitive.length}</p></div>
          </div>
          {sensitive.length > 0 && (
            <Notice tone="warn">
              {sensitive.map((f) => f.label).join(', ')} {sensitive.length > 1 ? 'are' : 'is'} classified Aadhaar or sensitive. A privacy requirement (masking, Aadhaar Data Vault, encryption) is generated in the FRS and checked under DPDP and Aadhaar compliance.
            </Notice>
          )}
          {p.entities.map((e) => (
            <Panel key={e.id} title={e.name} subtitle={`${e.fields.length} fields`} bodyClass="p-0">
              <table className="w-full">
                <thead><tr><th className={th}>Field</th><th className={th}>Type</th><th className={th}>Mandatory</th><th className={th}>Validation</th><th className={th + ' w-36'}>Source of value</th><th className={th + ' w-32'}>PII</th><th className={th}>Refs</th></tr></thead>
                <tbody>
                  {e.fields.map((f) => (
                    <tr key={f.id} data-field={f.id}>
                      <td className={td}>
                        <div className="flex items-center gap-1 font-medium">{f.label}{f.readOnly && <Lock className="h-3 w-3 text-ink-faint" aria-label="Read-only from e-KYC" />}</div>
                        <div className="font-mono text-[11px] text-ink-faint">{f.id}</div>
                        {f.masterList && <div className="text-xs text-ink-muted">Master: {f.masterList}</div>}
                      </td>
                      <td className={td}>{f.type}{f.length ? `(${f.length})` : ''}</td>
                      <td className={td}><input type="checkbox" aria-label={`${f.label} mandatory`} checked={f.mandatory} onChange={(ev) => edit(f.id, { mandatory: ev.target.checked })} /></td>
                      <td className={td + ' max-w-[320px] text-xs'}>{f.validation}</td>
                      <td className={td}><Select aria-label={`${f.label} source`} className="h-7 text-xs" value={f.valueSource} onChange={(ev) => edit(f.id, { valueSource: ev.target.value as ValueSource })}>{sources.map((s) => <option key={s}>{s}</option>)}</Select></td>
                      <td className={td}>
                        <Select aria-label={`${f.label} PII`} className="h-7 text-xs" value={f.pii} onChange={(ev) => edit(f.id, { pii: ev.target.value as PiiClass })}>{piis.map((s) => <option key={s}>{s}</option>)}</Select>
                        {f.pii !== 'None' && <Badge tone={piiTone[f.pii]} className="mt-1">{f.pii}</Badge>}
                      </td>
                      <td className={td}><Refs projectId={p.id} refs={f.refs} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ))}
          {p.masters.length > 0 && (
            <Panel title="Master lists" bodyClass="p-0">
              <table className="w-full">
                <thead><tr><th className={th}>Master</th><th className={th}>Values</th><th className={th}>Maintained by</th></tr></thead>
                <tbody>{p.masters.map((m) => <tr key={m.name}><td className={td + ' font-medium'}>{m.name}</td><td className={td}>{m.values.join(', ')}</td><td className={td}>{m.owner}</td></tr>)}</tbody>
              </table>
            </Panel>
          )}
        </div>
      ) : null}
    </div>
  );
}
