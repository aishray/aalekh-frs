# Aalekh FRS

GenAI-assisted requirements engineering for a State IT Directorate. The app builds a structured requirements model from the Government Order, corrigenda, minutes, voice briefs and paper forms (sources, clauses, reconciliations, workflow, data dictionary, decision tables, permissions), then generates the Functional Requirements Specification from that model. Every requirement traces to a clause, and every mandate is covered or marked not applicable.

All names, the state (Rajyapradesh), departments and GO numbers are fictional.

## Run it

```bash
npm ci
cp .env.local.example .env.local   # add SARVAM_API_KEY
npm run dev                        # http://localhost:3100
```

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Next.js on port 3100 |
| `npm run typecheck`, `npm run lint`, `npm run unit` | TypeScript, ESLint, Vitest unit tests for the deterministic engines |
| `npm run e2e` | Playwright demo-path test (`e2e/demo-path.e2e.ts`) against `npm start` with recorded responses |
| `npm run sarvam:check` | One small live call to each Sarvam API used (chat on both models, speech to text, translation, Document Intelligence); prints result, latency and model |
| `npm run record` | Runs the demo path with live capture and saves real Sarvam responses to `data/recorded/_live/` (see below) |
| `npm run index-recordings` | Regenerates `data/recorded/index.ts` (runs automatically before `dev` and `build`) |

Behind an HTTPS proxy, Node's built-in `fetch` needs `NODE_USE_ENV_PROXY=1` (Node 22.21 or later) for the Sarvam calls in `sarvam:check`, `record` and the local server.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `SARVAM_API_KEY` | `.env.local`, or the Vercel project settings | Sarvam API subscription key. Server only; it never reaches the browser. The same key covers chat, speech, translation and Document Intelligence. |
| `AI_RATE_LIMIT`, `AI_RATE_WINDOW_MIN` | optional | Live AI calls allowed per client IP per window (default 30 per 10 minutes). |
| `SARVAM_BASE_URL` | optional | Override the API host, for example a self-hosted deployment. |

## Sarvam AI

Verified against https://docs.sarvam.ai in September 2026. The task to model mapping is in `lib/ai/models.ts`; the client is `lib/ai/sarvam.ts`; every call goes through a route handler under `app/api/ai/`.

| Use | Model or API |
|---|---|
| Reconciliation, discovery, questions, workflow, decision tables, requirements, narrative, review, impact analysis, CR scope check | `sarvam-105b` (128K context) |
| Clause typing, short fixes and rewrites, permission proposal, interview questions | `sarvam-105b-conversations` (32K context, lower latency). `sarvam-30b` and `sarvam-m` are deprecated. |
| Voice briefs | Speech to text `saaras:v3`, then text translation |
| Clause translation, Hindi FRS | Text translation `sarvam-translate:v1`, formal mode, 2000 characters per call; IDs and acronyms protected with `{n}` placeholders |
| Scanned forms and PDFs | Document Intelligence (Sarvam Vision), `POST /doc-ai/v1/job/digitise`, poll status, read results |

Structured output uses `response_format: json_schema` and zod validation, with one corrective retry. Every call logs one JSON line with the task, model, latency and token usage.

**Reasoning is off by default.** CLAUDE.md section 7 asks for low reasoning on analysis tasks, but on `sarvam-105b` the reasoning trace for the reconcile prompt ran to 16,000 tokens (235 seconds) without an answer, beyond the 300 second function limit. Rule-based findings (supersession by corrigenda, missing annexures, coverage, RTS timelines, permissions) are computed in code, and the model handles the semantic part. Reasoning can be switched on per task in Settings for local use.

## Recorded responses

The sample project (State Post-Matric Scholarship Portal) replays recorded responses by default (Settings, "Use recorded responses for sample projects"), so the demo is deterministic and works offline. New projects always run live. If a live call fails for the sample project, the recording is used.

`npm run record` builds the app, starts it with `AI_CAPTURE_DIR`, and runs the Playwright demo path in recorded mode. For each AI request the server also sends the identical prompt to Sarvam and writes the live response, model, latency, tokens and request to `data/recorded/_live/scholarship/`. Captures are promoted into `data/recorded/scholarship/` with `npm run record -- --promote <name>...`. `data/recorded/README.md` lists which recordings are live and which were adjusted by hand to meet the acceptance criteria, and why.

## Deploying on Vercel

- Set `SARVAM_API_KEY` in the project's environment variables. No other setting is needed.
- Recordings, seed and reference data are static imports, so they are bundled into the functions.
- Every AI route runs on Node.js with `maxDuration = 300` (the Hobby plan maximum with Fluid compute). Long steps are split into one call per module or section, and narrative sections stream.
- Live AI routes are rate limited per IP (30 calls per 10 minutes, counted in the function instance) and input size is capped (256 KB JSON, 4 MB files, 60,000 characters per translation request), so a public link cannot exhaust credits. Recorded replays are free.
- `GET /api/ai/status` reports whether the key is configured; `POST /api/ai/status` makes one tiny call to each chat model and reports the result.

## Demo path

Runs in 3 to 4 minutes; `e2e/demo-path.e2e.ts` automates it and asserts each finding.

1. Dashboard: items needing attention across 8 projects.
2. Scholarship project, Sources: GO, corrigendum, minutes, Hindi voice brief, scanned form; a clause in Devanagari and English.
3. Reconcile: income limit superseded by Corrigendum 1, the 15 vs 10 day verification conflict, missing Annexure A. Resolve (GO prevails), defer Annexure A.
4. Discovery: payment failure handling, appeal and legacy migration missing; answer two questions.
5. Workflow and rules: RTS check 30 of 30 working days compliant; rule tester shows income ₹3,00,001 ineligible under BR-002, source COR1-1.
6. Generate FRS from the model; open GO 4.2 from a reference; a reused requirement from Online Building Plan Approval.
7. Quality: GO 7.3 uncovered, "quickly", DBT payment failure; fix all three and the score rises.
8. Approve as Director (baseline v1.0); add Corrigendum 2 and see the impact analysis; check vendor CR-07 (two asks in scope, one new scope).
9. Export the Word FRS and UAT test cases in Excel.

Shortcuts: `Ctrl+K` search, `Shift+P` presenter notes, `Shift+R` reset the sample project.

## Architecture

- `app/`: Next.js App Router pages, and `app/api/ai/*` route handlers (the only code that talks to Sarvam).
- `lib/types.ts`: the requirements model. `lib/repo/`: zustand store persisted to localStorage behind a repository layer; every mutation appends an activity event.
- `lib/engine/`: deterministic logic (clause segmentation, reconciliation rules, workflow validation and RTS, decision-table boundary tests, permissions, coverage, quality score, impact, CR matching, versioning). Unit tested in `tests/`.
- `lib/ai/`: model map, Sarvam client, prompts with zod schemas (`lib/ai/prompts/<step>.ts`), recordings, rate limiting and capture.
- `lib/generate/`, `lib/export/`: FRS assembly from the model; Word and Excel exports built in the browser with `docx` and `exceljs`.
- `data/`: sample sources, seed projects, reference data (standards, checklists, NFR baselines, ambiguous terms, validations, e-Gov component catalogue) and recordings.
