'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useRepo } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { Button, Empty, Input, PageHeader, PageSkeleton, Select, td, th } from '@/components/ui';
import { download, fmtDateTime } from '@/lib/util';

const PAGE = 50;

export default function ActivityPage() {
  const hydrated = useHydrated();
  const activity = useRepo((s) => s.activity);
  const projects = useRepo((s) => s.projects);
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [user, setUser] = useState('');
  const [shown, setShown] = useState(PAGE);

  const users = useMemo(() => Array.from(new Set(activity.map((a) => a.user))).sort(), [activity]);
  const rows = useMemo(
    () =>
      activity
        .filter((a) => (!project || a.projectId === project) && (!user || a.user === user))
        .filter((a) => `${a.action} ${a.target ?? ''} ${a.projectName ?? ''} ${a.user}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [activity, project, user, q],
  );

  if (!hydrated) return <PageSkeleton />;

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['Time', 'User', 'Project', 'Action', 'Target'].join(','), ...rows.map((a) => [a.at, a.user, a.projectName ?? '', a.action, a.target ?? ''].map(esc).join(','))];
    download('activity-log.csv', lines.join('\n'), 'text/csv');
  }

  const filtered = q || project || user;
  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle="Every change to a project is recorded with the user, time, project, action and target."
        actions={<Button onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" aria-hidden />Export CSV</Button>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input placeholder="Search actions and targets" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} className="max-w-xs" aria-label="Search activity" />
        <Select value={project} onChange={(e) => { setProject(e.target.value); setShown(PAGE); }} className="w-72" aria-label="Project">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={user} onChange={(e) => { setUser(e.target.value); setShown(PAGE); }} className="w-52" aria-label="User">
          <option value="">All users</option>
          {users.map((u) => <option key={u}>{u}</option>)}
        </Select>
        <span className="self-center text-xs text-ink-muted">{rows.length} event{rows.length === 1 ? '' : 's'}</span>
      </div>
      {rows.length === 0 ? (
        <Empty
          text={filtered ? 'No activity matches this filter.' : 'No activity yet. Changes to projects appear here.'}
          action={filtered ? <Button size="sm" onClick={() => { setQ(''); setProject(''); setUser(''); }}>Clear filter</Button> : <Link href="/projects"><Button size="sm">Open projects</Button></Link>}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-white">
          <table className="w-full" data-testid="activity">
            <thead>
              <tr>
                <th className={th + ' w-44'}>Time</th>
                <th className={th + ' w-40'}>User</th>
                <th className={th}>Project</th>
                <th className={th}>Action</th>
                <th className={th}>Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((a) => (
                <tr key={a.id}>
                  <td className={td + ' tabular-nums text-ink-muted'}>{fmtDateTime(a.at)}</td>
                  <td className={td}>{a.user}</td>
                  <td className={td}>
                    {a.projectId && projects.some((p) => p.id === a.projectId) ? (
                      <Link href={`/projects/${a.projectId}`} className="text-navy hover:underline">{a.projectName}</Link>
                    ) : (
                      <span className="text-ink-muted">{a.projectName ?? 'All projects'}</span>
                    )}
                  </td>
                  <td className={td}>{a.action}</td>
                  <td className={td + ' text-ink-muted'}>{a.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown && (
            <div className="border-t border-line p-2 text-center">
              <Button size="sm" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
