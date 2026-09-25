# Aalekh FRS: GenAI-Assisted Requirements Engineering for a State IT Department

## 0. Instructions to Claude Code

Build a working, multi-page web application that a State IT Directorate could plausibly pilot. It will be demonstrated to senior IAS officers in 2 to 4 minutes, but it must hold up if they ask "what else can it do?" and click around.

The core idea: **this is a requirements engineering tool, not a text generator.** The app first builds a structured requirements model (sources, clauses, roles, workflow, data dictionary, business rules, permissions, integrations), and the FRS document is generated *from* that model. This is what makes the output consistent, traceable, testable and reusable, and it is what separates this from "ChatGPT writes an FRS".

How to work:
1. Read this whole file. Write a short `docs/PLAN.md` (routes, data model, build phases), then start building without waiting for confirmation.
2. Build in the phases in Section 12. Each phase must be fully working before the next: real logic, real data flow, loading/empty/error states. Commit after each phase.
3. Verify Sarvam API details against `https://docs.sarvam.ai/llms.txt` before implementing Section 9.
4. After each phase, run the app, take Playwright screenshots of pages touched, review them against Section 11, fix issues.
5. No placeholder text, no dead buttons, no "coming soon". If a control exists, it works.
6. Light theme only. No em dashes in UI copy.
7. `SARVAM_API_KEY` lives in `.env.local` and never reaches the browser.

Workspace rule: this project lives only in the aalekh-frs repository. Never create, modify or commit files in any other repository. If the working directory is not the aalekh-frs repository, stop and ask.

---

## 1. The problem, in the Directorate's terms

When a line department (Social Welfare, Revenue, Health) wants software, the IT Directorate receives a Government Order (GO), scheme guidelines, sometimes a corrigendum, meeting minutes, the existing paper application form, and verbal instructions, often partly in Hindi or the state language. A programmer manually writes the FRS. Real problems in that process, which the app must address one by one:

| # | Real problem | What the app does about it |
|---|---|---|
| P1 | Drafting takes 2 to 6 weeks and quality depends on who writes it | Structured model + standard template + generation from the model |
| P2 | GO clauses get missed; nobody can prove every mandate is covered | Clause-level indexing and a coverage check: every clause must be cited by a requirement or marked "not applicable" with a reason |
| P3 | Sources contradict each other (GO says 15 days, minutes say 10); corrigenda silently change rules | Source reconciliation: conflicts and supersessions detected and resolved before drafting |
| P4 | Requirements are vague ("system should be fast"), so vendors dispute scope | Ambiguity and testability checks; every FR needs acceptance criteria; measurable NFRs |
| P5 | Workflows and status transitions are described in prose, so developers guess | Workflow designer: explicit state machine with actors, conditions, SLAs, escalations, notifications |
| P6 | Field-level details (validations, masters, which documents from DigiLocker) are missing | Data dictionary generated from the paper form and sources, with PII classification |
| P7 | Eligibility rules are written as paragraphs and implemented wrongly | Business rules as decision tables with auto-generated boundary test cases |
| P8 | Who can do what, in which jurisdiction, is unclear | Role-permission matrix with jurisdiction scope and maker-checker |
| P9 | Mandatory standards (GIGW, DPDP Act, CERT-In, Aadhaar rules, Right to Service timelines) are forgotten | Compliance checklist per project type, with baseline NFRs and RTS timeline validation |
| P10 | Every project starts from scratch although 70% is common (login, e-KYC, SMS, DBT, MIS) | Reuse library from approved FRSs and a catalogue of standard e-Gov components |
| P11 | After approval, GO amendments and vendor change requests cause disputes and cost overruns | Baseline + change control: corrigendum impact analysis and vendor change-request scope check |
| P12 | Downstream documents (UAT test cases, RFP scope, effort estimate) are written again by hand | Generated from the same model, consistent with the FRS |

The demo must visibly show P2, P3, P5, P7, P9 and P11. These are what officers feel.

---

## 2. Users and roles (no authentication)

Persona switcher in the top-right menu (a dropdown, not login):
- **Author:** Ravi Kumar, Senior Systems Analyst, Directorate of IT (default)
- **Reviewer:** Anita Deshmukh, Joint Director (IT)
- **Approver:** S. Raghavan, Director (IT)

Persona changes which actions are available in Review and Change control. All names, the state ("Rajyapradesh") and GO numbers are fictional and set in `config/branding.ts`.

---

## 3. Functional modules

Each module lists: purpose, inputs, processing, outputs, and acceptance criteria. Priority: **P0** = required for the demo path, **P1** = required for a credible product, **P2** = include if time permits.

### F1. Source intake and clause indexing (P0)

**Purpose:** turn heterogeneous source material into citable clauses.

**Inputs:**
- GO, guidelines, corrigendum, minutes, existing SOP: PDF, DOCX, TXT, pasted text.
- Scanned paper application form (image or scanned PDF). See F5.
- Voice brief in Indian languages (Sarvam STT).
- Each source has metadata: type (GO, Corrigendum, Guideline, Minutes, Form, Voice brief, Other), reference number, date, issuing authority, language, and for a corrigendum, **which GO it amends**.

**Processing:**
- Text extraction (pdfjs, mammoth). Scanned documents go through Sarvam Document Intelligence (digitise job). If unavailable, show a clear error and let the user paste text.
- Clause segmentation: detect numbered paragraphs ("4.2", "Para 7", "(iii)", "Item 3"), headings, and tables. Fallback: paragraphs. Deterministic code first; only if fewer than 3 clauses are found, ask the LLM to segment and return clause boundaries as JSON.
- Clause IDs: `GO-4.2`, `COR1-2`, `GDL-3`, `MIN-3`, `FORM-12` (field), `VB-1`. IDs are stable once assigned.
- Non-English sources: store original text and an English translation per clause (Sarvam translate). Show both.
- Each clause gets an LLM-assigned **clause type**: Mandate (must be implemented), Rule (eligibility/calculation), Timeline (SLA), Role, Information only. Information-only clauses are excluded from coverage requirements but visible.

**Outputs:** `SourceDoc[]` with `SourceClause[]` (id, label, original text, English text, clause type).

**Acceptance:** the sample GO produces clauses GO-1 to GO-9.x with correct numbering; the Hindi voice brief shows Devanagari and English; clause types are editable by the user.

### F2. Source reconciliation (P0)

**Purpose:** resolve contradictions *before* drafting, because an FRS built on conflicting sources is wrong from day one.

**Processing (LLM, JSON):** compare Mandate, Rule and Timeline clauses across sources and detect:
- **Conflict:** two clauses state incompatible values (e.g. GO-5.1 "15 days" vs MIN-4 "10 days").
- **Supersession:** a corrigendum clause replaces an earlier clause (e.g. COR1-1 raises income limit from ₹2.5 lakh to ₹3 lakh, superseding GO-3.2). Use corrigendum metadata to link automatically.
- **Duplicate:** same mandate stated in two places (merge for coverage purposes).
- **Gap-by-reference:** a clause refers to something not provided ("as per the format in Annexure B" with no Annexure B).

**User action:** each finding needs a resolution before drafting: pick which clause prevails, enter a clarified value, or mark "to be clarified with department" (becomes an Open Issue). Resolutions are stored as `RES-n` records and are citable.

**Outputs:** `Reconciliation[]`; superseded clauses are shown struck through with a link to the superseding clause; downstream generation uses only effective clauses.

**Acceptance:** with the sample data the app detects exactly: one conflict (verification timeline GO-5.1 vs MIN-4), one supersession (income limit GO-3.2 by COR1-1), one gap-by-reference (GO-4.3 mentions "the prescribed format in Annexure A", not provided). Drafting is blocked with a clear message until they are resolved or deferred.

### F3. Requirements discovery (P0)

**Purpose:** extract a structured understanding and find what is missing.

**Processing:**
1. **Analyse (LLM, JSON):** objective, scope in/out, stakeholders and roles, channels (portal, mobile, CSC, offline), key entities, integrations mentioned, candidate modules. Every item cites clause IDs.
2. **Gap checklist (deterministic + LLM):** each project type has a checklist of topics a complete e-Gov FRS must cover. For "Citizen service with benefit disbursement" the checklist includes: application channels, assisted mode (CSC), identity verification, document sourcing, eligibility rules, verification hierarchy, SLA per stage, Right to Service timeline, escalation on SLA breach, rejection and re-application, appeal, payment method and failure handling, notifications, grievance, renewal, data retention, legacy data migration, MIS, audit. The LLM marks each topic Covered (with refs), Partial, or Missing.
3. **Clarifying questions (LLM, JSON):** generated only for Partial and Missing topics, 5 to 8 questions, each with why it matters, 2 to 4 suggested answers, and a default assumption. Never ask what sources already answer.
4. **Answers** are stored as `ANS-n` and are citable. Unanswered questions become recorded assumptions `ASM-n`, which appear in the FRS and must be confirmed in review.

**Stakeholder interview mode (P1):** generate a role-specific question set (e.g. for the District Social Welfare Officer: current volumes, pain points, reports they need), which the author can use in a meeting and record answers by typing or voice. Answers become a new source (`INT-n` clauses).

**Acceptance:** checklist shows at least "Payment failure handling", "Appeal against rejection" and "Legacy data migration" as Missing for the sample, with matching questions.

### F4. Workflow designer (P0)

**Purpose:** define the application lifecycle as an explicit state machine. This is the most useful artefact for developers and the clearest for officers.

**Processing:** LLM proposes (JSON) from sources, answers and resolutions:
- **States:** e.g. Draft, Submitted, Pending institution verification, Returned for correction, Pending district approval, Sanctioned, Rejected, Payment initiated, Paid, Payment failed, Closed.
- **Transitions:** from, to, action name, actor role, conditions (referencing business rules), SLA in working days, escalation (to whom, after how long), notification (channel, recipient, template text), refs.

**User can edit** states and transitions in a table; the diagram updates. Diagram: render with Mermaid `stateDiagram-v2` or a simple custom SVG layout; must be readable on a projector.

**Validation (deterministic):**
- Every non-terminal state has at least one outgoing transition; every state is reachable from Draft.
- Every human-action transition has an actor and SLA.
- **RTS check:** the sum of SLAs on the longest path from Submitted to Sanctioned is compared to the notified service timeline (from sources or answers). Show "Total 30 working days against notified 30 days: compliant" or a warning.
- Every rejection has a notification with reason.

**Outputs:** `Workflow` model. Generates FR-VER (workflow actions), FR-NOT (notifications per transition) and an escalation requirement automatically in F8.

**Acceptance:** sample workflow passes validation after the conflict resolution; changing an SLA from 15 to 20 days makes the RTS check fail with a clear warning.

### F5. Data dictionary from forms (P1, include in demo if stable)

**Purpose:** field-level specification, which is usually missing and causes most rework.

**Inputs:** the scanned paper application form (sample provided) plus sources.

**Processing:** Sarvam Document Intelligence digitises the form; LLM (JSON) produces per field: label (English and original), field name, data type, length, mandatory, validation rule, source of value (Applicant entry, Aadhaar e-KYC, DigiLocker, Master data, System generated), master list name (e.g. District, Category, Course), **PII classification** (Personal, Sensitive personal, Aadhaar, Financial, Non-personal), refs.

Deterministic enrichments:
- Standard validations library: mobile (10 digits, starts 6 to 9), PIN code (6 digits), IFSC (`^[A-Z]{4}0[A-Z0-9]{6}$`), Aadhaar (never stored in full; masked; vault reference), email, date not in future, etc.
- Fields sourced from Aadhaar e-KYC are marked read-only.
- Any field classified Aadhaar or Sensitive generates a PRIV requirement in F8 and a compliance check item.

**Outputs:** `DataEntity[]` with `Field[]`, `MasterList[]`.

**Acceptance:** sample form yields about 20 fields with sensible types; Aadhaar field is flagged and generates a masking/vault requirement.

### F6. Business rules as decision tables (P0)

**Purpose:** make eligibility and calculation rules unambiguous and testable.

**Processing:** LLM (JSON) converts Rule clauses (post-reconciliation, so the ₹3 lakh corrigendum value is used) into decision tables: conditions (attribute, operator, value, unit), outcome, refs. Example: Eligible if domicile = Rajyapradesh AND annual family income ≤ ₹3,00,000 AND course level ≥ post-matric AND (for renewal) attendance ≥ 75%.

**Deterministic test generation:** for each numeric condition generate boundary cases (at limit, just above, just below); for each boolean condition, true/false; combine into a compact set (not full cartesian). Each case has inputs and expected outcome, IDs `TC-BR-n`.

**Rule tester:** a small form where the user enters sample values and sees which rules pass or fail, with the reason. This is a strong live demo moment ("income ₹3,00,001: ineligible, rule BR-002, source COR1-1").

**Acceptance:** BR tests reflect the corrigendum value, not the original GO value.

### F7. Roles and permissions (P1)

**Purpose:** role-permission matrix, jurisdiction scope and segregation of duties.

**Processing:** derive roles from F3 and actions from F4 transitions plus standard actions (view, create, edit, approve, export, configure masters). LLM proposes; user edits a matrix grid (roles × actions, checkbox cells). Each role has a **jurisdiction scope** (State, District, Institution, Self).

**Deterministic checks:** maker-checker (same role cannot both verify and approve the same application); every workflow transition's actor has the permission; admin roles cannot act on applications.

**Output:** feeds FR-ADM requirements and the Roles section of the FRS.

### F8. FRS generation from the model (P0)

**Purpose:** produce the document from the structured model, with narrative where needed.

**Generation strategy:**
- **Assembled deterministically from the model:** Document control, Stakeholders and roles table, Workflow (state table and diagram), Data dictionary, Business rules and decision tables, Role-permission matrix, Traceability matrix, Assumptions, Open issues, Sign-off.
- **Generated by LLM:** Introduction, As-Is process, To-Be narrative, functional requirements per module, integration requirements, reports, NFRs.
- Functional requirements per module (JSON), each: `FR-<MOD>-<NNN>`, title, "The system shall..." description, actor, priority (Must, Should, Could, Won't), acceptance criteria (Given/When/Then), refs (clause IDs, ANS, RES, ASM, STD, or model artefacts like `WF-T5` transition, `BR-002`, `FLD-income`). Modules: REG, APP, DOC, VER, PAY, NOT, GRV, ADM, RPT; only relevant ones.
- **Auto-generated requirements from the model** (not by LLM free text, but templated then polished): one FR-NOT per notification in the workflow, one escalation FR per SLA, one FR-VER per workflow action, validation FRs per data entity, one FR per decision table.
- **Reuse library (P1):** before generating a module, retrieve similar approved requirements from the seeded approved FRSs (simple keyword/TF-IDF similarity is fine, no vector DB needed) and pass the top 5 as examples. In the UI, show "Similar approved requirement: FR-APP-011 in Online Building Plan Approval" with "Use this" to adopt and adapt it.
- **e-Gov component catalogue (P1):** a static catalogue (`data/catalogue.json`) of standard components with pre-written integration requirement templates and questions: Aadhaar e-KYC (via AUA/KUA), DigiLocker (pull documents via API Setu), PFMS DBT, SMS gateway, e-Sign (ESP), payment gateway, State SSO / Jan Parichay, UMANG, CSC Digital Seva, NIC email. When F3 detects an integration, its template is used, filled with project specifics.
- **NFR baseline** per project type from `data/nfr-baseline.json`, citing STD refs, values marked "Proposed, to be confirmed" when not in sources: availability 99.5% monthly, response under 3 seconds at stated concurrency, GIGW 3.0 and WCAG 2.1 AA, bilingual UI, audit trail (user, time, IP, before/after values), Aadhaar masking and Data Vault, DPDP notice/consent/retention/erasure, backups with RPO/RTO, CERT-In 6-hour incident reporting and 180-day log retention, security audit by a CERT-In empanelled auditor before go-live, hosting in India.
- Post-processing: dedupe IDs, validate every ref exists (invalid refs dropped and raised as issues), enforce "shall" and acceptance criteria presence.

**Acceptance:** generated FRS for the sample has roughly 50 to 80 requirements; every FR has at least one valid ref; regenerating one module does not change IDs of other modules.

### F9. Quality and compliance engine (P0)

**Deterministic checks (instant, run on every change):**
- Ambiguous terms from `data/ambiguous-terms.json` (fast, quickly, user-friendly, easy, adequate, appropriate, etc., as soon as possible, minimal, robust, seamless, and similar).
- FR without acceptance criteria; FR without refs; duplicate or near-duplicate titles.
- **Coverage:** every effective Mandate/Rule/Timeline clause must be cited by at least one requirement or marked Not applicable with a reason.
- Workflow validation results (F4) and permission checks (F7).
- Compliance checklist per project type: each item is satisfied when a requirement with a matching STD ref or NFR category exists.
- Open assumptions not yet confirmed.

**LLM checks (on demand, "Run full review"):** conflicting requirements, untestable statements, missing exception flows, requirements that contradict an effective clause.

**Score:** computed in code from issues, not by the LLM, so it is stable and explainable: Completeness 25, Clarity 20, Testability 20, Traceability 20, Compliance 15. Show the formula on hover.

**Fix actions:** each issue has "Fix" (LLM proposes a change shown as a tracked change for accept/reject), "Draft requirement" for coverage gaps, or "Mark not applicable" with a reason.

**Acceptance:** with recorded data, the sample shows GO-7.3 (grievance resolution in 7 working days) uncovered, one ambiguity ("quickly") and one missing exception flow (DBT payment failure). Fixing all three raises the score visibly.

### F10. Downstream artefacts (P1, show one in the demo)

Generated from the same model so they stay consistent with the FRS:
- **UAT test cases:** per FR from its acceptance criteria, plus decision-table boundary tests from F6 and workflow path tests from F4 (happy path, rejection, return for correction, SLA breach escalation, payment failure). Columns: TC ID, Req ID, precondition, steps, test data, expected result. Export to Excel.
- **RFP scope annexure:** Scope of Work (modules and features from FRs), Functional requirements annexure (FR table), SLA and service levels (from NFRs), deliverables and acceptance (UAT, security audit, GIGW compliance certificate), assumptions. Export to Word. This is valuable because RFPs are usually written separately and drift from the FRS.
- **Screen inventory:** list of screens derived from roles × workflow actions × entities (e.g. "District officer: pending approvals list", "Application detail with approve/reject"), with the FRs each screen serves.
- **Indicative size estimate:** transparent counting method: screens, entities, integrations, reports, workflow transitions, each with an editable weight, giving complexity points and an indicative person-month range with an editable productivity factor. Clearly labelled "Indicative, for planning only". Never presented as a quote.

### F11. Baseline and change control (P0 for the demo, this is the officer-facing differentiator)

**Baseline:** on approval, the FRS is frozen as a baseline (v1.0). Later edits create a new draft version with a diff.

**Corrigendum impact analysis:** when a new source of type Corrigendum is added to a baselined project:
1. F2 detects superseded clauses.
2. Impact analysis (deterministic via refs + LLM for semantic matches): list every requirement, business rule, test case, data field and workflow transition that cites or depends on the superseded clause.
3. For each, the LLM proposes an updated version (tracked change).
4. Generate a **change note** (Word): reference to the corrigendum, affected items, proposed changes, impact on timeline/effort (qualitative), for approval.

**Vendor change-request scope check:** paste or upload a vendor CR (text). The app:
1. Splits it into individual asks.
2. For each ask, retrieves matching baseline requirements (similarity + LLM judgement, JSON).
3. Classifies: **Already in scope** (cites FR IDs and quotes the acceptance criteria, so no additional cost is justified), **Clarification of existing scope** (cites FR IDs), **New scope** (no matching requirement; potential genuine CR), with reasoning.
4. Produces a one-page CR assessment note for the file.

This directly addresses how vendors exploit vague FRSs. It is a strong closing moment for officers.

**Acceptance:** sample CR "Add SMS alerts to applicants at each stage of application processing, estimated 25 person-days" is classified Already in scope, citing FR-NOT requirements generated from the workflow and GO-7.2. Another ask "Integrate with the Income Tax department API for income verification" is classified New scope.

### F12. Review and approval (P1)

- Author submits version for review with a note; reviewer adds notes (file-noting style, chronological, with name, designation, time), comments on specific requirements, requests changes or forwards; approver approves, which creates the baseline.
- Reviewer comments on a requirement can be sent to "Propose fix" which produces a tracked change for the author.
- Version history with diff (added, modified, removed requirements; changed model artefacts).
- Every mutation writes an activity log event (user, time, project, action, target).

### F13. Export (P0: Word; P1: others)

- **FRS Word document** (`docx`): cover page (state, department, title, project, file number, version, date), version history, table of contents, all sections, requirement tables (ID, requirement with acceptance criteria, priority, source), workflow table (and diagram as PNG if feasible), data dictionary, decision tables, permission matrix, traceability appendix, sign-off block, DRAFT marking until approved. Nirmala UI for Devanagari runs.
- **Hindi version** via Sarvam translation, preserving IDs and acronyms.
- **Excel:** traceability matrix, coverage sheet, UAT test cases, data dictionary.
- **Change note** and **CR assessment note** (Word).
- **Markdown** copy.

---

## 4. Pages (functional mapping; keep layouts simple and consistent)

| Route | Purpose | Modules |
|---|---|---|
| `/` | Dashboard: projects by status, items needing attention (unresolved conflicts, uncovered clauses, reviews pending, CRs to assess), recent activity | all |
| `/projects` | Project list with status, version, requirement count, quality score, owner | |
| `/projects/new` | Create project: details, project type (drives checklist, template, NFR baseline), add sources | F1 |
| `/projects/[id]` | Overview: lifecycle stage, next action, model completeness (which artefacts exist), key counts | |
| `/projects/[id]/sources` | Sources, clause viewer (original + English), clause types, coverage markers | F1 |
| `/projects/[id]/reconcile` | Conflicts, supersessions, gaps by reference, with resolutions | F2 |
| `/projects/[id]/discovery` | Analysis, gap checklist, clarifying questions, assumptions, interview mode | F3 |
| `/projects/[id]/workflow` | State machine table + diagram + validation + RTS check | F4 |
| `/projects/[id]/data` | Data dictionary, masters, PII classification | F5 |
| `/projects/[id]/rules` | Decision tables, generated boundary tests, rule tester | F6 |
| `/projects/[id]/roles` | Role-permission matrix, jurisdiction, checks | F7 |
| `/projects/[id]/document` | FRS document view and editor with references, tracked changes, reuse suggestions | F8 |
| `/projects/[id]/quality` | Score, issues, coverage, compliance checklist | F9 |
| `/projects/[id]/deliverables` | Test cases, RFP annexure, screen inventory, size estimate | F10 |
| `/projects/[id]/changes` | Baseline, corrigendum impact, vendor CR scope check | F11 |
| `/projects/[id]/review` | Noting, comments, versions, diff, approval | F12 |
| `/projects/[id]/export` | All exports | F13 |
| `/library` | Reuse library (requirements from approved FRSs, searchable) and e-Gov component catalogue | F8 |
| `/standards` | Compliance checklists per standard and project type (editable), ambiguous-terms list, NFR baselines | F9 |
| `/activity` | Audit log across projects | F12 |
| `/settings` | AI engine (model, reasoning per task, connection test), branding, recorded-response mode, reset sample data | |

Inside a project, group the tabs in the sub-navigation as: **Inputs** (Sources, Reconcile, Discovery), **Model** (Workflow, Data, Rules, Roles), **Output** (Document, Quality, Deliverables), **Govern** (Review, Changes, Export). The overview page shows a guided "next step" so the user always knows what to do.

Model-first rule: every artefact page shows its source refs, and editing any artefact marks dependent FRS sections as "Out of date, regenerate" (dependency tracking via refs).

---

## 5. Data model (`lib/types.ts`, zod in `lib/schemas.ts`)

```ts
type Ref = string; // "GO-4.2" | "ANS-3" | "RES-1" | "ASM-2" | "STD-DPDP" | "WF-T5" | "BR-002" | "FLD-income" | "INT-4"

type SourceDoc = { id; name; kind: 'GO'|'Corrigendum'|'Guideline'|'Minutes'|'Form'|'VoiceBrief'|'Interview'|'Other';
  refNo?; date?; authority?; language; amends?: string /* docId */; clauses: SourceClause[] };
type SourceClause = { id; docId; label; original: string; english: string;
  type: 'Mandate'|'Rule'|'Timeline'|'Role'|'Info'; supersededBy?: Ref; notApplicable?: { reason: string } };

type Reconciliation = { id; kind: 'Conflict'|'Supersession'|'Duplicate'|'MissingReference';
  clauses: Ref[]; description; resolution?: { type: 'Prevails'|'ClarifiedValue'|'Deferred'; prevailing?: Ref; value?: string; note?: string; by; at } };

type Discovery = { objective; scopeIn; scopeOut; roles: Role[]; channels; entities; integrations; modules;
  checklist: { topic; status: 'Covered'|'Partial'|'Missing'; refs: Ref[] }[] };
type Question = { id; topic; question; whyItMatters; suggestedAnswers: string[]; defaultAssumption; answer?; assumed?: boolean };

type Workflow = { states: { id; name; terminal: boolean }[];
  transitions: { id /* WF-Tn */; from; to; action; actor; conditions: Ref[]; slaDays?: number;
    escalation?: { afterDays: number; to: string }; notification?: { channel: 'SMS'|'Email'|'In-app'; recipient; template }; refs: Ref[] }[];
  rtsDays?: number };

type DataEntity = { id; name; fields: Field[] };
type Field = { id /* FLD-x */; label; labelOriginal?; name; type; length?; mandatory: boolean; validation?;
  valueSource: 'Applicant'|'Aadhaar eKYC'|'DigiLocker'|'Master'|'System'; masterList?; pii: 'Personal'|'Sensitive'|'Aadhaar'|'Financial'|'None'; refs: Ref[] };

type DecisionTable = { id /* BR-nnn */; name; conditions: { attribute; operator; value; unit? }[]; outcome; refs: Ref[]; tests: TestCase[] };
type PermissionMatrix = { roles: { id; name; jurisdiction: 'State'|'District'|'Institution'|'Self' }[]; actions: string[]; grants: Record<string, string[]> };

type Requirement = { id; kind: 'FR'|'NFR'|'IR'|'RPT'; module; title; description; actor?; priority; acceptanceCriteria: string[];
  refs: Ref[]; origin: 'Generated'|'FromModel'|'Reused'|'Manual'; reusedFrom?: string; status: 'Draft'|'Reviewed'|'Approved' };

type Issue = { id; severity; type; message; targetIds: string[]; suggestion; status: 'Open'|'Fixed'|'Dismissed' };
type TestCase = { id; reqId; precondition; steps: string[]; data: Record<string, string>; expected };
type Baseline = { version; approvedBy; approvedAt; snapshot: ModelSnapshot };
type ImpactAnalysis = { id; corrigendumDocId; affected: { targetId; kind; reason; proposedChange }[]; status };
type CrAssessment = { id; title; vendorText; items: { ask; classification: 'In scope'|'Clarification'|'New scope'; matchedReqs: string[]; reasoning }[] };
```
Traceability, coverage, scores and "out of date" flags are **derived** with selectors, never stored.

Persistence: zustand + localStorage behind a repository layer (`lib/repo/`) so a backend can replace it. Every repo write appends an activity event.

---

## 6. Sample and seed data (`data/`)

Everything is fictional, specific and internally consistent. State: Rajyapradesh.

**Live demo project: State Post-Matric Scholarship Portal** (Social Welfare, file IT/SW/2026/0142, type "Citizen service with benefit disbursement"). Ships with sources only:
- `go_scholarship.txt` (and a generated PDF): GO No. SW/2026/SCH/118, 14 Aug 2026. Paragraphs: 1 Background (paper process, 6 to 9 month delays). 2 Objective. 3 Eligibility: 3.1 domicile, 3.2 family income up to ₹2.5 lakh p.a., 3.3 post-matric course in a recognised institution, 3.4 renewal requires 75% attendance. 4 Application: 4.1 portal and CSCs, 4.2 Aadhaar e-KYC mandatory, 4.3 caste and income certificates from DigiLocker where available, else upload "in the prescribed format in Annexure A" (Annexure A not provided). 5 Verification: 5.1 institution nodal officer within 15 days, 5.2 District Social Welfare Officer within 15 days, 5.3 reasons recorded for rejection. 6 Disbursement: 6.1 PFMS DBT to Aadhaar-seeded account, 6.2 single instalment by 31 March. 7 Grievance: 7.1 online grievance, 7.2 SMS at every stage, 7.3 grievances resolved within 7 working days. 8 MIS: 8.1 district dashboard, 8.2 monthly report to the Principal Secretary. 9 Service timeline: sanction within 30 working days of submission under the Rajyapradesh Right to Service Act. 10 Data protection: data used only for the scheme.
- `corrigendum_1.txt`: No. SW/2026/SCH/118-A, 2 Sep 2026, amends GO para 3.2: income limit raised to ₹3 lakh p.a.
- `minutes_kickoff.txt`: 5 items incl. item 4 "institution verification to be completed within 10 days" (conflicts with GO-5.1), CSC operators apply on behalf of students, renewals reuse verified documents, Hindi and English interface, works on low-end Android phones.
- `voice_brief_hi.txt` (+ optional audio): Hindi brief about mobile application, a district dashboard of pending applications, SMS with rejection reason and one chance to reapply; with English translation.
- `application_form.png`: a scanned-looking paper application form (generate it at build time: render an HTML form with a Playwright script to PNG, slightly greyed). About 20 fields: name, father's name, DOB, gender, category, Aadhaar number, mobile, address, district, PIN, institution, course, year, annual family income, bank account, IFSC, previous year attendance, declaration.
- `vendor_cr_07.txt`: a vendor change request with 3 asks: (a) SMS alerts at every stage, 25 person-days (in scope); (b) district-wise pending dashboard, 15 person-days (in scope, FR-RPT); (c) integration with Income Tax department API for income verification, 40 person-days (new scope).

- `corrigendum_2.txt`: No. SW/2026/SCH/118-B, 20 Sep 2026, amends GO para 7.3: grievances to be resolved within 5 working days. **Not loaded at start.** It is added after approval during the demo to trigger the corrigendum impact analysis (F11). COR1 is present from the start so reconciliation (F2) has a supersession to show before drafting.

**Seeded mature projects** (so the library, dashboard and reuse have content): Online Building Plan Approval (Approved, v1.0, full model and FRS, about 60 requirements), Public Grievance Redressal System (In review, v0.3, full model, reviewer notes), plus 5 lighter projects (e-Stamp Duty Refund, Mid-Day Meal MIS, Hospital Bed Dashboard, Mandi Price App, Fisheries Licence Renewal) with metadata and 10 to 15 requirements each. Author the full content in seed JSON; do not generate it at runtime.

**Static reference data:** `catalogue.json` (e-Gov components with integration requirement templates), `nfr-baseline.json` (per project type), `checklists.json` (gap checklist and compliance checklist per project type), `ambiguous-terms.json`, `validations.json` (standard field validations), `templates.json` (FRS section structures per project type).

---

## 7. AI pipeline summary

| Step | Module | Mode | Reasoning |
|---|---|---|---|
| Clause segmentation fallback, clause typing | F1 | JSON | off |
| Translation of non-English clauses | F1 | Translate API | n/a |
| Reconciliation | F2 | JSON | low |
| Discovery + checklist | F3 | JSON | low |
| Questions | F3 | JSON | low |
| Workflow proposal | F4 | JSON | low |
| Form digitisation + field extraction | F5 | Doc Intelligence + JSON | off |
| Decision tables | F6 | JSON | low |
| Permission proposal | F7 | JSON | off |
| Narrative sections | F8 | stream | off |
| Requirements per module (with reuse examples) | F8 | JSON | off |
| Semantic quality review | F9 | JSON | low |
| Fix / draft for clause / propose fix from comment | F9, F12 | JSON | off |
| Test cases, RFP annexure | F10 | JSON / stream | off |
| Impact analysis, CR scope check | F11 | JSON | low |
| Hindi FRS | F13 | Translate API | n/a |

Everything not in this table is deterministic code. Prefer code over LLM wherever the logic is rule-based (validation, coverage, scoring, test boundaries, RTS sum, permission checks, dependency tracking).

**Base system prompt** (prepend to all LLM calls):
```
You are a senior Business Analyst in a State Government IT Department in India, expert in e-Governance projects, ISO/IEC/IEEE 29148 requirements engineering and Government of India standards (GIGW 3.0, DPDP Act 2023, CERT-In directions, Aadhaar Act and UIDAI guidelines, MeitY e-Gov standards, Right to Service Acts).
Rules:
- Use only facts in the provided SOURCES, RESOLUTIONS, ANSWERS and MODEL. Never invent amounts, dates, GO numbers, names or limits.
- Superseded clauses are shown for context only; always use the effective clause.
- If information is missing, record an assumption or open issue instead of guessing.
- Every output item cites at least one valid reference ID from the provided lists.
- Formal, plain Indian government English. "Shall" for mandatory requirements.
- Never use ambiguous terms; state measurable values.
- Output exactly the requested JSON schema.
```
Context passed as labelled blocks: `SOURCES` (effective clauses as `[GO-4.2] (Timeline) text`), `RESOLUTIONS`, `ANSWERS`, `ASSUMPTIONS`, `MODEL` (compact JSON of the relevant artefacts only), `EXAMPLES` (reuse library matches). Keep each call focused; do not send the whole project when only one module is needed.

Put each prompt in `lib/ai/prompts/<step>.ts` with its zod schema and a JSON schema for `response_format`.

---

## 8. Recorded responses (demo reliability)

- `npm run record` runs the whole sample pipeline against the live Sarvam API and saves responses to `data/recorded/scholarship/`. Commit them.
- Settings toggle "Use recorded responses for sample projects" (default on). Recorded mode replays with realistic timing (staged progress, streamed text) and is indistinguishable in the UI.
- Live failures fall back silently to recordings where they exist.
- The recordings must produce the exact findings listed in the acceptance criteria of F2, F3, F9 and F11. If the live model does not produce one of them, adjust the recording by hand so the demo is deterministic, and note that in `data/recorded/README.md`.
- `Shift+R` resets the sample project; `Shift+P` opens presenter notes.

---

## 9. Sarvam AI integration

Verify against current docs before building.
- Chat: `POST https://api.sarvam.ai/v1/chat/completions`, header `api-subscription-key`, model `sarvam-105b` (128K context), optional `sarvam-30b`. `sarvam-m` is deprecated; do not use.
- `max_tokens` defaults to 2048; set 4000 to 8000 for generation calls.
- Reasoning is on by default and costs latency and tokens; set per task as in Section 7 (`reasoning_effort: "low"` or `null`). Ignore `reasoning_content` in output.
- Structured outputs: `response_format: { type: "json_schema", json_schema }`, then zod-validate; retry once with a correction message on failure.
- Speech to text: `POST https://api.sarvam.ai/speech-to-text`, model `saaras:v3`, transcribe then translate.
- Text translation API for clause translation and Hindi FRS (chunked, IDs and acronyms preserved).
- Document Intelligence (async job: create, upload, start, poll, download) for scanned forms and PDFs.
- Client helpers in `lib/ai/sarvam.ts`: `chatJSON`, `chatStream`, `translate`, `transcribe`, `digitise`; 60s timeout; retry once on 429/5xx; errors mapped to plain-language messages.
- All calls through Next.js route handlers under `app/api/`.

---

## 10. Tech stack

Next.js 14+ (App Router, TypeScript strict), Tailwind with semantic tokens, shadcn/ui (restyled), TanStack Table, zustand + persist, zod, pdfjs-dist, mammoth, docx, exceljs, mermaid (workflow diagram), cmdk (Ctrl+K search across projects, requirement IDs and clauses), sonner, lucide-react, Playwright.

---

## 11. UI standards (brief; function comes first)

- Light theme. Neutral grey app background `#F3F4F6`, white panels, borders `#E2E5E9`, text `#16202E` / `#4A5565`, primary navy `#1D3F6E`, success `#1F7A4D`, warning `#A86A12`, danger `#B3362D`, clause highlight `#FFF1B8`, review/noting panels pale green `#EEF5EA`.
- IBM Plex Sans + IBM Plex Sans Devanagari for UI; Source Serif 4 + Noto Serif Devanagari for the FRS document view.
- Left sidebar, top bar with search and persona menu, breadcrumbs, project sub-navigation grouped as in Section 4.
- Dense, readable tables; forms with labels above fields; sentence case; no all-caps labels.
- Every page: loading (skeletons), empty (one sentence + one action), error (what happened + how to fix).
- References everywhere are clickable tags (`GO 4.2`) that open the clause in a side panel with highlight.
- AI-proposed changes always appear as tracked changes (strikethrough red, underline green) with Accept/Reject. Nothing is silently overwritten.
- Avoid: gradients, glassmorphism, emoji, sparkle "AI" icons, chat-bubble UI, identical card grids as the main layout, default shadcn look, lorem ipsum.
- Readable at 1366x768 on a projector; keyboard accessible; AA contrast.
- No State Emblem or real government logos; a simple monogram mark.

---

## 12. Build phases

1. Scaffold, shell, tokens, restyled primitives, repo layer, types and schemas, seed and reference data loaded.
2. F1 Sources: upload, extraction, clause segmentation, typing, translation, viewer.
3. Sarvam client + recorded-response infrastructure.
4. F2 Reconciliation.
5. F3 Discovery, checklist, questions, assumptions.
6. F4 Workflow designer with validation and RTS check.
7. F6 Decision tables, boundary tests, rule tester.
8. F8 FRS generation (model-assembled + LLM sections), document view, references, tracked changes.
9. F9 Quality engine, coverage, compliance, fixes.
10. F12 Review, versions, baseline; F11 corrigendum impact and CR scope check.
11. F13 Exports (Word, Hindi, Excel, change note, CR note).
12. F5 Data dictionary from form, F7 Roles, F10 deliverables, library page.
13. Dashboard, projects list, overview guided next step, activity, standards, settings.
14. Record responses, end-to-end Playwright test of the demo path, screenshot review, README.

---

## 13. Demo path (build and test this exact flow)

Target 3 to 4 minutes. Each step shows a real function, not a screen.

1. **Dashboard (10s):** items needing attention across 8 projects.
2. **Scholarship project, Sources (20s):** GO, corrigendum, minutes, Hindi voice brief, scanned form; open a clause to show original and English.
3. **Reconcile (25s):** app found the income limit superseded by the corrigendum, the 15 vs 10 day conflict, and the missing Annexure A. Resolve the conflict (GO prevails), defer Annexure A as an open issue.
4. **Discovery (20s):** checklist shows missing payment-failure handling and appeals; answer two questions.
5. **Workflow and rules (35s):** state machine with SLAs and escalations; RTS check "30 of 30 working days: compliant". Rule tester: income ₹3,00,001, ineligible, BR-002, source COR1-1.
6. **Generate FRS (35s):** document builds from the model; click `GO 4.2` to see the clause; show a reused requirement from Building Plan Approval.
7. **Quality (25s):** GO 7.3 uncovered: draft requirement; ambiguity fixed via tracked change; score rises.
8. **Approve and change control (40s):** approve as Director (baseline v1.0). Add corrigendum 2 (grievance 7 to 5 days): impact analysis lists affected FR, test cases and workflow SLA with proposed changes. Paste vendor CR: two asks "Already in scope" citing FR IDs, one "New scope".
9. **Export (10s):** Word FRS, UAT test cases in Excel.

Playwright test `e2e/demo-path.spec.ts` runs this with recorded responses and asserts each finding appears.

Presenter notes (`Shift+P`): every requirement traces to its source; conflicts are resolved before drafting, not discovered by the vendor; workflows and rules are testable, not prose; compliance and Right to Service timelines are checked automatically; change requests are assessed against the baseline; runs on Sarvam, an Indian sovereign AI provider, deployable on the State Data Centre with open-weight models; next step is a pilot on two live projects measuring drafting time and change-request reduction.

---

## 14. Definition of done

- [ ] All P0 modules work end to end, live and with recorded responses, including with the network off.
- [ ] Acceptance criteria in F2, F3, F4, F6, F8, F9 and F11 are met by the sample.
- [ ] Every requirement has valid refs; every effective Mandate/Rule/Timeline clause is covered or marked not applicable after fixes.
- [ ] Editing a workflow SLA or a rule marks dependent requirements and tests out of date.
- [ ] Word and Excel exports open cleanly in MS Office and LibreOffice; Hindi renders.
- [ ] No dead buttons, placeholders, console errors or dark mode. API key absent from the client bundle.
- [ ] Demo-path Playwright test passes.
