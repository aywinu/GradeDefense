# How Kiro was used

Honest log of what Kiro did in this project. Kiro CLI ran headless (`kiro-cli chat --no-interactive`), one small task per run, and every run was reviewed, built and tested before the next one.

## Steering
- `.kiro/steering/product.md`: product rules (enemy mapping, no rewards for ticking "done", played onboarding).
- `.kiro/steering/tech.md`: stack, the pure `src/core/` rule, testing and asset licensing.

## Specs
| Date | Run | Result |
|---|---|---|
| 2026-11-26 | Generate the spec from the steering docs | `.kiro/specs/deadline-defense/` with requirements (EARS), design and tasks |
| 2026-11-26 | Targeted spec amendments | Relative demo dates, fonts without a loader, Chromium-only e2e, new R13 quick-time exam events, new R14 Moodle block + LMS showcase |

## Implementation runs
| Date | Task | What Kiro did | Review |
|---|---|---|---|
| 2026-11-26 | Task 1.1 | Project setup (Vite base path, aliases, Vitest/Playwright config, starter removed) | Build passes |
| 2026-11-26 | Tasks 1.2-1.3 | Core types, scoring formulas, 44 unit/property tests | Run throttled before finishing; Claude fixed fast-check import + 2 type errors. Tests and build pass |
| 2026-11-26 | Tasks 1.4-1.6 | Wave generation, targeting, neglect buff with unit + property tests (100 tests) | Passes. Review found a design gap: only items due in 7 days spawn, so the demo wave is 3 exams; redesign queued |
| 2026-11-26 | Task 2.2 | 60 original checkpoint questions + schema test | Claude fact-checked: fixed Tuckman (said five stages, listed four), SMART (missing Relevant), duplicate-correct option (2 μm vs 2000 nm), AIDA; rebalanced correct positions (29/60 were B) |
| 2026-11-26 | Task 1.7 | Semester campaign: week-by-week waves, spawn groups with escorts, lanes, seeded RNG (116 tests) | Redesign requested by Claude after review; tests + build pass |
| 2026-11-26 | Task 2.1 | Demo semester data (relative days) + resolveSemester with tests (140 tests) | Passes |
| 2026-11-26 | Tasks 1.8, 3.1-3.2 | Wave pacing fixes; Phaser 4 config, BootScene, minimal TitleScene | 151 tests pass; Claude fixed flaky fc.date invalid-date tests |
| 2026-11-26 | Spec amendment | Added R15–R17 (War Room, trials, scout/debrief) to requirements/design/tasks | Reviewed |
| 2026-11-26 | Tasks 3.3-3.5 | BattleScene layout, lane helpers, tower and enemy views, wave spawning | Builds; screenshot checked |
| 2026-11-26 | Tasks 3.6-3.8 | Pure stepSimulation with events, battle loop, wave end, victory/defeat (174 tests) | Tests + typecheck pass |
| 2026-11-26 | Task 6.1 | Readiness core rules + 61 unit/property tests | Passes |
| 2026-11-26 | Task 3.10 | Review fixes: game clock instead of Date.now, no game imports in core, pending spawns in state | Passes |
| 2026-11-26 | Task 2.3 | Topic labels for all 60 questions | Passes |
| 2026-11-26 | Task 5.1 | QTE core rules, trigger thresholds, outcomes + property tests | Claude added noNaN to a float generator (flaky NaN counterexample) |
| 2026-11-26 | Task 10.1 | Dependency-free RFC 5545 subset parser, Moodle-specific cleanup, icsToSemester + tests (files landed in commit c80c9ab) | Passes |
| 2026-11-26 | Tasks 14.1–14.3 | Moodle block plugin (server-side calendar events → postMessage), docs/moodle-integration.md, src/import/postmessage.ts with guards + tests | Claude hardened JSON-in-script escaping and added event.source check |
| 2026-11-27 | Phase 16 | IDE hooks + CLI custom agent deadline-dev with postToolUse/agentSpawn hooks | JSON validated |
| 2026-11-27 | Phase 11 (PDF questions) | notesToQuestions cloze generator + property tests, pdf.js extraction, 12 study-skills questions | Claude added citation/anaphora filters and whitespace normalisation after testing with a real PDF |
| 2026-11-27 | Smoke tests | 6 Playwright smoke tests (title, War Room, trial, battle, tour, reduced motion) | 3 failed against a stale preview build; Claude added returning-player save default and disabled server reuse |
