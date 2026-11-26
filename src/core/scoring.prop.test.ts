import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  calculateUrgency,
  calculateRisk,
  priorityScore,
  enemyHpMultiplier,
  enemySpeedMultiplier,
  fortressDamage,
  daysUntilDue,
} from './scoring';

describe('scoring (property-based tests)', () => {
  describe('calculateUrgency invariants', () => {
    it('urgency is always between 0.1 and 1.0 for non-negative days', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (days) => {
          const urgency = calculateUrgency(days);
          expect(urgency).toBeGreaterThanOrEqual(0.1);
          expect(urgency).toBeLessThanOrEqual(1.0);
        })
      );
    });

    it('urgency is always >= 0.1 for any days', () => {
      fc.assert(
        fc.property(fc.integer({ min: -100, max: 1000 }), (days) => {
          const urgency = calculateUrgency(days);
          expect(urgency).toBeGreaterThanOrEqual(0.1);
        })
      );
    });

    it('urgency decreases monotonically as days increase (for positive days)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (days, delta) => {
            const urgency1 = calculateUrgency(days);
            const urgency2 = calculateUrgency(days + delta);
            expect(urgency1).toBeGreaterThanOrEqual(urgency2);
          }
        )
      );
    });
  });

  describe('calculateRisk invariants', () => {
    it('risk is always between 0.0 and 1.0', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (grade) => {
          const risk = calculateRisk(grade);
          expect(risk).toBeGreaterThanOrEqual(0.0);
          expect(risk).toBeLessThanOrEqual(1.0);
        })
      );
    });

    it('risk is 0.5 for null grade', () => {
      expect(calculateRisk(null)).toBe(0.5);
    });

    it('risk decreases as grade increases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 1, max: 100 }),
          (grade1, delta) => {
            const grade2 = Math.min(100, grade1 + delta);
            const risk1 = calculateRisk(grade1);
            const risk2 = calculateRisk(grade2);
            expect(risk1).toBeGreaterThanOrEqual(risk2);
          }
        )
      );
    });
  });

  describe('priorityScore invariants', () => {
    it('priority is always positive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          fc.integer({ min: 0, max: 200 }),
          (days, grade, points) => {
            const priority = priorityScore(days, grade, points);
            expect(priority).toBeGreaterThan(0);
          }
        )
      );
    });

    it('is deterministic (same inputs produce same output)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          fc.integer({ min: 0, max: 200 }),
          (days, grade, points) => {
            const score1 = priorityScore(days, grade, points);
            const score2 = priorityScore(days, grade, points);
            expect(score1).toBe(score2);
          }
        )
      );
    });
  });

  describe('enemyHpMultiplier invariants', () => {
    it('HP multiplier is always >= 1.0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 1.0, noNaN: true }),
          fc.integer({ min: 0, max: 200 }),
          (urgency, points) => {
            const multiplier = enemyHpMultiplier(urgency, points);
            expect(multiplier).toBeGreaterThanOrEqual(1.0);
          }
        )
      );
    });

    it('HP multiplier is always positive', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.0, max: 2.0, noNaN: true }),
          fc.integer({ min: 0, max: 500 }),
          (urgency, points) => {
            const multiplier = enemyHpMultiplier(urgency, points);
            expect(multiplier).toBeGreaterThan(0);
          }
        )
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 1.0, noNaN: true }),
          fc.integer({ min: 0, max: 200 }),
          (urgency, points) => {
            const mult1 = enemyHpMultiplier(urgency, points);
            const mult2 = enemyHpMultiplier(urgency, points);
            expect(mult1).toBe(mult2);
          }
        )
      );
    });
  });

  describe('enemySpeedMultiplier invariants', () => {
    it('speed multiplier is always >= 1.0', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.1, max: 1.0, noNaN: true }), (urgency) => {
          const multiplier = enemySpeedMultiplier(urgency);
          expect(multiplier).toBeGreaterThanOrEqual(1.0);
        })
      );
    });

    it('speed multiplier is always positive', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.0, max: 2.0, noNaN: true }), (urgency) => {
          const multiplier = enemySpeedMultiplier(urgency);
          expect(multiplier).toBeGreaterThan(0);
        })
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.double({ min: 0.1, max: 1.0, noNaN: true }), (urgency) => {
          const mult1 = enemySpeedMultiplier(urgency);
          const mult2 = enemySpeedMultiplier(urgency);
          expect(mult1).toBe(mult2);
        })
      );
    });
  });

  describe('fortressDamage invariants', () => {
    it('damage is always non-negative', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 500 }), (points) => {
          const damage = fortressDamage(points);
          expect(damage).toBeGreaterThanOrEqual(0);
        })
      );
    });

    it('damage increases with points', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 400 }),
          fc.integer({ min: 10, max: 100 }),
          (points, delta) => {
            const damage1 = fortressDamage(points);
            const damage2 = fortressDamage(points + delta);
            expect(damage2).toBeGreaterThanOrEqual(damage1);
          }
        )
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 500 }), (points) => {
          const dmg1 = fortressDamage(points);
          const dmg2 = fortressDamage(points);
          expect(dmg1).toBe(dmg2);
        })
      );
    });
  });

  describe('daysUntilDue invariants', () => {
    it('is deterministic', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') }),
          fc.integer({ min: 0, max: 1e12 }),
          (dueDate, now) => {
            const days1 = daysUntilDue(dueDate, now);
            const days2 = daysUntilDue(dueDate, now);
            expect(days1).toBe(days2);
          }
        )
      );
    });

    it('returns positive for future dates', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2026-01-02'), max: new Date('2100-01-01') }),
          (dueDate: Date) => {
            // Skip invalid dates
            if (isNaN(dueDate.getTime())) return true;
            
            const now = new Date('2026-01-01').getTime();
            const days = daysUntilDue(dueDate, now);
            expect(days).toBeGreaterThan(0);
          }
        )
      );
    });

    it('returns negative for past dates', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2025-12-31') }),
          (dueDate: Date) => {
            const now = new Date('2026-01-01').getTime();
            const days = daysUntilDue(dueDate, now);
            expect(days).toBeLessThan(0);
          }
        )
      );
    });
  });
});
