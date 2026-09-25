import type { Project } from '@/lib/types';
import { emptyProject, R, src } from './helpers';

const GO = `GOVERNMENT OF RAJYAPRADESH
URBAN DEVELOPMENT DEPARTMENT
G.O. No. UD/2025/BP/044 Dated: 12 November 2025

1. Background
Building permissions in urban local bodies are processed manually, with applicants visiting offices several times and approvals taking up to 90 days.

2. Applications
2.1 Applications for building permission shall be submitted online by a registered architect or licensed engineer on behalf of the owner.
2.2 Drawings shall be submitted in DWG or PDF format and scrutinised automatically against the Rajyapradesh Building Bye-laws 2024.
2.3 Proof of ownership shall be fetched from the land records system where available.

3. Fees
3.1 Scrutiny fee and permit fee shall be computed by the system as per the notified schedule and paid online.

4. Scrutiny and inspection
4.1 The Assistant Town Planner shall complete scrutiny within 7 working days.
4.2 A joint site inspection shall be conducted within 10 working days of scrutiny, with geo-tagged photographs.
4.3 Where deficiencies are found, a single consolidated shortfall notice shall be issued.

5. Approval
5.1 The Commissioner of the urban local body shall approve or reject within 5 working days of the inspection report.
5.2 Applications for low-risk buildings up to 300 sq m shall be approved on self-certification by the architect.

6. Service timeline
6.1 Building permission shall be granted within 30 working days of a complete application, failing which it shall be deemed to be approved under the Rajyapradesh Right to Service Act.

7. Certificates
7.1 The permit shall be issued with a QR code and digital signature, verifiable online.
7.2 Occupancy certificates shall be applied for and issued online.

8. Monitoring
8.1 A public dashboard shall show applications received, approved, rejected and pending beyond timeline for every urban local body.
`;

export function buildBuildingProject(): Project {
  const p = emptyProject({
    id: 'obpa', name: 'Online Building Plan Approval', department: 'Urban Development', fileNo: 'IT/UD/2025/0087', type: 'permit',
    status: 'Approved', version: '1.0', owner: 'Priya Nair', createdAt: '2025-11-20T09:00:00.000Z', updatedAt: '2026-03-18T12:00:00.000Z',
    description: 'Online building permission with automated drawing scrutiny, joint site inspection and deemed approval under RTS.',
  });
  const types = {
    'GO-1': 'Info', 'GO-2.1': 'Mandate', 'GO-2.2': 'Mandate', 'GO-2.3': 'Mandate', 'GO-3.1': 'Rule', 'GO-4.1': 'Timeline', 'GO-4.2': 'Timeline',
    'GO-4.3': 'Mandate', 'GO-5.1': 'Timeline', 'GO-5.2': 'Rule', 'GO-6.1': 'Timeline', 'GO-7.1': 'Mandate', 'GO-7.2': 'Mandate', 'GO-8.1': 'Mandate',
  } as const;
  p.sources = [src('bp-go', 'GO', 'GO', 'GO on online building permission', GO, { refNo: 'UD/2025/BP/044', date: '2025-11-12', authority: 'Principal Secretary, Urban Development' }, types)];
  p.questions = [
    { id: 'Q-1', topic: 'Appeal', question: 'To whom does an applicant appeal against rejection?', whyItMatters: 'Appeal workflow and role.', suggestedAnswers: ['Director of Town Planning', 'District Collector'], defaultAssumption: 'Director of Town Planning', answer: 'Appeal lies with the Director of Town Planning within 30 days of rejection.' },
    { id: 'Q-2', topic: 'Legacy data', question: 'Must pending paper files be migrated?', whyItMatters: 'Migration scope and effort.', suggestedAnswers: ['Yes, pending only', 'No'], defaultAssumption: 'Pending files only', answer: 'Only files pending on go-live date are to be digitised and migrated.' },
  ];
  p.workflow = {
    rtsDays: 30, rtsRef: 'GO-6.1',
    states: [
      { id: 'draft', name: 'Draft', terminal: false }, { id: 'submitted', name: 'Submitted', terminal: false },
      { id: 'scrutiny', name: 'Under scrutiny', terminal: false }, { id: 'shortfall', name: 'Shortfall notice issued', terminal: false },
      { id: 'inspection', name: 'Site inspection', terminal: false }, { id: 'approval', name: 'Pending approval', terminal: false },
      { id: 'approved', name: 'Approved', terminal: true }, { id: 'rejected', name: 'Rejected', terminal: true },
    ],
    transitions: [
      { id: 'WF-T1', from: 'draft', to: 'submitted', action: 'Submit and pay fee', actor: 'Architect', conditions: [], refs: ['GO-2.1', 'GO-3.1'], notification: { channel: 'SMS', recipient: 'Owner', template: 'Application {no} submitted.' } },
      { id: 'WF-T2', from: 'submitted', to: 'scrutiny', action: 'Auto-scrutiny complete', actor: 'System', conditions: [], refs: ['GO-2.2'] },
      { id: 'WF-T3', from: 'scrutiny', to: 'inspection', action: 'Clear scrutiny', actor: 'Assistant Town Planner', conditions: [], slaDays: 7, escalation: { afterDays: 7, to: 'Town Planner' }, refs: ['GO-4.1'] },
      { id: 'WF-T4', from: 'scrutiny', to: 'shortfall', action: 'Issue shortfall notice', actor: 'Assistant Town Planner', conditions: [], slaDays: 7, refs: ['GO-4.3'], notification: { channel: 'SMS', recipient: 'Architect', template: 'Shortfall notice issued for {no}.' } },
      { id: 'WF-T5', from: 'shortfall', to: 'scrutiny', action: 'Resubmit', actor: 'Architect', conditions: [], slaDays: 30, refs: ['GO-4.3'] },
      { id: 'WF-T6', from: 'inspection', to: 'approval', action: 'Upload inspection report', actor: 'Building Inspector', conditions: [], slaDays: 10, escalation: { afterDays: 10, to: 'Town Planner' }, refs: ['GO-4.2'] },
      { id: 'WF-T7', from: 'approval', to: 'approved', action: 'Approve', actor: 'Commissioner', conditions: [], slaDays: 5, refs: ['GO-5.1'], notification: { channel: 'SMS', recipient: 'Owner', template: 'Permit {no} approved.' } },
      { id: 'WF-T8', from: 'approval', to: 'rejected', action: 'Reject with reasons', actor: 'Commissioner', conditions: [], slaDays: 5, refs: ['GO-5.1'], notification: { channel: 'SMS', recipient: 'Owner', template: 'Application {no} rejected: {reason}.' } },
    ],
  };
  p.rules = [
    { id: 'BR-001', name: 'Low-risk self-certification', conditions: [{ attribute: 'plotArea', operator: '<=', value: '300', unit: 'sq m', label: 'Built-up area' }, { attribute: 'floors', operator: '<=', value: '2', label: 'Floors' }], outcome: 'Eligible for self-certification', failOutcome: 'Full scrutiny required', refs: ['GO-5.2'] },
  ];
  p.permissions = {
    roles: [
      { id: 'architect', name: 'Architect', jurisdiction: 'Self' }, { id: 'atp', name: 'Assistant Town Planner', jurisdiction: 'District' },
      { id: 'inspector', name: 'Building Inspector', jurisdiction: 'District' }, { id: 'commissioner', name: 'Commissioner', jurisdiction: 'District' },
      { id: 'admin', name: 'State administrator', jurisdiction: 'State', admin: true },
    ],
    actions: ['Submit and pay fee', 'Clear scrutiny', 'Issue shortfall notice', 'Upload inspection report', 'Approve', 'Reject with reasons', 'View', 'Export', 'Configure masters'],
    grants: {
      architect: ['Submit and pay fee', 'View'], atp: ['Clear scrutiny', 'Issue shortfall notice', 'View'], inspector: ['Upload inspection report', 'View'],
      commissioner: ['Approve', 'Reject with reasons', 'View', 'Export'], admin: ['Configure masters', 'View', 'Export'],
    },
  };
  p.requirements = [
    R('FR-REG-001', 'Architect registration', 'The system shall register architects after verification of their Council of Architecture registration number and licensed engineers after verification of their ULB licence number.', ['Given a valid CoA number, when the architect registers, then the account is activated after OTP verification of mobile and email.', 'Given an expired CoA registration, when registration is attempted, then it is refused with the reason.'], ['GO-2.1'], 'Must', 'Architect'),
    R('FR-REG-002', 'Owner consent', 'The system shall record the owner\'s consent through Aadhaar OTP before an architect submits an application on the owner\'s behalf.', 'Given an application prepared by an architect, when the owner completes Aadhaar OTP, then consent with timestamp is attached to the application.', ['GO-2.1', 'STD-AADHAAR'], 'Must', 'Owner'),
    R('FR-REG-003', 'Officer sign-in', 'The system shall authenticate officers through Jan Parichay with two-factor authentication and assign role and ULB jurisdiction from the officer master.', 'Given an officer mapped to a ULB, when they sign in, then only applications of that ULB are listed.', ['STD-EGOV'], 'Must', 'Officer'),
    R('FR-APP-001', 'Online application', 'The system shall allow a registered architect to create a building permission application with owner details, plot details, proposed use and building parameters.', 'Given a signed-in architect, when all mandatory fields are completed, then the application can be saved as draft and submitted.', ['GO-2.1'], 'Must', 'Architect'),
    R('FR-APP-002', 'Save as draft', 'The system shall save the application as a draft at every step and allow the architect to resume it for 90 days.', 'Given a draft saved on day 1, when the architect returns on day 60, then all entered data is available.', ['GO-2.1'], 'Should', 'Architect'),
    R('FR-APP-003', 'Unique application number', 'The system shall generate a unique application number in the format BP/<ULB code>/<year>/<serial> on submission.', 'Given two submissions in the same ULB, when numbers are generated, then they are unique and sequential.', ['GO-2.1'], 'Must', 'System'),
    R('FR-APP-004', 'Acknowledgement', 'The system shall issue a PDF acknowledgement with the application number, fee paid and the date by which a decision is due under the Right to Service Act.', 'Given a successful submission, when the acknowledgement is generated, then it shows the due date computed as 30 working days from submission.', ['GO-6.1'], 'Must', 'System'),
    R('FR-APP-011', 'Assisted application with applicant consent', 'The system shall allow an authorised intermediary to submit an application on behalf of an applicant after recording the applicant\'s consent by OTP to the applicant\'s mobile number, and shall record the intermediary ID on the application.', ['Given an intermediary signed in, when the applicant enters the OTP sent to their mobile number, then the application is submitted with the intermediary ID recorded.', 'Given the OTP is not entered within 10 minutes, when submission is attempted, then it is refused.'], ['GO-2.1'], 'Must', 'Architect'),
    R('FR-APP-012', 'Status tracking', 'The system shall show the applicant the current status, the officer with whom the application is pending, and the working days elapsed against the notified timeline.', 'Given an application pending scrutiny for 4 working days, when the applicant views status, then it shows "Under scrutiny, 4 of 30 working days".', ['GO-6.1'], 'Must', 'Owner'),
    R('FR-DOC-001', 'Drawing upload', 'The system shall accept drawings in DWG or PDF format up to 50 MB per file and reject other formats with a message naming the permitted formats.', 'Given a DWG of 20 MB, when uploaded, then it is accepted; given a JPG, then it is refused with the permitted formats listed.', ['GO-2.2'], 'Must', 'Architect'),
    R('FR-DOC-002', 'Ownership from land records', 'The system shall fetch ownership details from the land records system using survey number and village, and allow upload of a sale deed only when the record is not found.', 'Given a survey number present in land records, when fetched, then the owner name and area are shown as read-only.', ['GO-2.3'], 'Must', 'System'),
    R('FR-DOC-003', 'Document checklist', 'The system shall show a document checklist based on building use and size and block submission until mandatory documents are attached.', 'Given a commercial building above 500 sq m, when the checklist is shown, then fire NOC is listed as mandatory.', ['GO-2.2'], 'Must', 'Architect'),
    R('FR-SCR-001', 'Automated drawing scrutiny', 'The system shall scrutinise submitted drawings against setbacks, FAR, ground coverage, height and parking rules of the Rajyapradesh Building Bye-laws 2024 and produce a scrutiny report listing every rule with pass or fail.', 'Given a drawing with front setback of 2.5 m where 3 m is required, when scrutiny runs, then the report shows the setback rule as failed with required and proposed values.', ['GO-2.2'], 'Must', 'System'),
    R('FR-SCR-002', 'Scrutiny by Assistant Town Planner', 'The system shall allow the Assistant Town Planner to review the automated scrutiny report, add observations, and either clear the application for inspection or issue a shortfall notice within 7 working days.', 'Given an application in scrutiny, when the ATP clears it, then it moves to Site inspection and the action is logged.', ['GO-4.1', 'WF-T3'], 'Must', 'Assistant Town Planner'),
    R('FR-SCR-003', 'Single consolidated shortfall notice', 'The system shall allow only one shortfall notice per application listing all deficiencies, and shall pause the RTS clock until the architect resubmits.', 'Given a shortfall notice already issued, when the ATP attempts a second notice, then the system refuses it.', ['GO-4.3', 'WF-T4'], 'Must', 'Assistant Town Planner'),
    R('FR-SCR-004', 'Resubmission', 'The system shall allow the architect to resubmit corrected drawings within 30 days of a shortfall notice, after which the application is closed.', 'Given 31 days since the notice without resubmission, when the daily job runs, then the application is closed and the owner notified.', ['GO-4.3', 'WF-T5'], 'Must', 'Architect'),
    R('FR-INS-001', 'Inspection scheduling', 'The system shall schedule a joint site inspection within 10 working days of scrutiny clearance and notify the architect and owner of the date by SMS.', 'Given scrutiny cleared on day 5, when inspection is scheduled, then the date is no later than working day 15.', ['GO-4.2'], 'Must', 'Building Inspector'),
    R('FR-INS-002', 'Geo-tagged inspection report', 'The system shall accept the inspection report only with at least three geo-tagged photographs taken within 200 metres of the plot coordinates.', 'Given photographs tagged 500 m away, when the report is uploaded, then it is refused.', ['GO-4.2', 'WF-T6'], 'Must', 'Building Inspector'),
    R('FR-VER-001', 'Approval or rejection', 'The system shall allow the Commissioner to approve or reject within 5 working days of the inspection report, with reasons mandatory for rejection.', 'Given a rejection without reasons, when submitted, then it is refused.', ['GO-5.1', 'WF-T7', 'WF-T8'], 'Must', 'Commissioner'),
    R('FR-VER-002', 'Self-certification route', 'The system shall approve applications meeting rule BR-001 on self-certification by the architect after automated scrutiny passes, without site inspection before approval.', 'Given a 250 sq m two-floor residential building with scrutiny passed, when submitted, then the permit is issued within 1 working day.', ['GO-5.2', 'BR-001'], 'Must', 'System'),
    R('FR-VER-003', 'Deemed approval', 'The system shall mark an application as deemed approved and issue the permit when 30 working days elapse after a complete application without a decision.', 'Given no decision by working day 30, when the daily job runs on day 31, then the permit is issued with the marking "Deemed approved under RTS Act".', ['GO-6.1', 'STD-RTS'], 'Must', 'System'),
    R('FR-VER-004', 'Post-approval audit of self-certified cases', 'The system shall randomly select 10% of self-certified approvals each month for site inspection.', 'Given 200 self-certified approvals in a month, when selection runs, then 20 are assigned for inspection.', ['GO-5.2'], 'Should', 'System'),
    R('FR-FEE-001', 'Fee computation', 'The system shall compute scrutiny and permit fees from the notified fee schedule based on built-up area and use.', 'Given a residential building of 400 sq m, when fees are computed, then the amount equals the schedule rate multiplied by area.', ['GO-3.1'], 'Must', 'System'),
    R('FR-FEE-002', 'Online payment', 'The system shall collect fees through the State payment gateway and proceed only on a verified success response.', 'Given a payment debited but not confirmed, when daily reconciliation runs, then the status is corrected.', ['GO-3.1'], 'Must', 'Architect'),
    R('FR-FEE-003', 'Fee master', 'The system shall allow the State administrator to maintain the fee schedule with effective dates and apply the schedule in force on the date of submission.', 'Given a new schedule effective 1 April, when an application submitted on 31 March is assessed, then the old schedule applies.', ['GO-3.1'], 'Must', 'State administrator'),
    R('FR-CRT-001', 'Digitally signed permit with QR code', 'The system shall issue the building permit as a PDF signed with the Commissioner\'s digital signature and carrying a QR code that opens the verification page.', 'Given an issued permit, when the QR code is scanned, then the public verification page shows permit number, owner, plot and validity.', ['GO-7.1'], 'Must', 'System'),
    R('FR-CRT-002', 'Occupancy certificate', 'The system shall allow the owner to apply for an occupancy certificate online with a completion report and issue it after inspection.', 'Given a permit, when the completion report is submitted, then an inspection is scheduled within 7 working days.', ['GO-7.2'], 'Must', 'Owner'),
    R('FR-NOT-001', 'Submission SMS', 'The system shall send an SMS to the owner on submission with application number and due date.', 'Given submission, when completed, then the SMS is sent within 5 minutes.', ['WF-T1'], 'Must', 'System'),
    R('FR-NOT-002', 'Shortfall SMS', 'The system shall send an SMS and email to the architect when a shortfall notice is issued, with the link to the notice.', 'Given a shortfall notice, when issued, then the SMS is sent within 5 minutes.', ['WF-T4'], 'Must', 'System'),
    R('FR-NOT-003', 'Decision SMS', 'The system shall send an SMS to the owner on approval or rejection, including the rejection reason where applicable.', 'Given a rejection, when recorded, then the SMS contains the recorded reason.', ['WF-T7', 'WF-T8'], 'Must', 'System'),
    R('FR-ESC-001', 'Escalation of delayed scrutiny', 'The system shall escalate an application to the Town Planner when scrutiny is not completed within 7 working days.', 'Given scrutiny pending on working day 8, when the daily job runs, then the application appears in the Town Planner\'s escalation list.', ['WF-T3', 'GO-4.1'], 'Must', 'System'),
    R('FR-ESC-002', 'Escalation of delayed inspection', 'The system shall escalate an application to the Town Planner when the inspection report is not uploaded within 10 working days.', 'Given no report on working day 11, when the daily job runs, then it is escalated.', ['WF-T6', 'GO-4.2'], 'Must', 'System'),
    R('FR-GRV-001', 'Appeal against rejection', 'The system shall allow the owner to file an appeal to the Director of Town Planning within 30 days of rejection and track its disposal.', 'Given a rejection on 1 March, when the owner files an appeal on 25 March, then it is registered and assigned to the Director.', ['ANS-1'], 'Must', 'Owner'),
    R('FR-ADM-001', 'ULB and officer masters', 'The system shall allow the State administrator to maintain ULB, ward and officer masters with LGD codes.', 'Given a new ward, when added with an LGD code, then it is available in the application form.', ['STD-EGOV'], 'Must', 'State administrator'),
    R('FR-ADM-002', 'Bye-law rule configuration', 'The system shall allow the State administrator to configure scrutiny rule parameters with effective dates without code changes.', 'Given a changed setback value effective from a date, when scrutiny runs for a later submission, then the new value is applied.', ['GO-2.2'], 'Must', 'State administrator'),
    R('FR-ADM-003', 'Legacy file migration', 'The system shall import digitised pending files with their current status and history so that they continue in the online workflow.', 'Given 1,200 pending files, when migration completes, then each file appears with its status and history and the counts reconcile.', ['ANS-2'], 'Should', 'State administrator'),
    R('FR-RPT-001', 'Public dashboard', 'The system shall publish a public dashboard showing, for every ULB, applications received, approved, rejected, deemed approved and pending beyond timeline, refreshed daily.', 'Given the dashboard, when opened without sign-in, then counts for every ULB are shown with the refresh date.', ['GO-8.1'], 'Must', 'Public'),
    R('FR-RPT-002', 'Officer pendency report', 'The system shall provide each officer a pendency report of applications with them, sorted by working days elapsed.', 'Given an officer with 12 pending files, when the report is opened, then 12 rows appear sorted by days elapsed.', ['GO-8.1'], 'Must', 'Officer'),
    R('FR-RPT-003', 'Monthly performance report', 'The system shall generate a monthly report per ULB with average disposal time, RTS compliance percentage and deemed approvals.', 'Given a month end, when the report is generated, then values match the underlying application data.', ['GO-8.1'], 'Should', 'Commissioner'),
    R('IR-001', 'Land records integration', 'The system shall fetch ownership details from the Rajyapradesh land records system through its REST API using survey number and village code.', 'Given the land records API is unavailable, when a fetch is attempted, then the applicant is allowed to upload a sale deed and the failure is logged.', ['GO-2.3'], 'Must', 'System'),
    R('IR-002', 'Payment gateway', 'The system shall integrate with the State payment gateway with server-to-server verification of every transaction.', 'Given a tampered callback, when verification fails, then the payment is not marked successful.', ['GO-3.1'], 'Must', 'System'),
    R('IR-003', 'e-Sign', 'The system shall integrate with an empanelled e-Sign Service Provider for signing of permits by the Commissioner.', 'Given approval, when the Commissioner completes e-Sign OTP, then the permit PDF carries a valid signature.', ['GO-7.1', 'STD-AADHAAR'], 'Must', 'Commissioner'),
    R('IR-004', 'SMS gateway', 'The system shall send SMS through the State SMS gateway with DLT-registered templates.', 'Given an SMS event, when sent, then the delivery report is stored.', ['GO-8.1'], 'Must', 'System'),
    R('IR-005', 'Fire NOC integration', 'The system shall request fire NOC from the Fire Services portal for buildings above 15 metres and receive the NOC status.', 'Given a building of 18 m, when scrutiny clears, then a fire NOC request is created automatically.', ['GO-2.2'], 'Should', 'System'),
    R('NFR-001', 'Monthly availability', 'The system shall be available for 99.5% of each calendar month, excluding planned maintenance notified 48 hours in advance.', 'Given monthly monitoring data, when availability is computed, then it is at least 99.5%.', ['STD-GIGW'], 'Must'),
    R('NFR-002', 'Response time', 'The system shall return 95% of responses within 3 seconds with 1,000 concurrent users.', 'Given a 30-minute load test, when measured, then the 95th percentile is 3 seconds or less.', ['STD-GIGW'], 'Must'),
    R('NFR-003', 'Drawing scrutiny time', 'The system shall complete automated scrutiny of a drawing up to 50 MB within 10 minutes.', 'Given a 50 MB DWG, when scrutiny runs, then the report is ready within 10 minutes.', ['GO-2.2'], 'Must'),
    R('NFR-004', 'GIGW and WCAG conformance', 'The system shall conform to GIGW 3.0 and WCAG 2.1 Level AA.', 'Given the GIGW audit, when completed, then no non-conformance remains open.', ['STD-GIGW', 'STD-WCAG'], 'Must'),
    R('NFR-005', 'Bilingual interface', 'The system shall provide all applicant-facing screens and notifications in Hindi and English.', 'Given any screen, when the language is switched, then all labels change.', ['STD-GIGW'], 'Must'),
    R('NFR-006', 'Audit trail', 'The system shall record user, role, time, IP address and before and after values for every create, update, approve and reject action.', 'Given an approval, when the audit log is queried, then the entry shows all fields.', ['STD-CERTIN'], 'Must'),
    R('NFR-007', 'Log retention and incident reporting', 'The system shall retain logs for 180 days within India and support reporting of cyber incidents to CERT-In within 6 hours.', 'Given logs 179 days old, when queried, then they are available.', ['STD-CERTIN'], 'Must'),
    R('NFR-008', 'Security audit', 'The system shall obtain a safe-to-host certificate from a CERT-In empanelled auditor before go-live.', 'Given go-live, when the checklist is reviewed, then the certificate is on record.', ['STD-SECAUDIT'], 'Must'),
    R('NFR-009', 'Personal data protection', 'The system shall display a privacy notice, record consent, and retain personal data only for the notified period.', 'Given a new application, when opened, then the notice is shown before data entry.', ['STD-DPDP'], 'Must'),
    R('NFR-010', 'Hosting in India', 'The system shall be hosted in the State Data Centre with all data and backups within India.', 'Given the deployment, when reviewed, then all locations are in India.', ['STD-HOST'], 'Must'),
    R('NFR-011', 'Backup and recovery', 'The system shall meet an RPO of 1 hour and an RTO of 4 hours, verified by a quarterly DR drill.', 'Given a DR drill, when executed, then service resumes within 4 hours.', ['STD-HOST'], 'Must'),
    R('NFR-012', 'Drawing storage', 'The system shall retain drawings and permits for the life of the building plus 10 years.', 'Given a permit issued in 2026, when queried in 2040, then the drawings are retrievable.', ['GO-7.1'], 'Should'),
    R('FR-APP-013', 'Withdrawal of application', 'The system shall allow the architect to withdraw an application before inspection, with fee refund as per the notified schedule.', 'Given an application in scrutiny, when withdrawn, then status becomes Withdrawn and the owner is notified.', ['GO-3.1'], 'Could', 'Architect'),
    R('FR-APP-014', 'Revision of approved plan', 'The system shall allow a revised plan to be submitted against an approved permit, reusing unchanged documents.', 'Given an approved permit, when a revision is created, then unchanged documents are carried over.', ['GO-2.1'], 'Should', 'Architect'),
    R('FR-NOT-004', 'Escalation alert to officer', 'The system shall send an email to the officer and the escalation authority when an application is escalated.', 'Given an escalation, when triggered, then both receive email within 15 minutes.', ['WF-T3', 'WF-T6'], 'Should', 'System'),
    R('FR-RPT-004', 'Architect performance report', 'The system shall report, for each architect, applications submitted, shortfall rate and self-certification audit failures.', 'Given an architect with 20 submissions and 5 shortfalls, when the report runs, then the shortfall rate shows 25%.', ['GO-5.2'], 'Could', 'Commissioner'),
  ];
  p.sections = {
    introduction: 'This Functional Requirements Specification describes the Online Building Plan Approval System for urban local bodies of Rajyapradesh, as directed by G.O. No. UD/2025/BP/044 dated 12 November 2025 [GO-1].',
    asis: 'Applications are submitted on paper at the urban local body. Drawings are checked manually, site inspection is scheduled by phone, and approvals take up to 90 days [GO-1].',
    tobe: 'Architects submit applications online, drawings are scrutinised automatically against the Building Bye-laws, a joint site inspection is recorded with geo-tagged photographs, and the Commissioner decides within the notified timeline, failing which the application is deemed approved [GO-2.2] [GO-4.2] [GO-6.1].',
  };
  p.notes = [
    { id: 'N-1', by: 'Priya Nair', designation: 'Systems Analyst', at: '2026-03-02T10:00:00.000Z', text: 'Draft FRS v0.9 submitted for review. All GO clauses covered; appeal and migration confirmed with the department.', action: 'Submitted for review' },
    { id: 'N-2', by: 'Anita Deshmukh', designation: 'Joint Director (IT)', at: '2026-03-10T11:30:00.000Z', text: 'Reviewed. Deemed approval logic and self-certification audit are clear. Forwarded for approval.', action: 'Forwarded' },
    { id: 'N-3', by: 'S. Raghavan', designation: 'Director (IT)', at: '2026-03-18T12:00:00.000Z', text: 'Approved. Baseline v1.0 to be used for the RFP.', action: 'Approved' },
  ];
  p.baseline = { version: '1.0', approvedBy: 'S. Raghavan', approvedAt: '2026-03-18T12:00:00.000Z', snapshot: { sources: p.sources, reconciliations: [], questions: [], entities: [], rules: p.rules, requirements: p.requirements, sections: p.sections, workflow: p.workflow, permissions: p.permissions } };
  return p;
}
