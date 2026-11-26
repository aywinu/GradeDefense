/**
 * Wave generation logic for Deadline Defense.
 * Pure and deterministic: takes `now` and an optional seeded RNG function as parameters.
 * 
 * CAMPAIGN SYSTEM:
 * - The campaign walks through the remaining semester week by week
 * - Wave k (1-indexed) covers items due in [(k-1)*7, k*7) days from now
 * - Overdue ungraded items (days < 0) join wave 1 as "overdue" (+25% speed)
 * - Each item becomes a "spawn group" (main creature + escorts) for horde feel
 * - Wave 1 is capped to be tutorial-friendly
 * 
 * NO Phaser imports allowed in this file.
 */

import type { CourseworkItem, Semester, EnemyStats, ItemType } from './types';
import type { RngFunction } from './rng';
import {
  calculateUrgency,
  priorityScore,
  enemyHpMultiplier,
  enemySpeedMultiplier,
  fortressDamage,
  daysUntilDue,
} from './scoring';

/**
 * Base stats for each enemy type (main creatures).
 */
const BASE_STATS: Record<ItemType, { hp: number; speed: number }> = {
  assignment: { hp: 50, speed: 30 },
  quiz: { hp: 30, speed: 60 },
  exam: { hp: 200, speed: 20 },
  project: { hp: 150, speed: 25 },
  presentation: { hp: 150, speed: 25 },
};

/**
 * Minion base stats (smaller, weaker escorts).
 */
const MINION_STATS = {
  draft: { hp: 15, speed: 40 }, // assignment escorts
  swarmer: { hp: 20, speed: 70 }, // quiz escorts
  topic: { hp: 25, speed: 25 }, // exam escorts
  phase: { hp: 30, speed: 30 }, // project/presentation escorts
};

/**
 * Spawn group configuration for each item type.
 */
interface SpawnGroup {
  mainCount: number;
  minionType: keyof typeof MINION_STATS;
  baseMinionCount: number;
  minionScaling: (points: number) => number; // additional minions based on points
}

const SPAWN_GROUPS: Record<ItemType, SpawnGroup> = {
  assignment: {
    mainCount: 1,
    minionType: 'draft',
    baseMinionCount: 2,
    minionScaling: () => 0, // fixed 2 minions
  },
  quiz: {
    mainCount: 0, // quizzes are only swarmers, no main enemy
    minionType: 'swarmer',
    baseMinionCount: 4,
    minionScaling: (points) => Math.min(2, Math.floor(points / 20)), // 4-6 based on points
  },
  exam: {
    mainCount: 1,
    minionType: 'topic',
    baseMinionCount: 6,
    minionScaling: () => 0, // fixed 6 minions (spawned in two pulses)
  },
  project: {
    mainCount: 1, // multi-phase enemy
    minionType: 'phase',
    baseMinionCount: 3,
    minionScaling: () => 0, // fixed 3 minions
  },
  presentation: {
    mainCount: 1, // multi-phase enemy
    minionType: 'phase',
    baseMinionCount: 3,
    minionScaling: () => 0, // fixed 3 minions
  },
};

/**
 * Calculate the number of weeks (waves) in the campaign.
 * Based on the last ungraded item due date.
 * 
 * @param semester - The semester data
 * @param now - Current timestamp
 * @returns Number of weeks (min 1, max 10)
 */
export function campaignLength(semester: Semester, now: number): number {
  const ungradedItems = semester.courses.flatMap((c) =>
    c.items.filter((item) => item.grade === null)
  );

  if (ungradedItems.length === 0) {
    return 1; // no items left, default to 1 wave
  }

  // Find the furthest due date
  const furthestDays = Math.max(
    ...ungradedItems.map((item) => daysUntilDue(item.dueDate, now))
  );

  // Convert to weeks (round up)
  const weeks = Math.ceil(Math.max(0, furthestDays) / 7);

  // Clamp to [1, 10]
  return Math.max(1, Math.min(10, weeks));
}

/**
 * Generate a wave of enemies for the campaign.
 * Wave k (1-indexed) covers items due in [(k-1)*7, k*7) days.
 * Overdue items join wave 1.
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
  const minDays = (waveNumber - 1) * 7;
  const maxDays = waveNumber * 7;

  // Filter items for this wave
  const waveItems = semester.courses.flatMap((course, courseIndex) =>
    course.items
      .filter((item) => {
        const days = daysUntilDue(item.dueDate, now);
        // Ungraded items only
        if (item.grade !== null) return false;

        // Wave 1: include overdue items (days < 0) and items in [0, 7)
        if (waveNumber === 1) {
          return days < maxDays;
        }

        // Other waves: items in [minDays, maxDays)
        return days >= minDays && days < maxDays;
      })
      .map((item) => ({
        item,
        courseIndex,
        days: daysUntilDue(item.dueDate, now),
        priority: priorityScore(daysUntilDue(item.dueDate, now), item.grade, item.points),
      }))
  );

  // Sort by priority (highest first)
  waveItems.sort((a, b) => b.priority - a.priority);

  // Create spawn groups for each item
  let allEnemies: EnemyStats[] = [];
  let spawnDelayAccumulator = 0;
  const SPAWN_INTERVAL_MS = 2000; // 2 seconds between groups

  for (const { item, courseIndex, days } of waveItems) {
    const group = createSpawnGroup(item, courseIndex, days, now, spawnDelayAccumulator, rng);
    allEnemies = allEnemies.concat(group);

    // Increment delay for next group
    spawnDelayAccumulator += SPAWN_INTERVAL_MS;
  }
  // Cap total wave size at 40
  if (allEnemies.length > 40) {
    allEnemies = allEnemies.slice(0, 40);
  }

  return allEnemies;
}

/**
 * Create a spawn group for a coursework item.
 * Returns main enemy + escorts/minions.
 * 
 * @param item - The coursework item
 * @param courseIndex - Course index (0-5) for lane
 * @param days - Days until due
 * @param now - Current timestamp
 * @param baseDelay - Base spawn delay for this group
 * @param rng - RNG function
 * @returns Array of enemies (main + minions)
 */
function createSpawnGroup(
  item: CourseworkItem,
  courseIndex: number,
  days: number,
  now: number,
  baseDelay: number,
  rng: RngFunction
): EnemyStats[] {
  const enemies: EnemyStats[] = [];
  const groupConfig = SPAWN_GROUPS[item.type];

  // Create main enemy/enemies
  for (let i = 0; i < groupConfig.mainCount; i++) {
    enemies.push(
      createEnemy(
        item,
        courseIndex,
        days,
        now,
        baseDelay + i * 500, // slight delay between mains
        false, // not a minion
        rng
      )
    );
  }

  // Create minions
  const minionCount =
    groupConfig.baseMinionCount + groupConfig.minionScaling(item.points);

  for (let i = 0; i < minionCount; i++) {
    enemies.push(
      createMinion(
        item,
        courseIndex,
        days,
        now,
        baseDelay + 1000 + i * 300, // minions spawn after main
        groupConfig.minionType,
        rng
      )
    );
  }

  return enemies;
}

/**
 * Create a main enemy from a coursework item.
 * 
 * @param item - The coursework item
 * @param courseIndex - Course index for lane
 * @param days - Days until due
 * @param now - Current timestamp
 * @param spawnDelay - Spawn delay in milliseconds
 * @param isMinion - Is this a minion?
 * @param rng - RNG function
 * @returns Enemy stats
 */
function createEnemy(
  item: CourseworkItem,
  courseIndex: number,
  days: number,
  now: number,
  spawnDelay: number,
  isMinion: boolean,
  rng: RngFunction
): EnemyStats {
  const urgency = calculateUrgency(days);
  const baseStats = BASE_STATS[item.type];

  // Apply multipliers
  const hpMult = enemyHpMultiplier(urgency, item.points);
  let speedMult = enemySpeedMultiplier(urgency);

  // Overdue buff: +25% speed
  const isOverdue = days < 0;
  if (isOverdue) {
    speedMult *= 1.25;
  }

  return {
    id: `${item.id}-${now}-${Math.floor(rng() * 100000)}`,
    courseId: item.courseId,
    itemId: item.id,
    type: item.type,
    hp: Math.round(baseStats.hp * hpMult),
    maxHp: Math.round(baseStats.hp * hpMult),
    speed: baseStats.speed * speedMult,
    damage: fortressDamage(item.points),
    lane: courseIndex,
    progress: 0,
    x: 1200, // right edge (spawn position) - will be computed by renderer
    y: 0, // will be computed by renderer from lane
    pathProgress: 0, // deprecated
    spawnedAt: now,
    spawnDelayMs: spawnDelay,
    label: item.name,
    daysLeft: Math.round(days),
    lastDamagedAt: null,
    neglected: false,
    isOverdue,
    isMinion,
  };
}

/**
 * Create a minion enemy.
 * 
 * @param item - The parent coursework item
 * @param courseIndex - Course index for lane
 * @param days - Days until due
 * @param now - Current timestamp
 * @param spawnDelay - Spawn delay in milliseconds
 * @param minionType - Type of minion
 * @param rng - RNG function
 * @returns Enemy stats
 */
function createMinion(
  item: CourseworkItem,
  courseIndex: number,
  days: number,
  now: number,
  spawnDelay: number,
  minionType: keyof typeof MINION_STATS,
  rng: RngFunction
): EnemyStats {
  const urgency = calculateUrgency(days);
  const minionStats = MINION_STATS[minionType];

  // Minions have simpler scaling (no points multiplier)
  let speedMult = enemySpeedMultiplier(urgency);

  // Overdue buff: +25% speed
  const isOverdue = days < 0;
  if (isOverdue) {
    speedMult *= 1.25;
  }

  // Minions deal less damage
  const damage = Math.max(1, Math.round(fortressDamage(item.points) * 0.3));

  return {
    id: `${item.id}-minion-${now}-${Math.floor(rng() * 100000)}`,
    courseId: item.courseId,
    itemId: item.id, // minions share parent item ID for filtering
    parentItemId: item.id,
    type: item.type,
    hp: Math.round(minionStats.hp * (1 + urgency * 0.5)), // slight HP scaling
    maxHp: Math.round(minionStats.hp * (1 + urgency * 0.5)),
    speed: minionStats.speed * speedMult,
    damage,
    lane: courseIndex,
    progress: 0,
    x: 1200,
    y: 0,
    pathProgress: 0,
    spawnedAt: now,
    spawnDelayMs: spawnDelay,
    label: item.name, // minions carry parent name
    daysLeft: Math.round(days),
    lastDamagedAt: null,
    neglected: false,
    isOverdue,
    isMinion: true,
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
  // This is a simple estimate; actual count depends on spawn groups
  const wave = generateWave(semester, waveNumber, now, () => 0.5); // deterministic RNG
  return wave.length;
}

/**
 * Get all items that will appear in a specific wave.
 * Useful for testing coverage.
 * 
 * @param semester - The semester data
 * @param waveNumber - Current wave number
 * @param now - Current timestamp
 * @returns Array of item IDs
 */
export function getWaveItemIds(semester: Semester, waveNumber: number, now: number): string[] {
  const wave = generateWave(semester, waveNumber, now, () => 0.5);
  // Return unique item IDs (not minion IDs)
  const itemIds = new Set(wave.map((e) => e.itemId));
  return Array.from(itemIds);
}

