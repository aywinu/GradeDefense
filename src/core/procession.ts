/**
 * The Procession: calendar-based battlefield where deadline distance = days left.
 * Pure functions, no Date.now(), no rendering imports.
 */

import { sealsFor } from './duel';
import type { Semester, ItemType } from './types';

export const PROCESSION = {
  horizonDays: 14, // a deadline enters the lane 14 days before it is due
  maxVisible: 4, // at most 4 deadlines on the field at once
  secondsPerDay: 8, // real seconds per semester day while fighting
  duelTimeScale: 0.2, // the clock runs at 20% while a question is open
  wrongAnswerDays: 0.5, // a wrong answer wastes half a day
  unpreparedFloor: 25, // an item met with all seals intact scores 25%
  passGrade: 50,
} as const;

export type Verdict = 'ready' | 'partial' | 'unprepared';

export interface ProcessionItem {
  itemId: string;
  courseId: string;
  label: string;
  type: ItemType;
  points: number;
  dueDay: number; // days after the procession start (float, >= 0)
  seals: number;
  maxSeals: number; // maxSeals = sealsFor({type,isMinion:false}, points)
  resolved: boolean;
  score: number | null; // item score 0-100 once resolved
  verdict: Verdict | null;
}

export interface ProcessionState {
  day: number; // current semester day (float, starts at 0)
  items: ProcessionItem[]; // all upcoming items, sorted by dueDay then itemId
  graded: Record<string, { points: number; earned: number }>; // per course: already-graded items (points, points*grade/100)
  totals: Record<string, number>; // per course: total points of ALL its items (graded + upcoming)
}

export interface Arrival {
  itemId: string;
  courseId: string;
  label: string;
  verdict: Verdict;
  score: number;
  gradeBefore: number;
  gradeAfter: number;
}

/**
 * Build initial procession state from a semester.
 * Upcoming items (grade = null, dueDate >= now) become procession items.
 * Graded items (grade ≠ null) go into `graded`.
 * Ungraded items already past due are ignored.
 */
export function buildProcession(semester: Semester, now: Date): ProcessionState {
  const nowMs = now.getTime();
  const graded: Record<string, { points: number; earned: number }> = {};
  const totals: Record<string, number> = {};
  const items: ProcessionItem[] = [];

  for (const course of semester.courses) {
    // Initialize course records
    if (!graded[course.id]) {
      graded[course.id] = { points: 0, earned: 0 };
    }
    if (!totals[course.id]) {
      totals[course.id] = 0;
    }

    for (const item of course.items) {
      // Add to totals
      totals[course.id] += item.points;

      if (item.grade !== null) {
        // Already graded
        graded[course.id].points += item.points;
        graded[course.id].earned += (item.points * item.grade) / 100;
      } else {
        // Ungraded
        const dueMs = item.dueDate.getTime();
        if (dueMs >= nowMs) {
          // Upcoming
          const dueDay = (dueMs - nowMs) / 86400000; // milliseconds to days
          const maxSeals = sealsFor({ type: item.type, isMinion: false }, item.points);
          items.push({
            itemId: item.id,
            courseId: item.courseId,
            label: item.name,
            type: item.type,
            points: item.points,
            dueDay,
            seals: maxSeals,
            maxSeals,
            resolved: false,
            score: null,
            verdict: null,
          });
        }
        // else: past due ungraded items are ignored
      }
    }
  }

  // Sort items by dueDay then itemId (deterministic)
  items.sort((a, b) => {
    if (a.dueDay !== b.dueDay) return a.dueDay - b.dueDay;
    return a.itemId.localeCompare(b.itemId);
  });

  return {
    day: 0,
    items,
    graded,
    totals,
  };
}

/**
 * Compute item score from remaining seals.
 * 100 when seals = 0, unpreparedFloor when seals = maxSeals, linear in between.
 * Rounded to 1 decimal.
 */
export function itemScore(seals: number, maxSeals: number): number {
  if (maxSeals === 0) return 100;
  const ratio = seals / maxSeals;
  const score = 100 - ratio * (100 - PROCESSION.unpreparedFloor);
  return Math.round(score * 10) / 10;
}

/**
 * Classify verdict based on remaining seals.
 * 0 → ready, <= half → partial, else unprepared.
 */
export function verdictFor(seals: number, maxSeals: number): Verdict {
  if (seals === 0) return 'ready';
  if (seals <= maxSeals / 2) return 'partial';
  return 'unprepared';
}

/**
 * Compute projected course grade (0-100, 1 decimal).
 * (graded.earned + resolved.earned + unresolved.points) / totals * 100.
 * Unresolved items count as fully ready (optimistic projection).
 * A course with no points → 100.
 */
export function courseGrade(state: ProcessionState, courseId: string): number {
  const total = Object.prototype.hasOwnProperty.call(state.totals, courseId) ? state.totals[courseId] : 0;
  if (total === 0 || !Number.isFinite(total)) return 100;

  const graded = Object.prototype.hasOwnProperty.call(state.graded, courseId) 
    ? state.graded[courseId] 
    : { points: 0, earned: 0 };
  let earned = graded.earned;

  // Add resolved items
  for (const item of state.items) {
    if (item.courseId === courseId && item.resolved && item.score !== null && Number.isFinite(item.score)) {
      earned += (item.points * item.score) / 100;
    }
  }

  // Add unresolved items (optimistic: 100%)
  for (const item of state.items) {
    if (item.courseId === courseId && !item.resolved) {
      earned += item.points;
    }
  }

  const grade = (earned / total) * 100;
  if (!Number.isFinite(grade)) return 100;
  return Math.round(grade * 10) / 10;
}

/**
 * Get visible items (at most maxVisible, nearest first, unresolved only, within horizon).
 */
export function visible(state: ProcessionState): ProcessionItem[] {
  const { day } = state;
  const unresolved = state.items.filter(
    (item) => !item.resolved && item.dueDay - day <= PROCESSION.horizonDays
  );
  // Sort by dueDay ascending (nearest first)
  unresolved.sort((a, b) => a.dueDay - b.dueDay);
  return unresolved.slice(0, PROCESSION.maxVisible);
}

/**
 * Compute lane progress (0 at horizon, 1 at arrival).
 */
export function laneProgress(item: ProcessionItem, day: number): number {
  // Handle NaN or infinite values
  if (!Number.isFinite(item.dueDay) || !Number.isFinite(day)) {
    return 0;
  }
  const daysLeft = item.dueDay - day;
  const progress = 1 - daysLeft / PROCESSION.horizonDays;
  return Math.max(0, Math.min(1, progress));
}

/**
 * Break n seals from an item. If seals reach 0, resolve as 'ready' with score 100.
 * Unknown or resolved ids → state unchanged.
 * Immutable.
 */
export function breakSeals(
  state: ProcessionState,
  itemId: string,
  n: number
): ProcessionState {
  const itemIndex = state.items.findIndex((item) => item.itemId === itemId);
  if (itemIndex === -1) return state; // unknown id

  const item = state.items[itemIndex];
  if (item.resolved) return state; // already resolved

  const newSeals = Math.max(0, item.seals - n);
  const newItems = [...state.items];
  newItems[itemIndex] = { ...item, seals: newSeals };

  // If seals reach 0, resolve immediately
  if (newSeals === 0) {
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      resolved: true,
      score: 100,
      verdict: 'ready',
    };
  }

  return { ...state, items: newItems };
}

/**
 * Advance the clock by `days` (clamped to >= 0).
 * Resolve all arrivals (dueDay <= new day) in due order.
 * Each Arrival records the course grade before and after.
 * Immutable.
 */
export function advance(
  state: ProcessionState,
  days: number
): { state: ProcessionState; arrivals: Arrival[] } {
  // Handle NaN or infinite values
  if (!Number.isFinite(state.day)) {
    return { state, arrivals: [] };
  }
  if (!Number.isFinite(days)) {
    days = 0;
  }
  
  const newDay = state.day + Math.max(0, days);
  const arrivals: Arrival[] = [];

  // Find all arrivals
  const toResolve = state.items.filter(
    (item) => !item.resolved && item.dueDay <= newDay
  );

  // Sort by dueDay then itemId (deterministic)
  toResolve.sort((a, b) => {
    if (a.dueDay !== b.dueDay) return a.dueDay - b.dueDay;
    return a.itemId.localeCompare(b.itemId);
  });

  let newState = { ...state, day: newDay };

  for (const item of toResolve) {
    const gradeBefore = courseGrade(newState, item.courseId);
    const score = itemScore(item.seals, item.maxSeals);
    const verdict = verdictFor(item.seals, item.maxSeals);

    // Resolve item
    const itemIndex = newState.items.findIndex((i) => i.itemId === item.itemId);
    if (itemIndex !== -1) {
      const newItems = [...newState.items];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        resolved: true,
        score,
        verdict,
      };
      newState = { ...newState, items: newItems };
    }

    const gradeAfter = courseGrade(newState, item.courseId);

    arrivals.push({
      itemId: item.itemId,
      courseId: item.courseId,
      label: item.label,
      verdict,
      score,
      gradeBefore,
      gradeAfter,
    });
  }

  return { state: newState, arrivals };
}

/**
 * Get courses with grade < passGrade.
 */
export function failedCourses(state: ProcessionState): string[] {
  const failed: string[] = [];
  const courseIds = Object.keys(state.totals);
  for (const courseId of courseIds) {
    if (courseGrade(state, courseId) < PROCESSION.passGrade) {
      failed.push(courseId);
    }
  }
  return failed.sort();
}

/**
 * Check if all items are resolved.
 */
export function isFinished(state: ProcessionState): boolean {
  return state.items.every((item) => item.resolved);
}

/**
 * Compute letter grade from numeric grade.
 * >=90 A, >=80 B, >=70 C, >=50 D, else F.
 */
export function letterGrade(grade: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (!Number.isFinite(grade)) return 'F';
  if (grade >= 90) return 'A';
  if (grade >= 80) return 'B';
  if (grade >= 70) return 'C';
  if (grade >= 50) return 'D';
  return 'F';
}
