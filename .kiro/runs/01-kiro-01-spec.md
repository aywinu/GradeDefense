You are working in the repo `deadline-defense` (Vite 8 + TypeScript strict, Phaser 4, GSAP, Howler, pdf.js, Vitest, fast-check, Playwright already installed). Read `.kiro/steering/product.md`, `.kiro/steering/tech.md`, `HACKATHON_STRATEGY.md` and `reference/coursepilot/` (README.md, course_plan.json, ground_truth.json, priority.py) first.

TASK: Create a Kiro spec for the game in `.kiro/specs/deadline-defense/` with three files. Do NOT write any game code yet.

1. `requirements.md`: user stories with acceptance criteria in EARS format (WHEN/IF/WHILE ... THE SYSTEM SHALL ...). Cover:
   - Title screen + haunted "semester fortress" theme (Costume Contest: spooky UI that serves the function).
   - Bundled demo semester converted from reference/coursepilot/course_plan.json (6 courses; due dates relative to "today" so the demo always works).
   - Enemy mapping: assignment = shambler, quiz = swarmer, exam = boss, project/presentation = multi-phase. Strength/speed scale with deadline proximity and weight (points); neglected items grow stronger. Past items with grades are "fallen" (already defeated or haunting ghosts if low grade).
   - Towers/defenders per course; placing and upgrading them.
   - Study checkpoints: multiple-choice questions bundled per course (write ~8 original questions per course, topics matching the course titles); a correct answer charges a special attack; wrong answers never punish beyond a missed charge. Optional: load a PDF with pdf.js and generate simple cloze questions from its text (no paid AI).
   - Import real deadlines from a Moodle calendar export (.ics file upload, parsed client-side). No backend, no tokens.
   - First wave = played tutorial, about 60 seconds.
   - Rewards never come from ticking "done" on real work.
   - Accessibility: keyboard play, reduced-motion respect, readable contrast, captions/visual cues for sound, mute toggle.
   - Persistence: versioned localStorage save with try/catch.
   - Static build to dist/, runs on GitHub Pages under a sub-path.
2. `design.md`: architecture (src/core pure rules with NO Phaser imports; src/game Phaser scenes; src/ui DOM/GSAP overlays; src/data; src/import for ics/pdf), data models in TypeScript, the scoring formulas (adapt urgency × risk × weight from priority.py into new TS code), scene flow, art direction (palette tokens, fonts from Google Fonts with OFL license, procedural/vector art generated in code so there are no licensing issues; audio synthesised with WebAudio or CC0), correctness properties for property-based tests, and the testing strategy.
3. `tasks.md`: an ordered checklist of small implementation tasks (`- [ ] 1. ...` with sub-tasks), each referencing requirement numbers. Order for a vertical slice first: core rules + tests → demo data → battlefield with one wave → checkpoints → tutorial → theme polish → ics import → pdf questions → save → a11y → build/Playwright smoke test. Include tasks for Kiro hooks (`.kiro/hooks/`) that run vitest on save of src/core files.

Keep each file focused and concrete. When done, print a 10-line summary of what you wrote.
