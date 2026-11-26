# Build log: who did what

The hackathon requires Kiro, and Kiro did a large part of the work (see `KIRO_USAGE.md` for every Kiro run). Other tools were used too. This file records all of them honestly.

## Tools
| Tool | Role |
|---|---|
| **Kiro CLI** (headless `kiro-cli chat --no-interactive`) | Spec (requirements → design → tasks), steering-driven implementation of tasks, hooks |
| **Claude Code** | Orchestration: wrote steering docs, split work into small Kiro tasks, reviewed every Kiro diff, ran build and tests, fixed small breakages, and wrote some code directly (marked below) |
| Vite, TypeScript, Phaser 4, GSAP, Howler, pdf.js, Vitest, fast-check, Playwright | Libraries and tooling (licenses in `CREDITS.md`) |

## Log
| Date | Change | Done by |
|---|---|---|
| 2026-11-10 | Vite+TS scaffold, dependencies, steering `product.md`/`tech.md`, hackathon strategy | Claude Code |
| 2026-11-26 | Spec generated and amended | Kiro |
| 2026-11-26 | Steering `art-direction.md` | Claude Code |
| 2026-11-26 | Task 1.1 project setup | Kiro |
| 2026-11-26 | Tasks 1.2–1.3 core types, scoring, unit and property tests | Kiro (run cut off by service throttling) + Claude Code (fixed fast-check import and two type errors) |
| 2026-11-26 | Tasks 1.4–1.6 wave generation, targeting, neglect + tests | Kiro |
| 2026-11-26 | Task 2.2 questions | Kiro + Claude Code (fact-check fixes) |
| 2026-11-26 | Task 1.7 semester campaign waves (redesign) | Kiro |
| 2026-11-26 | Task 2.1 demo semester + resolveSemester | Kiro |
| 2026-11-26 | Task 1.8 wave pacing (skip empty weeks, spread spawns, tutorial wave, boss HP cap) | Kiro |
| 2026-11-26 | Tasks 3.1–3.2 Phaser boot + minimal title | Kiro; Claude fixed a flaky property test (invalid dates) |
| 2026-11-26 | Spec amendment R15–R17 study loop | Kiro |
| 2026-11-26 | Self-hosted fonts + font loader | Claude Code |
| 2026-11-26 | Tasks 3.3–3.5 battlefield layout, towers, spawning | Kiro |
| 2026-11-26 | Atmosphere (simplex fog, candles, motes, vignette), procedural textures, DOM UI stage, title screen | Claude Code |
| 2026-11-26 | Tasks 3.6–3.8 pure simulation step + battle loop, victory/defeat | Kiro |
| 2026-11-26 | Task 6.1 readiness core | Kiro |
| 2026-11-26 | Task 3.10 sim purity (game clock), SimConfig, pending spawns | Kiro |
| 2026-11-26 | Task 2.3 question topics | Kiro |
| 2026-11-26 | War Room scene, TrialPanel, study model glue, versioned save + tests, WebAudio synth | Claude Code |
| 2026-11-26 | Task 5.1 QTE core | Kiro (+ Claude flaky-test fix) |
| 2026-11-26 | BattleScene rebuild, BattleUI (HUD, scout, debrief, checkpoint, QTE card, coach), entity views | Claude Code |
| 2026-11-26 | War Room redesign (muted ledger, candles, epitaph, graveyard + skeleton walk cycle) after user feedback | Claude Code |
| 2026-11-26 | Task 10.1 ICS parser (src/import) | Kiro (accidentally committed together with Claude's creature commit c80c9ab) |
| 2026-11-26 | Balance constants + headless campaign balance test (idle loses, studying holds) | Claude Code |
| 2026-11-26 | War Room v3 progressive disclosure (counsel, list + detail) | Claude Code |
| 2026-11-26 | Lantern cursor (fog parting + stirring), custom cursor | Claude Code |
| 2026-11-26 | Moodle block + postMessage handler | Kiro (+ Claude security hardening) |
| 2026-11-27 | Kiro hooks + custom agent | Kiro |
| 2026-11-27 | Three.js 3D battlefield + procedural rigged animated creatures, DOM labels | Claude Code |
| 2026-11-27 | Guided tours with animated SVG illustrations | Claude Code |
| 2026-11-27 | Embed wiring, ICS import UI, LMS showcase page, origin-check fix, string ids in guard | Claude Code |
| 2026-11-27 | PDF notes → questions (Kiro core) + UI wiring and quality filters (Claude) |
| 2026-11-27 | Playwright smoke tests | Kiro (+ Claude fixes) |
| 2026-11-27 | Perf pass: 27 → 60 fps in heaviest wave | Claude Code |
