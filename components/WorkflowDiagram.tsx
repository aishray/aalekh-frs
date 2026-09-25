'use client';

import { useEffect, useId, useState } from 'react';
import type { Workflow } from '@/lib/types';
import { Skeleton } from '@/components/ui';

const safe = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
const label = (s: string) => s.replace(/[:"#;]/g, ' ').replace(/\s+/g, ' ').trim();

export function workflowToMermaid(wf: Workflow, highlight: string[] = []) {
  const lines = ['stateDiagram-v2', '  direction LR'];
  for (const s of wf.states) lines.push(`  state "${label(s.name)}" as ${safe(s.id)}`);
  const first = wf.states[0];
  if (first) lines.push(`  [*] --> ${safe(first.id)}`);
  for (const t of wf.transitions) {
    const sla = t.slaDays != null ? ` ${t.slaDays}d` : '';
    lines.push(`  ${safe(t.from)} --> ${safe(t.to)} : ${t.id.replace('WF-', '')} ${label(t.action)}${sla}`);
  }
  for (const s of wf.states.filter((x) => x.terminal)) lines.push(`  ${safe(s.id)} --> [*]`);
  const hi = wf.states.filter((s) => highlight.includes(s.id)).map((s) => safe(s.id));
  if (hi.length) {
    lines.push('  classDef hot fill:#FBF1E1,stroke:#A86A12,stroke-width:2px');
    lines.push(`  class ${hi.join(',')} hot`);
  }
  return lines.join('\n');
}

let initialised = false;

async function ensureMermaid() {
  const mermaid = (await import('mermaid')).default;
  if (!initialised) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      fontFamily: 'IBM Plex Sans, Segoe UI, Arial, sans-serif',
      themeVariables: { primaryColor: '#E8EEF6', primaryBorderColor: '#1D3F6E', primaryTextColor: '#16202E', lineColor: '#4A5565', fontSize: '15px', background: '#FFFFFF' },
      state: { useMaxWidth: false },
    });
    initialised = true;
  }
  return mermaid;
}

/** Renders the workflow to SVG markup; also used by the Word export (converted to PNG). */
export async function renderWorkflowSvg(wf: Workflow, id = 'wf-export') {
  const mermaid = await ensureMermaid();
  const { svg } = await mermaid.render(id + Date.now(), workflowToMermaid(wf));
  return svg;
}

export function WorkflowDiagram({ wf, highlight = [] }: { wf: Workflow; highlight?: string[] }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rid = 'wf' + useId().replace(/[^a-z0-9]/gi, '');
  const code = workflowToMermaid(wf, highlight);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const mermaid = await ensureMermaid();
        const { svg } = await mermaid.render(rid + Date.now(), code);
        if (live) {
          setSvg(svg);
          setErr(null);
        }
      } catch (e) {
        if (live) setErr((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [code, rid]);

  if (err) return <p className="text-sm text-bad">The diagram could not be drawn: {err}. The state table below is complete.</p>;
  if (!svg) return <Skeleton className="h-64" />;
  return <div className="mermaid-host overflow-x-auto" aria-label="Workflow state diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
