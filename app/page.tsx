'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRepo, usePersona } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { Badge, PageHeader, PageSkeleton, Panel, Stat, td, th, type Tone } from '@/components/ui';
import { qualityFor } from '@/lib/engine/quality';
import { unresolvedFindings } from '@/lib/engine/model';
import { statusTone } from '@/lib/engine/status';
import { fmtDateTime } from '@/lib/util';
import type { Project } from '@/lib/types';

type Attention = { project: Project; text: string; href: string; tone: Tone; kind: string };

export default function Dashboard() {
  const hydrated = useHydrated();
  const projects = useRepo((s) => s.projects);
  const activity = useRepo((s) => s.activity);
  const persona = usePersona();

  const { attention, counts } = useMemo(() => {
    const items: Attention[] = [];
    for (const p of projects) {
      const base = `/projects/${p.id}`;
      const unresolved = unresolvedFindings(p).length;
      if (unresolved) items.push({ project: p, kind: 'Reconciliation', tone: 'warn', text: `${unresolved} source finding${unresolved > 1 ? 's' : ''} to resolve before drafting`, href: `${base}/reconcile` });
      if (!p.reconciledAt && p.sources.length && !p.requirements.length) items.push({ project: p, kind: 'Sources', tone: 'navy', text: `${p.sources.length} sources indexed; run reconciliation`, href: `${base}/reconcile` });
      if (p.requirements.length) {
        const q = qualityFor(p);
        const unc = q.issues.filter((i) => i.type === 'Coverage' && i.status === 'Open').length;
        if (unc) items.push({ project: p, kind: 'Coverage', tone: 'bad', text: `${unc} source clause${unc > 1 ? 's' : ''} not covered by any requirement`, href: `${base}/quality` });
        const amb = q.issues.filter((i) => i.type === 'Ambiguity' && i.status === 'Open').length;
        if (amb) items.push({ project: p, kind: 'Clarity', tone: 'warn', text: `${amb} ambiguous requirement${amb > 1 ? 's' : ''}`, href: `${base}/quality` });
      }
      if (p.status === 'In review') items.push({ project: p, kind: 'Review', tone: 'navy', text: `v${p.version} awaiting review or approval`, href: `${base}/review` });
      if (p.status === 'Changes requested') items.push({ project: p, kind: 'Review', tone: 'warn', text: `Reviewer requested changes to v${p.version}`, href: `${base}/review` });
      const openCmt = p.comments.filter((c) => !c.resolved).length;
      if (openCmt) items.push({ project: p, kind: 'Comments', tone: 'navy', text: `${openCmt} open reviewer comment${openCmt > 1 ? 's' : ''}`, href: `${base}/review` });
      const openImpact = p.impacts.filter((i) => i.status === 'Open').length;
      if (openImpact) items.push({ project: p, kind: 'Change control', tone: 'warn', text: `Corrigendum impact analysis awaiting decision`, href: `${base}/changes` });
      const newScope = p.crs.flatMap((c) => c.items).filter((i) => i.classification === 'New scope').length;
      if (newScope) items.push({ project: p, kind: 'Change request', tone: 'navy', text: `${newScope} vendor ask${newScope > 1 ? 's' : ''} assessed as new scope`, href: `${base}/changes` });
    }
    const counts = {
      total: projects.length,
      draft: projects.filter((p) => p.status === 'Draft').length,
      review: projects.filter((p) => p.status === 'In review' || p.status === 'Changes requested').length,
      approved: projects.filter((p) => p.status === 'Approved').length,
      reqs: projects.reduce((s, p) => s + p.requirements.length, 0),
    };
    return { attention: items, counts };
  }, [projects]);

  if (!hydrated) return <PageSkeleton />;
  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Good day, ${persona.name}. Items needing attention across ${counts.total} FRS projects of the Directorate.`} />
      <div className="mb-5 grid grid-cols-5 gap-3">
        <Stat label="Projects" value={counts.total} />
        <Stat label="Drafting" value={counts.draft} />
        <Stat label="In review" value={counts.review} tone={counts.review ? 'warn' : undefined} />
        <Stat label="Approved baselines" value={counts.approved} tone="ok" />
        <Stat label="Requirements under management" value={counts.reqs} />
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <Panel title="Needs attention" subtitle="Derived live from each project's model" bodyClass="p-0">
          {attention.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">Nothing needs attention. All projects are reconciled, covered and reviewed.</p>
          ) : (
            <table className="w-full" data-testid="attention">
              <thead>
                <tr><th className={th}>Project</th><th className={th}>Item</th><th className={th}></th></tr>
              </thead>
              <tbody>
                {attention.map((a, i) => (
                  <tr key={i} className="hover:bg-canvas/60">
                    <td className={td + ' w-[38%]'}>
                      <div className="font-medium">{a.project.name}</div>
                      <Badge tone={statusTone(a.project.status)} className="mt-0.5">{a.project.status}</Badge>
                    </td>
                    <td className={td}>
                      <Badge tone={a.tone}>{a.kind}</Badge>
                      <div className="mt-0.5">{a.text}</div>
                    </td>
                    <td className={td + ' text-right'}>
                      <Link href={a.href} className="text-sm text-navy underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="Projects by status" bodyClass="p-0">
            <ul>
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-1.5 last:border-0">
                  <Link href={`/projects/${p.id}`} className="truncate text-sm text-navy hover:underline">{p.name}</Link>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-ink-faint">v{p.version}</span>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Recent activity" actions={<Link href="/activity" className="text-xs text-navy underline">All activity</Link>} bodyClass="p-0">
            <ul>
              {activity.slice(0, 7).map((e) => (
                <li key={e.id} className="border-b border-line px-4 py-1.5 text-sm last:border-0">
                  <span className="font-medium">{e.user}</span> <span className="text-ink-muted">{e.action.toLowerCase()}</span>
                  {e.target && <span className="text-ink-muted"> {e.target}</span>}
                  <div className="text-xs text-ink-faint">{e.projectName} · {fmtDateTime(e.at)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
