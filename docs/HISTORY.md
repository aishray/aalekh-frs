# History

Aalekh FRS was first built inside the `aishray/aaila-consumer-ios` repository, in the folder `aalekh-frs/` on branch `claude/upbeat-knuth-w9qgc1`, starting from that repository's commit `aa6c929`. It was then moved into this standalone repository.

The history was carried over with `git subtree split --prefix=aalekh-frs`, so the commits below are real commits of this repository with the folder as the root. Their hashes differ from the originals because the paths changed.

| This repository | Original commit | Message |
|---|---|---|
| `fb41957` | `3ff1ef9` | Aalekh FRS phase 1: scaffold, shell, repo layer, model types, seed and reference data |
| `06adfeb` | `1826916` | Aalekh FRS phases 2-4: sources, Sarvam client with recorded responses, reconciliation |
| `43763b5` | `2fc8ae4` | Aalekh FRS phases 5-7: discovery, workflow designer, decision tables |
| `812889c` | `432c293` | Aalekh FRS phases 8-9: FRS generation from the model, quality and compliance engine |
| `7efdb2c` | `7e35743` | Aalekh FRS phases 10-11: review and baseline, change control, exports |
| `5cd6b82` | `0c5563b` | Aalekh FRS phase 12 (in progress): data dictionary page, field enrichment |
| `584895b` | `06aaf8f` | [aalekh] Add migration log; fix data dictionary field type |
| `58071a6` | `74c3ce1` | [aalekh] Phase 12: roles, deliverables and reuse library pages |
| (not carried) | `4321526` | [aalekh] Migration log: record 74c3ce1, fix commit table (touched only the old repository's migration log) |

The old repository's `AALEKH_MIGRATION.md` was not carried over; this file replaces it. No file outside `aalekh-frs/` in the old repository was ever modified.
