/**
 * Unit tests for targeting logic.
 * Ref: tasks.md 1.5.3
 */

import { describe, it, expect } from 'vitest';
import { selectTarget } from './targeting';
import type { TowerStats, EnemyStats } from './types';

describe('targeting', () => {
  const createTower = (overrides?: Partial<TowerStats>): TowerStats => ({
    courseId: 'CV101',
    x: 200,
    y: 100,
    range: 150,
    damage: 10,
    fireRate: 1,
    lastFiredAt: 0,
    upgrades: { damage: 0, speed: 0, range: 0 },
    ...overrides
  });

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
    progress: 0.5,
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

  describe('selectTarget', () => {
    it('returns null when no enemies', () => {
      const tower = createTower();
      const target = selectTarget(tower, []);
      expect(target).toBeNull();
    });

    it('returns null when no enemies in range', () => {
      const tower = createTower({ x: 200, y: 100, range: 50 });
      const enemies = [
        createEnemy({ x: 500, y: 100 }) // too far
      ];
      const target = selectTarget(tower, enemies);
      expect(target).toBeNull();
    });

    it('returns null when all enemies have 0 HP', () => {
      const tower = createTower();
      const enemies = [
        createEnemy({ hp: 0 }),
        createEnemy({ id: 'enemy-2', hp: 0 })
      ];
      const target = selectTarget(tower, enemies);
      expect(target).toBeNull();
    });

    it('targets enemy in range', () => {
      const tower = createTower({ x: 200, y: 100, range: 150 });
      const enemy = createEnemy({ x: 300, y: 100 });
      const target = selectTarget(tower, [enemy]);
      expect(target).toBe(enemy);
    });

    it('prioritizes same course over different course', () => {
      const tower = createTower({ courseId: 'CV101', x: 200, y: 100, range: 200 });
      const sameCourseEnemy = createEnemy({ 
        id: 'same',
        courseId: 'CV101',
        x: 350,
        y: 100,
        pathProgress: 0.3
      });
      const differentCourseEnemy = createEnemy({ 
        id: 'different',
        courseId: 'PHO101',
        x: 250,
        y: 100,
        pathProgress: 0.8 // closer to fortress
      });
      
      const target = selectTarget(tower, [differentCourseEnemy, sameCourseEnemy]);
      expect(target).toBe(sameCourseEnemy);
    });

    it('targets closest to fortress when no same-course enemies', () => {
      const tower = createTower({ courseId: 'CV101', x: 200, y: 100, range: 200 });
      const far = createEnemy({ 
        id: 'far',
        courseId: 'PHO101',
        x: 350,
        y: 100,
        pathProgress: 0.3
      });
      const near = createEnemy({ 
        id: 'near',
        courseId: 'PHO101',
        x: 250,
        y: 100,
        pathProgress: 0.8
      });
      
      const target = selectTarget(tower, [far, near]);
      expect(target).toBe(near);
    });

    it('breaks ties by HP when path progress is equal', () => {
      const tower = createTower({ x: 200, y: 100, range: 200 });
      const lowHp = createEnemy({ 
        id: 'low',
        courseId: 'PHO101',
        x: 300,
        y: 100,
        pathProgress: 0.5,
        hp: 30,
        maxHp: 50
      });
      const highHp = createEnemy({ 
        id: 'high',
        courseId: 'PHO101',
        x: 350,
        y: 100,
        pathProgress: 0.5,
        hp: 50,
        maxHp: 50
      });
      
      const target = selectTarget(tower, [lowHp, highHp]);
      expect(target).toBe(highHp);
    });

    it('combines all priority rules correctly', () => {
      const tower = createTower({ courseId: 'CV101', x: 200, y: 100, range: 300 });
      
      // Enemy 1: Same course, low progress, low HP
      const enemy1 = createEnemy({ 
        id: 'e1',
        courseId: 'CV101',
        x: 400,
        y: 100,
        pathProgress: 0.3,
        hp: 30
      });
      
      // Enemy 2: Same course, high progress, high HP (should win)
      const enemy2 = createEnemy({ 
        id: 'e2',
        courseId: 'CV101',
        x: 250,
        y: 100,
        pathProgress: 0.9,
        hp: 50
      });
      
      // Enemy 3: Different course, highest progress, high HP
      const enemy3 = createEnemy({ 
        id: 'e3',
        courseId: 'PHO101',
        x: 220,
        y: 100,
        pathProgress: 0.95,
        hp: 50
      });
      
      const target = selectTarget(tower, [enemy1, enemy3, enemy2]);
      expect(target).toBe(enemy2); // Same course beats higher progress from different course
    });

    it('respects range boundary exactly', () => {
      const tower = createTower({ x: 200, y: 100, range: 100 });
      
      // Exactly at range boundary
      const atBoundary = createEnemy({ 
        id: 'at',
        x: 300,
        y: 100 // distance = 100
      });
      
      // Just outside range
      const outsideRange = createEnemy({ 
        id: 'out',
        x: 301,
        y: 100 // distance > 100
      });
      
      const target1 = selectTarget(tower, [atBoundary]);
      expect(target1).toBe(atBoundary);
      
      const target2 = selectTarget(tower, [outsideRange]);
      expect(target2).toBeNull();
    });

    it('handles enemies at same position', () => {
      const tower = createTower({ x: 200, y: 100, range: 150 });
      const enemy1 = createEnemy({ 
        id: 'e1',
        x: 300,
        y: 100,
        pathProgress: 0.5,
        hp: 40
      });
      const enemy2 = createEnemy({ 
        id: 'e2',
        x: 300,
        y: 100,
        pathProgress: 0.5,
        hp: 50
      });
      
      const target = selectTarget(tower, [enemy1, enemy2]);
      expect(target).toBe(enemy2); // Higher HP
    });

    it('calculates distance in 2D correctly', () => {
      const tower = createTower({ x: 0, y: 0, range: 100 });
      
      // Enemy at (60, 80) = distance 100 (Pythagorean triple: 3-4-5 scaled)
      const inRange = createEnemy({ 
        id: 'in',
        x: 60,
        y: 80
      });
      
      // Enemy at (80, 80) = distance ~113.14
      const outRange = createEnemy({ 
        id: 'out',
        x: 80,
        y: 80
      });
      
      const target1 = selectTarget(tower, [inRange]);
      expect(target1).toBe(inRange);
      
      const target2 = selectTarget(tower, [outRange]);
      expect(target2).toBeNull();
    });
  });
});
