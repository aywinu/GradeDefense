# Deadline Defense

**Your semester is under siege.** A haunted study tool in costume: your real deadlines crawl out of the fog as a horde, and the only weapon that works is studying.

*Kiroween 2026 · Costume Contest.* Built with **Kiro**: spec-driven development, steering, hooks, a custom agent, and 26 headless Kiro runs whose prompts live in [`.kiro/runs/`](.kiro/runs). See **[KIRO_USAGE.md](KIRO_USAGE.md)**.

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
- **The siege** (3D, Three.js): each wave is one real week, and your deadlines crawl slowly toward your semester.
  - Assignments are zombies, quizzes are cursed pages, exams are crowned wraiths, and projects are stone golems. Each carries its coursework name and the days left on a scroll.
  - **You pick which deadline to fight** (click it, or Tab and Space) and duel it with **questions from its own course**. Each correct answer breaks one of its seals; a wrong answer lets it creep closer but shows the explanation. An exam has 8–10 seals, so beating it means you actually studied for it.
  - Practice trials in the War Room weaken a course's deadlines before the battle even starts.
  - If an exam reaches the duel zone, time slows for a timed last-stand question.
  - *Scout reports* before each wave show what is coming and how ready you are. *Debriefs* after it turn the battle into real advice ("Midterm in 4 days, readiness 20%: 3 trials recommended").
- **Your real semester**:
  - import a calendar export (`.ics`, e.g. Moodle → Calendar → Export), parsed entirely in the browser;
  - or install the **Moodle block** (`moodle/block_gradedefense`), which sends your upcoming deadlines to the game with `postMessage`, with origin checks both ways and no tokens.
- **Haunted, and readable**:
  - simplex-noise fog that your cursor-lantern parts and stirs;
  - candles that light the scene with real shadows, and skeletons wandering the graveyard behind the War Room;
  - synthesised sound with visual captions;
  - a played tutorial plus first-visit guided tours.

## Accessibility
- Fully keyboard playable (Tab, Space, 1–4, P, M, T, arrows, Enter, Esc) with visible focus rings.
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
The rules are pure functions with property-based tests. One of them proves the design's core claim with a headless simulation of the whole demo semester: **a student who never answers loses; one who answers a question every 10 s at 75% accuracy holds** (`src/core/balance.test.ts`).

## Disclosure
The demo semester (`src/data/demo.json`) reuses synthetic course names and relative dates from the author's earlier, unrelated project CoursePilot (a Moodle agent). No code was copied, and the data contains no real students. Everything else was built during the Kiroween submission period. [KIRO_USAGE.md](KIRO_USAGE.md) records who did what: Kiro, Claude Code, or the author.

## Licence
MIT. Fonts are OFL, and all art and sound is generated in code. See [CREDITS.md](CREDITS.md).
