/**
 * Wave generation logic for Deadline Defense.
 * Pure and deterministic: takes `now` and an optional seeded RNG function as parameters.
 * 
 * Wave 1 is small and gentle (tutorial wave); later waves get bigger.
 * NO Phaser imports allowed in this file.
 */

import type { CourseworkItem, Semester, EnemyStats, ItemType } from './types';
import {
  calculateUrgency,
  priorityScore,
  enemyHpMultiplier,
  enemySpeedMultiplier,
  fortressDamage,
  daysUntilDue,
} from './scoring';

/**
 * Seeded random number generator function type.
 * Returns a number in [0, 1) like Math.random().
 */
export type RngFunction = () => number;

/**
 * Base stats for each enemy type.
 */
const BASE_STATS: Record<ItemType, { hp: number; speed: number }> = {
  assignment: { hp: 50, speed: 30 },
  quiz: { hp: 30, speed: 60 },
  exam: { hp: 200, speed: 20 },
  project: { hp: 150, speed: 25 },
  presentation: { hp: 150, speed: 25 },
};

/**
 * Lane Y positions (placeholder, will be overridden by game scene).
 * Indexed by course position (0-5).
 */
const LANE_Y_POSITIONS = [100, 200, 300, 400, 500, 600];

/**
 * Generate a wave of enemies based on semester data and wave number.
 * 
 * Wave 1 is small and gentle (tutorial wave); later waves get bigger.
 * 
 * @param semester - The semester data with absolute due dates
 * @param waveNumber - Current wave number (1-indexed)
 * @param now - Current timestamp (milliseconds since epoch)
 * @param rng - Optional seeded RNG function for deterministic behavior
 * @returns Array of enemy stats to spawn
 */
export function generateWave(
  semester: Semester,
  waveNumber: number,
  now: number,
  rng: RngFunction = Math.random
): EnemyStats[] {
  // Filter to items due within next 7 days (and not graded yet)
  const upcoming = semester.courses.flatMap((course) =>
    course.items
      .filter((item) => {
        const days = daysUntilDue(item.dueDate, now);
        // Only include future items (not graded) within 7 days
        return item.grade === null && days >= 0 && days <= 7;
      })
      .map((item) => ({
        item,
        priority: priorityScore(daysUntilDue(item.dueDate, now), item.grade, item.points),
      }))
  );

  // Sort by priority score (highest first)
  upcoming.sort((a, b) => b.priority - a.priority);

  // Determine wave size
  // Wave 1 is small and gentle (2-3 enemies)
  // Later waves grow: 5 + (waveNumber - 1)
  const waveSize = waveNumber === 1 ? Math.min(3, upcoming.length) : Math.min(5 + waveNumber - 1, upcoming.length);

  // Spawn top N items
  return upcoming.slice(0, waveSize).map(({ item }) => createEnemy(item, now, semester.courses, rng));
}

/**
 * Create an enemy from a coursework item.
 * 
 * @param item - The coursework item
 * @param now - Current timestamp
 * @param courses - All courses (for lane mapping)
 * @param rng - Optional seeded RNG function
 * @returns Enemy stats
 */
export function createEnemy(
  item: CourseworkItem,
  now: number,
  courses: Array<{ id: string }>,
  rng: RngFunction = Math.random
): EnemyStats {
  const days = daysUntilDue(item.dueDate, now);
  const urgency = calculateUrgency(days);

  // Get base stats for this enemy type
  const baseStats = BASE_STATS[item.type];

  // Apply multipliers
  const hpMult = enemyHpMultiplier(urgency, item.points);
  const speedMult = enemySpeedMultiplier(urgency);

  // Find lane Y position (index in courses array)
  const courseIndex = courses.findIndex((c) => c.id === item.courseId);
  const laneY = courseIndex >= 0 && courseIndex < LANE_Y_POSITIONS.length 
    ? LANE_Y_POSITIONS[courseIndex] 
    : LANE_Y_POSITIONS[0];

  return {
    id: `${item.id}-${now}-${Math.floor(rng() * 10000)}`,
    courseId: item.courseId,
    itemId: item.id,
    type: item.type,
    hp: Math.round(baseStats.hp * hpMult),
    maxHp: Math.round(baseStats.hp * hpMult),
    speed: baseStats.speed * speedMult,
    damage: fortressDamage(item.points),
    x: 1200, // right edge (spawn position)
    y: laneY,
    pathProgress: 0,
    spawnedAt: now,
    lastDamagedAt: null,
    neglected: false,
  };
}

/**
 * Get the number of enemies that would be spawned for a wave.
 * Useful for testing without creating full enemy objects.
 * 
 * @param semester - The semester data
 * @param waveNumber - Current wave number
 * @param now - Current timestamp
 * @returns Number of enemies that would spawn
 */
export function getWaveSize(semester: Semester, waveNumber: number, now: number): number {
  // Filter to items due within next 7 days (and not graded yet)
  const upcomingCount = semester.courses.reduce((count, course) => {
    return (
      count +
      course.items.filter((item) => {
        const days = daysUntilDue(item.dueDate, now);
        return item.grade === null && days >= 0 && days <= 7;
      }).length
    );
  }, 0);

  // Wave 1 is small (2-3 enemies), later waves grow
  return waveNumber === 1 ? Math.min(3, upcomingCount) : Math.min(5 + waveNumber - 1, upcomingCount);
}
