import type { PermissionMatrix, Workflow } from '@/lib/types';
import { SYSTEM_ACTORS } from './workflow';

export type PermFinding = { id: string; severity: 'High' | 'Medium'; message: string; targets: string[] };

const VERIFY = /verif/i;
const APPROVE = /sanction|approve/i;

export function checkPermissions(m: PermissionMatrix, wf?: Workflow): PermFinding[] {
  const out: PermFinding[] = [];
  const grants = (roleId: string) => m.grants[roleId] ?? [];

  // Maker-checker: the same role cannot both verify and approve.
  for (const r of m.roles) {
    const g = grants(r.id);
    const v = g.filter((a) => VERIFY.test(a));
    const a = g.filter((x) => APPROVE.test(x));
    if (v.length && a.length)
      out.push({ id: `PRM-mc-${r.id}`, severity: 'High', message: `Maker-checker: ${r.name} can both "${v[0]}" and "${a[0]}" the same application.`, targets: [r.id] });
  }

  // Admin roles cannot act on applications.
  const wfActions = new Set(wf?.transitions.map((t) => t.action) ?? []);
  for (const r of m.roles.filter((x) => x.admin)) {
    const acting = grants(r.id).filter((a) => wfActions.has(a));
    if (acting.length) out.push({ id: `PRM-admin-${r.id}`, severity: 'High', message: `${r.name} is an administrator but can "${acting[0]}" on applications.`, targets: [r.id] });
  }

  // Every workflow transition's actor has the permission.
  for (const t of wf?.transitions ?? []) {
    if (SYSTEM_ACTORS.includes(t.actor)) continue;
    const role = m.roles.find((r) => r.name.toLowerCase() === t.actor.toLowerCase());
    if (!role) {
      out.push({ id: `PRM-norole-${t.id}`, severity: 'Medium', message: `${t.id} actor "${t.actor}" is not a role in the matrix.`, targets: [t.id] });
      continue;
    }
    if (!grants(role.id).includes(t.action))
      out.push({ id: `PRM-miss-${t.id}`, severity: 'High', message: `${role.name} performs "${t.action}" (${t.id}) but does not have that permission.`, targets: [role.id, t.id] });
  }
  return out;
}
