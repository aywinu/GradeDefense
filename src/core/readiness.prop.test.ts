import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateReadiness,
  identifyWeakTopics,
  recommendTrialCount,
  threatLevel,
  trialQuestionPick,
  type TrialResult,
} from './readiness';

/**
 * Property-based tests for readiness core rules.
 * These tests verify invariants that should hold for all possible inputs.
 */

// Arbitrary generators
const arbTrialResult = fc.record({
  courseId: fc.constantFrom('CV101', 'PHO101', 'MGT101', 'DSA101', 'MKT101', 'MATH101'),
  timestamp: fc.integer({ min: 0, max: Date.now() }),
  score: fc.integer({ min: 0, max: 100 }),
  questionsAnswered: fc.array(
    fc.record({
      questionId: fc.string(),
      correct: fc.boolean(),
      topic: fc.option(fc.string(), { nil: undefined }),
    })
  ),
});

const arbTrialHistoryEntry = fc.record({
  courseId: fc.constantFrom('CV101', 'PHO101', 'MGT101', 'DSA101', 'MKT101', 'MATH101'),
  questionId: fc.string(),
  correct: fc.boolean(),
  atMs: fc.integer({ min: 0, max: Date.now() }),
});

describe('readiness (property-based tests)', () => {
  describe('calculateReadiness invariants', () => {
    it('returns value in [0, 100]', () => {
      fc.assert(
        fc.property(fc.array(arbTrialResult), (trials) => {
          const now = Date.now();
          const readiness = calculateReadiness(trials, now);
          expect(readiness).toBeGreaterThanOrEqual(0);
          expect(readiness).toBeLessThanOrEqual(100);
        })
      );
    });

    it('never decreases when adding trial with score ≥ current readiness', () => {
      fc.assert(
        fc.property(fc.array(arbTrialResult), fc.integer({ min: 0, max: 100 }), (trials, newScore) => {
          const now = Date.now();
          const currentReadiness = calculateReadiness(trials, now);
          
          if (newScore >= currentReadiness) {
            const newTrial: TrialResult = {
              courseId: 'CV101',
              timestamp: now - 1000,
              score: newScore,
              questionsAnswered: [],
            };
            const newReadiness = calculateReadiness([...trials, newTrial], now);
            expect(newReadiness).toBeGreaterThanOrEqual(currentReadiness);
          }
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.array(arbTrialResult), (trials) => {
          const now = Date.now();
          const readiness1 = calculateReadiness(trials, now);
          const readiness2 = calculateReadiness(trials, now);
          expect(readiness1).toBe(readiness2);
        })
      );
    });
  });

  describe('identifyWeakTopics invariants', () => {
    it('returns sorted array', () => {
      fc.assert(
        fc.property(fc.array(arbTrialResult), (trials) => {
          const weakTopics = identifyWeakTopics(trials);
          const sorted = [...weakTopics].sort();
          expect(weakTopics).toEqual(sorted);
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.array(arbTrialResult), (trials) => {
          const weakTopics1 = identifyWeakTopics(trials);
          const weakTopics2 = identifyWeakTopics(trials);
          expect(weakTopics1).toEqual(weakTopics2);
        })
      );
    });

    it('never includes topics with ≥50% correct rate', () => {
      fc.assert(
        fc.property(fc.array(arbTrialResult), (trials) => {
          const weakTopics = identifyWeakTopics(trials);
          
          // Manually compute topic stats to verify
          const topicStats = new Map<string, { correct: number; total: number }>();
          for (const trial of trials) {
            for (const q of trial.questionsAnswered) {
              if (!q.topic) continue;
              const stats = topicStats.get(q.topic) ?? { correct: 0, total: 0 };
              stats.total++;
              if (q.correct) stats.correct++;
              topicStats.set(q.topic, stats);
            }
          }
          
          for (const topic of weakTopics) {
            const stats = topicStats.get(topic);
            expect(stats).toBeDefined();
            if (stats) {
              expect(stats.total).toBeGreaterThanOrEqual(3);
              expect(stats.correct / stats.total).toBeLessThan(0.5);
            }
          }
        })
      );
    });
  });

  describe('recommendTrialCount invariants', () => {
    it('returns non-negative value', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (daysUntilDue, readiness) => {
          const count = recommendTrialCount(daysUntilDue, readiness);
          expect(count).toBeGreaterThanOrEqual(0);
        })
      );
    });

    it('returns 0 for 100% readiness', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (daysUntilDue) => {
          const count = recommendTrialCount(daysUntilDue, 100);
          expect(count).toBe(0);
        })
      );
    });

    it('returns 0 for overdue items', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (readiness) => {
          expect(recommendTrialCount(0, readiness)).toBe(0);
          expect(recommendTrialCount(-5, readiness)).toBe(0);
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 }), (daysUntilDue, readiness) => {
          const count1 = recommendTrialCount(daysUntilDue, readiness);
          const count2 = recommendTrialCount(daysUntilDue, readiness);
          expect(count1).toBe(count2);
        })
      );
    });

    it('increases as readiness decreases (fixed days)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 }), (daysUntilDue, readiness1) => {
          const readiness2 = Math.max(0, readiness1 - 10);
          const count1 = recommendTrialCount(daysUntilDue, readiness1);
          const count2 = recommendTrialCount(daysUntilDue, readiness2);
          
          // Lower readiness should recommend at least as many trials
          expect(count2).toBeGreaterThanOrEqual(count1);
        })
      );
    });

    it('increases as days increase (fixed readiness)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 }), (days1, readiness) => {
          const days2 = days1 + 7;
          const count1 = recommendTrialCount(days1, readiness);
          const count2 = recommendTrialCount(days2, readiness);
          
          // More days until due should recommend at least as many trials
          expect(count2).toBeGreaterThanOrEqual(count1);
        })
      );
    });
  });

  describe('threatLevel invariants', () => {
    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1.5 }), (priorityScore) => {
          const level1 = threatLevel(priorityScore);
          const level2 = threatLevel(priorityScore);
          expect(level1).toBe(level2);
        })
      );
    });

    it('returns valid level', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 1.5 }), (priorityScore) => {
          const level = threatLevel(priorityScore);
          expect(['Low', 'Medium', 'High', 'Critical']).toContain(level);
        })
      );
    });
  });

  describe('trialQuestionPick invariants', () => {
    it('returns at most n questions', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ id: fc.string(), courseId: fc.string() })),
          fc.array(arbTrialHistoryEntry),
          fc.integer({ min: 0, max: 20 }),
          (questions, history, n) => {
            const picked = trialQuestionPick(questions, history, n);
            expect(picked.length).toBeLessThanOrEqual(n);
            expect(picked.length).toBeLessThanOrEqual(questions.length);
          }
        )
      );
    });

    it('returns unique question IDs', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ id: fc.string(), courseId: fc.string() }), { minLength: 1 }),
          fc.array(arbTrialHistoryEntry),
          fc.integer({ min: 1, max: 10 }),
          (questions, history, n) => {
            const picked = trialQuestionPick(questions, history, n);
            const uniquePicked = new Set(picked);
            expect(picked.length).toBe(uniquePicked.size);
          }
        )
      );
    });

    it('with deterministic RNG is deterministic', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ id: fc.string(), courseId: fc.string() })),
          fc.array(arbTrialHistoryEntry),
          fc.integer({ min: 0, max: 20 }),
          (questions, history, n) => {
            const rng = () => 0.5;
            const picked1 = trialQuestionPick(questions, history, n, rng);
            const picked2 = trialQuestionPick(questions, history, n, rng);
            expect(picked1).toEqual(picked2);
          }
        )
      );
    });

    it('returns valid question IDs from pool', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ id: fc.string(), courseId: fc.string() }), { minLength: 1 }),
          fc.array(arbTrialHistoryEntry),
          fc.integer({ min: 1, max: 10 }),
          (questions, history, n) => {
            const picked = trialQuestionPick(questions, history, n);
            const questionIds = new Set(questions.map(q => q.id));
            for (const id of picked) {
              expect(questionIds.has(id)).toBe(true);
            }
          }
        )
      );
    });
  });
});
