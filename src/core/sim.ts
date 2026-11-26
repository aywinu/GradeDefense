/**
 * Core simulation logic (pure, frame-based).
 * Handles enemy movement, tower firing, damage, kills, fortress damage, and wave end detection.
 * Returns new state + events for the renderer to consume.
 * 
 * NO Date.now() calls. All timing uses state.timeMs (game clock).
 * 
 * Ref: tasks.md Phase 3.6-3.8, 3.10
 */

import type { GameState, EnemyStats } from './types';
import type { RngFunction } from './rng';
import { selectTarget } from './targeting';
import { applyNeglectBuff } from './neglect';

/**
 * Simulation configuration passed from the game layer.
 * Core must not import from src/game, so layout constants are passed in.
 */
export interface SimConfig {
  fortressX: number; // fortress right edge (Layout.FORTRESS_X_MAX)
  spawnX: number; // enemy spawn X position (Layout.ENEMY_SPAWN_X)
  waveStartTimeMs: number; // time when current wave started (for spawn scheduling)
}

/**
 * Simulation events emitted during a step.
 * The Phaser layer consumes these to render effects.
 */
export type SimEvent =
  | { type: 'hit'; enemyId: string; damage: number; x: number; y: number }
  | { type: 'kill'; enemyId: string; gold: number; x: number; y: number }
  | { type: 'fortressHit'; enemyId: string; damage: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'projectile'; fromX: number; fromY: number; toX: number; toY: number; towerId: string }
  | { type: 'spawn'; enemy: EnemyStats }; // emitted when pending enemy is released

export interface SimResult {
  state: GameState;
  events: SimEvent[];
}

/**
 * Run one simulation step.
 * 
 * @param state - Current game state
 * @param dtMs - Delta time in milliseconds
 * @param config - Simulation configuration (layout constants)
 * @param rng - Random number generator (for future stochastic mechanics, unused for now)
 * @returns New state and events
 */
export function stepSimulation(
  state: GameState,
  dtMs: number,
  config: SimConfig,
  _rng: RngFunction
): SimResult {
  const events: SimEvent[] = [];
  
  // Clone state for immutability
  const newState: GameState = {
    ...state,
    enemies: state.enemies.map(e => ({ ...e })),
    towers: state.towers.map(t => ({ ...t })),
    pending: state.pending.map(e => ({ ...e })),
  };
  
  // Advance game clock
  newState.timeMs += dtMs;
  
  const dtSec = dtMs / 1000;
  
  // Track enemies to remove (killed or reached fortress)
  const enemiesToRemove = new Set<string>();
  
  // --- PHASE 1: Release pending spawns ---
  const stillPending: EnemyStats[] = [];
  for (const pendingEnemy of newState.pending) {
    // Check if it's time to spawn (spawnAtMs is relative to wave start)
    const spawnTime = config.waveStartTimeMs + pendingEnemy.spawnDelayMs;
    if (newState.timeMs >= spawnTime) {
      // Spawn this enemy
      newState.enemies.push(pendingEnemy);
      events.push({ type: 'spawn', enemy: pendingEnemy });
    } else {
      // Keep in pending
      stillPending.push(pendingEnemy);
    }
  }
  newState.pending = stillPending;
  
  // --- PHASE 2: Tower firing (before movement, so positions are consistent) ---
  for (const tower of newState.towers) {
    // Check fire rate cooldown (using game time, not wall-clock)
    const timeSinceLastShot = newState.timeMs - tower.lastFiredAt;
    const shotCooldown = 1000 / tower.fireRate; // ms per shot
    
    // Allow firing if never fired (lastFiredAt === 0) or if cooldown has passed
    if (tower.lastFiredAt !== 0 && timeSinceLastShot < shotCooldown) {
      continue; // Still on cooldown
    }
    
    // Select target
    const target = selectTarget(tower, newState.enemies);
    
    if (!target) {
      continue; // No valid target
    }
    
    // Fire!
    tower.lastFiredAt = newState.timeMs;
    
    // Emit projectile event
    events.push({
      type: 'projectile',
      fromX: tower.x,
      fromY: tower.y,
      toX: target.x,
      toY: target.y,
      towerId: tower.courseId,
    });
    
    // Apply damage
    target.hp -= tower.damage;
    target.lastDamagedAt = newState.timeMs;
    
    // Emit hit event
    events.push({
      type: 'hit',
      enemyId: target.id,
      damage: tower.damage,
      x: target.x,
      y: target.y,
    });
    
    // Check for kill
    if (target.hp <= 0) {
      const goldReward = 10; // Base reward per kill
      newState.gold += goldReward;
      
      events.push({
        type: 'kill',
        enemyId: target.id,
        gold: goldReward,
        x: target.x,
        y: target.y,
      });
      
      enemiesToRemove.add(target.id);
    }
  }
  
  // --- PHASE 3: Enemy movement ---
  for (const enemy of newState.enemies) {
    if (enemy.hp <= 0) {
      continue; // Skip dead enemies
    }
    
    // Move enemy left by speed * dt
    enemy.x -= enemy.speed * dtSec;
    
    // Update progress (1 at fortress, 0 at spawn)
    enemy.progress = 1 - (enemy.x - config.fortressX) / (config.spawnX - config.fortressX);
    enemy.pathProgress = enemy.progress; // Keep deprecated field in sync
    
    // Check if reached fortress
    if (enemy.x <= config.fortressX) {
      newState.fortressHp -= enemy.damage;
      events.push({
        type: 'fortressHit',
        enemyId: enemy.id,
        damage: enemy.damage,
      });
      enemiesToRemove.add(enemy.id);
    }
  }
  
  // --- PHASE 4: Neglect buff application ---
  for (let i = 0; i < newState.enemies.length; i++) {
    newState.enemies[i] = applyNeglectBuff(newState.enemies[i], newState.timeMs);
  }
  
  // --- PHASE 5: Remove dead/reached enemies ---
  newState.enemies = newState.enemies.filter(e => !enemiesToRemove.has(e.id));
  
  // --- PHASE 6: Check wave cleared ---
  // Wave is cleared when both enemies and pending are empty
  const hadEnemiesOrPending = state.enemies.length > 0 || state.pending.length > 0;
  const nowEmpty = newState.enemies.length === 0 && newState.pending.length === 0;
  
  if (hadEnemiesOrPending && nowEmpty) {
    // Wave just cleared (had enemies/pending, now has none)
    events.push({
      type: 'waveCleared',
      wave: state.wave,
    });
    
    // Grant wave clear bonuses
    newState.gold += 50;
    newState.fortressHp = Math.min(
      newState.maxFortressHp,
      newState.fortressHp + Math.floor(newState.maxFortressHp * 0.1)
    );
  }
  
  return { state: newState, events };
}
