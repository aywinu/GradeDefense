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
