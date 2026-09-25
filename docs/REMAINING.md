# Remaining work

Phases 1 to 14 of the build plan (CLAUDE.md, Section 12) are complete: the New project wizard, Standards,
Activity and Settings pages, the README, `npm run record` with live captures, `npm run sarvam:check`, and the
Sarvam client verified against https://docs.sarvam.ai (September 2026).

## Known limitations

- Reasoning is off by default for every AI task (see README, "Sarvam AI"): on `sarvam-105b` the reasoning trace
  for analysis prompts exceeds the 300 second function limit on Vercel.
- Several sample recordings remain hand-authored because the live answer missed an acceptance criterion or IDs
  that later steps depend on; `data/recorded/README.md` lists each one.
- The corrigendum impact analysis lists affected requirements and test cases but no workflow SLA, because
  grievances are not part of the application state machine.
- Hindi FRS export needs the live AI engine (no recording).
- The live AI rate limit is kept in function memory, so on Vercel it applies per function instance.
