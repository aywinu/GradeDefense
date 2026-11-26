/**
 * Tower targeting logic.
 * Pure functions with no Phaser imports.
 * Ref: design.md Targeting, R4.3
 */

import type { TowerStats, EnemyStats } from './types';

/**
 * Calculate Euclidean distance between two points.
 */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Select the best target for a tower from a list of enemies.
 * 
 * Priority:
 * 1. Enemies from the tower's course
 * 2. Closest to fortress (highest pathProgress)
 * 3. Highest HP
 * 
 * @param tower The tower selecting a target
 * @param enemies All enemies on the battlefield
 * @returns The selected enemy or null if no valid target
 */
export function selectTarget(
  tower: TowerStats,
  enemies: EnemyStats[]
): EnemyStats | null {
  // Filter enemies in range with HP > 0
  const inRange = enemies.filter(e => 
    distance(tower, e) <= tower.range && e.hp > 0
  );
  
  if (inRange.length === 0) return null;
  
  // Priority 1: Prefer enemies from same course
  const sameCourse = inRange.filter(e => e.courseId === tower.courseId);
  const candidates = sameCourse.length > 0 ? sameCourse : inRange;
  
  // Priority 2 & 3: Sort by pathProgress (descending), then HP (descending)
  candidates.sort((a, b) => {
    // First, prioritize by path progress (closer to fortress)
    if (a.pathProgress !== b.pathProgress) {
      return b.pathProgress - a.pathProgress;
    }
    // Then by HP (higher HP)
    return b.hp - a.hp;
  });
  
  return candidates[0];
}
