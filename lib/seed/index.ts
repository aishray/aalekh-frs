import type { ActivityEvent, Project } from '@/lib/types';
import { buildScholarshipProject } from './scholarship';
import { buildBuildingProject } from './building';
import { buildGrievanceProject } from './grievance';
import { buildLightProjects } from './light';

// Bump to force a reseed of browser storage when seed content changes.
export const SEED_VERSION = 1;

export function buildSeed(): { projects: Project[]; activity: ActivityEvent[] } {
  const projects = [buildScholarshipProject(), buildGrievanceProject(), buildBuildingProject(), ...buildLightProjects()];
  const activity: ActivityEvent[] = [
    { id: 'ev-s1', at: '2026-09-23T16:00:00.000Z', user: 'Meera Joshi', projectId: 'fish', projectName: 'Fisheries Licence Renewal', action: 'Added source', target: 'GO FSH/2026/LIC/006' },
    { id: 'ev-s2', at: '2026-09-22T10:00:00.000Z', user: 'Ravi Kumar', projectId: 'pms-scholarship', projectName: 'State Post-Matric Scholarship Portal', action: 'Added sources', target: 'GO, Corrigendum 1, Minutes, Voice brief, Form' },
    { id: 'ev-s3', at: '2026-09-21T09:30:00.000Z', user: 'Meera Joshi', projectId: 'beds', projectName: 'Hospital Bed Dashboard', action: 'Submitted for review', target: 'v0.4' },
    { id: 'ev-s4', at: '2026-09-19T15:10:00.000Z', user: 'Anita Deshmukh', projectId: 'pgrs', projectName: 'Public Grievance Redressal System', action: 'Commented', target: 'FR-APP-002, FR-RPT-001' },
    { id: 'ev-s5', at: '2026-09-15T10:00:00.000Z', user: 'Ravi Kumar', projectId: 'mdm', projectName: 'Mid-Day Meal MIS', action: 'Generated requirements', target: 'v0.2' },
    { id: 'ev-s6', at: '2026-09-10T11:00:00.000Z', user: 'Anita Deshmukh', projectId: 'mandi', projectName: 'Mandi Price App', action: 'Requested changes', target: 'v0.3' },
    { id: 'ev-s7', at: '2026-03-18T12:00:00.000Z', user: 'S. Raghavan', projectId: 'obpa', projectName: 'Online Building Plan Approval', action: 'Approved baseline', target: 'v1.0' },
    { id: 'ev-s8', at: '2026-01-22T10:00:00.000Z', user: 'S. Raghavan', projectId: 'estamp', projectName: 'e-Stamp Duty Refund', action: 'Approved baseline', target: 'v1.1' },
  ];
  return { projects, activity };
}
