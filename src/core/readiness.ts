/**
 * Readiness & Study Loop — Core Rules (Pure Functions)
 * 
 * Tracks student readiness per course based on practice trial history
 * with recency weighting.
 * 
 * NO Phaser imports allowed in this file.
 */

import type { CourseId, CourseworkItem, Course } from './types';

/**
 * Trial history entry for a single question attempt.
 */
export interface TrialHistoryEntry {
  courseId: CourseId;
  questionId: string;
  correct: boolean;
  atMs: number; // timestamp
}

/**
 * Result from a completed practice trial (5 questions).
 */
export interface TrialResult {
  courseId: CourseId;
  timestamp: number; // Date.now()
  score: number; // 0-100
  questionsAnswered: { questionId: string; correct: boolean; topic?: string }[];
}

/**
 * Course readiness summary.
 */
export interface CourseReadiness {
  courseId: CourseId;
  readiness: number; // 0-100, weighted average of recent trial scores
  trialHistory: TrialResult[];
  weakTopics: string[]; // topics with <50% correct rate
}

/**
 * Calculate readiness score for a course based on trial history.
 * Uses recency weighting: trials from last 7 days count 2×, older count 1×.
 * 
 * @param trialHistory - Array of past trial results
 * @param now - Current timestamp
 * @returns Readiness score 0-100
 */
export function calculateReadiness(trialHistory: TrialResult[], now: number): number {
  if (trialHistory.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const trial of trialHistory) {
    const daysAgo = (now - trial.timestamp) / 86400000;
    const weight = daysAgo <= 7 ? 2.0 : 1.0;
    totalWeightedScore += trial.score * weight;
    totalWeight += weight;
  }

  return Math.min(100, Math.max(0, totalWeightedScore / totalWeight));
}

/**
 * Identify weak topics from trial history.
 * A topic is weak if it has ≥3 questions answered and <50% correct rate.
 * 
 * @param trialHistory - Array of past trial results
 * @returns Array of topic names with <50% correct rate
 */
export function identifyWeakTopics(trialHistory: TrialResult[]): string[] {
  const topicStats = new Map<string, { correct: number; total: number }>();

  for (const trial of trialHistory) {
    for (const q of trial.questionsAnswered) {
      if (!q.topic) continue;
      const stats = topicStats.get(q.topic) ?? { correct: 0, total: 0 };
      stats.total++;
      if (q.correct) stats.correct++;
      topicStats.set(q.topic, stats);
    }
  }

  // Return topics with <50% correct rate and ≥3 questions
  return Array.from(topicStats.entries())
    .filter(([_, stats]) => stats.total >= 3 && stats.correct / stats.total < 0.5)
    .map(([topic, _]) => topic)
    .sort();
}

/**
 * Recommend number of practice trials needed before a deadline.
 * Formula: ceil((daysUntilDue - 1) * (1 - readiness/100))
 * 
 * @param daysUntilDue - Days until the deadline
 * @param readiness - Current readiness score 0-100
 * @returns Recommended number of trials (≥0)
 */
export function recommendTrialCount(daysUntilDue: number, readiness: number): number {
  if (daysUntilDue <= 0) return 0;
  const gap = 1 - readiness / 100; // 0 (fully ready) to 1 (not ready)
  return Math.max(0, Math.ceil((daysUntilDue - 1) * gap));
}

/**
 * Compute threat level from priority score.
 * 
 * @param priorityScore - Priority score from scoring.ts (0-1 range typically)
 * @returns Threat level
 */
export function threatLevel(priorityScore: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (priorityScore < 0.3) return 'Low';
  if (priorityScore < 0.5) return 'Medium';
  if (priorityScore < 0.7) return 'High';
  return 'Critical';
}

/**
 * Calculate current grade for a course based on past graded items.
 * Uses weighted average (points as weights).
 * 
 * @param course - Course with items
 * @returns Grade 0-100 or null if no graded items
 */
export function courseGrade(course: Course): number | null {
  const gradedItems = course.items.filter(item => item.grade !== null);
  if (gradedItems.length === 0) return null;

  let totalWeightedGrade = 0;
  let totalWeight = 0;

  for (const item of gradedItems) {
    if (item.grade !== null) {
      totalWeightedGrade += item.grade * item.points;
      totalWeight += item.points;
    }
  }

  if (totalWeight === 0) return null;
  return totalWeightedGrade / totalWeight;
}

/**
 * Find the next big enemies (exams, projects, presentations, items ≥50 points).
 * Returns up to n items, sorted by due date (soonest first).
 * 
 * @param course - Course with items
 * @param now - Current date
 * @param n - Maximum number of items to return (default 3)
 * @returns Array of big upcoming items
 */
export function nextBigEnemies(
  course: Course,
  now: Date,
  n: number = 3
): CourseworkItem[] {
  const bigItems = course.items.filter(item => {
    // Only future items (not graded yet, or due in future)
    if (item.dueDate <= now) return false;
    
    // Big items: exams, projects, presentations, or high-weight items
    if (item.type === 'exam' || item.type === 'project' || item.type === 'presentation') {
      return true;
    }
    return item.points >= 50;
  });

  // Sort by due date (soonest first)
  bigItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return bigItems.slice(0, n);
}

/**
 * RNG function type for deterministic randomness.
 */
export type RngFunction = () => number;

/**
 * Pick n questions for a trial, preferring questions answered wrong or never seen.
 * 
 * @param questions - Available questions pool
 * @param history - Trial history entries
 * @param n - Number of questions to pick (default 5)
 * @param rng - Random number generator (for deterministic tests)
 * @returns Array of n unique question IDs
 */
export function trialQuestionPick(
  questions: Array<{ id: string; courseId: CourseId }>,
  history: TrialHistoryEntry[],
  n: number = 5,
  rng: RngFunction = Math.random
): string[] {
  if (questions.length === 0) return [];
  if (n <= 0) return [];
  
  // Build a unique set of questions (by ID) to avoid duplicates
  const uniqueQuestions = new Map<string, { id: string; courseId: CourseId }>();
  for (const q of questions) {
    if (!uniqueQuestions.has(q.id)) {
      uniqueQuestions.set(q.id, q);
    }
  }
  
  // Build stats per question
  const questionStats = new Map<string, { correct: number; total: number }>();
  for (const entry of history) {
    const stats = questionStats.get(entry.questionId) ?? { correct: 0, total: 0 };
    stats.total++;
    if (entry.correct) stats.correct++;
    questionStats.set(entry.questionId, stats);
  }

  // Categorize questions
  const neverSeen: string[] = [];
  const answeredWrong: string[] = [];
  const answeredCorrect: string[] = [];

  for (const [qid] of uniqueQuestions) {
    const stats = questionStats.get(qid);
    if (!stats) {
      neverSeen.push(qid);
    } else if (stats.correct < stats.total) {
      // At least one wrong answer
      answeredWrong.push(qid);
    } else {
      // All correct
      answeredCorrect.push(qid);
    }
  }

  // Shuffle each category with RNG
  const shuffle = (arr: string[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledNeverSeen = shuffle(neverSeen);
  const shuffledWrong = shuffle(answeredWrong);
  const shuffledCorrect = shuffle(answeredCorrect);

  // Pick in priority order: never seen > wrong > correct
  const picked: string[] = [];
  const pool = [...shuffledNeverSeen, ...shuffledWrong, ...shuffledCorrect];
  
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    picked.push(pool[i]);
  }

  return picked;
}
