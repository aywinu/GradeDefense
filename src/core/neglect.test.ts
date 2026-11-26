/**
 * Unit tests for neglect buff logic.
 * Ref: tasks.md 1.6.3
 */

import { describe, it, expect } from 'vitest';
import { 
  applyNeglectBuff, 
  shouldApplyNeglectBuff,
  NEGLECT_THRESHOLD_MS,
  NEGLECT_HP_MULTIPLIER,
  NEGLECT_SPEED_MULTIPLIER
} from './neglect';
import type { EnemyStats } from './types';

describe('neglect', () => {
  const createEnemy = (overrides?: Partial<EnemyStats>): EnemyStats => ({
    id: 'enemy-1',
    courseId: 'CV101',
    itemId: 'CV101-hw1',
    type: 'assignment',
    hp: 50,
    maxHp: 50,
    speed: 30,
    damage: 10,
    lane: 0,
    progress: 0,
    x: 300,
    y: 100,
    pathProgress: 0.5,
    spawnedAt: 1000,
    spawnDelayMs: 0,
    label: 'Test Item',
    daysLeft: 7,
    lastDamagedAt: null,
    neglected: false,
    ...overrides
  });

  describe('applyNeglectBuff', () => {
    it('does not apply buff if enemy was recently spawned', () => {
      const enemy = createEnemy({ spawnedAt: 1000 });
      const elapsedTime = 1000 + 30000; // 30 seconds alive
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result).toBe(enemy); // unchanged
      expect(result.neglected).toBe(false);
      expect(result.hp).toBe(50);
      expect(result.speed).toBe(30);
    });

    it('applies buff after neglect threshold', () => {
      const enemy = createEnemy({ spawnedAt: 1000, hp: 50, maxHp: 50, speed: 30 });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS; // exactly at threshold
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result.neglected).toBe(true);
      expect(result.hp).toBe(50 * NEGLECT_HP_MULTIPLIER);
      expect(result.maxHp).toBe(50 * NEGLECT_HP_MULTIPLIER);
      expect(result.speed).toBe(30 * NEGLECT_SPEED_MULTIPLIER);
    });

    it('applies buff well after threshold', () => {
      const enemy = createEnemy({ spawnedAt: 1000, hp: 50, maxHp: 50, speed: 30 });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS + 30000; // 90 seconds alive
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result.neglected).toBe(true);
      expect(result.hp).toBe(50 * NEGLECT_HP_MULTIPLIER);
      expect(result.maxHp).toBe(50 * NEGLECT_HP_MULTIPLIER);
      expect(result.speed).toBe(30 * NEGLECT_SPEED_MULTIPLIER);
    });

    it('does not apply buff if already buffed', () => {
      const enemy = createEnemy({ 
        spawnedAt: 1000,
        hp: 75, // already buffed HP
        maxHp: 75,
        speed: 37.5,
        neglected: true
      });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS + 10000;
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result).toBe(enemy); // unchanged
      expect(result.hp).toBe(75); // no double buffing
    });

    it('does not apply buff if enemy was damaged', () => {
      const enemy = createEnemy({ 
        spawnedAt: 1000,
        lastDamagedAt: 50000
      });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS + 10000;
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result).toBe(enemy); // unchanged
      expect(result.neglected).toBe(false);
    });

    it('does not apply buff if enemy was damaged even once', () => {
      const enemy = createEnemy({ 
        spawnedAt: 1000,
        lastDamagedAt: 2000 // damaged early
      });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS + 10000;
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result).toBe(enemy);
      expect(result.neglected).toBe(false);
    });

    it('applies buff only once', () => {
      const enemy = createEnemy({ spawnedAt: 1000, hp: 50, maxHp: 50, speed: 30 });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS;
      
      // First application
      const buffed = applyNeglectBuff(enemy, elapsedTime);
      expect(buffed.neglected).toBe(true);
      expect(buffed.hp).toBe(75);
      
      // Second application (should not change)
      const stillBuffed = applyNeglectBuff(buffed, elapsedTime + 10000);
      expect(stillBuffed).toBe(buffed); // same reference
      expect(stillBuffed.hp).toBe(75); // not 112.5
    });

    it('preserves current HP correctly', () => {
      const enemy = createEnemy({ 
        spawnedAt: 1000,
        hp: 30, // damaged but not marked
        maxHp: 50,
        speed: 30,
        lastDamagedAt: null // but we're checking this
      });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS;
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result.hp).toBe(30 * NEGLECT_HP_MULTIPLIER); // 45
      expect(result.maxHp).toBe(50 * NEGLECT_HP_MULTIPLIER); // 75
    });

    it('handles zero spawn time', () => {
      const enemy = createEnemy({ spawnedAt: 0, hp: 50, maxHp: 50, speed: 30 });
      const elapsedTime = NEGLECT_THRESHOLD_MS;
      
      const result = applyNeglectBuff(enemy, elapsedTime);
      
      expect(result.neglected).toBe(true);
      expect(result.hp).toBe(75);
    });

    it('buff applies at exactly threshold, not before', () => {
      const enemy = createEnemy({ spawnedAt: 1000, hp: 50, maxHp: 50, speed: 30 });
      
      // 1ms before threshold
      const justBefore = applyNeglectBuff(enemy, 1000 + NEGLECT_THRESHOLD_MS - 1);
      expect(justBefore.neglected).toBe(false);
      
      // Exactly at threshold
      const exactly = applyNeglectBuff(enemy, 1000 + NEGLECT_THRESHOLD_MS);
      expect(exactly.neglected).toBe(true);
    });
  });

  describe('shouldApplyNeglectBuff', () => {
    it('returns false for newly spawned enemy', () => {
      const enemy = createEnemy({ spawnedAt: 1000 });
      const elapsedTime = 1000 + 30000;
      
      expect(shouldApplyNeglectBuff(enemy, elapsedTime)).toBe(false);
    });

    it('returns true after threshold', () => {
      const enemy = createEnemy({ spawnedAt: 1000 });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS;
      
      expect(shouldApplyNeglectBuff(enemy, elapsedTime)).toBe(true);
    });

    it('returns false if already buffed', () => {
      const enemy = createEnemy({ spawnedAt: 1000, neglected: true });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS + 10000;
      
      expect(shouldApplyNeglectBuff(enemy, elapsedTime)).toBe(false);
    });

    it('returns false if damaged', () => {
      const enemy = createEnemy({ spawnedAt: 1000, lastDamagedAt: 50000 });
      const elapsedTime = 1000 + NEGLECT_THRESHOLD_MS + 10000;
      
      expect(shouldApplyNeglectBuff(enemy, elapsedTime)).toBe(false);
    });

    it('matches applyNeglectBuff behavior', () => {
      const testCases = [
        { spawnedAt: 1000, elapsedTime: 1000 + 30000, lastDamagedAt: null, neglected: false },
        { spawnedAt: 1000, elapsedTime: 1000 + 60000, lastDamagedAt: null, neglected: false },
        { spawnedAt: 1000, elapsedTime: 1000 + 90000, lastDamagedAt: 50000, neglected: false },
        { spawnedAt: 1000, elapsedTime: 1000 + 90000, lastDamagedAt: null, neglected: true },
      ];

      testCases.forEach(({ spawnedAt, elapsedTime, lastDamagedAt, neglected }) => {
        const enemy = createEnemy({ spawnedAt, lastDamagedAt, neglected });
        const shouldBuff = shouldApplyNeglectBuff(enemy, elapsedTime);
        const applied = applyNeglectBuff(enemy, elapsedTime);
        
        if (shouldBuff) {
          expect(applied.neglected).toBe(true);
          expect(applied).not.toBe(enemy);
        } else {
          expect(applied).toBe(enemy);
        }
      });
    });
  });

  describe('constants', () => {
    it('NEGLECT_THRESHOLD_MS is 60 seconds', () => {
      expect(NEGLECT_THRESHOLD_MS).toBe(60000);
    });

    it('NEGLECT_HP_MULTIPLIER is 1.5', () => {
      expect(NEGLECT_HP_MULTIPLIER).toBe(1.5);
    });

    it('NEGLECT_SPEED_MULTIPLIER is 1.25', () => {
      expect(NEGLECT_SPEED_MULTIPLIER).toBe(1.25);
    });
  });
});
