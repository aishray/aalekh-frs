import type { ClauseType, Project, SourceDoc } from '@/lib/types';
import { ingest } from '@/lib/engine/ingest';
import goText from '@/data/sources/go_scholarship.txt';
import cor1Text from '@/data/sources/corrigendum_1.txt';
import minText from '@/data/sources/minutes_kickoff.txt';
import vbHi from '@/data/sources/voice_brief_hi.txt';
import vbEn from '@/data/sources/voice_brief_en.txt';
import formText from '@/data/sources/application_form.txt';
import classify from '@/data/recorded/scholarship/classify.json';

export const SCHOLARSHIP_ID = 'pms-scholarship';

export const sampleTypes: Record<string, ClauseType> = Object.fromEntries(
  (classify.response.types as { id: string; type: ClauseType }[]).map((t) => [t.id, t.type]),
);

const T0 = '2026-09-22T10:00:00.000Z';

export function scholarshipSources(): SourceDoc[] {
  const types = sampleTypes;
  return [
    ingest({ id: 'src-go', prefix: 'GO', name: 'GO on online Post-Matric Scholarship', kind: 'GO', text: goText, refNo: 'SW/2026/SCH/118', date: '2026-08-14', authority: 'Principal Secretary, Social Welfare Department', addedAt: T0, types }),
    ingest({ id: 'src-cor1', prefix: 'COR1', name: 'Corrigendum 1: income limit', kind: 'Corrigendum', text: cor1Text, refNo: 'SW/2026/SCH/118-A', date: '2026-09-02', authority: 'Principal Secretary, Social Welfare Department', amends: 'src-go', addedAt: T0, types }),
    ingest({ id: 'src-min', prefix: 'MIN', name: 'Minutes of kick-off meeting', kind: 'Minutes', text: minText, date: '2026-08-22', authority: 'Director (IT)', addedAt: T0, types }),
    ingest({
      id: 'src-vb', prefix: 'VB', name: 'Voice brief by Joint Director, Social Welfare (Hindi)', kind: 'VoiceBrief', text: vbHi, date: '2026-08-25',
      authority: 'Joint Director, Social Welfare', addedAt: T0, types, english: vbEn.trim().split('\n'),
    }),
    ingest({ id: 'src-form', prefix: 'FORM', name: 'Existing paper application form (scanned)', kind: 'Form', text: formText, authority: 'Social Welfare Department', addedAt: T0, types }),
  ];
}

export function buildScholarshipProject(): Project {
  return {
    id: SCHOLARSHIP_ID,
    name: 'State Post-Matric Scholarship Portal',
    department: 'Social Welfare',
    fileNo: 'IT/SW/2026/0142',
    type: 'benefit',
    status: 'Draft',
    version: '0.1',
    owner: 'Ravi Kumar',
    createdAt: T0,
    updatedAt: T0,
    sample: 'scholarship',
    description: 'Online application, verification, sanction and DBT payment of the State Post-Matric Scholarship through the portal and CSCs.',
    sources: scholarshipSources(),
    reconciliations: [],
    questions: [],
    entities: [],
    masters: [],
    rules: [],
    requirements: [],
    sections: {},
    sectionsAt: {},
    reviewIssues: [],
    issueState: {},
    changes: [],
    notes: [],
    comments: [],
    versions: [],
    impacts: [],
    crs: [],
    stamps: {},
  };
}
