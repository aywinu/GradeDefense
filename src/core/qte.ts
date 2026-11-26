/**
 * Quick-Time Event (QTE) core rules.
 * Pure functions, game-clock based (no Date.now()).
 * 
 * QTE is triggered when:
 * - An exam boss crosses 50% HP
 * - A multi-phase enemy (project/presentation) crosses 66% or 33% HP
 * 
 * Defaults:
 * - Base time: 8000 ms
 * - Extended time: 16000 ms (with extraTime accessibility setting)
 * 
 * Outcomes:
 * - Correct answer → critical hit (3× base damage)
 * - Wrong/timeout → enrage buff (+50% damage, +25% speed for 10000 ms)
 */

import type { EnemyStats, CheckpointQuestion } from './types';

export interface QTESettings {
  extraTime: boolean; // accessibility setting: doubles timer
}

export interface QTEState {
  enemyId: string;
  question: CheckpointQuestion;
  timeRemaining: number; // milliseconds
  maxTime: number; // 8000 or 16000 based on settings
  startedAt: number; // game clock timestamp (from GameState.timeMs)
}

export interface QTEOutcome {
  success: boolean;
  damage?: number; // critical hit damage if success (3× base)
  enrage?: {
    damageMult: number; // 1.5
    speedMult: number; // 1.25
    durationMs: number; // 10000
  };
}

/**
 * Start a QTE with the given enemy, question, and settings.
 * Uses game clock time (from GameState.timeMs), NOT Date.now().
 * 
 * @param enemy - The enemy triggering the QTE
 * @param question - The checkpoint question to ask
 * @param settings - Accessibility settings (extraTime)
 * @param gameClockTime - Current game clock time in milliseconds (from GameState.timeMs)
 * @returns Initial QTE state
 */
export function startQTE(
  enemy: EnemyStats,
  question: CheckpointQuestion,
  settings: QTESettings,
  gameClockTime: number
): QTEState {
  const maxTime = settings.extraTime ? 16000 : 8000;
  return {
    enemyId: enemy.id,
    question,
    timeRemaining: maxTime,
    maxTime,
    startedAt: gameClockTime
  };
}

/**
 * Update QTE state by decrementing the timer.
 * Timer is clamped to [0, maxTime].
 * 
 * @param state - Current QTE state
 * @param deltaTimeMs - Time elapsed since last update (milliseconds)
 * @returns Updated QTE state
 */
export function updateQTE(state: QTEState, deltaTimeMs: number): QTEState {
  return {
    ...state,
    timeRemaining: Math.max(0, state.timeRemaining - deltaTimeMs)
  };
}

/**
 * Resolve QTE outcome based on player answer.
 * Deterministic: same inputs always produce same output.
 * 
 * @param state - Current QTE state
 * @param answerIndex - Player's answer (0-3), or null if timeout
 * @param baseDamage - Base tower damage (for critical hit calculation)
 * @returns QTE outcome (success with critical damage, or failure with enrage)
 */
export function resolveQTE(
  state: QTEState,
  answerIndex: number | null,
  baseDamage: number
): QTEOutcome {
  const isCorrect = answerIndex !== null && answerIndex === state.question.correctIndex;
  
  if (isCorrect) {
    return {
      success: true,
      damage: baseDamage * 3 // critical hit: 3× base damage
    };
  } else {
    return {
      success: false,
      enrage: {
        damageMult: 1.5,
        speedMult: 1.25,
        durationMs: 10000
      }
    };
  }
}

/**
 * Determine if a QTE should be triggered for the given enemy.
 * 
 * Trigger conditions:
 * - Exam boss (type=exam, not minion) crosses 50% HP
 * - Multi-phase enemy (project/presentation, not minion) crosses 66% or 33% HP
 * 
 * @param enemy - The enemy to check
 * @param hpFractionBefore - HP fraction before damage (0-1)
 * @param hpFractionAfter - HP fraction after damage (0-1)
 * @param alreadyTriggered - True if QTE already triggered for this enemy
 * @returns True if QTE should trigger
 */
export function shouldTriggerQTE(
  enemy: EnemyStats,
  hpFractionBefore: number,
  hpFractionAfter: number,
  alreadyTriggered: boolean
): boolean {
  // Never trigger if already triggered
  if (alreadyTriggered) {
    return false;
  }
  
  // Only trigger for main enemies (not minions)
  if (enemy.isMinion) {
    return false;
  }
  
  // Exam boss: trigger at 50% HP
  if (enemy.type === 'exam') {
    return hpFractionBefore > 0.5 && hpFractionAfter <= 0.5;
  }
  
  // Multi-phase enemy (project/presentation): trigger at 66% or 33% HP
  if (enemy.type === 'project' || enemy.type === 'presentation') {
    const crossedThreshold = (threshold: number) =>
      hpFractionBefore > threshold && hpFractionAfter <= threshold;
    
    return crossedThreshold(0.66) || crossedThreshold(0.33);
  }
  
  return false;
}
