# Remaining work

Phases 1 to 12 of the build plan (CLAUDE.md, Section 12) are complete. Still to do:

## Phase 13: remaining pages

- `/projects/new`: new project wizard (details, project type, add sources). The "New project" button on `/projects` links here.
- `/standards`: compliance checklists per standard and project type (editable), ambiguous-terms list, NFR baselines.
- `/activity`: audit log across projects.
- `/settings`: AI engine (model, reasoning per task), the Sarvam connection test (the server route `POST /api/ai/status` already exists), branding, recorded-response mode, reset sample data.

These four routes return 404 until built; the sidebar already links to three of them.

## Phase 14: finishing

- `README.md`: run commands, environment, recorded mode, the demo path, architecture.
- `data/recorded/README.md`: which recordings were hand-authored (all of them so far) and why.
- `npm run record` (`scripts/record.ts`): run the sample pipeline against the live Sarvam API and save responses to `data/recorded/scholarship/`. The `record` script entry exists in `package.json`; the script file does not.
- Verify the Sarvam client against the current docs at https://docs.sarvam.ai/llms.txt (the build environment could not reach them), especially the Document Intelligence job endpoints in `lib/ai/sarvam.ts`, and run the live connection test.
- Final screenshot review against CLAUDE.md Section 11.

## Known limitations

- The corrigendum impact analysis lists affected requirements and test cases but no workflow SLA, because grievances are not part of the application state machine.
- Hindi FRS export needs the live AI engine (no recording).
