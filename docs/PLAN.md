# Aalekh FRS: build plan

Self-contained Next.js 14 app in `aalekh-frs/`. Nothing outside this folder is modified.

## Architecture

- **Model first.** Every project holds a structured requirements model (sources and clauses, reconciliations, discovery, questions, workflow, data entities, decision tables, permission matrix). The FRS is assembled from the model; LLM output only fills narrative and per-module requirements.
- **Client state:** zustand + `persist` (localStorage) behind `lib/repo/` (`useRepo`, action functions). Every mutation appends an activity event.
- **Derived, never stored:** traceability, coverage, issues, scores, out-of-date flags (`lib/engine/*`, pure functions, unit tested with vitest).
- **AI:** browser calls `POST /api/ai/[step]` with a focused context. The route handler (server only, holds `SARVAM_API_KEY`) either replays a recorded response (`data/recorded/scholarship/*.json`) or calls Sarvam (`lib/ai/sarvam.ts`), zod-validates, and falls back to a recording on failure. Prompts and schemas live in `lib/ai/prompts/<step>.ts`.
- **Exports:** `docx` and `exceljs` in the browser (`lib/export/*`).

## Routes

| Route | Module |
|---|---|
| `/` dashboard, `/projects`, `/projects/new` | overview, F1 |
| `/projects/[id]` overview with next step | |
| `/projects/[id]/sources` | F1 |
| `/projects/[id]/reconcile` | F2 |
| `/projects/[id]/discovery` | F3 |
| `/projects/[id]/workflow` | F4 |
| `/projects/[id]/data` | F5 |
| `/projects/[id]/rules` | F6 |
| `/projects/[id]/roles` | F7 |
| `/projects/[id]/document` | F8 |
| `/projects/[id]/quality` | F9 |
| `/projects/[id]/deliverables` | F10 |
| `/projects/[id]/changes` | F11 |
| `/projects/[id]/review` | F12 |
| `/projects/[id]/export` | F13 |
| `/library`, `/standards`, `/activity`, `/settings` | |
| `/api/ai/[step]`, `/api/ai/test` | Sarvam proxy + recordings |

## Data model

`lib/types.ts` (Section 5 of the brief) plus `Project` (metadata, all artefacts, narrative sections, tracked changes, notes, comments, versions, baseline, impact analyses, CR assessments, `stamps` for dependency tracking). zod schemas for every AI response in `lib/schemas.ts` / prompt files.

Out-of-date tracking: editing an artefact (workflow transition, rule, field, clause) records `stamps[ref] = now`. A requirement or test whose refs include a stamped artefact newer than its `generatedAt` is flagged "Out of date, regenerate".

## Build phases

1. Scaffold, shell, tokens, primitives, repo layer, types, reference + seed data
2. F1 sources (upload, pdfjs/mammoth extraction, deterministic clause segmentation, typing, translation, viewer)
3. Sarvam client + recorded-response infrastructure
4. F2 reconciliation
5. F3 discovery, checklist, questions, assumptions
6. F4 workflow designer, validation, RTS check
7. F6 decision tables, boundary tests, rule tester
8. F8 FRS generation, document view, ref side panel, tracked changes, reuse
9. F9 quality engine, coverage, compliance, fixes, score
10. F12 review, versions, baseline; F11 corrigendum impact, vendor CR scope check
11. F13 exports (Word, Hindi, Excel, change note, CR note, Markdown)
12. F5 data dictionary, F7 roles, F10 deliverables, library
13. Dashboard, projects, overview, activity, standards, settings
14. Recordings, e2e demo-path test (`e2e/demo-path.e2e.ts`), screenshot review, README

## Repo constraints

The host repository's CI runs root-level `jest` over every path. To keep it green without touching root files, this app never uses `*.test.*` / `*.spec.*` filenames: unit tests are `tests/*.unit.ts` (vitest) and Playwright tests are `e2e/*.e2e.ts`.
