import type { Project, Requirement, WfTransition } from '@/lib/types';
import nfrBaseline from '@/data/nfr-baseline.json';
import catalogue from '@/data/catalogue.json';
import { effectiveClauses } from './model';
import { CLOCK_PAUSED_ACTORS, SYSTEM_ACTORS } from './workflow';
import { fmtValue } from './rules';

type Draft = Omit<Requirement, 'id' | 'generatedAt' | 'status'> & { modelKey: string };

const nameOf = (p: Project, id: string) => p.workflow?.states.find((s) => s.id === id)?.name ?? id;
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const isOfficer = (t: WfTransition) => !SYSTEM_ACTORS.includes(t.actor) && !CLOCK_PAUSED_ACTORS.includes(t.actor);

/**
 * Requirements generated from the model, not by free-text LLM output: one FR-VER per officer workflow action,
 * one FR-NOT per notification, one escalation FR per escalation, one FR per decision table, validation FRs per
 * data entity, and a privacy FR for Aadhaar and sensitive fields.
 */
export function modelDerived(p: Project): Draft[] {
  const out: Draft[] = [];
  const wf = p.workflow;
  if (wf) {
    for (const t of wf.transitions.filter(isOfficer)) {
      const conds = t.conditions.filter((c) => p.rules.some((r) => r.id === c));
      out.push({
        modelKey: `VER:${t.id}`, kind: 'FR', module: 'VER', origin: 'FromModel', actor: t.actor, priority: 'Must',
        title: `${t.action} (${nameOf(p, t.from)})`,
        description: `The system shall allow the ${t.actor} to ${lc(t.action)} an application in the state "${nameOf(p, t.from)}", moving it to "${nameOf(p, t.to)}"${t.slaDays != null ? ` within ${t.slaDays} working days` : ''}${conds.length ? `, only when business rules ${conds.join(', ')} are satisfied` : ''}${/reject|return|dismiss/i.test(t.action) ? ', with the reason recorded in writing' : ''}.`,
        acceptanceCriteria: [
          `Given an application in "${nameOf(p, t.from)}" within the ${t.actor}'s jurisdiction, when the ${t.actor} performs "${t.action}", then the application moves to "${nameOf(p, t.to)}" and the action is recorded in the audit trail.`,
          ...(/reject|return|dismiss/i.test(t.action) ? [`Given the reason field is empty, when "${t.action}" is submitted, then the system refuses it with the message "Reason is mandatory".`] : []),
          ...(conds.length ? [`Given any of ${conds.join(', ')} is not satisfied, when "${t.action}" is attempted, then the system blocks it and names the failed rule.`] : []),
        ],
        refs: [t.id, ...t.refs, ...conds],
      });
    }
    for (const t of wf.transitions.filter((x) => x.notification)) {
      const n = t.notification!;
      out.push({
        modelKey: `NOT:${t.id}`, kind: 'FR', module: 'NOT', origin: 'FromModel', actor: 'System', priority: 'Must',
        title: `${n.channel} to ${n.recipient.toLowerCase()} on "${t.action}"`,
        description: `The system shall send ${n.channel === 'In-app' ? 'an in-app notification' : n.channel === 'Email' ? 'an email' : 'an SMS'} to the ${n.recipient.toLowerCase()} when the application moves from "${nameOf(p, t.from)}" to "${nameOf(p, t.to)}", with the text: "${n.template}"`,
        acceptanceCriteria: [`Given an application moves from "${nameOf(p, t.from)}" to "${nameOf(p, t.to)}", when the transition ${t.id} is saved, then the ${n.channel} is sent to the ${n.recipient.toLowerCase()} within 5 minutes with all placeholders filled and its delivery status is recorded.`],
        refs: [t.id, ...t.refs],
      });
    }
    for (const t of wf.transitions.filter((x) => x.escalation)) {
      const e = t.escalation!;
      out.push({
        modelKey: `ESC:${t.id}`, kind: 'FR', module: 'ESC', origin: 'FromModel', actor: 'System', priority: 'Must',
        title: `Escalation when "${t.action}" is delayed`,
        description: `The system shall escalate an application to the ${e.to} when it remains in "${nameOf(p, t.from)}" for more than ${e.afterDays} working days without "${t.action}", show it in the ${e.to}'s escalation list with the days elapsed, and notify the ${t.actor} and the ${e.to} by email.`,
        acceptanceCriteria: [`Given an application has been in "${nameOf(p, t.from)}" for ${e.afterDays + 1} working days, when the daily escalation job runs, then it appears in the ${e.to}'s escalation list and both officers receive an email.`],
        refs: [t.id, ...t.refs.filter((r) => /^(GO|COR|MIN|RES|ANS|ASM)/.test(r))],
      });
    }
  }
  for (const r of p.rules) {
    const conds = r.conditions.map((c) => `${c.label ?? c.attribute} ${c.operator} ${fmtValue(c.value, c.unit)}`).join(' and ');
    out.push({
      modelKey: `BR:${r.id}`, kind: 'FR', module: 'BR', origin: 'FromModel', actor: 'System', priority: 'Must',
      title: `Eligibility rule ${r.id}: ${r.name}`,
      description: `The system shall evaluate decision table ${r.id} (${r.name}) for every ${r.appliesTo === 'Renewal' ? 'renewal ' : ''}application at submission and again at verification: when ${conds}, the outcome is "${r.outcome}"; otherwise "${r.failOutcome}", shown to the applicant and the officer with the rule ID.`,
      acceptanceCriteria: [
        `Given the boundary test cases generated for ${r.id}, when each is executed, then every case produces its expected outcome.`,
        `Given an application that fails ${r.id}, when it is submitted, then the applicant sees "${r.failOutcome}" with the rule ID.`,
      ],
      refs: [r.id, ...r.refs],
    });
  }
  for (const e of p.entities) {
    const mandatory = e.fields.filter((f) => f.mandatory);
    const validated = e.fields.filter((f) => f.validation);
    if (e.fields.length)
      out.push({
        modelKey: `VAL:${e.id}`, kind: 'FR', module: 'VAL', origin: 'FromModel', actor: 'System', priority: 'Must',
        title: `Field validation: ${e.name}`,
        description: `The system shall validate the ${e.name} fields as specified in the data dictionary: ${mandatory.length} mandatory fields must be completed, and ${validated.length} fields must pass their validation rules (for example ${validated.slice(0, 3).map((f) => `${f.label}: ${f.validation}`).join('; ')}) before the record can be saved; fields sourced from Aadhaar e-KYC shall be read-only.`,
        acceptanceCriteria: [`Given any field value that violates its data dictionary rule, when the form is saved, then the field is highlighted with a message stating the rule, and the record is not saved.`],
        refs: e.fields.slice(0, 6).map((f) => f.id).concat(e.fields.flatMap((f) => f.refs).filter((r, i, a) => a.indexOf(r) === i).slice(0, 4)),
      });
    const sensitive = e.fields.filter((f) => f.pii === 'Aadhaar' || f.pii === 'Sensitive');
    if (sensitive.length)
      out.push({
        modelKey: `PRIV:${e.id}`, kind: 'FR', module: 'PRIV', origin: 'FromModel', actor: 'System', priority: 'Must',
        title: `Protection of Aadhaar and sensitive fields in ${e.name}`,
        description: `The system shall store ${sensitive.filter((f) => f.pii === 'Aadhaar').map((f) => f.label).join(', ') || 'no Aadhaar field'} only in the Aadhaar Data Vault with a reference token in application tables, display only the last four digits, encrypt ${sensitive.filter((f) => f.pii === 'Sensitive').map((f) => f.label).join(', ') || 'sensitive fields'} at rest, and restrict their display to roles that need them.`,
        acceptanceCriteria: ['Given a saved record, when application tables outside the vault are inspected, then no full Aadhaar number is present.', 'Given any screen, report or export showing Aadhaar, when rendered, then only the last four digits are visible.'],
        refs: [...sensitive.map((f) => f.id), 'STD-AADHAAR', 'STD-DPDP'],
      });
  }
  return out;
}

/** Keywords that link a baseline NFR to source clauses that state the same obligation. */
const NFR_LINKS: Record<string, RegExp> = { bilingual: /\bhindi\b/i, dpdp: /personal data|data protection/i, performance: /low-end|3g|slow connection/i };

export function nfrDrafts(p: Project): Draft[] {
  const base = [...nfrBaseline.common, ...((nfrBaseline.byType as Record<string, typeof nfrBaseline.common>)[p.type] ?? [])];
  const clauses = effectiveClauses(p);
  return base.map((n) => {
    const links = NFR_LINKS[n.key] ? clauses.filter((c) => NFR_LINKS[n.key].test(c.english || c.original)).map((c) => c.id) : [];
    let description = n.description;
    const refs = [...n.refs, ...links];
    if (n.key === 'rts' && p.workflow?.rtsDays) {
      description = description.replace('the notified Right to Service timeline', `the notified Right to Service timeline of ${p.workflow.rtsDays} working days`);
      if (p.workflow.rtsRef) refs.push(p.workflow.rtsRef);
    }
    return {
      modelKey: `NFR:${n.key}`, kind: 'NFR' as const, module: 'NFR', origin: 'FromModel' as const, priority: 'Must' as const,
      title: n.title + ('proposed' in n && n.proposed ? ' (proposed, to be confirmed)' : ''),
      description: description + ('proposed' in n && n.proposed ? ' Values are proposed by the Directorate and to be confirmed by the department.' : ''),
      acceptanceCriteria: n.acceptance,
      refs,
    };
  });
}

/** Integration requirements from the e-Gov component catalogue templates, filled with project specifics. */
export function integrationDrafts(p: Project): Draft[] {
  const out: Draft[] = [];
  for (const i of p.discovery?.integrations ?? []) {
    const c = catalogue.find((x) => x.id === i.catalogueId);
    if (!c) continue;
    const fill = (s: string) =>
      s
        .replace('{actor}', 'the applicant')
        .replace('{documents}', 'caste and income certificates')
        .replace('{document}', 'orders')
        .replace('{fee}', 'the fee');
    out.push({
      modelKey: `IR:${c.id}`, kind: 'IR', module: 'INT', origin: 'FromModel', actor: 'System', priority: 'Must',
      title: c.template.title,
      description: fill(c.template.description),
      acceptanceCriteria: c.template.acceptance.map(fill),
      refs: [...i.refs, ...c.refs],
    });
  }
  return out;
}

export function idFor(module: string, kind: Requirement['kind'], n: number) {
  const num = String(n).padStart(3, '0');
  if (kind === 'NFR') return `NFR-${num}`;
  if (kind === 'IR') return `IR-${num}`;
  return `FR-${module}-${num}`;
}

function prefixOf(r: Pick<Requirement, 'kind' | 'module'>) {
  return r.kind === 'NFR' ? 'NFR-' : r.kind === 'IR' ? 'IR-' : `FR-${r.module}-`;
}

function maxNum(reqs: Requirement[], prefix: string) {
  let m = 0;
  for (const r of reqs) if (r.id.startsWith(prefix)) m = Math.max(m, parseInt(r.id.slice(prefix.length), 10) || 0);
  return m;
}

/**
 * Replaces model-derived requirements while keeping IDs stable: an artefact that already has a requirement keeps
 * its ID (text is refreshed), new artefacts get the next free number in their module, removed artefacts drop out.
 */
export function mergeModelDerived(existing: Requirement[], drafts: Draft[], at: string): Requirement[] {
  const byKey = new Map(existing.filter((r) => r.modelKey).map((r) => [r.modelKey!, r]));
  const keep = existing.filter((r) => !r.modelKey || drafts.some((d) => d.modelKey === r.modelKey));
  const out = keep.slice();
  for (const d of drafts) {
    const prev = byKey.get(d.modelKey);
    if (prev) {
      const i = out.findIndex((r) => r.id === prev.id);
      const changed = prev.description !== d.description || prev.title !== d.title || prev.refs.join() !== d.refs.join() || prev.acceptanceCriteria.join() !== d.acceptanceCriteria.join();
      out[i] = { ...prev, ...d, id: prev.id, generatedAt: at, status: changed ? 'Draft' : prev.status };
    } else {
      const prefix = prefixOf(d);
      out.push({ ...d, id: idFor(d.module, d.kind, maxNum(out, prefix) + 1), generatedAt: at, status: 'Draft' });
    }
  }
  return out;
}

/** Replaces the LLM-generated requirements of one module; other modules' IDs never change. */
export function replaceModule(existing: Requirement[], module: string, kind: Requirement['kind'], drafts: Omit<Requirement, 'id'>[]): Requirement[] {
  const isTarget = (r: Requirement) => r.module === module && r.origin !== 'FromModel' && r.origin !== 'Manual';
  const rest = existing.filter((r) => !isTarget(r));
  const prefix = kind === 'NFR' ? 'NFR-' : kind === 'IR' ? 'IR-' : `FR-${module}-`;
  let n = maxNum(rest, prefix);
  const used = new Set(rest.map((r) => r.id));
  const out = rest.slice();
  for (const d of drafts) {
    let id = idFor(module, kind, ++n);
    while (used.has(id)) id = idFor(module, kind, ++n);
    used.add(id);
    out.push({ ...d, id });
  }
  return out;
}

export const MODULE_ORDER = ['REG', 'APP', 'DOC', 'VER', 'BR', 'VAL', 'PAY', 'NOT', 'ESC', 'GRV', 'RPT', 'ADM', 'PRIV', 'INT', 'NFR'];

export function sortRequirements(reqs: Requirement[]) {
  const ord = (m: string) => {
    const i = MODULE_ORDER.indexOf(m);
    return i < 0 ? 50 : i;
  };
  return reqs.slice().sort((a, b) => ord(a.module) - ord(b.module) || a.id.localeCompare(b.id, 'en', { numeric: true }));
}
