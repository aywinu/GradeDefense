import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  sealsFor,
  applyAnswer,
  creepSpeed,
  isDefeated,
  reachedAltar,
  type DuelState,
} from './duel';

describe('duel.ts property tests', () => {
  describe('sealsFor properties', () => {
    it('always returns an integer ≥ 1', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('assignment' as const),
            fc.constant('quiz' as const),
            fc.constant('exam' as const),
            fc.constant('project' as const),
            fc.constant('presentation' as const)
          ),
          fc.boolean(),
          fc.nat(500),
          (type, isMinion, points) => {
            const result = sealsFor({ type, isMinion }, points);
            return Number.isInteger(result) && result >= 1;
          }
        )
      );
    });

    it('minions always have exactly 1 seal regardless of type or points', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('assignment' as const),
            fc.constant('quiz' as const),
            fc.constant('exam' as const),
            fc.constant('project' as const),
            fc.constant('presentation' as const)
          ),
          fc.nat(500),
          (type, points) => {
            const result = sealsFor({ type, isMinion: true }, points);
            return result === 1;
          }
        )
      );
    });

    it('seals increase or stay same as points increase (monotonic)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('assignment' as const),
            fc.constant('exam' as const)
          ),
          fc.nat(500),
          fc.nat(500),
          (type, points1, points2) => {
            const [low, high] = points1 <= points2 ? [points1, points2] : [points2, points1];
            const sealsLow = sealsFor({ type, isMinion: false }, low);
            const sealsHigh = sealsFor({ type, isMinion: false }, high);
            return sealsHigh >= sealsLow;
          }
        )
      );
    });
  });

  describe('applyAnswer properties', () => {
    const arbDuelState = fc.record({
      seals: fc.nat(20),
      maxSeals: fc.constant(10),
      progress: fc.double({ min: 0, max: 1, noNaN: true }),
    }).filter((s) => s.seals <= s.maxSeals);

    it('seals never go negative', () => {
      fc.assert(
        fc.property(
          arbDuelState,
          fc.boolean(),
          fc.nat(10),
          (state, correct, streak) => {
            const result = applyAnswer(state, correct, streak);
            return result.state.seals >= 0;
          }
        )
      );
    });

    it('seals never exceed maxSeals', () => {
      fc.assert(
        fc.property(
          arbDuelState,
          fc.boolean(),
          fc.nat(10),
          (state, correct, streak) => {
            const result = applyAnswer(state, correct, streak);
            return result.state.seals <= result.state.maxSeals;
          }
        )
      );
    });

    it('progress stays in [0, 1]', () => {
      fc.assert(
        fc.property(
          arbDuelState,
          fc.boolean(),
          fc.nat(10),
          (state, correct, streak) => {
            const result = applyAnswer(state, correct, streak);
            return result.state.progress >= 0 && result.state.progress <= 1;
          }
        )
      );
    });

    it('correct answers never increase progress', () => {
      fc.assert(
        fc.property(arbDuelState, fc.nat(10), (state, streak) => {
          const result = applyAnswer(state, true, streak);
          return result.state.progress === state.progress;
        })
      );
    });

    it('wrong answers never decrease progress', () => {
      fc.assert(
        fc.property(arbDuelState, fc.nat(10), (state, streak) => {
          const result = applyAnswer(state, false, streak);
          return result.state.progress >= state.progress;
        })
      );
    });

    it('damage never exceeds seals before the answer', () => {
      fc.assert(
        fc.property(
          arbDuelState,
          fc.boolean(),
          fc.nat(10),
          (state, correct, streak) => {
            const result = applyAnswer(state, correct, streak);
            return result.damage <= state.seals;
          }
        )
      );
    });

    it('correct answer with no streak always deals 1 damage (if seals > 0)', () => {
      fc.assert(
        fc.property(
          arbDuelState.filter((s) => s.seals > 0),
          (state) => {
            const result = applyAnswer(state, true, 0);
            return result.damage === 1;
          }
        )
      );
    });

    it('correct answer with streak ≥ 3 deals 1 or 2 damage', () => {
      fc.assert(
        fc.property(
          arbDuelState.filter((s) => s.seals > 0),
          fc.integer({ min: 3, max: 20 }),
          (state, streak) => {
            const result = applyAnswer(state, true, streak);
            return result.damage === 1 || result.damage === 2;
          }
        )
      );
    });

    it('wrong answer always deals 0 damage', () => {
      fc.assert(
        fc.property(arbDuelState, fc.nat(10), (state, streak) => {
          const result = applyAnswer(state, false, streak);
          return result.damage === 0;
        })
      );
    });

    it('wrong answer always lurches by 0.06 (before capping)', () => {
      fc.assert(
        fc.property(
          arbDuelState.filter((s) => s.progress < 0.95),
          fc.nat(10),
          (state, streak) => {
            const result = applyAnswer(state, false, streak);
            return result.lurch === 0.06;
          }
        )
      );
    });

    it('determinism: same inputs produce same outputs', () => {
      fc.assert(
        fc.property(
          arbDuelState,
          fc.boolean(),
          fc.nat(10),
          (state, correct, streak) => {
            const result1 = applyAnswer(state, correct, streak);
            const result2 = applyAnswer(state, correct, streak);
            return (
              result1.damage === result2.damage &&
              result1.lurch === result2.lurch &&
              result1.state.seals === result2.state.seals &&
              result1.state.progress === result2.state.progress
            );
          }
        )
      );
    });

    it('maxSeals never changes', () => {
      fc.assert(
        fc.property(
          arbDuelState,
          fc.boolean(),
          fc.nat(10),
          (state, correct, streak) => {
            const result = applyAnswer(state, correct, streak);
            return result.state.maxSeals === state.maxSeals;
          }
        )
      );
    });
  });

  describe('creepSpeed properties', () => {
    it('always returns positive and finite', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('assignment' as const),
            fc.constant('quiz' as const),
            fc.constant('exam' as const),
            fc.constant('project' as const),
            fc.constant('presentation' as const)
          ),
          fc.boolean(),
          fc.integer({ min: -30, max: 30 }),
          (type, isMinion, daysLeft) => {
            const speed = creepSpeed(type, isMinion, daysLeft);
            return speed > 0 && Number.isFinite(speed);
          }
        )
      );
    });

    it('overdue items are always faster than on-time items', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('assignment' as const),
            fc.constant('quiz' as const),
            fc.constant('exam' as const),
            fc.constant('project' as const),
            fc.constant('presentation' as const)
          ),
          fc.boolean(),
          fc.nat(30),
          (type, isMinion, daysLeft) => {
            const normalSpeed = creepSpeed(type, isMinion, daysLeft);
            const overdueSpeed = creepSpeed(type, isMinion, -1);
            return overdueSpeed > normalSpeed;
          }
        )
      );
    });

    it('determinism: same inputs produce same outputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('assignment' as const),
            fc.constant('quiz' as const),
            fc.constant('exam' as const),
            fc.constant('project' as const),
            fc.constant('presentation' as const)
          ),
          fc.boolean(),
          fc.integer({ min: -30, max: 30 }),
          (type, isMinion, daysLeft) => {
            const speed1 = creepSpeed(type, isMinion, daysLeft);
            const speed2 = creepSpeed(type, isMinion, daysLeft);
            return speed1 === speed2;
          }
        )
      );
    });
  });

  describe('isDefeated and reachedAltar properties', () => {
    const arbDuelState = fc.record({
      seals: fc.nat(20),
      maxSeals: fc.constant(10),
      progress: fc.double({ min: 0, max: 1.1, noNaN: true }),
    });

    it('isDefeated iff seals = 0', () => {
      fc.assert(
        fc.property(arbDuelState, (state) => {
          return isDefeated(state) === (state.seals === 0);
        })
      );
    });

    it('reachedAltar iff progress ≥ 1', () => {
      fc.assert(
        fc.property(arbDuelState, (state) => {
          return reachedAltar(state) === (state.progress >= 1);
        })
      );
    });
  });

  describe('defeating a creature requires correct answers equal to seals (no streak)', () => {
    it('N seals require exactly N correct answers when streak = 0', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (maxSeals) => {
          let state: DuelState = { seals: maxSeals, maxSeals, progress: 0 };
          let answersNeeded = 0;

          while (!isDefeated(state) && answersNeeded < maxSeals * 2) {
            const result = applyAnswer(state, true, 0);
            state = result.state;
            answersNeeded++;
          }

          return answersNeeded === maxSeals && isDefeated(state);
        })
      );
    });

    it('N seals with streak ≥ 3 require ceil(N/2) correct answers', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (maxSeals) => {
          let state: DuelState = { seals: maxSeals, maxSeals, progress: 0 };
          let answersNeeded = 0;

          while (!isDefeated(state) && answersNeeded < maxSeals) {
            const result = applyAnswer(state, true, 5);
            state = result.state;
            answersNeeded++;
          }

          const expected = Math.ceil(maxSeals / 2);
          return answersNeeded === expected && isDefeated(state);
        })
      );
    });
  });

  describe('wrong answers eventually cause altar reach', () => {
    it('enough wrong answers (ceil(1/0.06) = 17) reach altar', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (maxSeals) => {
          let state: DuelState = { seals: maxSeals, maxSeals, progress: 0 };
          const maxWrongAnswers = Math.ceil(1 / 0.06);

          for (let i = 0; i < maxWrongAnswers; i++) {
            if (reachedAltar(state)) break;
            const result = applyAnswer(state, false, 0);
            state = result.state;
          }

          return reachedAltar(state) && state.seals === maxSeals;
        })
      );
    });
  });
});
