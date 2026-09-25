import { describe, expect, it } from 'vitest';
import rec from '@/data/recorded/scholarship/workflow.json';
import { rtsCheck, validateWorkflow } from '@/lib/engine/workflow';
import type { Workflow } from '@/lib/types';

function wf(): Workflow {
  const r = rec.response;
  return { states: r.states, rtsDays: r.rtsDays, rtsRef: r.rtsRef, transitions: r.transitions.map((t, i) => ({ ...t, id: `WF-T${i + 1}`, slaDays: t.slaDays ?? undefined, escalation: t.escalation ?? undefined, notification: (t.notification ?? undefined) as Workflow['transitions'][number]['notification'] })) };
}

describe('workflow validation', () => {
  it('sample workflow passes validation with RTS 30 of 30', () => {
    const w = wf();
    expect(validateWorkflow(w)).toEqual([]);
    const r = rtsCheck(w);
    expect(r.ok).toBe(true);
    expect(r.message).toBe('Total 30 working days against notified 30 days: compliant');
  });

  it('changing an SLA from 15 to 20 days fails the RTS check', () => {
    const w = wf();
    w.transitions.find((t) => t.action === 'Verify application')!.slaDays = 20;
    const r = rtsCheck(w);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('35 working days exceeds the notified 30 days');
    expect(validateWorkflow(w).some((f) => f.id === 'WFV-rts')).toBe(true);
  });

  it('flags a rejection without reason and a dead-end state', () => {
    const w = wf();
    w.transitions.find((t) => t.action === 'Reject')!.notification = undefined;
    w.transitions = w.transitions.filter((t) => t.from !== 'paid');
    const ids = validateWorkflow(w).map((f) => f.id);
    expect(ids.some((i) => i.startsWith('WFV-rejnote'))).toBe(true);
    expect(ids).toContain('WFV-dead-paid');
  });
});
