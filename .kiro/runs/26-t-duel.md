Design change requested by the product owner (also add it to the spec: a new requirement R18 "Duel combat" in requirements.md with EARS criteria, a "Duel combat" section in design.md, and a new phase in tasks.md; mark the Lantern of Knowledge and gold-bought sentinels as superseded by R18):

"There are no sentinels and no Lantern. The player chooses which deadline-creature to attack and weakens it with questions from its own course. Every correct answer removes one seal. A wrong answer makes it lurch closer, but the explanation is shown. Enemies are slow (a wave lasts as long as a study session); exams have many seals, so defeating one means you have studied for it."

Implement, as PURE functions in a new file src/core/duel.ts (no Phaser/Three/DOM imports), with unit tests (duel.test.ts) and fast-check property tests (duel.prop.test.ts):
- `sealsFor(enemy: Pick<EnemyStats,'type'|'isMinion'>, points: number): number`: minions 1; quiz 2; assignment 3 (+1 if points ≥ 50); project/presentation 5; exam 8 (+2 if points ≥ 100). Always an integer ≥ 1.
- `applyAnswer(state: DuelState, correct: boolean, streak: number): { state: DuelState; damage: number; lurch: number }`. DuelState = { seals: number; maxSeals: number; progress: number /*0..1 toward the altar*/ }. Correct: damage 1 (2 if streak ≥ 3, never more than the remaining seals). Wrong: damage 0, lurch +0.06 progress (capped at 1).
- `creepSpeed(type, isMinion, daysLeft)`: lane-crossing speed in progress per second so that a regular creature takes ~180–300 s to cross and an exam ~360 s. Overdue items (daysLeft < 0) are 25% faster. Always > 0 and finite.
- `isDefeated(s)` and `reachedAltar(s)`.
Property invariants: seals never negative and never exceed maxSeals; damage never exceeds seals before the answer; progress stays in [0, 1]; correct answers never increase progress; the number of correct answers needed to defeat a creature equals its seals when the streak is 0 (no streak bonus); creepSpeed is positive and finite for all inputs.
Do NOT touch src/game/**, src/game3d/**, src/ui/** (another task is rewriting the scene). Tick the new tasks.
Verify: `npx vitest run src/core` and `npx tsc --noEmit` pass.
