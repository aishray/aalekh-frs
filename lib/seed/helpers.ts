import type { Priority, Project, ProjectType, Requirement, SourceDoc, SourceKind, ClauseType } from '@/lib/types';
import { ingest } from '@/lib/engine/ingest';

export function R(
  id: string,
  title: string,
  description: string,
  acceptance: string | string[],
  refs: string[],
  priority: Priority = 'Must',
  actor?: string,
  at = '2026-03-10T10:00:00.000Z',
): Requirement {
  const parts = id.split('-');
  const kind = (parts[0] === 'NFR' ? 'NFR' : parts[0] === 'IR' ? 'IR' : parts[1] === 'RPT' ? 'RPT' : 'FR') as Requirement['kind'];
  const module = parts[0] === 'NFR' ? 'NFR' : parts[0] === 'IR' ? 'INT' : parts[1];
  return {
    id,
    kind,
    module,
    title,
    description,
    actor,
    priority,
    acceptanceCriteria: Array.isArray(acceptance) ? acceptance : [acceptance],
    refs,
    origin: 'Generated',
    status: 'Approved',
    generatedAt: at,
  };
}

export function src(
  id: string,
  prefix: string,
  kind: SourceKind,
  name: string,
  text: string,
  meta: { refNo?: string; date?: string; authority?: string; amends?: string } = {},
  types: Record<string, ClauseType> = {},
): SourceDoc {
  return ingest({ id, prefix, kind, name, text, addedAt: '2026-01-10T10:00:00.000Z', types, ...meta });
}

export function emptyProject(p: {
  id: string; name: string; department: string; fileNo: string; type: ProjectType; status: Project['status']; version: string;
  owner: string; createdAt: string; updatedAt: string; description: string;
}): Project {
  return {
    ...p,
    sources: [], reconciliations: [], questions: [], entities: [], masters: [], rules: [], requirements: [],
    sections: {}, sectionsAt: {}, reviewIssues: [], issueState: {}, changes: [], notes: [], comments: [], versions: [],
    impacts: [], crs: [], stamps: {}, reconciledAt: p.createdAt,
  };
}
