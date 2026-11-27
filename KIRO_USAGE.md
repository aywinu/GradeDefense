# How Kiro built Deadline Defense

Kiro was the engine of this project, not an add-on. Every game rule, the question bank, the importers, the Moodle plugin, the hooks and the end-to-end tests started as a **Kiro spec task**. Each one was executed by **headless Kiro CLI runs** (`kiro-cli chat --no-interactive`), one small task at a time. Claude Code orchestrated the runs: it wrote the task prompts, reviewed every diff, ran the build and tests, and fixed what didn't pass. Claude Code also built the rendering layer (the 2D/3D visuals and DOM UI). Both roles are recorded honestly below.

| | |
|---|---|
| Kiro runs | 30, every prompt saved in [`.kiro/runs/`](.kiro/runs) |
| Spec | `.kiro/specs/deadline-defense/` – 19 requirement groups in EARS form, design, ~450 tracked tasks (361 done, 68 superseded with what replaced them, 23 deferred) |
| Steering | 4 files, always included |
| Hooks | 3 IDE hooks + 2 agent hooks |
| Custom agent | `deadline-dev` (`.kiro/agents/deadline-dev.json`) |
| Tests | 545 unit and property tests (139 fast-check properties) + 7 Playwright e2e tests |
| Kiro credits used | ~160 of the Kiroween bonus at the time of writing |

---

## 1. Steering: the rules Kiro always reads (`.kiro/steering/`)
| File | What it enforced, with an example of it changing the outcome |
|---|---|
| `product.md` | The product rules: deadlines become enemies, onboarding is played, and **only correct study answers earn rewards**. Its *"Useful first, game second"* section made Kiro add requirements **R15–R17** (War Room, practice trials, scout report and debrief) to the spec in one amendment run. |
| `tech.md` | Pure rules in `src/core` with no rendering imports, Vitest + fast-check + Playwright, and a versioned save. A review found `src/core/sim.ts` calling `Date.now()` and importing a game file; the follow-up Kiro run (task 3.10) fixed both and added a test that **fails if any core file calls `Date.now()`**. |
| `art-direction.md` | The Costume Contest look: palette, OFL fonts only, reduced-motion rules. It overrode the neon palette and the "Creepster" novelty font in Kiro's first design draft. |
| `tech.md` + `product.md` | Steered every implementation run. Each prompt in `.kiro/runs/` is scoped to one task and points back at them. |

## 2. Spec-driven development (`.kiro/specs/deadline-defense/`)
1. **Generate** ([run 01](.kiro/runs/01-kiro-01-spec.md)). From the steering files, Kiro wrote `requirements.md` (EARS), `design.md` (architecture, TypeScript models, scoring formulas, correctness properties, testing strategy) and `tasks.md` (ordered vertical slices).
2. **Amend as reviews find gaps**, always through Kiro:
   - [run 02](.kiro/runs/02-kiro-02-amend.md): relative demo dates (never stale), no font-loader dependency, Chromium-only e2e, **R13 quick-time exam events**, and **R14 Moodle block + LMS showcase**.
   - [run 12](.kiro/runs/12-kiro-03-amend.md): **R15–R17**, the study loop that makes this a study tool rather than a time sink.
   - [run 26](.kiro/runs/26-t-duel.md): **R18 duel combat**, after the author found towers too passive.
   - [run 28](.kiro/runs/28-t-procession.md): **R19 The Procession**, after the author found many simultaneous creatures slow and chaotic: the battlefield became the calendar, and an arriving deadline costs grade by its weight.
3. **Implement task by task.** Every run ticks the checkboxes it completed.
4. **Reconcile** ([run 25](.kiro/runs/25-t-sync.md), [run 30](.kiro/runs/30-t-sync2.md)). After each redesign, the `deadline-dev` agent re-read the code and marked every task as done, *superseded* (with what was built instead) or *deferred*, so the spec tells the truth.

Examples where the spec process caught design problems before they shipped:
- **Task 1.4 → 1.7.** Kiro's first wave generator only spawned items due within 7 days. A simulation of the demo semester showed wave 1 would be three exams and nothing else. Task 1.7 re-specified waves as **week-by-week campaign waves with spawn groups**. Task 1.8 then skipped empty weeks, spread spawns over 25–40 s, and added a gentle tutorial wave and a cap on boss HP.
- **Task 3.10.** The pure simulation got a game clock, so a quick-time event's 20% slow-motion slows tower cooldowns too. Spawning moved into state, so `waveCleared` fires exactly once.

## 3. Property-based testing (fast-check), written by Kiro
Selected invariants (see `src/core/*.prop.test.ts`, `src/import/*.test.ts`, `src/data/*.test.ts`):
- urgency stays in [0.1, 1]; HP and speed multipliers are always positive; scoring is deterministic;
- every spawned creature maps to a real deadline; every ungraded deadline appears in exactly one campaign wave; waves never exceed 40 creatures; same seed, same wave;
- readiness stays in [0, 100]; more correct answers never lower it; recommended trial counts are non-negative integers;
- QTE timers are never negative and outcomes are deterministic; a correct answer always crits and a timeout always enrages;
- the `.ics` parser and the postMessage guard **never throw on arbitrary input**; a valid payload always yields at most 6 courses;
- the notes-to-questions generator never throws; every question has 4 distinct choices containing the answer exactly once.

`src/core/procession.balance.test.ts` (run 29) plays the whole demo semester headlessly with a simulated student, using only Kiro's pure rules. It proves the design claims:
- **a student who never answers fails** (every course ends at 25–33%);
- one who answers at 75% accuracy passes every course (average 96.7%);
- **prioritising by weight beats fighting whatever is nearest** (lowest course grade 87.4% vs 83.3% over ten seeds);
- higher accuracy never gives a lower grade.
To make these hold, Kiro tuned two constants itself: 8 s per semester day (was 6) and a 20% clock while a question is open (was 25%).

## 4. Hooks
| Hook | When | What |
|---|---|---|
| `.kiro/hooks/core-tests-on-save.kiro.hook` | a file in `src/core/**` is edited | run the core unit and property tests, report failures |
| `.kiro/hooks/question-bank-check.kiro.hook` | `src/data/checkpoints.json` is edited | validate the schema and fact-check the changed questions |
| `.kiro/hooks/steering-guard.kiro.hook` | `src/game/**`, `src/game3d/**`, `src/ui/**` are edited | check the change against `art-direction.md` (palette, fonts, reduced motion, contrast) |
| agent `agentSpawn` | the `deadline-dev` agent starts | print `git status --short` |
| agent `postToolUse` on `fs_write` | the agent writes a file | `tsc --noEmit` |

## 5. Custom agent: `deadline-dev`
`.kiro/agents/deadline-dev.json` packs the project rules (pure core, small tasks, tests before done) into the agent prompt. It loads the steering files and `tasks.md` as resources, restricts tools, and carries the two hooks above. It ran the final spec reconciliation (`kiro-cli chat --agent deadline-dev`).

## 6. Driving Kiro headless: what worked
- **One small task per run.** Each prompt names the task, the files it may touch and the verification command. Larger prompts drifted; small ones landed.
- **Parallel runs with file fences.** Two Kiro runs ran at once only when their prompts fenced off disjoint files (e.g. the question bank while the simulation was being rewritten).
- **Verification is part of the prompt.** Every run ends by running `vitest`, `tsc` or Playwright and fixing failures before reporting.
- **Throttling.** The service throttled requests for a few minutes on day one. The runner retries automatically, and two runs that were cut short are noted below.

## 7. Every Kiro run
| # | Task | What Kiro produced | Review outcome |
|---|---|---|---|
| 01 | Spec | requirements (EARS), design, tasks from steering | — |
| 02 | Spec amendment | relative dates, R13 QTE, R14 Moodle block + showcase | — |
| 03 | 1.1 Setup | Vite base path, aliases, Vitest/Playwright configs | build passes |
| 04 | 1.2–1.3 Core types + scoring | types, scoring, 44 unit/property tests | run throttled before the end; Claude fixed an import and two type errors |
| 05 | 1.4 Waves | wave generation + property tests | design gap found → task 1.7 |
| 06 | 1.5–1.6 Targeting, neglect | pure functions + tests | passes |
| 07 | 2.2 Question bank | 60 original questions + schema test | Claude fact-checked: fixed 4 questions, rebalanced answer positions |
| 08 | 1.7 Campaign waves | week-by-week waves, spawn groups, seeded RNG | passes (116 tests) |
| 09 | 2.1 Demo semester | relative-date data + `resolveSemester` | passes |
| 10 | 1.8 Wave pacing | empty weeks skipped, spread spawns, tutorial wave, boss cap | passes |
| 11 | 3.1–3.2 Boot + title | Phaser 4 config, scenes | Claude fixed a flaky invalid-date property |
| 12 | Spec amendment | R15–R17 study loop | — |
| 13 | 3.3–3.5 Battlefield | layout, sentinels, spawning | passes |
| 14 | 3.6–3.8 Simulation | pure `stepSimulation` with events, victory/defeat | passes (174 tests) |
| 15 | 3.10 Review fixes | game clock, no core→game import, pending spawns | passes |
| 16 | 6.1 Readiness | readiness, weak topics, threat, trial picking + 61 tests | passes |
| 17 | 2.3 Topics | topic labels for 60 questions | passes |
| 18 | 5.1 QTE rules | QTE state machine + property tests | Claude added `noNaN` to a float generator |
| 19 | 10.1 `.ics` parser | dependency-free RFC 5545 subset parser, Moodle cleanup | passes (32 tests) |
| 20 | 14.1–14.2 Moodle block | `block_gradedefense` (server-side calendar → postMessage), docs | Claude hardened JSON-in-script escaping, added `event.source` check |
| 21 | 14.3 Embed handler | validated postMessage contract + tests | Claude closed an empty-allowlist hole, allowed string ids |
| 22 | 16 Hooks + agent | hooks and `deadline-dev` | Claude converted to the current hook/agent schema (validated with `kiro-cli agent validate`) |
| 23 | 11 Notes → questions | cloze generator + properties, pdf.js extraction, study-skills bank | Claude added citation/anaphora filters after a real PDF test |
| 24 | 15 Smoke tests | 7 Playwright tests | Claude fixed a stale-server config and a default save; all pass |
| 25 | Spec sync | tasks reconciled with the code (`--agent deadline-dev`) | — |
| 26 | Duel combat (R18) | spec amendment + src/core/duel.ts (seals, applyAnswer, creepSpeed) + unit/property tests | Claude built the duel UI and scene on top |
| 27 | Duel balance | headless semester simulation with a simulated student | passes untuned (creepScale 1.0) |
| 28 | The Procession (R19) | spec amendment + `src/core/procession.ts` (calendar clock, arrivals, weighted grades, transcript) + 78 unit/property tests | Claude built the scene, HUD and 3D on top |
| 29 | Procession balance | semester simulation with two targeting policies; tuned the clock constants | passes; proves weight-first beats nearest-first |
| 30 | Spec sync 2 | tasks and design reconciled after R19 (`--agent deadline-dev`) | — |

## 8. Division of labour (honest)
- **Kiro:** spec, steering-driven implementation of all of `src/core` (the procession, duels, simulation, waves, QTE, readiness, balance), question bank and topics, `.ics` parser, notes-to-questions generator, postMessage contract, the Moodle plugin, hooks, custom agent, Playwright tests.
- **Claude Code:**
  - orchestration: prompts, reviews, fixes noted above;
  - steering `art-direction.md`;
  - the rendering layer: Phaser title/War Room, the Three.js 3D battlefield (rigged KayKit skeletons, CC0, with procedural fallbacks), DOM UI, guided tours;
  - study model glue, versioned save, synthesised audio;
  - balance tuning with the headless simulation;
  - the LMS showcase page, CI/deploy.
- **The author:** product direction and both combat redesigns ("pick one deadline and weaken it with its own course's questions"; "lose when a date arrives and you haven't weakened it enough"), art-direction feedback (e.g. "less shiny, more unique", "show progressive disclosure", "go 3D", "real 3D models"), the Moodle background from CoursePilot.
