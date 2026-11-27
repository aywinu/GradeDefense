import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  PROCESSION,
  buildProcession,
  itemScore,
  verdictFor,
  courseGrade,
  visible,
  laneProgress,
  breakSeals,
  advance,
  letterGrade,
  type ProcessionItem,
  type ProcessionState,
} from './procession';

describe('procession (property-based)', () => {
  // Arbitraries
  const arbSeals = fc.tuple(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 1, max: 20 })
  ).map(([seals, maxSeals]) => ({ seals: Math.min(seals, maxSeals), maxSeals }));

  const arbProcessionItem = (): fc.Arbitrary<ProcessionItem> =>
    fc.record({
      itemId: fc.string({ minLength: 1 }),
      courseId: fc.string({ minLength: 1 }),
      label: fc.string({ minLength: 1 }),
      type: fc.constantFrom('assignment', 'quiz', 'exam', 'project', 'presentation'),
      points: fc.integer({ min: 1, max: 200 }),
      dueDay: fc.float({ min: 0, max: 100 }),
      seals: fc.integer({ min: 0, max: 20 }),
      maxSeals: fc.integer({ min: 1, max: 20 }),
      resolved: fc.boolean(),
      score: fc.oneof(fc.constant(null), fc.float({ min: 0, max: 100 })),
      verdict: fc.oneof(fc.constant(null), fc.constantFrom('ready', 'partial', 'unprepared')),
    }).map((item) => ({
      ...item,
      seals: Math.min(item.seals, item.maxSeals), // ensure seals <= maxSeals
    }));

  const arbProcessionState = (): fc.Arbitrary<ProcessionState> =>
    fc.record({
      day: fc.float({ min: 0, max: 100 }),
      items: fc.array(arbProcessionItem(), { maxLength: 10 }),
      graded: fc.dictionary(
        fc.string({ minLength: 1 }),
        fc.record({
          points: fc.float({ min: 0, max: 500 }),
          earned: fc.float({ min: 0, max: 500 }),
        })
      ),
      totals: fc.dictionary(fc.string({ minLength: 1 }), fc.float({ min: 0, max: 1000 })),
    });

  describe('itemScore', () => {
    it('always returns a value in [0, 100]', () => {
      fc.assert(
        fc.property(arbSeals, ({ seals, maxSeals }) => {
          const score = itemScore(seals, maxSeals);
          return score >= 0 && score <= 100;
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(arbSeals, ({ seals, maxSeals }) => {
          const score1 = itemScore(seals, maxSeals);
          const score2 = itemScore(seals, maxSeals);
          return score1 === score2;
        })
      );
    });

    it('score increases as seals decrease (monotonic)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (maxSeals, seals1) => {
            const seals2 = Math.min(seals1 + 1, maxSeals);
            const score1 = itemScore(Math.min(seals1, maxSeals), maxSeals);
            const score2 = itemScore(seals2, maxSeals);
            return score1 >= score2;
          }
        )
      );
    });
  });

  describe('verdictFor', () => {
    it('verdict is one of ready/partial/unprepared', () => {
      fc.assert(
        fc.property(arbSeals, ({ seals, maxSeals }) => {
          const verdict = verdictFor(seals, maxSeals);
          return ['ready', 'partial', 'unprepared'].includes(verdict);
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(arbSeals, ({ seals, maxSeals }) => {
          const verdict1 = verdictFor(seals, maxSeals);
          const verdict2 = verdictFor(seals, maxSeals);
          return verdict1 === verdict2;
        })
      );
    });
  });

  describe('courseGrade', () => {
    it('always returns a value in [0, 100]', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.string({ minLength: 1 }), (state, courseId) => {
          const grade = courseGrade(state, courseId);
          return Number.isFinite(grade) && grade >= 0 && grade <= 100;
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.string({ minLength: 1 }), (state, courseId) => {
          const grade1 = courseGrade(state, courseId);
          const grade2 = courseGrade(state, courseId);
          return grade1 === grade2;
        })
      );
    });
  });

  describe('visible', () => {
    it('never returns more than maxVisible', () => {
      fc.assert(
        fc.property(arbProcessionState(), (state) => {
          const vis = visible(state);
          return vis.length <= PROCESSION.maxVisible;
        })
      );
    });

    it('never returns a resolved item', () => {
      fc.assert(
        fc.property(arbProcessionState(), (state) => {
          const vis = visible(state);
          return vis.every((item) => !item.resolved);
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(arbProcessionState(), (state) => {
          const vis1 = visible(state);
          const vis2 = visible(state);
          return (
            vis1.length === vis2.length &&
            vis1.every((item, i) => item.itemId === vis2[i].itemId)
          );
        })
      );
    });
  });

  describe('laneProgress', () => {
    it('always returns a value in [0, 1]', () => {
      fc.assert(
        fc.property(arbProcessionItem(), fc.float({ min: 0, max: 100 }), (item, day) => {
          const progress = laneProgress(item, day);
          return progress >= 0 && progress <= 1;
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(arbProcessionItem(), fc.float({ min: 0, max: 100 }), (item, day) => {
          const progress1 = laneProgress(item, day);
          const progress2 = laneProgress(item, day);
          return progress1 === progress2;
        })
      );
    });
  });

  describe('breakSeals', () => {
    it('seals never go negative', () => {
      fc.assert(
        fc.property(
          arbProcessionState(),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 0, max: 100 }),
          (state, itemId, n) => {
            const newState = breakSeals(state, itemId, n);
            return newState.items.every((item) => item.seals >= 0);
          }
        )
      );
    });

    it('seals never exceed maxSeals', () => {
      fc.assert(
        fc.property(
          arbProcessionState(),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 0, max: 100 }),
          (state, itemId, n) => {
            const newState = breakSeals(state, itemId, n);
            return newState.items.every((item) => item.seals <= item.maxSeals);
          }
        )
      );
    });

    it('breaking more seals never lowers the grade', () => {
      fc.assert(
        fc.property(
          arbProcessionState(),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          (state, n1, n2) => {
            if (state.items.length === 0) return true;
            const item = state.items[0];
            const courseId = item.courseId;

            const state1 = breakSeals(state, item.itemId, n1);
            const state2 = breakSeals(state, item.itemId, n1 + n2);

            const grade1 = courseGrade(state1, courseId);
            const grade2 = courseGrade(state2, courseId);

            // Breaking more seals should never lower the grade
            return grade2 >= grade1 || Math.abs(grade2 - grade1) < 0.1; // allow rounding tolerance
          }
        )
      );
    });

    it('is immutable (original state unchanged)', () => {
      fc.assert(
        fc.property(
          arbProcessionState(),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 0, max: 100 }),
          (state, itemId, n) => {
            const originalItems = state.items.map((item) => ({ ...item }));
            breakSeals(state, itemId, n);
            return state.items.every(
              (item, i) =>
                item.seals === originalItems[i].seals &&
                item.resolved === originalItems[i].resolved
            );
          }
        )
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(
          arbProcessionState(),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 0, max: 100 }),
          (state, itemId, n) => {
            const newState1 = breakSeals(state, itemId, n);
            const newState2 = breakSeals(state, itemId, n);
            return (
              newState1.items.length === newState2.items.length &&
              newState1.items.every((item, i) => item.seals === newState2.items[i].seals)
            );
          }
        )
      );
    });
  });

  describe('advance', () => {
    it('day never decreases', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.float({ min: -10, max: 100 }), (state, days) => {
          if (!Number.isFinite(state.day)) return true; // skip NaN states
          const { state: newState } = advance(state, days);
          return newState.day >= state.day;
        })
      );
    });

    it('grades stay in [0, 100]', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.float({ min: 0, max: 100 }), (state, days) => {
          const { arrivals } = advance(state, days);
          return arrivals.every(
            (arrival) =>
              arrival.gradeBefore >= 0 &&
              arrival.gradeBefore <= 100 &&
              arrival.gradeAfter >= 0 &&
              arrival.gradeAfter <= 100
          );
        })
      );
    });

    it('every item resolves at most once', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.float({ min: 0, max: 200 }), (state, days) => {
          const { arrivals } = advance(state, days);
          const itemIds = arrivals.map((a) => a.itemId);
          const uniqueIds = new Set(itemIds);
          return itemIds.length === uniqueIds.size;
        })
      );
    });

    it('advance(a) then advance(b) equals advance(a + b)', () => {
      fc.assert(
        fc.property(
          arbProcessionState(),
          fc.float({ min: 0, max: 50 }),
          fc.float({ min: 0, max: 50 }),
          (state, a, b) => {
            // Skip NaN or non-finite values
            if (!Number.isFinite(state.day) || !Number.isFinite(a) || !Number.isFinite(b)) return true;
            if (state.items.some(item => !Number.isFinite(item.dueDay))) return true;
            
            // Approach 1: advance(a) then advance(b)
            const { state: state1 } = advance(state, a);
            const { state: state2, arrivals: arrivals2 } = advance(state1, b);

            // Approach 2: advance(a + b)
            const { state: state3, arrivals: arrivals3 } = advance(state, a + b);

            // Both should have the same day
            if (Math.abs(state2.day - state3.day) > 0.001) return false;

            // Both should have the same resolved set
            const resolved2 = state2.items.filter((item) => item.resolved).map((item) => item.itemId);
            const resolved3 = state3.items.filter((item) => item.resolved).map((item) => item.itemId);
            if (resolved2.length !== resolved3.length) return false;
            if (!resolved2.every((id) => resolved3.includes(id))) return false;

            // Grades should be the same
            const courses = Object.keys(state.totals);
            for (const courseId of courses) {
              const grade2 = courseGrade(state2, courseId);
              const grade3 = courseGrade(state3, courseId);
              if (Math.abs(grade2 - grade3) > 0.1) return false; // allow rounding tolerance
            }

            return true;
          }
        )
      );
    });

    it('is immutable (original state unchanged)', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.float({ min: 0, max: 100 }), (state, days) => {
          if (!Number.isFinite(state.day)) return true; // skip NaN states
          const originalDay = state.day;
          const originalResolved = state.items.filter((item) => item.resolved).length;
          advance(state, days);
          return (
            state.day === originalDay &&
            state.items.filter((item) => item.resolved).length === originalResolved
          );
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(arbProcessionState(), fc.float({ min: 0, max: 100 }), (state, days) => {
          if (!Number.isFinite(state.day)) return true; // skip NaN states
          const { state: newState1, arrivals: arrivals1 } = advance(state, days);
          const { state: newState2, arrivals: arrivals2 } = advance(state, days);
          return (
            newState1.day === newState2.day &&
            arrivals1.length === arrivals2.length &&
            arrivals1.every((a, i) => a.itemId === arrivals2[i].itemId)
          );
        })
      );
    });
  });

  describe('letterGrade', () => {
    it('always returns A/B/C/D/F', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 100 }), (grade) => {
          const letter = letterGrade(grade);
          return ['A', 'B', 'C', 'D', 'F'].includes(letter);
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 100 }), (grade) => {
          const letter1 = letterGrade(grade);
          const letter2 = letterGrade(grade);
          return letter1 === letter2;
        })
      );
    });

    it('grade >= 90 implies A', () => {
      fc.assert(
        fc.property(fc.float({ min: 90, max: 100 }), (grade) => {
          if (!Number.isFinite(grade)) return true; // skip NaN/Infinity
          return letterGrade(grade) === 'A';
        })
      );
    });

    it('grade < 50 implies F', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: Math.fround(49.99) }), (grade) => {
          return letterGrade(grade) === 'F';
        })
      );
    });
  });
});
