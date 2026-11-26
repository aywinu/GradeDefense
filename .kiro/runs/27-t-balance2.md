Update the headless balance test for duel combat (R18). Only touch src/core/balance.ts and src/core/balance.test.ts (and tick a task in tasks.md).
The battle no longer has towers: creatures creep with `creepSpeed` (src/core/duel.ts) and lose seals only through answers (`applyAnswer`). Rewrite `src/core/balance.test.ts` to simulate each demo-semester wave (src/data/demo.json, `resolveSemester`, `generateWave`, keep at most 2 minions per parent item like the scene does) with `stepSimulation` (towers: []), enemy hp = `sealsFor(...)`, speed = creepSpeed × lane span (1500 px), damage 15 (exam 30, minion 5), and a simulated student who every `answerEveryMs` answers one question against the creature closest to the altar, correct with probability `accuracy` (seeded RNG), applying `applyAnswer` (wrong answers lurch the target forward).
Assertions:
1. An idle student (never answers) loses the demo semester (total breach damage ≥ 100).
2. A student who answers every 10 s with 75% accuracy keeps total breach damage < 60 over the semester.
3. Monotonicity: answering more often (every 8 s vs every 14 s) at the same accuracy never takes more damage.
4. Monotonicity: higher accuracy (0.9 vs 0.6) at the same rate never takes more damage.
If assertion 2 fails, tune ONLY constants you add to src/core/balance.ts (e.g. a global `creepScale` that the scene can also read) and report the values; do not change duel.ts.
Verify: `npx vitest run src/core` and `npx tsc --noEmit` pass.
