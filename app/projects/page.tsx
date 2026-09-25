'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useRepo } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { Badge, Button, Empty, Input, PageHeader, PageSkeleton, Select, td, th } from '@/components/ui';
import { projectTypes } from '@/config/branding';
import { statusTone } from '@/lib/engine/status';
import { qualityFor } from '@/lib/engine/quality';
import { fmtDate } from '@/lib/util';

export default function ProjectsPage() {
  const hydrated = useHydrated();
  const projects = useRepo((s) => s.projects);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const rows = useMemo(
    () =>
      projects
        .filter((p) => (!status || p.status === status) && `${p.name} ${p.fileNo} ${p.department} ${p.owner}`.toLowerCase().includes(q.toLowerCase()))
        .map((p) => ({ p, score: p.requirements.length ? qualityFor(p).total : null })),
    [projects, q, status],
  );
  if (!hydrated) return <PageSkeleton />;
  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="All FRS projects of the Directorate, with status, version and quality score."
        actions={
          <Link href="/projects/new">
            <Button variant="primary"><Plus className="h-4 w-4" aria-hidden />New project</Button>
          </Link>
        }
      />
      <div className="mb-3 flex gap-2">
        <Input placeholder="Filter by name, file number, department or owner" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" aria-label="Filter projects" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48" aria-label="Status">
          <option value="">All statuses</option>
          <option>Draft</option>
          <option>In review</option>
          <option>Changes requested</option>
          <option>Approved</option>
        </Select>
      </div>
      {rows.length === 0 ? (
        <Empty text="No project matches this filter." action={<Button size="sm" onClick={() => { setQ(''); setStatus(''); }}>Clear filter</Button>} />
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Project</th>
                <th className={th}>Department</th>
                <th className={th}>Type</th>
                <th className={th}>Status</th>
                <th className={th}>Version</th>
                <th className={th + ' text-right'}>Requirements</th>
                <th className={th + ' text-right'}>Quality</th>
                <th className={th}>Owner</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, score }) => (
                <tr key={p.id} className="hover:bg-canvas/60">
                  <td className={td}>
                    <Link href={`/projects/${p.id}`} className="font-medium text-navy hover:underline">{p.name}</Link>
                    <div className="text-xs text-ink-faint">File {p.fileNo}</div>
                  </td>
                  <td className={td}>{p.department}</td>
                  <td className={td + ' text-xs text-ink-muted'}>{projectTypes[p.type]}</td>
                  <td className={td}><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                  <td className={td}>v{p.version}</td>
                  <td className={td + ' text-right tabular-nums'}>{p.requirements.length}</td>
                  <td className={td + ' text-right tabular-nums'}>{score == null ? <span className="text-ink-faint">Not drafted</span> : score}</td>
                  <td className={td}>{p.owner}</td>
                  <td className={td + ' text-xs text-ink-muted'}>{fmtDate(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
