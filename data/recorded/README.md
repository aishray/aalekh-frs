# Recorded responses

`scholarship/` holds the responses replayed for the sample project (State Post-Matric Scholarship Portal) when
"Use recorded responses for sample projects" is on (the default). `index.ts` is generated from these files by
`npm run index-recordings` and bundles them into the server build.

`_live/scholarship/` holds the raw captures from `npm run record` (25 September 2026, `sarvam-105b` and
`sarvam-105b-conversations`, reasoning off): the live response, model, latency, token usage and the exact
request blocks the app sent. They are kept as evidence and are not replayed.

## How recordings were made

`npm run record` runs the demo path (`e2e/demo-path.e2e.ts`) against a production build in recorded mode, so the
project state evolves exactly as in the demo, while the server sends each identical prompt to Sarvam and saves the
live answer. Each capture was then checked against the acceptance criteria in CLAUDE.md (F2, F3, F4, F6, F8, F9,
F11) and against the IDs later steps depend on (RES-2, ANS-1, WF-T3, BR-002, FR-NOT-001, FR-GRV-004).

Files whose JSON has `"provenance": "live"` are unmodified live responses. All other files are hand-authored
(written before live access was available) and were kept because the live answer did not meet a criterion, or
because later recordings and the demo script depend on their exact content. The live pipeline is exercised on
every call for new projects; these recordings only make the demo deterministic.

## Step by step

| Recording | Source | Why |
|---|---|---|
| `reconcile` | Live | With the tightened prompt the model returned the GO-5.1 / MIN-4 conflict, the COR1-1 supersession, the Annexure A gap, and a spurious "conflict" on GO-3.2 / COR1-1. The reconciliation engine drops AI findings on a pair already linked as a corrigendum supersession, so the demo shows exactly the three F2 findings. Across four live runs the conflict was found three times; runs also added extra conflicts or duplicates, which a user resolves or defers. |
| `discovery` | Hand-authored | The live capture meets F3 (payment failure handling, appeal against rejection and legacy data migration all Missing), but its role names differ in case ("Institution Nodal Officer") from the workflow and permission recordings, so the hand-authored version is kept for consistency. |
| `questions` | Hand-authored | The live capture asks about all three missing topics (F3 met), but with different suggested answers; the demo answers "Notify the student by SMS to correct bank details" (ANS-1) and "Appeal to the Director, Social Welfare within 30 days" (ANS-2), which the workflow (appeal states) and requirements recordings cite. |
| `workflow` | Hand-authored | The first live capture put SLAs on automatic steps, had no escalations and mixed grievance states into the application lifecycle (F4 validation fails). The prompt was tightened and SLAs on System and Applicant steps are now cleared in code; a replay then produced a valid state machine with escalations and payment retry, but with different transition numbering from the demo's WF-T3 and appeal states. |
| `rules` | Hand-authored | The first live capture used `= 300000` for the income limit and an empty domicile rule (F6 fails). After the prompt fix a replay returned `<= 300000 INR` citing COR1-1 and `>= 75 %` for renewal, which meets F6, but with different condition labels from the rule tester fields in the demo. |
| `requirements.*` | Hand-authored | The first live captures returned 198 module requirements (72 in NOT alone) that restated model-derived notifications and cited GO-7.3, so F8 (50 to 80 requirements) and F9 (GO-7.3 uncovered) failed. The prompt now caps each module at 8 and forbids restating model-derived requirements; replays returned 5 (NOT) and 7 (APP). The demo recordings keep FR-GRV-001 with "quickly" and leave GO-7.3 uncovered on purpose, so the quality demo (F9) has the three findings to fix. |
| `narrative.introduction`, `narrative.asis`, `narrative.tobe` | Live | Streamed text from `sarvam-105b`, 2 to 5 s each, citing clause IDs in the same `[GO-4.1]` form the document view links. |
| `fix.AMB-FR-GRV-001-quickly` | Live | Replaced "quickly" with a measurable 24 hours (F9). |
| `fix.REV-1` | Live | Drafted the DBT payment failure flow (record reason, SMS to correct bank details within 30 days, next weekly batch), consistent with ANS-1 (F9). |
| `fix.COV-GO-7.3` | Hand-authored | The live draft covered GO-7.3 but its description did not start with "The system shall" and its module was not a project module. |
| `review` | Hand-authored | The live review raised seven plausible issues but not the DBT payment failure exception flow that F9 requires. |
| `cr` | Hand-authored | The live assessment classified the SMS ask correctly as In scope citing FR-NOT-001, but returned only one of the three asks (F11 needs 2 In scope and 1 New scope). |
| `impact.COR2` | Hand-authored | The live call failed schema validation twice (149 s); the recording lists FR-GRV-004, TC-FR-GRV-004-1 and the 5-day change (F11). |
| `fields`, `permissions` | Hand-authored | Live captures succeeded (13 s and 2 s); kept for the exact field IDs (FLD-aadhaarNumber) and role labels the demo and later recordings use. |
| `classify` | Hand-authored | Imported by the seed to type the sample clauses; kept so clause types stay stable. The live capture succeeded (0.5 s). |
| `interview`, `translate`, `digitise.application_form` | Hand-authored | Not on the timed demo path. Document Intelligence and translation were verified live with `npm run sarvam:check`. |

Promote a capture with `npm run record -- --promote <name>`.
