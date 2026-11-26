/**
 * Duel combat: pure functions for the player-vs-creature combat system.
 * No towers, no Lantern. The player targets a creature and weakens it with questions.
 */

import type { EnemyStats, ItemType } from './types';

/** State of an ongoing duel with a creature. */
export interface DuelState {
  /** Number of seals remaining (creature is defeated when this reaches 0). */
  seals: number;
  /** Maximum seals (never changes during the duel, used for UI). */
  maxSeals: number;
  /** Progress toward the altar (0 = spawned, 1 = reached altar). */
  progress: number;
}

/** Result of applying an answer to a duel. */
export interface ApplyAnswerResult {
  state: DuelState;
  /** Damage dealt to seals (0 if wrong answer, 1 or 2 if correct). */
  damage: number;
  /** Progress added if wrong answer (0.06 if wrong, 0 if correct). */
  lurch: number;
}

/**
 * Compute the number of seals for a creature based on its type and points.
 * 
 * Rules:
 * - Minions: 1 seal
 * - Quiz: 2 seals
 * - Assignment: 3 seals (+1 if points ≥ 50)
 * - Project/Presentation: 5 seals
 * - Exam: 8 seals (+2 if points ≥ 100)
 * 
 * @returns An integer ≥ 1
 */
export function sealsFor(
  enemy: Pick<EnemyStats, 'type' | 'isMinion'>,
  points: number
): number {
  if (enemy.isMinion) {
    return 1;
  }

  switch (enemy.type) {
    case 'quiz':
      return 2;
    case 'assignment':
      return points >= 50 ? 4 : 3;
    case 'project':
    case 'presentation':
      return 5;
    case 'exam':
      return points >= 100 ? 10 : 8;
    default:
      return 1;
  }
}

/**
 * Apply an answer (correct or wrong) to a duel state.
 * 
 * Rules:
 * - Correct: damage = 1 (or 2 if streak ≥ 3), capped at remaining seals
 * - Wrong: damage = 0, lurch = +0.06 progress (capped at 1)
 * - Progress never decreases
 * - Seals never go negative
 * 
 * @param state Current duel state
 * @param correct Whether the answer was correct
 * @param streak Number of consecutive correct answers before this one (0 = no streak bonus)
 * @returns Updated state, damage dealt, and lurch amount
 */
export function applyAnswer(
  state: DuelState,
  correct: boolean,
  streak: number
): ApplyAnswerResult {
  if (correct) {
    // Correct answer: deal damage (1 or 2 if streak ≥ 3), no lurch
    const baseDamage = streak >= 3 ? 2 : 1;
    const damage = Math.min(baseDamage, state.seals);
    return {
      state: {
        ...state,
        seals: state.seals - damage,
      },
      damage,
      lurch: 0,
    };
  } else {
    // Wrong answer: no damage, lurch forward +0.06
    const lurch = 0.06;
    return {
      state: {
        ...state,
        progress: Math.min(1, state.progress + lurch),
      },
      damage: 0,
      lurch,
    };
  }
}

/**
 * Compute the speed at which a creature crosses the lane (progress per second).
 * 
 * Target timings:
 * - Regular creatures: ~180-300s to cross (progress 0 → 1)
 * - Exams: ~360s to cross
 * - Overdue items (daysLeft < 0): 25% faster
 * 
 * @returns A positive, finite speed (progress per second)
 */
export function creepSpeed(
  type: ItemType,
  isMinion: boolean,
  daysLeft: number
): number {
  // Base speed: inverse of target crossing time
  let baseSpeed: number;
  
  if (isMinion) {
    // Minions are fast
    baseSpeed = 1 / 120; // 2 minutes
  } else if (type === 'exam') {
    // Exams are slow (long study session)
    baseSpeed = 1 / 360; // 6 minutes
  } else if (type === 'quiz') {
    // Quizzes are fast
    baseSpeed = 1 / 180; // 3 minutes
  } else if (type === 'project' || type === 'presentation') {
    // Projects are slow
    baseSpeed = 1 / 300; // 5 minutes
  } else {
    // Assignments: medium
    baseSpeed = 1 / 240; // 4 minutes
  }

  // Overdue items are 25% faster
  if (daysLeft < 0) {
    baseSpeed *= 1.25;
  }

  return baseSpeed;
}

/**
 * Check if a creature is defeated (all seals broken).
 */
export function isDefeated(state: DuelState): boolean {
  return state.seals <= 0;
}

/**
 * Check if a creature has reached the altar (progress = 1).
 */
export function reachedAltar(state: DuelState): boolean {
  return state.progress >= 1;
}
