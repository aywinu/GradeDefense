Headless balance simulation for The Procession (R19). Touch ONLY src/core/procession.balance.test.ts (new), src/core/procession.ts (ONLY the numeric values inside the PROCESSION constant, if tuning is needed) and tasks.md (add and tick a 19.x balance sub-task).

Simulate the demo semester (src/data/demo.json, resolveSemester at a fixed date, buildProcession) with a simulated student, entirely with the pure functions of src/core/procession.ts and applyAnswer from src/core/duel.ts:
- Time model (mirrors the scene): when the student is NOT answering, the clock advances at 1 day per PROCESSION.secondsPerDay real seconds. Each question takes `secondsPerAnswer` real seconds, during which the clock runs at PROCESSION.duelTimeScale. A wrong answer additionally advances PROCESSION.wrongAnswerDays. Step the simulation in 0.5 s real-time ticks.
- The student only duels items returned by visible(state). Answers are correct with probability `accuracy` (seeded mulberry32 from src/core/rng.ts). Correct answers break seals via applyAnswer's damage (streak bonus included).
- Two targeting policies: `nearest` (smallest dueDay) and `weighted` (highest points/totals[course] × seals, ties by dueDay).
- Run until isFinished(state). Report final course grades.

Assertions:
1. An idle student (never answers) fails at least one course (failedCourses non-empty at the end).
2. A student answering continuously, 6 s per answer, 75% accuracy, `weighted` policy, fails no course and averages >= 75 across courses.
3. Prioritising matters: with the same seed, rate and accuracy (6 s, 75%), the `weighted` policy's lowest course grade is >= the `nearest` policy's lowest course grade, for seeds 1..10 on average.
4. Monotonic: higher accuracy (0.9 vs 0.6) never gives a lower average grade (same seed, weighted).
If assertion 2 fails, tune ONLY the PROCESSION values (e.g. secondsPerDay, duelTimeScale) and report the old and new values. Keep secondsPerDay between 4 and 12 and duelTimeScale between 0.1 and 0.4.
Verify: `npx vitest run src/core` and `npx tsc --noEmit` pass. Print the final grades of each scenario in your summary.
