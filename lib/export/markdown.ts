import type { Project } from '@/lib/types';
import { sortRequirements } from '@/lib/engine/generate';
import { moduleName } from '@/lib/generate/run';
import { assumptions } from '@/lib/engine/model';

export function frsMarkdown(p: Project) {
  const L: string[] = [];
  L.push(`# Functional Requirements Specification: ${p.name}`, '', `${p.department} Department, Government of Rajyapradesh. File ${p.fileNo}. Version ${p.version} (${p.status}).`, '');
  for (const [k, t] of [['introduction', 'Introduction'], ['asis', 'As-Is process'], ['tobe', 'To-Be process']]) L.push(`## ${t}`, '', p.sections[k] ?? 'Not generated.', '');
  if (p.workflow) {
    L.push('## Application workflow', '', '| ID | From | Action (actor) | To | SLA | Source |', '|---|---|---|---|---|---|');
    const nm = (id: string) => p.workflow!.states.find((s) => s.id === id)?.name ?? id;
    p.workflow.transitions.forEach((t) => L.push(`| ${t.id} | ${nm(t.from)} | ${t.action} (${t.actor}) | ${nm(t.to)} | ${t.slaDays ?? ''} | ${t.refs.join(', ')} |`));
    L.push('');
  }
  L.push('## Requirements', '');
  let mod = '';
  for (const r of sortRequirements(p.requirements)) {
    if (r.module !== mod) {
      mod = r.module;
      L.push(`### ${moduleName(mod)}`, '');
    }
    L.push(`**${r.id} ${r.title}** (${r.priority})`, '', r.description, '', ...r.acceptanceCriteria.map((a, i) => `${i + 1}. ${a}`), '', `Source: ${r.refs.join(', ')}`, '');
  }
  const a = assumptions(p);
  if (a.length) L.push('## Assumptions', '', ...a.map((x) => `- ${x.id}: ${x.text}`), '');
  return L.join('\n');
}
