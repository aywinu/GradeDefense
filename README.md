# Deadline Defense

**Your LMS tells you what is due. This shows you what matters.** A haunted study tool in costume: your real deadlines crawl out of the fog in the order they are due, each one as dangerous as its weight in your grade, and the only weapon that works is studying.

*Kiroween 2026 · Costume Contest.* Built with **Kiro**: spec-driven development, steering, hooks, a custom agent, and 29 headless Kiro runs whose prompts live in [`.kiro/runs/`](.kiro/runs). See **[KIRO_USAGE.md](KIRO_USAGE.md)**.

**Play:** https://aywinu.github.io/GradeDefense/ · **LMS showcase:** https://aywinu.github.io/GradeDefense/showcase/lms.html

---

## Why
Students procrastinate on deadlines they can't see until it's too late, and study tools feel like chores. Deadline Defense turns the semester into a fight you can see, and makes studying the only way to win. You can't "tick done" for rewards. Only **correct answers** to study questions power your defence, so the game never rewards faking progress.

## What it does
- **The War Room** (home): one line of *tonight's counsel* tells you the single most useful thing to do right now. It's based on due dates, weights and how ready you are. Below it:
  - each course shows its readiness as a row of candles, its threat level and its next big deadline;
  - selecting a course shows its full battle plan: great enemies with real dates and points, how many trials to do before each, and the topics you keep missing;
  - every deadline sits on a tombstone timeline.
- **Practice trials**: five questions per course in a grimoire. Correct answers raise readiness and **pre-weaken** that course's deadlines before the battle; wrong answers show the explanation and cost nothing. Questions you got wrong or never saw come back first.
- **The procession** (3D, Three.js): **the battlefield is your calendar.** Each real deadline is one creature, its distance from the altar is its days left, and the altar is today.
  - The nearest four deadlines are on the field. Exams are skeleton mages, projects are armoured warriors, assignments are hooded rogues, quizzes are minions; each is tinted by its course and carries its name, days left and **share of the course grade** on a scroll.
  - **You choose what to fight** (click it, or Tab and Space) and duel it with **questions from its own course**. Each correct answer breaks a seal, three in a row break two. A wrong answer costs half a day: the whole calendar lurches forward. The clock keeps running, slowly, while you think.
  - **When a deadline arrives, every seal still on it costs grade in that course, in proportion to its weight.** A 10-point lab barely scratches; a 100-point exam can fail the course. Your projected grade per course is always at the top of the screen.
  - When an exam is a day away, time stops for a timed **last stand** question.
  - *Scout reports* show the next 14 days with weights, seals and readiness (Train from there). The term ends with your **projected transcript** and real advice ("Quiz in 5 days, readiness 0%: 4 practice trials recommended").
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
src/core/              pure game rules, no rendering: the procession (calendar clock, arrivals,
                       weighted grades), duels, QTE, readiness, scoring (+ unit and property tests)
src/game3d/            Three.js battlefield, rigged animated skeletons (KayKit, CC0)
src/game/              Phaser 4 scenes (title, War Room, battle orchestration)
src/ui/                DOM overlays: HUD, trials, scout/debrief, QTE card, guided tours
src/study/model.ts     one source of truth for readiness, threat and advice across screens
src/import/            .ics parser and the embedded postMessage contract
moodle/                Moodle 4.5 block plugin
showcase/lms.html      generic LMS page embedding the block (used in the demo video)
```
The rules are pure functions with property-based tests. A headless simulation plays the whole demo semester to prove the design's claims (`src/core/procession.balance.test.ts`): **a student who never answers fails; one who answers at 75% accuracy passes everything; and prioritising by weight beats fighting whatever is nearest**.

## Disclosure
The demo semester (`src/data/demo.json`) reuses synthetic course names and relative dates from the author's earlier, unrelated project CoursePilot (a Moodle agent). No code was copied, and the data contains no real students. Everything else was built during the Kiroween submission period. [KIRO_USAGE.md](KIRO_USAGE.md) records who did what: Kiro, Claude Code, or the author.

## Licence
MIT. Fonts are OFL, the skeleton characters are CC0 (KayKit by Kay Lousberg), and everything else, art and sound, is generated in code. See [CREDITS.md](CREDITS.md).
