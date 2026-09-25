import type { Persona } from '@/lib/types';

// All names, the state and GO numbers are fictional.
export const branding = {
  product: 'Aalekh FRS',
  tagline: 'Requirements engineering for e-Governance projects',
  state: 'Rajyapradesh',
  directorate: 'Directorate of Information Technology',
  department: 'Department of Information Technology, Government of Rajyapradesh',
  monogram: 'A',
};

export const personas: Persona[] = [
  { id: 'author', name: 'Ravi Kumar', designation: 'Senior Systems Analyst, Directorate of IT', role: 'Author' },
  { id: 'reviewer', name: 'Anita Deshmukh', designation: 'Joint Director (IT)', role: 'Reviewer' },
  { id: 'approver', name: 'S. Raghavan', designation: 'Director (IT)', role: 'Approver' },
];

export const projectTypes = {
  benefit: 'Citizen service with benefit disbursement',
  permit: 'Citizen service with permit or approval',
  grievance: 'Grievance and case management',
  mis: 'MIS and dashboard',
  licence: 'Licence issue and renewal',
} as const;
