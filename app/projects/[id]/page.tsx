'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { useRepo } from '@/lib/repo/store';
import { Button, Panel, Stat } from '@/components/ui';
import { modelCompleteness, nextStep } from '@/lib/engine/nextstep';
import { qualityFor } from '@/lib/engine/quality';
import { coverageClauses } from '@/lib/engine/model';
import { fmtDateTime } from '@/lib/util';

export default function Overview() {
  const { project: p } = useCurrentProject();
  const activity = useRepo((s) => s.activity);
  const step = useMemo(() => nextStep(p), [p]);
  const model = useMemo(() => modelCompleteness(p), [p]);
  const q = useMemo(() => (p.requirements.length ? qualityFor(p) : null), [p]);
  const events = activity.filter((e) => e.projectId === p.id).slice(0, 8);
  const cov = coverageClauses(p).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-md border border-navy/30 bg-navy-soft px-5 py-4" data-testid="next-step">
        <div>
          <p className="text-xs font-medium text-navy">Next step</p>
          <p className="text-base font-semibold text-ink">{step.title}</p>
          <p className="text-sm text-ink-muted">{step.detail}</p>
        </div>
        <Link href={step.href}>
          <Button variant="primary">{step.cta}<ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <Stat label="Source clauses" value={p.sources.reduce((s, d) => s + d.clauses.length, 0)} hint={`${cov} must be covered`} />
        <Stat label="Requirements" value={p.requirements.length} />
        <Stat label="Open questions" value={p.questions.filter((x) => !x.answer && !x.assumed).length} />
        <Stat label="Quality score" value={q ? q.total : 'Not drafted'} hint={q ? 'out of 100' : undefined} tone={q ? (q.total >= 85 ? 'ok' : q.total >= 70 ? 'warn' : 'bad') : undefined} />
        <Stat label="Version" value={`v${p.version}`} hint={p.baseline ? `Baseline v${p.baseline.version}` : 'No baseline yet'} />
      </div>
      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <Panel title="Model completeness" subtitle="The FRS is generated from these artefacts">
          <ul className="divide-y divide-line">
            {model.map((m) => (
              <li key={m.label} className="flex items-center gap-3 py-1.5">
                {m.done ? <CheckCircle2 className="h-4 w-4 text-ok" aria-label="Done" /> : <Circle className="h-4 w-4 text-ink-faint" aria-label="Not done" />}
                <Link href={`/projects/${p.id}/${m.href}`} className="flex-1 text-sm text-navy hover:underline">{m.label}</Link>
                <span className="text-xs text-ink-muted">{m.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Project activity">
          {events.length === 0 ? (
            <p className="text-sm text-ink-muted">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium">{e.user}</span> <span className="text-ink-muted">{e.action.toLowerCase()}</span>
                  {e.target && <span className="text-ink-muted"> {e.target}</span>}
                  <div className="text-xs text-ink-faint">{fmtDateTime(e.at)}</div>
                </li>
              ))}
            </ul>
          )}
          {p.description && <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">{p.description}</p>}
        </Panel>
      </div>
    </div>
  );
}
