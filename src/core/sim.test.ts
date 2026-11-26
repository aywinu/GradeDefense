/**
 * Tests for simulation module
 */

import { describe, it, expect } from 'vitest';
import { stepSimulation, type SimConfig } from './sim';
import type { GameState, EnemyStats, TowerStats } from './types';
import { mulberry32 } from './rng';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      pending: [],
      chargeMeter: 0,
      special: 0,
      answeredQuestions: [],
      lastAnswerTime: 0,
      timeMs: 0,
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
      spawnedAt: 0,
      spawnDelayMs: 0,
      label: 'Assignment 1',
      daysLeft: 7,
      lastDamagedAt: null,
      neglected: false,
      ...overrides,
    };
  }

  const rng = mulberry32(42);
  
  const config: SimConfig = {
    fortressX: 150,
    spawnX: 1650,
    waveStartTimeMs: 0,
  };

  describe('game time management', () => {
    it('should advance game clock by dtMs', () => {
      const state = createGameState({ timeMs: 0 });
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.timeMs).toBe(1000);
    });

    it('should use game time for tower cooldowns', () => {
      const tower = createTower({ fireRate: 1, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      // First shot at time 0
      const result1 = stepSimulation(state, 100, config, rng);
      expect(result1.events.filter(e => e.type === 'projectile').length).toBe(1);
      expect(result1.state.towers[0].lastFiredAt).toBe(100); // timeMs advanced to 100
      
      // Try to fire again at time 600ms (500ms after first shot, should fire because cooldown is 1000ms/1 = 1000ms)
      const result2 = stepSimulation(result1.state, 500, config, rng);
      expect(result2.state.timeMs).toBe(600);
      expect(result2.events.filter(e => e.type === 'projectile').length).toBe(0); // 600 - 100 = 500ms < 1000ms cooldown
      
      // Fire again at time 1100ms (1000ms after first shot, should fire)
      const result3 = stepSimulation(result2.state, 500, config, rng);
      expect(result3.state.timeMs).toBe(1100);
      expect(result3.events.filter(e => e.type === 'projectile').length).toBe(1); // 1100 - 100 = 1000ms >= 1000ms cooldown
    });

    it('should handle time scale: two steps of 8ms == one of 16ms for cooldown purposes', () => {
      const tower = createTower({ fireRate: 2, lastFiredAt: 0 }); // 500ms cooldown
      const enemy = createEnemy({ x: 300, y: 450 });
      
      // Scenario A: two 8ms steps (simulating 20% time scale in renderer)
      const stateA = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      const resultA1 = stepSimulation(stateA, 8, config, rng);
      expect(resultA1.events.filter(e => e.type === 'projectile').length).toBe(1); // First shot at time 8
      const resultA2 = stepSimulation(resultA1.state, 8, config, rng);
      expect(resultA2.state.timeMs).toBe(16);
      // 16 - 8 = 8ms since last shot, not enough for 500ms cooldown
      expect(resultA2.events.filter(e => e.type === 'projectile').length).toBe(0);
      
      // Scenario B: one 16ms step (normal time scale)
      const stateB = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      const resultB = stepSimulation(stateB, 16, config, rng);
      expect(resultB.events.filter(e => e.type === 'projectile').length).toBe(1); // First shot at time 16
      expect(resultB.state.timeMs).toBe(16);
      
      // Both should have same game time and tower state
      expect(resultA2.state.timeMs).toBe(resultB.state.timeMs);
    });
  });

  describe('pending spawn management', () => {
    it('should release pending spawns when due', () => {
      const pendingEnemy = createEnemy({ id: 'pending-1', spawnDelayMs: 100 });
      const state = createGameState({ pending: [pendingEnemy], timeMs: 0 });
      const configWithWaveStart = { ...config, waveStartTimeMs: 0 };
      
      // Before spawn time
      const result1 = stepSimulation(state, 50, configWithWaveStart, rng);
      expect(result1.state.pending.length).toBe(1);
      expect(result1.state.enemies.length).toBe(0);
      expect(result1.events.filter(e => e.type === 'spawn').length).toBe(0);
      
      // At spawn time
      const result2 = stepSimulation(result1.state, 50, configWithWaveStart, rng);
      expect(result2.state.timeMs).toBe(100);
      expect(result2.state.pending.length).toBe(0);
      expect(result2.state.enemies.length).toBe(1);
      expect(result2.events.filter(e => e.type === 'spawn').length).toBe(1);
      expect(result2.events[0]).toMatchObject({
        type: 'spawn',
        enemy: expect.objectContaining({ id: 'pending-1' }),
      });
    });

    it('should handle multiple pending spawns at different times', () => {
      const pending1 = createEnemy({ id: 'p1', spawnDelayMs: 100 });
      const pending2 = createEnemy({ id: 'p2', spawnDelayMs: 200 });
      const pending3 = createEnemy({ id: 'p3', spawnDelayMs: 300 });
      const state = createGameState({ pending: [pending1, pending2, pending3], timeMs: 0 });
      const configWithWaveStart = { ...config, waveStartTimeMs: 0 };
      
      // At 150ms: p1 spawned, p2 and p3 pending
      const result1 = stepSimulation(state, 150, configWithWaveStart, rng);
      expect(result1.state.enemies.length).toBe(1);
      expect(result1.state.pending.length).toBe(2);
      
      // At 250ms: p2 spawned, p3 pending
      const result2 = stepSimulation(result1.state, 100, configWithWaveStart, rng);
      expect(result2.state.timeMs).toBe(250);
      expect(result2.state.enemies.length).toBe(2);
      expect(result2.state.pending.length).toBe(1);
      
      // At 350ms: p3 spawned
      const result3 = stepSimulation(result2.state, 100, configWithWaveStart, rng);
      expect(result3.state.timeMs).toBe(350);
      expect(result3.state.enemies.length).toBe(3);
      expect(result3.state.pending.length).toBe(0);
    });

    it('should not fire waveCleared while pending non-empty', () => {
      const tower = createTower({ x: 260, y: 450, damage: 100, range: 200, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 });
      const pendingEnemy = createEnemy({ id: 'pending-1', spawnDelayMs: 1000 });
      const state = createGameState({
        towers: [tower],
        enemies: [enemy],
        pending: [pendingEnemy],
        timeMs: 0,
      });
      
      // Kill the active enemy (but pending is not empty)
      const result = stepSimulation(state, 100, config, rng);
      
      expect(result.state.enemies.length).toBe(0); // Enemy killed
      expect(result.state.pending.length).toBe(1); // Still have pending
      expect(result.events.filter(e => e.type === 'waveCleared').length).toBe(0); // Should NOT fire
    });

    it('should fire waveCleared only when both enemies and pending are empty', () => {
      const tower = createTower({ x: 260, y: 450, damage: 100, range: 200, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 });
      const state = createGameState({
        towers: [tower],
        enemies: [enemy],
        pending: [], // No pending
        timeMs: 0,
      });
      
      // Kill the last enemy
      const result = stepSimulation(state, 100, config, rng);
      
      expect(result.state.enemies.length).toBe(0);
      expect(result.state.pending.length).toBe(0);
      expect(result.events.filter(e => e.type === 'waveCleared').length).toBe(1); // Should fire
    });
  });

  describe('enemy movement', () => {
    it('should move enemies left by speed * dt', () => {
      const enemy = createEnemy({ x: 1000, speed: 100 });
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, config, rng); // 1 second
      
      expect(result.state.enemies[0].x).toBe(900); // 1000 - 100*1
    });

    it('should update progress as enemy moves', () => {
      const enemy = createEnemy({ x: 1650 }); // At spawn
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 10000, config, rng); // 10 seconds at 100px/s = 1000px
      
      const movedEnemy = result.state.enemies[0];
      expect(movedEnemy.x).toBe(650); // 1650 - 1000
      
      // Progress should be ~0.33 (moved 1000px out of 1500px total)
      const expectedProgress = 1 - (650 - config.fortressX) / (config.spawnX - config.fortressX);
      expect(movedEnemy.progress).toBeCloseTo(expectedProgress, 2);
    });

    it('should handle multiple enemies moving independently', () => {
      const enemy1 = createEnemy({ id: 'e1', x: 1000, speed: 100 });
      const enemy2 = createEnemy({ id: 'e2', x: 800, speed: 50 });
      const state = createGameState({ enemies: [enemy1, enemy2] });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.enemies[0].x).toBe(900); // 1000 - 100
      expect(result.state.enemies[1].x).toBe(750); // 800 - 50
    });
  });

  describe('fortress damage', () => {
    it('should apply damage when enemy reaches fortress', () => {
      // Enemy starts already at or past fortress threshold
      const enemy = createEnemy({ x: 145, speed: 1, damage: 15 }); // Already past threshold
      const state = createGameState({ enemies: [enemy], fortressHp: 100 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      // 100 (start) - 15 (fortress damage) + 10 (wave clear 10% regen) = 95
      expect(result.state.fortressHp).toBe(95);
    });

    it('should emit fortressHit event', () => {
      const enemy = createEnemy({ id: 'enemy-1', x: 160, damage: 15 });
      const state = createGameState({ enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.enemies.length).toBe(0);
    });
  });

  describe('tower firing', () => {
    it('should fire at enemy in range', () => {
      const tower = createTower({ x: 260, y: 450, range: 200, damage: 10, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 400, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.enemies[0].hp).toBe(40); // 50 - 10
    });

    it('should not fire if on cooldown', () => {
      const tower = createTower({ fireRate: 1, lastFiredAt: 500 }); // Fired at time 500, needs 1000ms cooldown
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 1000 }); // Now at time 1000
      
      const result = stepSimulation(state, 100, config, rng); // Advance to 1100
      
      // 1100 - 500 = 600ms since last shot, not enough for 1000ms cooldown
      expect(result.state.enemies[0].hp).toBe(50); // No damage
      expect(result.events.filter(e => e.type === 'projectile').length).toBe(0);
    });

    it('should respect fire rate', () => {
      const tower = createTower({ fireRate: 2, lastFiredAt: 0 }); // 2 shots/sec = 500ms cooldown
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      // First shot at time 100
      const result1 = stepSimulation(state, 100, config, rng);
      expect(result1.events.filter(e => e.type === 'projectile').length).toBe(1);
      expect(result1.state.timeMs).toBe(100);
      
      // At time 400 (300ms later, total 400ms since start, 300ms since first shot) - not enough
      const result2 = stepSimulation(result1.state, 300, config, rng);
      expect(result2.state.timeMs).toBe(400);
      expect(result2.events.filter(e => e.type === 'projectile').length).toBe(0);
      
      // At time 650 (250ms later, total 650ms since start, 550ms since first shot) - enough for next shot
      const result3 = stepSimulation(result2.state, 250, config, rng);
      expect(result3.state.timeMs).toBe(650);
      expect(result3.events.filter(e => e.type === 'projectile').length).toBe(1);
    });

    it('should not fire at enemies out of range', () => {
      const tower = createTower({ x: 260, range: 100 });
      const enemy = createEnemy({ x: 500 }); // Too far
      const state = createGameState({ towers: [tower], enemies: [enemy] });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.events.filter(e => e.type === 'projectile').length).toBe(0);
    });

    it('should emit projectile event', () => {
      const tower = createTower({ courseId: 'CV101', x: 260, y: 450, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.enemies[0].lastDamagedAt).toBe(1000); // Should be set to game time
    });
  });

  describe('enemy kills', () => {
    it('should grant gold when enemy is killed', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 }); // Overkill
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy], gold: 0, timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.gold).toBe(60); // 10 (kill) + 50 (wave cleared bonus)
    });

    it('should emit kill event', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ id: 'enemy-1', hp: 50, x: 300, y: 450 });
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.enemies.length).toBe(0);
    });
  });

  describe('wave cleared', () => {
    it('should emit waveCleared event when last enemy is removed', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy], wave: 3, timeMs: 0 });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
        timeMs: 0,
      });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
        timeMs: 0,
      });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.fortressHp).toBe(100); // Capped at max
    });

    it('should emit waveCleared only once', () => {
      const tower = createTower({ damage: 100, lastFiredAt: 0 });
      const enemy = createEnemy({ x: 300, y: 450, hp: 50 }); // In range
      const state = createGameState({ towers: [tower], enemies: [enemy], timeMs: 0 });
      
      const result1 = stepSimulation(state, 1000, config, rng);
      expect(result1.events.filter(e => e.type === 'waveCleared').length).toBe(1);
      
      // Next frame, no enemies, should not emit again
      const result2 = stepSimulation(result1.state, 1000, config, rng);
      expect(result2.events.filter(e => e.type === 'waveCleared').length).toBe(0);
    });
  });

  describe('immutability', () => {
    it('should not mutate input state', () => {
      const tower = createTower({ damage: 10, lastFiredAt: 0 });
      const enemy = createEnemy({ hp: 50 });
      const state = createGameState({ towers: [tower], enemies: [enemy], gold: 0, timeMs: 0 });
      
      const originalGold = state.gold;
      const originalEnemyHp = state.enemies[0].hp;
      const originalEnemyX = state.enemies[0].x;
      const originalTimeMs = state.timeMs;
      
      stepSimulation(state, 1000, config, rng);
      
      expect(state.gold).toBe(originalGold);
      expect(state.enemies[0].hp).toBe(originalEnemyHp);
      expect(state.enemies[0].x).toBe(originalEnemyX);
      expect(state.timeMs).toBe(originalTimeMs);
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
        timeMs: 0,
      });
      
      const result = stepSimulation(state, 1000, config, rng);
      
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
        timeMs: 0,
      });
      
      const result = stepSimulation(state, 1000, config, rng);
      
      expect(result.state.enemies.length).toBe(0); // Both removed
      expect(result.state.gold).toBe(60); // 10 (e1 kill) + 50 (wave cleared bonus)
      // 100 (start) - 15 (fortress damage) + 10 (wave clear 10% regen) = 95
      expect(result.state.fortressHp).toBe(95);
      expect(result.events.filter(e => e.type === 'kill').length).toBe(1);
      expect(result.events.filter(e => e.type === 'fortressHit').length).toBe(1);
    });
  });
});

describe('core purity', () => {
  it('should not use Date.now() in any src/core/*.ts files', () => {
    const coreDir = join(__dirname);
    const files = readdirSync(coreDir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    
    const violations: string[] = [];
    
    for (const file of files) {
      const content = readFileSync(join(coreDir, file), 'utf-8');
      
      // Remove comments (single-line // and multi-line /* */)
      const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* ... */
        .replace(/\/\/.*/g, ''); // Remove // ...
      
      if (withoutComments.includes('Date.now(')) {
        violations.push(file);
      }
    }
    
    expect(violations).toEqual([]);
  });
});
