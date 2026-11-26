/**
 * Layout helpers for battlefield positioning (pure functions)
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.3
 * 
 * Layout on the 1600x900 canvas:
 * - HUD band at top: y 0-90
 * - 6 lanes between y=110 and y=870 (760px total height)
 * - Fortress (grimoire desk) on left: x 0-150
 * - Tower positions at x=260
 * - Enemy spawn at x=1650, walk left to fortress
 */

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;

const HUD_HEIGHT = 90;
const LANE_START_Y = 110;
const LANE_END_Y = 870;
const LANE_COUNT = 6;

const FORTRESS_X_MIN = 0;
const FORTRESS_X_MAX = 150;

const TOWER_X = 260;
const ENEMY_SPAWN_X = 1650;

/**
 * Calculate Y position for a given lane index (0-5)
 * @param laneIndex - Lane index (0 for top lane, 5 for bottom lane)
 * @returns Y position in pixels
 */
export function laneY(laneIndex: number): number {
  if (laneIndex < 0 || laneIndex >= LANE_COUNT) {
    throw new Error(`Invalid lane index: ${laneIndex}. Must be 0-${LANE_COUNT - 1}`);
  }

  const laneHeight = (LANE_END_Y - LANE_START_Y) / LANE_COUNT;
  return LANE_START_Y + (laneIndex + 0.5) * laneHeight; // center of lane
}

/**
 * Calculate tower position for a given lane index
 * @param laneIndex - Lane index (0-5)
 * @returns {x, y} position in pixels
 */
export function towerPosition(laneIndex: number): { x: number; y: number } {
  return {
    x: TOWER_X,
    y: laneY(laneIndex),
  };
}

/**
 * Calculate enemy spawn position for a given lane index
 * @param laneIndex - Lane index (0-5)
 * @returns {x, y} position in pixels
 */
export function enemySpawnPosition(laneIndex: number): { x: number; y: number } {
  return {
    x: ENEMY_SPAWN_X,
    y: laneY(laneIndex),
  };
}

/**
 * Calculate fortress position (center point)
 * @returns {x, y} position in pixels
 */
export function fortressPosition(): { x: number; y: number } {
  return {
    x: (FORTRESS_X_MIN + FORTRESS_X_MAX) / 2,
    y: CANVAS_HEIGHT / 2,
  };
}

/**
 * Layout constants for reference
 */
export const Layout = {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  LANE_START_Y,
  LANE_END_Y,
  LANE_COUNT,
  FORTRESS_X_MIN,
  FORTRESS_X_MAX,
  TOWER_X,
  ENEMY_SPAWN_X,
} as const;
