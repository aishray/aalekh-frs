import type { Project, Requirement, TestCase, Workflow } from '@/lib/types';
import { boundaryTests } from './rules';
import { longestPath } from './workflow';

/** Splits "Given X, when Y, then Z" into its parts. */
export function gwt(ac: string) {
  const m = ac.match(/^\s*given\s+(.*?),?\s+when\s+(.*?),?\s+then\s+(.*)$/i);
  if (!m) return { given: 'The system is available and the user is signed in with the required role', when: ac.replace(/\.$/, ''), then: 'The behaviour described is observed' };
  return { given: cap(m[1]), when: cap(m[2]), then: cap(m[3].replace(/\.$/, '')) };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Test data mentioned in the criterion: amounts, days, percentages, sizes. */
function dataFrom(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const nums = text.match(/₹\s?[\d,]+|Rs\.?\s?[\d,]+|\d+(\.\d+)?\s?(working days|days|MB|%|minutes|hours|seconds|digits)/gi);
  nums?.slice(0, 4).forEach((v, i) => (out[`value ${i + 1}`] = v.trim()));
  return out;
}

export function reqTests(r: Requirement): TestCase[] {
  return r.acceptanceCriteria.map((ac, i) => {
    const g = gwt(ac);
    return { id: `TC-${r.id}-${i + 1}`, reqId: r.id, title: r.title, precondition: g.given, steps: [g.when], data: dataFrom(ac), expected: g.then, refs: r.refs };
  });
}

function pathTests(wf: Workflow): TestCase[] {
  const out: TestCase[] = [];
  const st = (re: RegExp) => wf.states.find((s) => re.test(s.name))?.id;
  const draft = wf.states[0]?.id;
  const add = (id: string, title: string, to: string | undefined, expected: string) => {
    if (!draft || !to) return;
    const lp = longestPath(wf, draft, to);
    if (!lp) return;
    out.push({
      id, reqId: lp.path.map((t) => t.id).join(', '), title, precondition: 'A registered applicant and officers of every role for the district',
      steps: lp.path.map((t) => `${t.actor}: ${t.action}`), data: {}, expected, refs: lp.path.map((t) => t.id),
    });
  };
  add('TC-WF-1', 'Happy path to payment', st(/^paid$/i) ?? st(/sanction|approved/i), 'The application reaches the final paid or approved state and every notification on the path is sent');
  add('TC-WF-2', 'Rejection with reason', st(/reject/i), 'The application is rejected and the applicant receives the reason');
  add('TC-WF-3', 'Return for correction and resubmission', st(/return/i), 'The application is returned with reasons and can be resubmitted');
  add('TC-WF-4', 'Payment failure and re-initiation', st(/payment failed/i), 'The failure reason is recorded, the applicant is notified and payment can be re-initiated');
  const esc = wf.transitions.find((t) => t.escalation);
  if (esc)
    out.push({ id: 'TC-WF-5', reqId: esc.id, title: 'SLA breach escalation', precondition: `An application in "${wf.states.find((s) => s.id === esc.from)?.name}"`, steps: [`Leave it without "${esc.action}" for ${esc.escalation!.afterDays + 1} working days`, 'Run the daily escalation job'], data: {}, expected: `The application is escalated to ${esc.escalation!.to}`, refs: [esc.id] });
  return out;
}

/** UAT test cases: per requirement from its acceptance criteria, decision-table boundary tests and workflow path tests. */
export function uatTests(p: Project): TestCase[] {
  return [...p.requirements.flatMap(reqTests), ...boundaryTests(p.rules), ...(p.workflow ? pathTests(p.workflow) : [])];
}
