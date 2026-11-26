# Deadline Defense

**Your semester is under siege.** A haunted study tool in costume: your real deadlines crawl out of the fog as a horde, and the only weapon that works is studying.

*Kiroween 2026 · Costume Contest.* Built with **Kiro** (spec-driven development, steering, hooks, a custom agent) and Claude Code. See [KIRO_USAGE.md](KIRO_USAGE.md).

**Play:** https://aywinu.github.io/GradeDefense/ · **LMS showcase:** https://aywinu.github.io/GradeDefense/showcase/lms.html

---

## Why
Students procrastinate on deadlines they can't see until it's too late, and study tools feel like chores. Deadline Defense turns the semester into a fight you can see, and makes studying the only way to win. You can't "tick done" for rewards. Only **correct answers** to study questions power your defence, so the game never rewards faking progress.

## What it does
- **The War Room** (home): one line of *tonight's counsel* tells you the single most useful thing to do right now. It's based on due dates, weights and how ready you are. Below it:
  - each course shows its readiness as a row of candles, its threat level and its next big deadline;
  - selecting a course shows its full battle plan: great enemies with real dates and points, how many trials to do before each, and the topics you keep missing;
  - every deadline sits on a tombstone timeline.
- **Practice trials**: five questions per course in a grimoire. Correct answers raise readiness and **forge** that course's sentinels; wrong answers show the explanation and cost nothing. Questions you got wrong or never saw come back first.
- **The siege** (3D, Three.js): each wave is one real week of your semester.
  - Assignments are shambling zombies, quizzes are swarms of cursed pages, exams are crowned wraith bosses, and projects are stone golems.
  - Every creature carries its coursework name and the days left on a scroll.
  - *Scout reports* before each wave show what is coming and how ready you are, with a Train button. *Debriefs* after it turn breaches into real advice ("Midterm in 4 days, readiness 20%: 3 trials recommended").
- **Study checkpoints** (C) pause the siege for a question; correct answers charge the **Lantern of Knowledge** (Space), which burns the whole field.
- **Quick-time exams**: when a boss reaches the duel zone or breaks, time slows, the world desaturates, a heartbeat starts and a question appears with a burning timer. A correct answer is a critical strike; a wrong one enrages the boss.
- **Your real semester**:
  - import a calendar export (`.ics`, e.g. Moodle → Calendar → Export), parsed entirely in the browser;
  - or install the **Moodle block** (`moodle/block_gradedefense`), which sends your upcoming deadlines to the game with `postMessage`, with origin checks both ways and no tokens.
- **Haunted, and readable**:
  - simplex-noise fog that your cursor-lantern parts and stirs;
  - candles that light the scene with real shadows, and skeletons wandering the graveyard behind the War Room;
  - synthesised sound with visual captions;
  - a played tutorial plus first-visit guided tours.

## Accessibility
- Fully keyboard playable (1–4, C, Space, P, M, T, arrows, Enter, Esc) with visible focus rings.
- `prefers-reduced-motion` is respected, and there's a toggle in the pause menu: no shake, flicker or fog drift, and minimal particles.
- Quick-time exams get double time ("extra time") with reduced motion on.
- Every sound has a caption; there's a mute toggle; text meets WCAG AA contrast.
- It works with storage blocked: the save module falls back to memory.

## Run it
```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest unit + property tests (fast-check)
npm run test:e2e     # Playwright smoke tests (builds and serves the app)
npm run build        # static site in dist/ (BASE_PATH=/GradeDefense/ for GitHub Pages)
```

## How it's built
```
.kiro/                 steering, spec (requirements → design → tasks), hooks, custom agent
src/core/              pure game rules, no rendering: scoring, waves, targeting, neglect,
                       simulation step, QTE, readiness, balance (+ unit and property tests)
src/game3d/            Three.js battlefield and procedural, code-rigged creatures
src/game/              Phaser 4 scenes (title, War Room, battle orchestration)
src/ui/                DOM overlays: HUD, trials, scout/debrief, QTE card, guided tours
src/study/model.ts     one source of truth for readiness, threat and advice across screens
src/import/            .ics parser and the embedded postMessage contract
moodle/                Moodle 4.5 block plugin
showcase/lms.html      generic LMS page embedding the block (used in the demo video)
```
The rules are pure functions with property-based tests. One of them proves the design's core claim with a headless simulation of the whole demo semester: **an idle player loses, a player who studies holds** (`src/core/balance.test.ts`).

## Disclosure
The demo semester's synthetic dates come from the author's earlier project CoursePilot. It's disclosed in `reference/coursepilot/README.md`, and no code was copied. Everything else was built during the Kiroween submission period. See [BUILD_LOG.md](BUILD_LOG.md) for who did what (Kiro or Claude Code).

## Licence
MIT. Fonts are OFL, and all art and sound is generated in code. See [CREDITS.md](CREDITS.md).
