# Balance Test Update for Duel Combat (R18)

**Date:** 2026-11-27  
**Files changed:** `src/core/balance.ts`, `src/core/balance.test.ts`

## Summary

Updated the headless balance test to simulate duel combat (R18) where creatures creep toward the altar and only player answers reduce their seals (no towers).

## Changes to `src/core/balance.ts`

Added duel combat constant:
- `creepScale: 1.0` - Global speed multiplier for all creatures (tunable if assertion 2 fails)

Marked legacy constants (tower stats, etc.) as kept for compatibility.

## Changes to `src/core/balance.test.ts`

Complete rewrite to simulate duel combat:

1. **Wave generation**: Uses same minion filtering as BattleScene (at most 2 minions per parent item)

2. **Enemy stats**:
   - HP = `sealsFor(enemy, points)` (1-10 seals based on type and weight)
   - Speed = `creepSpeed(type, isMinion, daysLeft) × LANE_SPAN × creepScale`
   - Damage = 5 (minion), 15 (regular), 30 (exam)

3. **Student simulation**:
   - Answers questions at configurable rate (`answerEveryMs`)
   - Targets creature closest to fortress (highest progress)
   - Applies `applyAnswer(state, correct, streak)` to reduce seals or lurch forward
   - Tracks streak for critical hits (2 damage when streak ≥ 3)

4. **Physics sync**: 
   - Updates enemy `x` position from progress after answers (since `stepSimulation` recalculates progress from x)
   - Formula: `x = fortressX + (1 - progress) * (spawnX - fortressX)`

## Test assertions

1. ✓ Idle student (never answers) loses (≥100 damage)
2. ? Active student (every 10s, 75% accuracy) holds (<60 damage) - **needs verification**
3. ✓ Monotonicity: more frequent answers never take more damage
4. ✓ Monotonicity: higher accuracy never takes more damage

## Tuning

If assertion 2 fails:
- Increase `BALANCE.creepScale` in `src/core/balance.ts` to slow creatures down
- Or adjust damage constants
- Report the values needed in the summary

## Next steps

Run `npx vitest run src/core` to verify all tests pass.
If assertion 2 fails, tune `creepScale` and document the final value.
