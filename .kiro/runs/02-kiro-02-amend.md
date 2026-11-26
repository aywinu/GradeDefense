Amend the existing spec in `.kiro/specs/deadline-defense/` (requirements.md, design.md, tasks.md). Make ONLY these five targeted edits. Keep everything else as is. Do not write game code.

1. Demo dates must never go stale. `src/data/demo.json` stores `daysOffset` (relative days, as in course_plan.json), NOT absolute dates. Absolute due dates are computed at runtime from "today" by a pure function in `src/core/` (e.g. `resolveSemester(demo, now)`). Fix design.md "Demo Semester Conversion" and tasks 2.1.2 / 2.1.5 accordingly.
2. Fonts: no WebFont Loader dependency. Load Google Fonts via a `<link>` in index.html and wait with `document.fonts.ready` in BootScene. Fix design.md Fonts and task 3.1.2.
3. Playwright: Chromium only (that is what is installed). Fix task 1.1.4 and the browser list in requirements (keep Firefox/Safari as "should work, not CI-tested").
4. NEW requirement R13 "Quick-Time Exam Events" + design section + new tasks phase (after Phase 4 checkpoints): when a boss (exam) or multi-phase enemy reaches a phase threshold, the game slows to 20% speed and shows a short multiple-choice question from that course with a visible countdown (default 8s; 16s when the reduced-motion or "extra time" accessibility setting is on). Correct = critical hit (big damage + dramatic effect), wrong/timeout = boss enrages briefly. Keyboard keys 1-4 answer. The timer and outcome rules are pure functions in `src/core/qte.ts` with property tests (time never negative, outcome is deterministic for given inputs).
5. NEW requirement R14 "Moodle block + LMS showcase" + tasks phase before Final Polish:
   - `moodle/block_gradedefense/`: a minimal Moodle 4.5 block plugin (version.php, block_gradedefense.php, lang/en strings, styles.css) that embeds the static game in an iframe and passes the current user's upcoming course events (from Moodle's calendar API, server-side) to the game via `postMessage` as JSON. No tokens in URLs.
   - The game accepts that postMessage payload (validated, origin-checked) as an alternative to .ics import.
   - `showcase/lms.html`: a static page that imitates a generic LMS dashboard (NO Moodle logo or trademarks) with the block embedded, fed by the demo semester through the same postMessage contract. It is used for the demo video.

When done, print a short list of what changed in each file.
