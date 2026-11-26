/**
 * Wave generation logic for Deadline Defense.
 * Pure and deterministic: takes `now` and an optional seeded RNG function as parameters.
 * 
 * CAMPAIGN SYSTEM:
 * - The campaign walks through the remaining semester week by week
 * - Empty weeks are SKIPPED, campaign is the list of non-empty weeks
 * - Each wave tracks its real `week` number for UI display ("Week 6")
 * - Wave k (1-indexed) covers items due in [(k-1)*7, k*7) days from now
 * - Overdue ungraded items (days < 0) join wave 1 as "overdue" (+25% speed)
 * - Each item becomes a "spawn group" (main creature + escorts) for horde feel
 * - Spawns spread over 25-40s for full waves (groups ordered by due date, minions trail 0.4-1.2s)
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
 * Maximum HP multiplier for exam bosses relative to a full-urgency assignment.
 */
const EXAM_BOSS_HP_CAP_MULTIPLIER = 4.0;

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
 * Week metadata for campaign waves.
 */
export interface WaveWeek {
  waveIndex: number; // 1-indexed wave number (skips empty weeks)
  weekNumber: number; // actual week number (1-10)
  itemCount: number; // number of items in this week
}

/**
 * Calculate the list of non-empty weeks (waves) in the campaign.
 * Empty weeks are skipped; each wave tracks its real week number for UI.
 * 
 * @param semester - The semester data
 * @param now - Current timestamp
 * @returns Array of non-empty weeks with metadata
 */
export function campaignWeeks(semester: Semester, now: number): WaveWeek[] {
  const ungradedItems = semester.courses.flatMap((c) =>
    c.items.filter((item) => item.grade === null)
  );

  if (ungradedItems.length === 0) {
    return [{ waveIndex: 1, weekNumber: 1, itemCount: 0 }];
  }

  // Find the furthest due date
  const furthestDays = Math.max(
    ...ungradedItems.map((item) => daysUntilDue(item.dueDate, now))
  );

  // Convert to weeks (round up), clamp to [1, 10]
  const totalWeeks = Math.max(1, Math.min(10, Math.ceil(Math.max(0, furthestDays) / 7)));

  // Count items per week
  const weeks: WaveWeek[] = [];
  let waveIndex = 1;

  for (let week = 1; week <= totalWeeks; week++) {
    const minDays = (week - 1) * 7;
    const maxDays = week * 7;

    const itemCount = ungradedItems.filter((item) => {
      const days = daysUntilDue(item.dueDate, now);
      
      // Week 1: include overdue items (days < 0) and items in [0, 7)
      if (week === 1) {
        return days < maxDays;
      }
      
      // Other weeks: items in [minDays, maxDays)
      return days >= minDays && days < maxDays;
    }).length;

    // Skip empty weeks
    if (itemCount > 0) {
      weeks.push({ waveIndex, weekNumber: week, itemCount });
      waveIndex++;
    }
  }

  return weeks.length > 0 ? weeks : [{ waveIndex: 1, weekNumber: 1, itemCount: 0 }];
}

/**
 * Calculate the number of waves (non-empty weeks) in the campaign.
 * 
 * @param semester - The semester data
 * @param now - Current timestamp
 * @returns Number of non-empty waves (min 1, max 10)
 */
export function campaignLength(semester: Semester, now: number): number {
  return campaignWeeks(semester, now).length;
}

/**
 * Generate a wave of enemies for the campaign.
 * Wave k (1-indexed) covers items due in [(k-1)*7, k*7) days.
 * Overdue items join wave 1.
 * Spawns are spread over 25-40s for full waves, grouped by due date.
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
  // Find the actual week number for this wave index
  const weeks = campaignWeeks(semester, now);
  const waveWeek = weeks.find(w => w.waveIndex === waveNumber);
  
  if (!waveWeek) {
    return []; // Invalid wave number
  }

  const weekNumber = waveWeek.weekNumber;
  const minDays = (weekNumber - 1) * 7;
  const maxDays = weekNumber * 7;

  // Filter items for this wave
  const waveItems = semester.courses.flatMap((course, courseIndex) =>
    course.items
      .filter((item) => {
        const days = daysUntilDue(item.dueDate, now);
        // Ungraded items only
        if (item.grade !== null) return false;

        // Wave 1: include overdue items (days < 0) and items in [0, 7)
        if (weekNumber === 1) {
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

  // Sort by due date (earliest first) for spawn order
  waveItems.sort((a, b) => a.days - b.days);

  // Calculate spawn timing: spread over 25-40s for full waves
  const BASE_SPAWN_DURATION_MS = 25000; // 25 seconds
  const MAX_SPAWN_DURATION_MS = 40000; // 40 seconds
  const totalDuration = waveItems.length <= 1 
    ? 0 
    : BASE_SPAWN_DURATION_MS + (waveItems.length / 40) * (MAX_SPAWN_DURATION_MS - BASE_SPAWN_DURATION_MS);
  
  const groupInterval = waveItems.length > 1 
    ? totalDuration / (waveItems.length - 1) 
    : 0;

  // Create spawn groups for each item
  let allEnemies: EnemyStats[] = [];
  
  for (let i = 0; i < waveItems.length; i++) {
    const { item, courseIndex, days } = waveItems[i];
    const baseDelay = i * groupInterval;
    
    const group = createSpawnGroup(item, courseIndex, days, now, baseDelay, rng);
    allEnemies = allEnemies.concat(group);
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
 * Minions trail their leaders by 0.4-1.2s for natural spacing.
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

  // Create minions (trail by 0.4-1.2s)
  const minionCount =
    groupConfig.baseMinionCount + groupConfig.minionScaling(item.points);

  const MINION_TRAIL_MIN = 400; // 0.4s
  const MINION_TRAIL_MAX = 1200; // 1.2s

  for (let i = 0; i < minionCount; i++) {
    // Randomize trail time between 0.4-1.2s for each minion
    const trailDelay = MINION_TRAIL_MIN + rng() * (MINION_TRAIL_MAX - MINION_TRAIL_MIN);
    
    enemies.push(
      createMinion(
        item,
        courseIndex,
        days,
        now,
        baseDelay + trailDelay + i * 300, // minions spawn after main with varied delay
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
  let hp = Math.round(baseStats.hp * hpMult);

  // Cap exam boss HP to max ~4x a full-urgency assignment's HP
  if (item.type === 'exam') {
    const maxAssignmentUrgency = 1.0; // full urgency
    const maxAssignmentHp = BASE_STATS.assignment.hp * enemyHpMultiplier(maxAssignmentUrgency, 50); // typical assignment
    const maxBossHp = maxAssignmentHp * EXAM_BOSS_HP_CAP_MULTIPLIER;
    hp = Math.min(hp, Math.round(maxBossHp));
  }

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
    hp,
    maxHp: hp,
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

/**
 * Generate a tutorial wave with exactly 1 shambler + 2 draft minions.
 * Uses the lowest-points upcoming assignment, with low HP and slow speed for learning.
 * 
 * @param semester - The semester data
 * @param now - Current timestamp
 * @param rng - Optional seeded RNG function
 * @returns Array of exactly 3 enemies (1 shambler + 2 minions)
 */
export function tutorialWave(
  semester: Semester,
  now: number,
  rng: RngFunction = Math.random
): EnemyStats[] {
  // Find all upcoming ungraded assignments
  const upcomingAssignments = semester.courses.flatMap((course, courseIndex) =>
    course.items
      .filter((item) => 
        item.type === 'assignment' && 
        item.grade === null && 
        daysUntilDue(item.dueDate, now) >= 0
      )
      .map((item) => ({ item, courseIndex, days: daysUntilDue(item.dueDate, now) }))
  );

  // Pick the lowest-points assignment
  upcomingAssignments.sort((a, b) => a.item.points - b.item.points);
  
  if (upcomingAssignments.length === 0) {
    // Fallback: create a synthetic tutorial assignment
    const syntheticItem: CourseworkItem = {
      id: 'tutorial-assignment',
      courseId: semester.courses[0]?.id || 'TUTORIAL',
      name: 'Tutorial Assignment',
      type: 'assignment',
      dueDate: new Date(now + 7 * 86400000), // 7 days out
      points: 30,
      grade: null,
    };
    
    return createTutorialGroup(syntheticItem, 0, 7, now, rng);
  }

  const { item, courseIndex, days } = upcomingAssignments[0];
  return createTutorialGroup(item, courseIndex, days, now, rng);
}

/**
 * Create a tutorial spawn group: 1 weak shambler + 2 weak minions.
 * 
 * @param item - The assignment item
 * @param courseIndex - Course index
 * @param days - Days until due
 * @param now - Current timestamp
 * @param rng - RNG function
 * @returns Array of exactly 3 enemies
 */
function createTutorialGroup(
  item: CourseworkItem,
  courseIndex: number,
  days: number,
  now: number,
  rng: RngFunction
): EnemyStats[] {
  const enemies: EnemyStats[] = [];

  // Create weak shambler (50% HP, 70% speed)
  const shambler = createEnemy(item, courseIndex, days, now, 0, false, rng);
  shambler.hp = Math.round(shambler.hp * 0.5);
  shambler.maxHp = shambler.hp;
  shambler.speed = shambler.speed * 0.7;
  enemies.push(shambler);

  // Create 2 weak minions (60% HP, 70% speed, trail by 0.5-0.8s)
  for (let i = 0; i < 2; i++) {
    const trailDelay = 500 + rng() * 300; // 0.5-0.8s
    const minion = createMinion(item, courseIndex, days, now, trailDelay, 'draft', rng);
    minion.hp = Math.round(minion.hp * 0.6);
    minion.maxHp = minion.hp;
    minion.speed = minion.speed * 0.7;
    enemies.push(minion);
  }

  return enemies;
}

