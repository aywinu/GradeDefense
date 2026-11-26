/**
 * Pure scoring functions for Deadline Defense.
 * All functions are pure (no side effects, no Date.now()).
 * Take `now` as a parameter for time-based calculations.
 * 
 * Adapted from reference/coursepilot/priority.py.
 */

/**
 * Calculate urgency based on days until due date.
 * Saturates at 3 weeks out (21 days).
 * 
 * @param daysUntilDue - Number of days until the deadline (can be negative for overdue)
 * @returns Urgency score from 0.1 (far future) to 1.0 (due today or overdue)
 */
export function calculateUrgency(daysUntilDue: number): number {
  // Saturates at 3 weeks out, minimum urgency is 0.1
  return Math.max(0.1, 1 - daysUntilDue / 21);
}

/**
 * Calculate risk based on current grade.
 * Unknown grade (null) = medium risk.
 * 
 * @param grade - Current grade (0-100) or null if unknown
 * @returns Risk score from 0.0 (100% grade) to 1.0 (0% grade)
 */
export function calculateRisk(grade: number | null): number {
  // Unknown grade = medium risk
  if (grade === null) return 0.5;
  return (100 - grade) / 100;
}

/**
 * Calculate weight based on points.
 * 
 * @param points - Points/weight of the item
 * @returns Normalized weight score
 */
export function calculateWeight(points: number): number {
  return points / 100;
}

/**
 * Calculate overall priority score for an item.
 * Weighted sum: urgency 50%, risk 30%, weight 20%.
 * 
 * @param daysUntilDue - Number of days until the deadline
 * @param grade - Current grade (0-100) or null if unknown
 * @param points - Points/weight of the item
 * @returns Priority score (higher = more urgent)
 */
export function priorityScore(
  daysUntilDue: number,
  grade: number | null,
  points: number
): number {
  const urgency = calculateUrgency(daysUntilDue);
  const risk = calculateRisk(grade);
  const weight = calculateWeight(points);
  
  // Weighted sum: urgency 50%, risk 30%, weight 20%
  return urgency * 0.5 + risk * 0.3 + weight * 0.2;
}

/**
 * Calculate HP multiplier based on urgency and points.
 * More urgent and higher-weight items have more HP.
 * 
 * @param urgency - Urgency score (0.1 to 1.0)
 * @param points - Points/weight of the item
 * @returns HP multiplier (always >= 1.0)
 */
export function enemyHpMultiplier(urgency: number, points: number): number {
  return (1 + urgency * 2) * (1 + points / 100);
}

/**
 * Calculate speed multiplier based on urgency.
 * More urgent items move faster.
 * 
 * @param urgency - Urgency score (0.1 to 1.0)
 * @returns Speed multiplier (always >= 1.0)
 */
export function enemySpeedMultiplier(urgency: number): number {
  return 1 + urgency * 0.5;
}

/**
 * Calculate fortress damage based on points.
 * Higher-weight items deal more damage if they reach the fortress.
 * 
 * @param points - Points/weight of the item
 * @returns Damage amount (always >= 0)
 */
export function fortressDamage(points: number): number {
  // High-weight items deal more damage if they reach the end
  return Math.round(points / 10);
}

/**
 * Calculate days until due date.
 * Pure function that takes current time as a parameter.
 * 
 * @param dueDate - The due date
 * @param now - Current timestamp (milliseconds since epoch)
 * @returns Number of days until due (negative if overdue)
 */
export function daysUntilDue(dueDate: Date, now: number): number {
  return (dueDate.getTime() - now) / 86400000;
}
