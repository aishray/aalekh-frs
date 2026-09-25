import type { Project, ProjectType } from '@/lib/types';
import { emptyProject, R, src } from './helpers';

type Row = [string, string, string, string, string[], ('Must' | 'Should' | 'Could')?, string?];

function light(
  meta: { id: string; name: string; department: string; fileNo: string; type: ProjectType; status: Project['status']; version: string; owner: string; createdAt: string; updatedAt: string; description: string },
  go: { refNo: string; date: string; authority: string; text: string },
  rows: Row[],
): Project {
  const p = emptyProject(meta);
  p.sources = [src(`${meta.id}-go`, 'GO', 'GO', `GO: ${meta.name}`, go.text, { refNo: go.refNo, date: go.date, authority: go.authority })];
  p.requirements = rows.map(([id, title, desc, ac, refs, pr, actor]) => {
    const r = R(id, title, desc, ac, refs, pr ?? 'Must', actor, meta.updatedAt);
    return { ...r, status: meta.status === 'Approved' ? 'Approved' : 'Draft' };
  });
  if (meta.status === 'Approved') {
    p.baseline = { version: meta.version, approvedBy: 'S. Raghavan', approvedAt: meta.updatedAt, snapshot: { sources: p.sources, reconciliations: [], questions: [], entities: [], rules: [], requirements: p.requirements, sections: {} } };
  }
  return p;
}

export function buildLightProjects(): Project[] {
  return [
    light(
      { id: 'estamp', name: 'e-Stamp Duty Refund', department: 'Revenue (Registration and Stamps)', fileNo: 'IT/REV/2025/0211', type: 'benefit', status: 'Approved', version: '1.1', owner: 'Priya Nair', createdAt: '2025-10-02T09:00:00.000Z', updatedAt: '2026-01-22T10:00:00.000Z', description: 'Online refund of unused or spoiled e-stamp papers with bank credit.' },
      { refNo: 'REV/2025/ST/077', date: '2025-09-15', authority: 'Inspector General of Registration', text: `1. Background\nRefund of unused e-stamp paper requires visits to the Sub-Registrar office.\n\n2. Refund\n2.1 Applications for refund of unused e-stamp certificates shall be made online within 6 months of purchase.\n2.2 The Collector of Stamps shall decide within 21 days.\n2.3 A deduction of 10% of the stamp value shall be made from the refund.\n2.4 The refund shall be credited to the bank account of the purchaser.\n` },
      [
        ['FR-APP-001', 'Refund application', 'The system shall allow the purchaser to apply for refund by entering the e-stamp certificate number, which is validated against the SHCIL record.', 'Given a valid certificate number, when entered, then purchase date and value are fetched and shown read-only.', ['GO-2.1'], 'Must', 'Purchaser'],
        ['FR-APP-002', 'Six-month window', 'The system shall refuse refund applications made more than 6 months after the purchase date.', 'Given a certificate purchased 6 months and 1 day earlier, when applying, then the application is refused with the reason.', ['GO-2.1'], 'Must', 'System'],
        ['FR-APP-003', 'Refund request filed by stamp vendor', 'The system shall let a licensed stamp vendor file the refund request for a purchaser, with the purchaser confirming the request by OTP.', 'Given the purchaser confirms by OTP, when the vendor files the request, then the vendor licence number is stored with the request.', ['GO-2.1'], 'Should', 'Stamp vendor'],
        ['FR-VER-001', 'Decision by Collector of Stamps', 'The system shall allow the Collector of Stamps to approve or reject within 21 days, with reasons mandatory for rejection.', 'Given a rejection without reasons, when submitted, then it is refused.', ['GO-2.2'], 'Must', 'Collector of Stamps'],
        ['FR-PAY-001', 'Refund computation', 'The system shall compute the refund as the stamp value less a 10% deduction, rounded down to the nearest rupee.', 'Given a stamp value of ₹10,005, when computed, then the refund is ₹9,004.', ['GO-2.3'], 'Must', 'System'],
        ['FR-PAY-002', 'Bank credit', 'The system shall credit the refund to the purchaser\'s bank account through the treasury and record the UTR number.', 'Given an approved refund, when the treasury confirms, then the UTR is stored and shown to the purchaser.', ['GO-2.4'], 'Must', 'System'],
        ['FR-PAY-003', 'Payment failure handling', 'The system shall mark a refund as failed when the treasury returns a failure, notify the purchaser to correct bank details, and re-initiate payment after correction.', 'Given a treasury failure for an invalid account, when processed, then the purchaser receives an SMS with a correction link.', ['GO-2.4'], 'Must', 'System'],
        ['FR-NOT-001', 'Status SMS', 'The system shall send an SMS to the purchaser at submission, decision and credit.', 'Given a credit, when the UTR is recorded, then the SMS includes the UTR.', ['GO-2.4'], 'Must', 'System'],
        ['FR-RPT-001', 'Refund register', 'The system shall provide the Inspector General a register of refunds with value, deduction and status, exportable to Excel.', 'Given the register, when exported, then totals match the screen.', ['GO-2.3'], 'Should', 'Inspector General'],
        ['NFR-001', 'Audit trail', 'The system shall log user, time, IP address and before and after values for every decision.', 'Given a decision, when the log is queried, then all fields are present.', ['STD-CERTIN'], 'Must'],
        ['NFR-002', 'Hosting in India', 'The system shall be hosted in the State Data Centre with all data in India.', 'Given the deployment, when reviewed, then all locations are in India.', ['STD-HOST'], 'Must'],
      ],
    ),
    light(
      { id: 'mdm', name: 'Mid-Day Meal MIS', department: 'School Education', fileNo: 'IT/SE/2026/0034', type: 'mis', status: 'Draft', version: '0.2', owner: 'Ravi Kumar', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-09-15T10:00:00.000Z', description: 'Daily meal count capture from schools with district dashboards and fund utilisation.' },
      { refNo: 'SE/2026/MDM/019', date: '2026-06-20', authority: 'Secretary, School Education', text: `1. Background\nDaily meal data is collected by phone calls from schools.\n\n2. Data capture\n2.1 Head teachers shall report the number of meals served by 14:00 every school day.\n2.2 Schools without internet shall report by SMS or IVRS.\n\n3. Monitoring\n3.1 Block and district officers shall see non-reporting schools daily.\n3.2 Monthly fund utilisation shall be reported to the Government of India.\n` },
      [
        ['FR-APP-001', 'Daily meal count', 'The system shall allow the head teacher to report meals served by class for each school day.', 'Given a school day, when the count is saved before 14:00, then it is marked on time.', ['GO-2.1'], 'Must', 'Head teacher'],
        ['FR-APP-002', 'SMS and IVRS reporting', 'The system shall accept the daily count by SMS in the format MDM <UDISE code> <count> and by IVRS.', 'Given an SMS "MDM 09123400101 142", when received, then 142 meals are recorded for that school.', ['GO-2.2'], 'Must', 'Head teacher'],
        ['FR-APP-003', 'Holiday calendar', 'The system shall exclude declared holidays from non-reporting counts.', 'Given a declared holiday, when non-reporting is computed, then no school is marked non-reporting.', ['GO-3.1'], 'Should', 'System'],
        ['FR-RPT-001', 'Non-reporting list', 'The system shall show block and district officers the list of schools that have not reported by 14:30 each school day.', 'Given 12 schools not reported, when the officer opens the list at 14:30, then 12 schools appear.', ['GO-3.1'], 'Must', 'Block officer'],
        ['FR-RPT-002', 'Fund utilisation report', 'The system shall generate the monthly fund utilisation report in the Government of India format.', 'Given a month end, when generated, then values match meals served multiplied by cost norms.', ['GO-3.2'], 'Must', 'District officer'],
        ['FR-NOT-001', 'Reminder SMS', 'The system shall send a reminder SMS at 13:30 to head teachers who have not reported.', 'Given a school not reported at 13:30, when the job runs, then the head teacher receives the SMS.', ['GO-2.1'], 'Should', 'System'],
        ['FR-ADM-001', 'School master from UDISE+', 'The system shall import the school master from UDISE+ with enrolment by class.', 'Given the UDISE+ file, when imported, then school counts reconcile.', ['GO-2.1'], 'Must', 'State administrator'],
        ['FR-RPT-003', 'Meals against enrolment', 'The system shall flag schools reporting meals above enrolment.', 'Given 150 meals against 140 enrolled, when saved, then the entry is flagged for review.', ['GO-3.1'], 'Must', 'System'],
        ['NFR-001', 'Low-bandwidth operation', 'The system shall load the head teacher entry screen within 5 seconds on a 2G connection.', 'Given a throttled 2G profile, when loaded, then the screen is usable within 5 seconds.', ['GO-2.2'], 'Must'],
        ['NFR-002', 'Bilingual interface', 'The system shall provide all school-facing screens in Hindi and English.', 'Given the entry screen, when switched to Hindi, then all labels are in Hindi.', ['STD-GIGW'], 'Must'],
      ],
    ),
    light(
      { id: 'beds', name: 'Hospital Bed Dashboard', department: 'Health and Family Welfare', fileNo: 'IT/HFW/2026/0051', type: 'mis', status: 'In review', version: '0.4', owner: 'Meera Joshi', createdAt: '2026-05-05T09:00:00.000Z', updatedAt: '2026-09-21T09:30:00.000Z', description: 'Real-time bed availability across government hospitals for referral and public view.' },
      { refNo: 'HFW/2026/HOS/044', date: '2026-04-28', authority: 'Principal Secretary, Health', text: `1. Background\nReferral of patients is delayed because bed availability is not known.\n\n2. Availability\n2.1 Every government hospital shall update bed availability by ward type at least every 4 hours.\n2.2 Availability shall be visible to the public.\n\n3. Referral\n3.1 Referring doctors shall be able to reserve a bed for 2 hours.\n` },
      [
        ['FR-APP-001', 'Bed update', 'The system shall allow the hospital nodal officer to update occupied and vacant beds by ward type.', 'Given an update, when saved, then the timestamp and officer are recorded.', ['GO-2.1'], 'Must', 'Hospital nodal officer'],
        ['FR-APP-002', 'Stale data flag', 'The system shall flag a hospital whose data is older than 4 hours and alert the district nodal officer.', 'Given the last update 4 hours 5 minutes ago, when the check runs, then the hospital is flagged.', ['GO-2.1'], 'Must', 'System'],
        ['FR-APP-003', 'Bed reservation for referral', 'The system shall allow a referring doctor to reserve a vacant bed for 2 hours, after which it is released automatically.', 'Given a reservation at 10:00, when not admitted by 12:00, then the bed is released.', ['GO-3.1'], 'Must', 'Referring doctor'],
        ['FR-RPT-001', 'Public availability view', 'The system shall show the public vacant beds by hospital and ward type without sign-in.', 'Given the public page, when opened, then vacant beds and last update time are shown.', ['GO-2.2'], 'Must', 'Public'],
        ['FR-RPT-002', 'District occupancy report', 'The system shall show district officers occupancy percentage by hospital and ward type for any date range.', 'Given a date range, when selected, then occupancy is computed from updates.', ['GO-2.1'], 'Should', 'District officer'],
        ['FR-NOT-001', 'Reservation SMS', 'The system shall send the reservation code by SMS to the referring doctor and the receiving hospital.', 'Given a reservation, when made, then both receive the code within 2 minutes.', ['GO-3.1'], 'Must', 'System'],
        ['FR-ADM-001', 'Hospital and ward master', 'The system shall allow the State administrator to maintain hospitals, ward types and sanctioned beds.', 'Given a new ward, when added, then it appears in the update screen.', ['GO-2.1'], 'Must', 'State administrator'],
        ['IR-001', 'HMIS integration', 'The system shall pull admissions and discharges from hospitals running e-Hospital to update occupancy automatically.', 'Given an e-Hospital discharge, when received, then the vacant count increases by one.', ['GO-2.1'], 'Should', 'System'],
        ['NFR-001', 'Public page performance', 'The system shall serve the public availability page within 2 seconds for 5,000 concurrent users.', 'Given a load test, when run, then the 95th percentile is 2 seconds or less.', ['STD-GIGW'], 'Must'],
        ['NFR-002', 'Availability', 'The system shall be available for 99.9% of each month.', 'Given monthly data, when computed, then availability is at least 99.9%.', ['STD-GIGW'], 'Must'],
      ],
    ),
    light(
      { id: 'mandi', name: 'Mandi Price App', department: 'Agriculture Marketing', fileNo: 'IT/AGM/2026/0008', type: 'mis', status: 'Changes requested', version: '0.3', owner: 'Ravi Kumar', createdAt: '2026-04-12T09:00:00.000Z', updatedAt: '2026-09-10T11:00:00.000Z', description: 'Daily commodity prices from regulated markets on a farmer mobile app with price alerts.' },
      { refNo: 'AGM/2026/MKT/031', date: '2026-04-01', authority: 'Director, Agriculture Marketing', text: `1. Background\nFarmers do not know prices in nearby mandis before transporting produce.\n\n2. Prices\n2.1 Each regulated market shall publish modal, minimum and maximum prices of arrivals by 12:00 daily.\n2.2 Farmers shall be able to set price alerts for up to five commodities.\n` },
      [
        ['FR-APP-001', 'Price entry', 'The system shall allow the market secretary to enter arrivals and modal, minimum and maximum prices per commodity by 12:00 each market day.', 'Given an entry after 12:00, when saved, then it is marked late.', ['GO-2.1'], 'Must', 'Market secretary'],
        ['FR-APP-002', 'Price view', 'The system shall show farmers the latest prices in markets within a selected distance of their location.', 'Given a 50 km radius, when selected, then only markets within 50 km are listed.', ['GO-2.1'], 'Must', 'Farmer'],
        ['FR-APP-003', 'Price alerts', 'The system shall allow a farmer to set alerts for up to five commodities with a threshold price.', 'Given a sixth alert, when saved, then it is refused.', ['GO-2.2'], 'Must', 'Farmer'],
        ['FR-NOT-001', 'Alert notification', 'The system shall send a push notification and SMS when the modal price crosses the farmer\'s threshold.', 'Given a threshold of ₹2,000 and a modal price of ₹2,050, when prices are published, then the alert is sent.', ['GO-2.2'], 'Must', 'System'],
        ['FR-RPT-001', 'Price trend', 'The system shall show a 30-day price trend per commodity and market.', 'Given a commodity, when selected, then 30 days of modal prices are plotted.', ['GO-2.1'], 'Should', 'Farmer'],
        ['FR-ADM-001', 'Commodity master', 'The system shall maintain commodity and variety masters aligned with Agmarknet codes.', 'Given an Agmarknet code, when imported, then it maps to the commodity.', ['GO-2.1'], 'Must', 'State administrator'],
        ['IR-001', 'Agmarknet upload', 'The system shall upload daily prices to Agmarknet in its prescribed format.', 'Given published prices, when the upload runs at 13:00, then Agmarknet acknowledges the file.', ['GO-2.1'], 'Should', 'System'],
        ['NFR-001', 'Offline cache', 'The app shall show the last downloaded prices when offline, with the download time.', 'Given no network, when opened, then last prices and their time are shown.', ['GO-2.1'], 'Must'],
        ['NFR-002', 'Bilingual interface', 'The app shall be available in Hindi and English.', 'Given the app, when the language is switched, then all labels change.', ['STD-GIGW'], 'Must'],
        ['FR-APP-004', 'Late entry follow-up', 'The system should notify the district marketing officer quickly when a market has not published prices.', 'Given no prices by 12:00, when checked, then the officer is notified.', ['GO-2.1'], 'Should', 'System'],
      ],
    ),
    light(
      { id: 'fish', name: 'Fisheries Licence Renewal', department: 'Fisheries', fileNo: 'IT/FSH/2026/0015', type: 'licence', status: 'Draft', version: '0.1', owner: 'Meera Joshi', createdAt: '2026-08-18T09:00:00.000Z', updatedAt: '2026-09-23T16:00:00.000Z', description: 'Online issue and annual renewal of fishing and fish-seed licences with inspection.' },
      { refNo: 'FSH/2026/LIC/006', date: '2026-08-01', authority: 'Commissioner of Fisheries', text: `1. Background\nLicences are renewed on paper at district fisheries offices.\n\n2. Renewal\n2.1 Licences shall be renewed online on payment of the renewal fee before expiry.\n2.2 A renewal reminder shall be sent 30 days before expiry.\n2.3 The Assistant Director shall decide within 15 days, after inspection where required.\n` },
      [
        ['FR-APP-001', 'Online renewal', 'The system shall allow a licence holder to apply for renewal online from 60 days before expiry.', 'Given a licence expiring in 45 days, when the holder signs in, then renewal is available.', ['GO-2.1'], 'Must', 'Licence holder'],
        ['FR-FEE-001', 'Renewal fee', 'The system shall collect the renewal fee through the payment gateway as per the licence category.', 'Given category A, when paying, then the category A fee is charged.', ['GO-2.1'], 'Must', 'Licence holder'],
        ['FR-NOT-001', 'Renewal reminder', 'The system shall send an SMS reminder 30 days before licence expiry.', 'Given expiry on 30 October, when the job runs on 30 September, then the SMS is sent.', ['GO-2.2'], 'Must', 'System'],
        ['FR-VER-001', 'Decision', 'The system shall allow the Assistant Director to approve or reject renewal within 15 days, with reasons for rejection.', 'Given a rejection without reasons, when submitted, then it is refused.', ['GO-2.3'], 'Must', 'Assistant Director'],
        ['FR-INS-001', 'Inspection', 'The system shall allow the field inspector to record an inspection report with geo-tagged photographs where the licence category requires inspection.', 'Given a category requiring inspection, when the report is missing, then approval is blocked.', ['GO-2.3'], 'Must', 'Field inspector'],
        ['FR-CRT-001', 'Renewed licence', 'The system shall issue the renewed licence as a digitally signed PDF with a QR code.', 'Given approval, when the licence is generated, then the QR code resolves to the verification page.', ['GO-2.1'], 'Must', 'System'],
        ['FR-RPT-001', 'Expiry report', 'The system shall list licences expiring in the next 60 days by district.', 'Given the report, when run, then licences are grouped by district.', ['GO-2.2'], 'Should', 'District officer'],
        ['FR-ADM-001', 'Licence category master', 'The system shall maintain licence categories with fee and inspection requirement.', 'Given a category update, when saved, then new applications use it.', ['GO-2.1'], 'Must', 'State administrator'],
        ['NFR-001', 'Audit trail', 'The system shall log every decision with user, time, IP address and values changed.', 'Given a decision, when queried, then the log entry exists.', ['STD-CERTIN'], 'Must'],
        ['NFR-002', 'Bilingual interface', 'The system shall provide all applicant screens in Hindi and English.', 'Given any screen, when switched, then labels change.', ['STD-GIGW'], 'Must'],
      ],
    ),
  ];
}
