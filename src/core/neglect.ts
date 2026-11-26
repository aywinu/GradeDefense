/**
 * Neglect buff logic for enemies.
 * Pure functions with no Phaser imports.
 * Uses elapsed game time parameter, not wall-clock time.
 * Ref: design.md Neglect Check, R3.4
 */

import type { EnemyStats } from './types';

/**
 * Neglect threshold in milliseconds.
 * If an enemy hasn't been damaged for this duration, it gets buffed.
 */
export const NEGLECT_THRESHOLD_MS = 60000; // 60 seconds

/**
 * HP multiplier applied when an enemy is neglected.
 */
export const NEGLECT_HP_MULTIPLIER = 1.5; // +50% HP

/**
 * Speed multiplier applied when an enemy is neglected.
 */
export const NEGLECT_SPEED_MULTIPLIER = 1.25; // +25% speed

/**
 * Apply neglect buff to an enemy if conditions are met.
 * 
 * Conditions:
 * - Enemy hasn't been damaged (lastDamagedAt is null)
 * - Enemy has been alive for >= NEGLECT_THRESHOLD_MS
 * - Buff hasn't already been applied (neglected flag is false)
 * 
 * @param enemy The enemy to check
 * @param elapsedGameTime Elapsed game time in milliseconds (NOT wall-clock time)
 * @returns Updated enemy with buff applied if conditions met, otherwise unchanged
 */
export function applyNeglectBuff(enemy: EnemyStats, elapsedGameTime: number): EnemyStats {
  // Already buffed
  if (enemy.neglected) {
    return enemy;
  }
  
  // Has been damaged
  if (enemy.lastDamagedAt !== null) {
    return enemy;
  }
  
  // Not alive long enough
  const timeAlive = elapsedGameTime - enemy.spawnedAt;
  if (timeAlive < NEGLECT_THRESHOLD_MS) {
    return enemy;
  }
  
  // Apply buff
  return {
    ...enemy,
    hp: enemy.hp * NEGLECT_HP_MULTIPLIER,
    maxHp: enemy.maxHp * NEGLECT_HP_MULTIPLIER,
    speed: enemy.speed * NEGLECT_SPEED_MULTIPLIER,
    neglected: true
  };
}

/**
 * Check if an enemy should receive the neglect buff.
 * Does not apply the buff, only checks conditions.
 * Useful for testing or UI indicators.
 * 
 * @param enemy The enemy to check
 * @param elapsedGameTime Elapsed game time in milliseconds
 * @returns True if the enemy should receive the buff
 */
export function shouldApplyNeglectBuff(enemy: EnemyStats, elapsedGameTime: number): boolean {
  if (enemy.neglected) return false;
  if (enemy.lastDamagedAt !== null) return false;
  
  const timeAlive = elapsedGameTime - enemy.spawnedAt;
  return timeAlive >= NEGLECT_THRESHOLD_MS;
}
