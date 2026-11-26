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
