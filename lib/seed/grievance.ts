import type { Project } from '@/lib/types';
import { emptyProject, R, src } from './helpers';

const GO = `GOVERNMENT OF RAJYAPRADESH
ADMINISTRATIVE REFORMS DEPARTMENT
G.O. No. AR/2026/PG/012 Dated: 3 February 2026

1. Background
Public grievances are received through letters, the Chief Minister's helpline and department offices, with no common tracking.

2. Channels
2.1 Grievances shall be received through a web portal, a mobile app, the 1100 helpline and in person at Tehsil offices.
2.2 Every grievance shall receive a unique registration number by SMS.

3. Routing
3.1 Grievances shall be routed automatically to the concerned department and district office based on category and location.
3.2 A grievance wrongly routed shall be transferred within 1 working day.

4. Disposal
4.1 Grievances shall be disposed of within 15 working days at the first level.
4.2 Grievances not disposed of within 15 working days shall be escalated to the district head of the department.
4.3 The citizen shall be able to rate the disposal and reopen the grievance once within 15 days if dissatisfied.

5. Monitoring
5.1 The Chief Secretary shall review pendency monthly through a dashboard.
`;

export function buildGrievanceProject(): Project {
  const p = emptyProject({
    id: 'pgrs', name: 'Public Grievance Redressal System', department: 'Administrative Reforms', fileNo: 'IT/AR/2026/0019', type: 'grievance',
    status: 'In review', version: '0.3', owner: 'Ravi Kumar', createdAt: '2026-02-10T09:00:00.000Z', updatedAt: '2026-09-19T15:10:00.000Z',
    description: 'Single grievance system across portal, app, helpline and Tehsil offices with automatic routing and escalation.',
  });
  p.sources = [src('pg-go', 'GO', 'GO', 'GO on integrated grievance redressal', GO, { refNo: 'AR/2026/PG/012', date: '2026-02-03', authority: 'Secretary, Administrative Reforms' }, {
    'GO-1': 'Info', 'GO-2.1': 'Mandate', 'GO-2.2': 'Mandate', 'GO-3.1': 'Mandate', 'GO-3.2': 'Timeline', 'GO-4.1': 'Timeline', 'GO-4.2': 'Timeline', 'GO-4.3': 'Rule', 'GO-5.1': 'Mandate',
  })];
  p.questions = [
    { id: 'Q-1', topic: 'Categorisation', question: 'Who maintains the grievance category master?', whyItMatters: 'Routing depends on it.', suggestedAnswers: ['Administrative Reforms', 'Each department'], defaultAssumption: 'Administrative Reforms maintains it', answer: 'Administrative Reforms maintains categories; departments map sub-categories.' },
    { id: 'Q-2', topic: 'Closure and feedback', question: 'What happens after a reopened grievance is disposed of again?', whyItMatters: 'Defines the terminal state.', suggestedAnswers: ['Closed permanently', 'Escalated to Collector'], defaultAssumption: 'Closed permanently', assumed: true },
  ];
  p.workflow = {
    rtsDays: 15, rtsRef: 'GO-4.1',
    states: [
      { id: 'registered', name: 'Registered', terminal: false }, { id: 'assigned', name: 'Assigned to office', terminal: false },
      { id: 'escalated', name: 'Escalated', terminal: false }, { id: 'disposed', name: 'Disposed', terminal: false },
      { id: 'reopened', name: 'Reopened', terminal: false }, { id: 'closed', name: 'Closed', terminal: true },
    ],
    transitions: [
      { id: 'WF-T1', from: 'registered', to: 'assigned', action: 'Auto-route', actor: 'System', conditions: [], refs: ['GO-3.1'], notification: { channel: 'SMS', recipient: 'Citizen', template: 'Grievance {no} registered.' } },
      { id: 'WF-T2', from: 'assigned', to: 'assigned', action: 'Transfer', actor: 'Grievance Officer', conditions: [], slaDays: 1, refs: ['GO-3.2'] },
      { id: 'WF-T3', from: 'assigned', to: 'disposed', action: 'Dispose', actor: 'Grievance Officer', conditions: [], slaDays: 15, escalation: { afterDays: 15, to: 'District head' }, refs: ['GO-4.1', 'GO-4.2'], notification: { channel: 'SMS', recipient: 'Citizen', template: 'Grievance {no} disposed.' } },
      { id: 'WF-T4', from: 'assigned', to: 'escalated', action: 'Escalate', actor: 'System', conditions: [], refs: ['GO-4.2'] },
      { id: 'WF-T5', from: 'escalated', to: 'disposed', action: 'Dispose', actor: 'District head', conditions: [], slaDays: 7, refs: ['GO-4.2'] },
      { id: 'WF-T6', from: 'disposed', to: 'reopened', action: 'Reopen', actor: 'Citizen', conditions: ['BR-001'], refs: ['GO-4.3'] },
      { id: 'WF-T7', from: 'reopened', to: 'closed', action: 'Dispose again', actor: 'District head', conditions: [], slaDays: 7, refs: ['GO-4.3'] },
      { id: 'WF-T8', from: 'disposed', to: 'closed', action: 'Auto-close', actor: 'System', conditions: [], refs: ['GO-4.3'] },
    ],
  };
  p.rules = [{ id: 'BR-001', name: 'Reopen window', conditions: [{ attribute: 'daysSinceDisposal', operator: '<=', value: '15', unit: 'days', label: 'Days since disposal' }, { attribute: 'reopenCount', operator: '=', value: '0', label: 'Times reopened' }], outcome: 'Can reopen', failOutcome: 'Cannot reopen', refs: ['GO-4.3'] }];
  p.requirements = [
    R('FR-REG-001', 'Multi-channel registration', 'The system shall register grievances from the portal, mobile app, 1100 helpline and Tehsil office counters into a single register.', 'Given a grievance entered by a helpline agent, when saved, then it appears in the same register as portal grievances with channel marked Helpline.', ['GO-2.1'], 'Must', 'Citizen'),
    R('FR-REG-002', 'Registration number by SMS', 'The system shall send the unique registration number to the citizen by SMS within 5 minutes of registration.', 'Given a new grievance, when registered, then the SMS is sent within 5 minutes.', ['GO-2.2', 'WF-T1'], 'Must', 'System'),
    R('FR-REG-003', 'Attachments', 'The system shall accept up to three attachments of up to 5 MB each in PDF, JPG or PNG format with a grievance.', 'Given a 6 MB file, when attached, then it is refused with the limit stated.', ['GO-2.1'], 'Should', 'Citizen'),
    R('FR-APP-001', 'Automatic routing', 'The system shall route each grievance to the department and district office mapped to its category and location.', 'Given category Water supply and district Nagarpur, when registered, then it is assigned to the Nagarpur PHED office.', ['GO-3.1', 'WF-T1'], 'Must', 'System'),
    R('FR-APP-002', 'Transfer of wrongly routed grievance', 'The system shall allow the grievance officer to transfer a wrongly routed grievance with reasons within 1 working day of assignment.', 'Given assignment on Monday, when transfer is attempted on Wednesday, then it requires approval of the district head.', ['GO-3.2', 'WF-T2'], 'Must', 'Grievance Officer'),
    R('FR-VER-001', 'Disposal with action taken report', 'The system shall allow the grievance officer to dispose of a grievance only with an action taken report of at least 50 characters and optional attachment.', 'Given an ATR of 20 characters, when disposal is attempted, then it is refused.', ['GO-4.1', 'WF-T3'], 'Must', 'Grievance Officer'),
    R('FR-ESC-001', 'Escalation after 15 working days', 'The system shall escalate a grievance to the district head of the department when it is not disposed of within 15 working days of assignment.', 'Given no disposal by working day 15, when the daily job runs on day 16, then the grievance is escalated.', ['GO-4.2', 'WF-T4'], 'Must', 'System'),
    R('FR-GRV-001', 'Citizen rating', 'The system shall allow the citizen to rate the disposal on a scale of 1 to 5 through a link sent by SMS.', 'Given a disposal, when the citizen opens the SMS link, then a 1 to 5 rating can be submitted once.', ['GO-4.3'], 'Must', 'Citizen'),
    R('FR-GRV-002', 'Reopen once', 'The system shall allow the citizen to reopen a disposed grievance once within 15 days of disposal as per rule BR-001.', 'Given a grievance disposed 16 days ago, when reopen is attempted, then it is refused.', ['GO-4.3', 'BR-001', 'WF-T6'], 'Must', 'Citizen'),
    R('FR-GRV-003', 'Auto-closure', 'The system shall close a disposed grievance automatically when 15 days pass without reopening.', 'Given disposal on day 0 and no reopen, when the job runs on day 16, then status is Closed.', ['GO-4.3', 'WF-T8'], 'Must', 'System'),
    R('FR-NOT-001', 'Disposal SMS', 'The system shall send an SMS to the citizen on disposal with the summary of action taken and the rating link.', 'Given a disposal, when saved, then the SMS includes the rating link.', ['WF-T3'], 'Must', 'System'),
    R('FR-ADM-001', 'Category master', 'The system shall allow the Administrative Reforms administrator to maintain grievance categories and departments to map sub-categories and offices.', 'Given a new sub-category mapped to an office, when saved, then new grievances route to that office.', ['ANS-1'], 'Must', 'State administrator'),
    R('FR-RPT-001', 'Chief Secretary dashboard', 'The system shall show the Chief Secretary department-wise and district-wise pendency, escalations and average disposal time, refreshed daily.', 'Given the dashboard, when opened, then counts match the register as of the previous day.', ['GO-5.1'], 'Must', 'Chief Secretary'),
    R('FR-RPT-002', 'Satisfaction report', 'The system shall report average citizen rating and reopen rate by department and district each month.', 'Given a month end, when the report runs, then ratings are averaged per department.', ['GO-4.3', 'GO-5.1'], 'Should', 'Chief Secretary'),
    R('NFR-001', 'Availability', 'The system shall be available for 99.5% of each calendar month excluding notified maintenance.', 'Given monthly data, when computed, then availability is at least 99.5%.', ['STD-GIGW'], 'Must'),
    R('NFR-002', 'Bilingual interface', 'The system shall provide all citizen screens and SMS in Hindi and English.', 'Given any citizen screen, when switched to Hindi, then all labels appear in Hindi.', ['STD-GIGW'], 'Must'),
    R('NFR-003', 'Audit trail', 'The system shall log user, role, time, IP address and before and after values for every transfer, disposal and escalation.', 'Given a transfer, when the log is queried, then all fields are present.', ['STD-CERTIN'], 'Must'),
    R('NFR-004', 'Personal data protection', 'The system shall show a privacy notice and record consent before registering a grievance, and mask the citizen mobile number in officer views except the last four digits.', 'Given an officer view, when a grievance is opened, then only the last four digits of the mobile number are visible.', ['STD-DPDP'], 'Must'),
    R('NFR-005', 'Hosting in India', 'The system shall be hosted in the State Data Centre with all data within India.', 'Given the deployment, when reviewed, then all locations are in India.', ['STD-HOST'], 'Must'),
    R('NFR-006', 'Log retention', 'The system shall retain logs for 180 days within India.', 'Given logs 179 days old, when queried, then they are available.', ['STD-CERTIN'], 'Must'),
    R('IR-001', 'Helpline CRM integration', 'The system shall receive grievances from the 1100 helpline CRM through an API and return registration numbers.', 'Given a helpline entry, when posted, then the registration number is returned in the API response.', ['GO-2.1'], 'Must', 'System'),
    R('IR-002', 'SMS gateway', 'The system shall send SMS through the State SMS gateway with DLT-registered templates.', 'Given an SMS event, when triggered, then delivery status is stored.', ['GO-2.2'], 'Must', 'System'),
  ].map((r) => ({ ...r, status: 'Reviewed' as const }));
  p.sections = {
    introduction: 'This FRS describes the Public Grievance Redressal System directed by G.O. No. AR/2026/PG/012 dated 3 February 2026 [GO-1].',
  };
  p.notes = [
    { id: 'N-1', by: 'Ravi Kumar', designation: 'Senior Systems Analyst', at: '2026-09-12T10:00:00.000Z', text: 'Draft v0.3 submitted for review. Assumption ASM on closure after reopening is pending confirmation from Administrative Reforms.', action: 'Submitted for review' },
    { id: 'N-2', by: 'Anita Deshmukh', designation: 'Joint Director (IT)', at: '2026-09-19T15:10:00.000Z', text: 'Please address the comments on FR-APP-002 and FR-RPT-001 before this is placed before the Director.', action: 'Comments added' },
  ];
  p.comments = [
    { id: 'C-1', reqId: 'FR-APP-002', by: 'Anita Deshmukh', designation: 'Joint Director (IT)', at: '2026-09-19T15:00:00.000Z', text: 'GO-3.2 says the transfer itself must happen within 1 working day. The requirement should state that the system blocks transfers after that without approval, and who approves.' },
    { id: 'C-2', reqId: 'FR-RPT-001', by: 'Anita Deshmukh', designation: 'Joint Director (IT)', at: '2026-09-19T15:05:00.000Z', text: 'Add export to Excel for the monthly review meeting.' },
  ];
  return p;
}
