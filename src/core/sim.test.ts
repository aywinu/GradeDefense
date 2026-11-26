/**
 * Tests for simulation module
 */

import { describe, it, expect } from 'vitest';
import { stepSimulation } from './sim';
import type { GameState, EnemyStats, TowerStats } from './types';
import { mulberry32 } from './rng';
import { Layout } from '../game/layout';

describe('stepSimulation', () => {
  // Helper to create minimal game state
  function createGameState(overrides?: Partial<GameState>): GameState {
    return {
      wave: 1,
      gold: 0,
      fortressHp: 100,
      maxFortressHp: 100,
      towers: [],
      enemies: [],
      chargeMeter: 0,
      answeredQuestions: [],
      lastAnswerTime: 0,
      ...overrides,
    };
  }

  // Helper to create a tower
  function createTower(overrides?: Partial<TowerStats>): TowerStats {
    return {
      courseId: 'CV101',
      x: 260,
      y: 450,
      range: 150,
      damage: 10,
      fireRate: 1,
      lastFiredAt: 0,
      upgrades: { damage: 0, speed: 0, range: 0 },
      ...overrides,
    };
  }

  // Helper to create an enemy
  function createEnemy(overrides?: Partial<EnemyStats>): EnemyStats {
    return {
      id: 'enemy-1',
      courseId: 'CV101',
      itemId: 'CV101-midterm',
      type: 'assignment',
      hp: 50,
      maxHp: 50,
      speed: 100, // px/s
      damage: 10,
      lane: 0,
      progress: 0,
      x: 1650,
      y: 450,
      pathProgress: 0,
      spawnedAt: Date.now(),
      spawnDelayMs: 0,
      label: 'Assignment 1',
      daysLeft: 7,
      lastDamagedAt: null,
      neglected: false,
      ...overrides,
    };
  }

  const rng = mulberry32(42);

  describe('enemy movement', () => {
    it('should move enemies left by speed * dt', () => {
      const enemy = createEnemy({ x: 1000, speed: 100 });
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng); // 1 second
      
      expect(result.state.enemies[0].x).toBe(900); // 1000 - 100*1
    });

    it('should update progress as enemy moves', () => {
      const enemy = createEnemy({ x: 1650 }); // At spawn
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 10000, rng); // 10 seconds at 100px/s = 1000px
      
      const movedEnemy = result.state.enemies[0];
      expect(movedEnemy.x).toBe(650); // 1650 - 1000
      
      // Progress should be ~0.67 (moved 1000px out of 1500px total)
      const expectedProgress = 1 - (650 - Layout.FORTRESS_X_MAX) / (Layout.ENEMY_SPAWN_X - Layout.FORTRESS_X_MAX);
      expect(movedEnemy.progress).toBeCloseTo(expectedProgress, 2);
    });

    it('should handle multiple enemies moving independently', () => {
      const enemy1 = createEnemy({ id: 'e1', x: 1000, speed: 100 });
      const enemy2 = createEnemy({ id: 'e2', x: 800, speed: 50 });
      const state = createGameState({ enemies: [enemy1, enemy2] });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies[0].x).toBe(900); // 1000 - 100
      expect(result.state.enemies[1].x).toBe(750); // 800 - 50
    });
  });

  describe('fortress damage', () => {
    it('should apply damage when enemy reaches fortress', () => {
      // Enemy starts already at or past fortress threshold
      const enemy = createEnemy({ x: 145, speed: 1, damage: 15 }); // Already past threshold
      const state = createGameState({ enemies: [enemy], fortressHp: 100 });
      
      const result = stepSimulation(state, 1000, rng);
      
      // 100 (start) - 15 (fortress damage) + 10 (wave clear 10% regen) = 95
      expect(result.state.fortressHp).toBe(95);
    });

    it('should emit fortressHit event', () => {
      const enemy = createEnemy({ id: 'enemy-1', x: 160, damage: 15 });
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      const fortressHitEvent = result.events.find(e => e.type === 'fortressHit');
      expect(fortressHitEvent).toBeDefined();
      expect(fortressHitEvent).toMatchObject({
        type: 'fortressHit',
        enemyId: 'enemy-1',
        damage: 15,
      });
    });

    it('should remove enemy after reaching fortress', () => {
      const enemy = createEnemy({ x: 160 });
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies.length).toBe(0);
    });
  });

  describe('tower firing', () => {
    it('should fire at enemy in range', () => {
      const tower = createTower({ x: 260, y: 450, range: 200, damage: 10, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 400, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies[0].hp).toBe(40); // 50 - 10
    });

    it('should not fire if on cooldown', () => {
      const now = Date.now();
      const tower = createTower({ fireRate: 1, lastFiredAt: now - 500 }); // Fired 0.5s ago, needs 1s cooldown
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 100, rng);
      
      expect(result.state.enemies[0].hp).toBe(50); // No damage
      expect(result.events.filter(e => e.type === 'projectile').length).toBe(0);
    });

    it('should respect fire rate', async () => {
      const tower = createTower({ fireRate: 2, lastFiredAt: 0 }); // 2 shots/sec = 500ms cooldown
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      // First shot
      const result1 = stepSimulation(state, 100, rng);
      expect(result1.events.filter(e => e.type === 'projectile').length).toBe(1);
      
      // Wait 300ms (total 400ms, not enough for next shot)
      await new Promise(resolve => setTimeout(resolve, 300));
      const result2 = stepSimulation(result1.state, 300, rng);
      expect(result2.events.filter(e => e.type === 'projectile').length).toBe(0);
      
      // Wait another 250ms (total 650ms, enough for next shot)
      await new Promise(resolve => setTimeout(resolve, 250));
      const result3 = stepSimulation(result2.state, 250, rng);
      expect(result3.events.filter(e => e.type === 'projectile').length).toBe(1);
    });

    it('should not fire at enemies out of range', () => {
      const tower = createTower({ x: 260, range: 100 });
      const enemy = createEnemy({ x: 500 }); // Too far
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.events.filter(e => e.type === 'projectile').length).toBe(0);
    });

    it('should emit projectile event', () => {
      const tower = createTower({ courseId: 'CV101', x: 260, y: 450, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      const projectileEvent = result.events.find(e => e.type === 'projectile');
      expect(projectileEvent).toMatchObject({
        type: 'projectile',
        fromX: 260,
        fromY: 450,
        toX: 300,
        toY: 450,
        towerId: 'CV101',
      });
    });

    it('should emit hit event', () => {
      const tower = createTower({ damage: 15, lastFiredAt: 0 });
      const enemy = createEnemy({ id: 'enemy-1', x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      const hitEvent = result.events.find(e => e.type === 'hit');
      expect(hitEvent).toMatchObject({
        type: 'hit',
        enemyId: 'enemy-1',
        damage: 15,
        x: 300,
        y: 450,
      });
    });

    it('should update lastDamagedAt when enemy is hit', () => {
      const tower = createTower({ lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, lastDamagedAt: null }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies[0].lastDamagedAt).not.toBeNull();
    });
  });

  describe('enemy kills', () => {
    it('should grant gold when enemy is killed', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 }); // Overkill
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy], gold: 0 });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.gold).toBe(60); // 10 (kill) + 50 (wave cleared bonus)
    });

    it('should emit kill event', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ id: 'enemy-1', hp: 50, x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      const killEvent = result.events.find(e => e.type === 'kill');
      expect(killEvent).toMatchObject({
        type: 'kill',
        enemyId: 'enemy-1',
        gold: 10,
        x: 300,
        y: 450,
      });
    });

    it('should remove killed enemy', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies.length).toBe(0);
    });
  });

  describe('wave cleared', () => {
    it('should emit waveCleared event when last enemy is removed', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy], wave: 3 });
      
      const result = stepSimulation(state, 1000, rng);
      
      const waveClearedEvent = result.events.find(e => e.type === 'waveCleared');
      expect(waveClearedEvent).toMatchObject({
        type: 'waveCleared',
        wave: 3,
      });
    });

    it('should grant wave clear bonuses', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({
        towers: [tower],
        enemies: [enemy],
        gold: 0,
        fortressHp: 80,
        maxFortressHp: 100,
      });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.gold).toBe(60); // 10 (kill) + 50 (wave bonus)
      expect(result.state.fortressHp).toBe(90); // 80 + 10% of 100
    });

    it('should not exceed max fortress HP', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({
        towers: [tower],
        enemies: [enemy],
        fortressHp: 95,
        maxFortressHp: 100,
      });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.fortressHp).toBe(100); // Capped at max
    });

    it('should emit waveCleared only once', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result1 = stepSimulation(state, 1000, rng);
      expect(result1.events.filter(e => e.type === 'waveCleared').length).toBe(1);
      
      // Next frame, no enemies, should not emit again
      const result2 = stepSimulation(result1.state, 1000, rng);
      expect(result2.events.filter(e => e.type === 'waveCleared').length).toBe(0);
    });
  });

  describe('immutability', () => {
    it('should not mutate input state', () => {
      const tower = createTower({ damage: 10, lastFiredAt: 0 });
      const enemy = createEnemy({ hp: 50 });
      const state = createGameState({ towers: [tower], enemies: [enemy], gold: 0 });
      
      const originalGold = state.gold;
      const originalEnemyHp = state.enemies[0].hp;
      const originalEnemyX = state.enemies[0].x;
      
      stepSimulation(state, 1000, rng);
      
      expect(state.gold).toBe(originalGold);
      expect(state.enemies[0].hp).toBe(originalEnemyHp);
      expect(state.enemies[0].x).toBe(originalEnemyX);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple towers firing at different enemies', () => {
      const tower1 = createTower({ courseId: 'CV101', x: 260, y: 200, lastFiredAt: 0 });
      const tower2 = createTower({ courseId: 'PHO101', x: 260, y: 400, lastFiredAt: 0 });
      const enemy1 = createEnemy({ id: 'e1', courseId: 'CV101', x: 300, y: 200, hp: 50 });
      const enemy2 = createEnemy({ id: 'e2', courseId: 'PHO101', x: 300, y: 400, hp: 50 });
      
      const state = createGameState({
        towers: [tower1, tower2],
        enemies: [enemy1, enemy2],
      });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies[0].hp).toBe(40); // Both hit
      expect(result.state.enemies[1].hp).toBe(40);
      expect(result.events.filter(e => e.type === 'projectile').length).toBe(2);
    });

    it('should handle wave where some enemies are killed and some reach fortress', () => {
      const tower = createTower({ damage: 100, x: 260, range: 100, lastFiredAt: 0 });
      const enemy1 = createEnemy({ id: 'e1', x: 300, hp: 50, damage: 10 }); // Will be killed (in range)
      const enemy2 = createEnemy({ id: 'e2', x: 145, speed: 1, hp: 50, damage: 15 }); // Will reach fortress (out of range, already there)
      
      const state = createGameState({
        towers: [tower],
        enemies: [enemy1, enemy2],
        fortressHp: 100,
        gold: 0,
      });
      
      const result = stepSimulation(state, 1000, rng);
      
      expect(result.state.enemies.length).toBe(0); // Both removed
      expect(result.state.gold).toBe(60); // 10 (e1 kill) + 50 (wave cleared bonus)
      // 100 (start) - 15 (fortress damage) + 10 (wave clear 10% regen) = 95
      expect(result.state.fortressHp).toBe(95);
      expect(result.events.filter(e => e.type === 'kill').length).toBe(1);
      expect(result.events.filter(e => e.type === 'fortressHit').length).toBe(1);
    });
  });
});
