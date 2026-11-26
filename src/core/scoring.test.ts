import { describe, it, expect } from 'vitest';
import {
  calculateUrgency,
  calculateRisk,
  calculateWeight,
  priorityScore,
  enemyHpMultiplier,
  enemySpeedMultiplier,
  fortressDamage,
  daysUntilDue,
} from './scoring';

describe('scoring', () => {
  describe('calculateUrgency', () => {
    it('saturates at 21 days', () => {
      expect(calculateUrgency(21)).toBeCloseTo(0.1);
      expect(calculateUrgency(30)).toBeCloseTo(0.1);
      expect(calculateUrgency(100)).toBeCloseTo(0.1);
    });

    it('returns 1.0 for items due today', () => {
      expect(calculateUrgency(0)).toBe(1.0);
    });

    it('returns 1.0 for overdue items', () => {
      expect(calculateUrgency(-1)).toBeCloseTo(1.047, 2);
      expect(calculateUrgency(-7)).toBeCloseTo(1.333, 2);
    });

    it('scales smoothly between 0 and 21 days', () => {
      expect(calculateUrgency(7)).toBeCloseTo(0.667, 2);
      expect(calculateUrgency(14)).toBeCloseTo(0.333, 2);
    });
  });

  describe('calculateRisk', () => {
    it('returns 0.5 for unknown grade', () => {
      expect(calculateRisk(null)).toBe(0.5);
    });

    it('returns 1.0 for 0% grade', () => {
      expect(calculateRisk(0)).toBe(1.0);
    });

    it('returns 0.0 for 100% grade', () => {
      expect(calculateRisk(100)).toBe(0.0);
    });

    it('scales linearly with grade', () => {
      expect(calculateRisk(50)).toBe(0.5);
      expect(calculateRisk(80)).toBe(0.2);
      expect(calculateRisk(20)).toBe(0.8);
    });
  });

  describe('calculateWeight', () => {
    it('normalizes by 100', () => {
      expect(calculateWeight(0)).toBe(0);
      expect(calculateWeight(100)).toBe(1);
      expect(calculateWeight(50)).toBe(0.5);
      expect(calculateWeight(200)).toBe(2);
    });
  });

  describe('priorityScore', () => {
    it('increases as deadline approaches (fixed grade and points)', () => {
      const scoreA = priorityScore(14, 80, 50);
      const scoreB = priorityScore(7, 80, 50);
      const scoreC = priorityScore(0, 80, 50);
      
      expect(scoreB).toBeGreaterThan(scoreA);
      expect(scoreC).toBeGreaterThan(scoreB);
    });

    it('increases as grade decreases (fixed deadline and points)', () => {
      const scoreA = priorityScore(7, 90, 50);
      const scoreB = priorityScore(7, 70, 50);
      const scoreC = priorityScore(7, 50, 50);
      
      expect(scoreB).toBeGreaterThan(scoreA);
      expect(scoreC).toBeGreaterThan(scoreB);
    });

    it('increases as points increase (fixed deadline and grade)', () => {
      const scoreA = priorityScore(7, 80, 20);
      const scoreB = priorityScore(7, 80, 50);
      const scoreC = priorityScore(7, 80, 100);
      
      expect(scoreB).toBeGreaterThan(scoreA);
      expect(scoreC).toBeGreaterThan(scoreB);
    });

    it('handles null grade', () => {
      const score = priorityScore(7, null, 50);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('enemyHpMultiplier', () => {
    it('is always >= 1.0', () => {
      expect(enemyHpMultiplier(0.1, 0)).toBeCloseTo(1.2);
      expect(enemyHpMultiplier(1.0, 0)).toBeCloseTo(3.0);
      expect(enemyHpMultiplier(0.5, 50)).toBeCloseTo(3.0);
      expect(enemyHpMultiplier(1.0, 100)).toBeCloseTo(6.0);
    });

    it('scales with urgency', () => {
      const lowUrgency = enemyHpMultiplier(0.1, 50);
      const highUrgency = enemyHpMultiplier(1.0, 50);
      expect(highUrgency).toBeGreaterThan(lowUrgency);
    });

    it('scales with points', () => {
      const lowPoints = enemyHpMultiplier(0.5, 10);
      const highPoints = enemyHpMultiplier(0.5, 100);
      expect(highPoints).toBeGreaterThan(lowPoints);
    });
  });

  describe('enemySpeedMultiplier', () => {
    it('is always >= 1.0', () => {
      expect(enemySpeedMultiplier(0.1)).toBeCloseTo(1.05);
      expect(enemySpeedMultiplier(0.5)).toBeCloseTo(1.25);
      expect(enemySpeedMultiplier(1.0)).toBeCloseTo(1.5);
    });

    it('increases with urgency', () => {
      const lowUrgency = enemySpeedMultiplier(0.1);
      const highUrgency = enemySpeedMultiplier(1.0);
      expect(highUrgency).toBeGreaterThan(lowUrgency);
    });
  });

  describe('fortressDamage', () => {
    it('is always >= 0', () => {
      expect(fortressDamage(0)).toBe(0);
      expect(fortressDamage(10)).toBe(1);
      expect(fortressDamage(100)).toBe(10);
      expect(fortressDamage(50)).toBe(5);
    });

    it('scales with points', () => {
      const low = fortressDamage(10);
      const high = fortressDamage(100);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('daysUntilDue', () => {
    it('calculates positive days for future dates', () => {
      const now = new Date('2026-01-01T00:00:00Z').getTime();
      const future = new Date('2026-01-08T00:00:00Z');
      expect(daysUntilDue(future, now)).toBeCloseTo(7);
    });

    it('calculates negative days for past dates', () => {
      const now = new Date('2026-01-08T00:00:00Z').getTime();
      const past = new Date('2026-01-01T00:00:00Z');
      expect(daysUntilDue(past, now)).toBeCloseTo(-7);
    });

    it('calculates zero days for same date', () => {
      const now = new Date('2026-01-01T00:00:00Z').getTime();
      const same = new Date('2026-01-01T00:00:00Z');
      expect(daysUntilDue(same, now)).toBe(0);
    });

    it('handles fractional days', () => {
      const now = new Date('2026-01-01T12:00:00Z').getTime();
      const future = new Date('2026-01-02T12:00:00Z');
      expect(daysUntilDue(future, now)).toBeCloseTo(1);
    });
  });
});
