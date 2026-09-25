'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useCurrentProject } from '@/lib/repo/useProjectId';
import { Badge, Button, Empty, ErrorBox, Input, Notice, PageHeader, Panel, Progress, Select, td, th } from '@/components/ui';
import { runAi } from '@/lib/ai/client';
import { useAiRun } from '@/lib/ai/useAiRun';
import { compact, standardBlocks } from '@/lib/ai/context';
import { checkPermissions } from '@/lib/engine/permissions';
import type { Jurisdiction, PermissionMatrix } from '@/lib/types';
import { cn } from '@/lib/util';

type Proposal = { roles: { name: string; jurisdiction: Jurisdiction; admin: boolean }[]; actions: string[]; grants: { role: string; actions: string[] }[] };
const scopes: Jurisdiction[] = ['State', 'District', 'Institution', 'Self'];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function RolesPage() {
  const { project: p, update } = useCurrentProject();
  const ai = useAiRun();
  const [newAction, setNewAction] = useState('');
  const m = p.permissions;
  const findings = useMemo(() => (m ? checkPermissions(m, p.workflow) : []), [m, p.workflow]);
  const wfActions = new Set(p.workflow?.transitions.map((t) => t.action) ?? []);

  async function propose() {
    const out = await ai.run(['Collecting roles from discovery and workflow actors', 'Listing workflow and standard actions', 'Applying maker-checker and admin separation'], () =>
      runAi<Proposal>('permissions', p, {
        ...standardBlocks(p),
        MODEL: compact({ roles: p.discovery?.roles.map((r) => r.name), workflow: p.workflow?.transitions.map((t) => ({ action: t.action, actor: t.actor })) }),
      }),
    );
    if (!out) return;
    update('Proposed permission matrix', `${out.data.roles.length} roles`, (x) => {
      const roles = out.data.roles.map((r) => ({ id: slug(r.name), name: r.name, jurisdiction: r.jurisdiction, admin: r.admin || undefined }));
      x.permissions = {
        roles,
        actions: out.data.actions,
        grants: Object.fromEntries(out.data.grants.map((g) => [slug(g.role), g.actions.filter((a) => out.data.actions.includes(a))])),
      };
    });
    toast.success('Permission matrix proposed. Review the checks below.');
  }

  const set = (action: string, fn: (x: PermissionMatrix) => void) => update(action, undefined, (x) => fn(x.permissions!));

  return (
    <div>
      <PageHeader
        title="Roles and permissions"
        subtitle="Who can do what, in which jurisdiction. Checked for maker-checker, administrator separation and consistency with the workflow."
        actions={<Button variant={m ? 'secondary' : 'primary'} onClick={propose} loading={ai.busy} disabled={!p.workflow && !p.discovery}>{m ? 'Propose again' : 'Propose matrix'}</Button>}
      />
      {!p.workflow && !p.discovery && <Notice tone="warn" className="mb-4">Run discovery and design the workflow first; roles and actions come from them.</Notice>}
      {ai.busy && <div className="mb-4 max-w-lg"><Progress stages={ai.stages} current={ai.stage} /></div>}
      {ai.error && <div className="mb-4"><ErrorBox title="The matrix could not be proposed" message={ai.error} action={<Button size="sm" onClick={propose}>Try again</Button>} /></div>}
      {!m && !ai.busy ? (
        (p.workflow || p.discovery) && <Empty text="No permission matrix yet." action={<Button variant="primary" onClick={propose}>Propose matrix</Button>} />
      ) : m ? (
        <div className="space-y-4">
          <Panel title="Checks" subtitle="Run on every change" bodyClass={findings.length ? 'p-0' : undefined}>
            {findings.length === 0 ? (
              <p className="text-sm text-ok">No role both verifies and sanctions, administrators cannot act on applications, and every workflow actor holds the permission for its action.</p>
            ) : (
              <ul data-testid="perm-findings">
                {findings.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 border-b border-line px-4 py-2 text-sm last:border-0"><Badge tone={f.severity === 'High' ? 'bad' : 'warn'}>{f.severity}</Badge>{f.message}</li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Role-permission matrix" subtitle="Tick a cell to grant the action. Workflow actions are marked." bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Action</th>
                    {m.roles.map((r) => (
                      <th key={r.id} className={th + ' min-w-[120px] text-center align-bottom'}>
                        <div>{r.name}{r.admin && <Badge className="ml-1">Admin</Badge>}</div>
                        <Select aria-label={`${r.name} jurisdiction`} className="mt-1 h-7 text-xs font-normal" value={r.jurisdiction} onChange={(e) => set('Changed jurisdiction', (x) => { x.roles.find((y) => y.id === r.id)!.jurisdiction = e.target.value as Jurisdiction; })}>
                          {scopes.map((s) => <option key={s}>{s}</option>)}
                        </Select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.actions.map((a) => (
                    <tr key={a}>
                      <td className={td}>{a}{wfActions.has(a) && <Badge tone="navy" className="ml-1.5">Workflow</Badge>}</td>
                      {m.roles.map((r) => {
                        const on = m.grants[r.id]?.includes(a) ?? false;
                        return (
                          <td key={r.id} className={cn(td, 'text-center', on && 'bg-navy-soft/60')}>
                            <input
                              type="checkbox"
                              aria-label={`${r.name} can ${a}`}
                              checked={on}
                              onChange={(e) => set(e.target.checked ? 'Granted permission' : 'Revoked permission', (x) => {
                                const g = new Set(x.grants[r.id] ?? []);
                                if (e.target.checked) g.add(a); else g.delete(a);
                                x.grants[r.id] = Array.from(g);
                              })}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form className="flex items-center gap-2 border-t border-line px-4 py-2.5" onSubmit={(e) => { e.preventDefault(); const a = newAction.trim(); if (a && !m.actions.includes(a)) set('Added action', (x) => { x.actions.push(a); }); setNewAction(''); }}>
              <Input aria-label="New action" className="h-7 w-64 text-xs" value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="Add an action, for example Download sanction order" />
              <Button size="sm" type="submit" disabled={!newAction.trim()}><Plus className="h-3.5 w-3.5" aria-hidden />Add action</Button>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
