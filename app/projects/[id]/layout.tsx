'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useRepo } from '@/lib/repo/store';
import { useHydrated } from '@/lib/repo/hydrated';
import { Badge, ErrorBox, PageSkeleton, Button } from '@/components/ui';
import { cn } from '@/lib/util';
import { projectTypes } from '@/config/branding';
import { statusTone } from '@/lib/engine/status';

const groups = [
  { name: 'Inputs', items: [['sources', 'Sources'], ['reconcile', 'Reconcile'], ['discovery', 'Discovery']] },
  { name: 'Model', items: [['workflow', 'Workflow'], ['data', 'Data'], ['rules', 'Rules'], ['roles', 'Roles']] },
  { name: 'Output', items: [['document', 'Document'], ['quality', 'Quality'], ['deliverables', 'Deliverables']] },
  { name: 'Govern', items: [['review', 'Review'], ['changes', 'Changes'], ['export', 'Export']] },
] as const;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const hydrated = useHydrated();
  const project = useRepo((s) => s.projects.find((p) => p.id === id));

  if (!hydrated) return <PageSkeleton />;
  if (!project)
    return (
      <ErrorBox
        title="Project not found"
        message="This project does not exist in this browser. It may have been reset from Settings."
        action={<Link href="/projects"><Button size="sm">Go to projects</Button></Link>}
      />
    );

  const base = `/projects/${project.id}`;
  const pending = project.reconciliations.filter((r) => !r.resolution).length;
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-ink-faint">
        <Link href="/projects" className="hover:text-ink">Projects</Link>
        <span className="mx-1.5">/</span>
        <Link href={base} className="hover:text-ink">{project.name}</Link>
        {path !== base && (
          <>
            <span className="mx-1.5">/</span>
            <span className="text-ink-muted">{labelFor(path.split('/').pop() || '')}</span>
          </>
        )}
      </nav>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={base} className="text-base font-semibold text-ink hover:underline">{project.name}</Link>
        <span className="text-xs text-ink-faint">File {project.fileNo}</span>
        <span className="text-xs text-ink-faint">{project.department}</span>
        <span className="text-xs text-ink-faint">{projectTypes[project.type]}</span>
        <Badge tone={statusTone(project.status)}>{project.status}</Badge>
        <Badge>v{project.version}</Badge>
        {project.baseline && <Badge tone="ok">Baseline v{project.baseline.version}</Badge>}
      </div>
      <div className="mb-5 flex flex-wrap items-stretch gap-2 border-b border-line">
        <Link href={base} className={cn('-mb-px border-b-2 px-1 pb-2 pt-1 text-sm', path === base ? 'border-navy font-medium text-navy' : 'border-transparent text-ink-muted hover:text-ink')}>
          Overview
        </Link>
        {groups.map((g) => (
          <div key={g.name} className="flex items-end gap-0 border-l border-line pl-2">
            <span className="mb-2.5 mr-1 text-[10px] font-medium text-ink-faint">{g.name}</span>
            {g.items.map(([slug, label]) => {
              const href = `${base}/${slug}`;
              const active = path.startsWith(href);
              return (
                <Link key={slug} href={href} className={cn('-mb-px flex items-center gap-1 border-b-2 px-1.5 pb-2 pt-1 text-sm', active ? 'border-navy font-medium text-navy' : 'border-transparent text-ink-muted hover:text-ink')}>
                  {label}
                  {slug === 'reconcile' && pending > 0 && <span className="rounded-full bg-warn px-1.5 text-[10px] font-semibold text-white">{pending}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

function labelFor(slug: string) {
  for (const g of groups) for (const [s, l] of g.items) if (s === slug) return l;
  return slug;
}
