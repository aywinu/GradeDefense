/**
 * Core simulation logic (pure, frame-based).
 * Handles enemy movement, tower firing, damage, kills, fortress damage, and wave end detection.
 * Returns new state + events for the renderer to consume.
 * 
 * Ref: tasks.md Phase 3.6-3.8
 */

import type { GameState } from './types';
import type { RngFunction } from './rng';
import { selectTarget } from './targeting';
import { applyNeglectBuff } from './neglect';
import { Layout } from '../game/layout';

/**
 * Simulation events emitted during a step.
 * The Phaser layer consumes these to render effects.
 */
export type SimEvent =
  | { type: 'hit'; enemyId: string; damage: number; x: number; y: number }
  | { type: 'kill'; enemyId: string; gold: number; x: number; y: number }
  | { type: 'fortressHit'; enemyId: string; damage: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'projectile'; fromX: number; fromY: number; toX: number; toY: number; towerId: string };

export interface SimResult {
  state: GameState;
  events: SimEvent[];
}

/**
 * Run one simulation step.
 * 
 * @param state - Current game state
 * @param dtMs - Delta time in milliseconds
 * @param rng - Random number generator (for future stochastic mechanics, unused for now)
 * @returns New state and events
 */
export function stepSimulation(
  state: GameState,
  dtMs: number,
  _rng: RngFunction
): SimResult {
  const events: SimEvent[] = [];
  
  // Clone state for immutability
  const newState: GameState = {
    ...state,
    enemies: state.enemies.map(e => ({ ...e })),
    towers: state.towers.map(t => ({ ...t })),
  };
  
  const dtSec = dtMs / 1000;
  const now = Date.now(); // Use wall-clock time for lastFiredAt tracking
  
  // Track enemies to remove (killed or reached fortress)
  const enemiesToRemove = new Set<string>();
  
  // --- PHASE 1: Tower firing (before movement, so positions are consistent) ---
  for (const tower of newState.towers) {
    // Check fire rate cooldown
    const timeSinceLastShot = now - tower.lastFiredAt;
    const shotCooldown = 1000 / tower.fireRate; // ms per shot
    
    if (timeSinceLastShot < shotCooldown) {
      continue; // Still on cooldown
    }
    
    // Select target
    const target = selectTarget(tower, newState.enemies);
    
    if (!target) {
      continue; // No valid target
    }
    
    // Fire!
    tower.lastFiredAt = now;
    
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
    target.lastDamagedAt = now;
    
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
  
  // --- PHASE 2: Enemy movement ---
  for (const enemy of newState.enemies) {
    if (enemy.hp <= 0) {
      continue; // Skip dead enemies
    }
    
    // Move enemy left by speed * dt
    enemy.x -= enemy.speed * dtSec;
    
    // Update progress (1 at fortress, 0 at spawn)
    enemy.progress = 1 - (enemy.x - Layout.FORTRESS_X_MAX) / (Layout.ENEMY_SPAWN_X - Layout.FORTRESS_X_MAX);
    enemy.pathProgress = enemy.progress; // Keep deprecated field in sync
    
    // Check if reached fortress
    if (enemy.x <= Layout.FORTRESS_X_MAX) {
      newState.fortressHp -= enemy.damage;
      events.push({
        type: 'fortressHit',
        enemyId: enemy.id,
        damage: enemy.damage,
      });
      enemiesToRemove.add(enemy.id);
    }
  }
  
  // --- PHASE 3: Neglect buff application ---
  const elapsedGameTime = now; // Use wall-clock time for neglect tracking
  for (let i = 0; i < newState.enemies.length; i++) {
    newState.enemies[i] = applyNeglectBuff(newState.enemies[i], elapsedGameTime);
  }
  
  // --- PHASE 4: Remove dead/reached enemies ---
  newState.enemies = newState.enemies.filter(e => !enemiesToRemove.has(e.id));
  
  // --- PHASE 5: Check wave cleared ---
  if (newState.enemies.length === 0 && state.enemies.length > 0) {
    // Wave just cleared (had enemies, now has none)
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
