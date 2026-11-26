/**
 * Study model: glue between saved progress, the semester and the pure rules in
 * src/core/readiness.ts. Everything the War Room, trials, scout report and
 * debrief show comes from here, so screens never disagree.
 */
import demo from '../data/demo.json';
import checkpoints from '../data/checkpoints.json';
import { resolveSemester } from '../core/semester';
import { priorityScore, daysUntilDue } from '../core/scoring';
import {
  calculateReadiness,
  identifyWeakTopics,
  recommendTrialCount,
  threatLevel,
  courseGrade,
  nextBigEnemies,
  trialQuestionPick,
} from '../core/readiness';
import type { Course, CourseworkItem, DemoSemester, Semester } from '../core/types';
import { load, save, type TrialSession } from '../save/save';
import { forgeMultipliers } from '../core/balance';

export interface Question {
  id: string;
  courseId: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explain?: string;
  topic?: string;
}

export const SPARKS_PER_LEVEL = 3;
export const MAX_FORGE = 5;

const QUESTIONS: Question[] = Object.entries(checkpoints as Record<string, Omit<Question, 'courseId'>[]>).flatMap(
  ([courseId, list]) => list.map((q) => ({ ...q, courseId })),
);

export function questionsFor(courseId: string): Question[] {
  const own = QUESTIONS.filter((q) => q.courseId === courseId);
  return own.length ? own : QUESTIONS; // imported courses without questions fall back to the shared pool
}

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

let semesterCache: { at: number; sem: Semester } | null = null;

export function getSemester(now = new Date()): Semester {
  if (semesterCache && Math.abs(semesterCache.at - now.getTime()) < 60_000) return semesterCache.sem;
  const src = load().semester;
  let sem: Semester | null = null;
  if (src.source !== 'demo') {
    try {
      const parsed = JSON.parse(src.json) as Semester;
      sem = {
        startDate: new Date(parsed.startDate),
        courses: parsed.courses.map((c) => ({
          ...c,
          items: c.items.map((i) => ({ ...i, dueDate: new Date(i.dueDate) })),
        })),
      };
    } catch {
      sem = null;
    }
  }
  sem ??= resolveSemester(demo as unknown as DemoSemester, now);
  semesterCache = { at: now.getTime(), sem };
  return sem;
}

export function invalidateSemester(): void {
  semesterCache = null;
}

export function sessionsFor(courseId: string): TrialSession[] {
  return load().sessions.filter((s) => s.courseId === courseId);
}

export function readinessFor(courseId: string, now = Date.now()): number {
  return Math.round(calculateReadiness(sessionsFor(courseId), now));
}

export function forgeLevel(courseId: string): number {
  return load().forge[courseId] ?? 0;
}

export function sparks(courseId: string): number {
  return load().sparks[courseId] ?? 0;
}

export type Threat = 'Low' | 'Medium' | 'High' | 'Critical';

export interface CourseView {
  course: Course;
  grade: number | null;
  readiness: number;
  threat: Threat;
  big: Array<CourseworkItem & { days: number }>;
  next: (CourseworkItem & { days: number }) | null;
  weakTopics: string[];
  recommendedTrials: number;
  forge: number;
  sparks: number;
  trials: number;
}

export function courseView(course: Course, now = new Date()): CourseView {
  const t = now.getTime();
  const upcoming = course.items
    .filter((i) => i.grade === null && i.dueDate.getTime() >= t - 86400000)
    .map((i) => ({ ...i, days: Math.max(0, Math.ceil(daysUntilDue(i.dueDate, t))) }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const grade = courseGrade(course);
  const top = upcoming.reduce((m, i) => Math.max(m, priorityScore(i.days, grade, i.points)), 0);
  const readiness = readinessFor(course.id, t);
  // Readiness lowers the threat a little: preparation is the point.
  const threat = threatLevel(top * (1 - readiness / 250)) as Threat;
  const big = nextBigEnemies(course, now, 3).map((i) => ({ ...i, days: Math.max(0, Math.ceil(daysUntilDue(i.dueDate, t))) }));
  const next = big[0] ?? upcoming[0] ?? null;
  const sessions = sessionsFor(course.id);
  return {
    course,
    grade,
    readiness,
    threat,
    big,
    next,
    weakTopics: weakTopicsFor(sessions),
    // Kiro's formula scales with days left; capped so the advice stays actionable.
    recommendedTrials: next ? Math.min(4, recommendTrialCount(next.days, readiness)) : 0,
    forge: forgeLevel(course.id),
    sparks: sparks(course.id),
    trials: sessions.filter((s) => s.source === 'trial').length,
  };
}

/**
 * Kiro's identifyWeakTopics needs 3+ answers per topic; with small question
 * pools that takes a while, so recent misses that were not answered correctly
 * afterwards are surfaced too.
 */
function weakTopicsFor(sessions: TrialSession[]): string[] {
  const stable = identifyWeakTopics(sessions);
  const last = new Map<string, boolean>();
  for (const s of [...sessions].sort((a, b) => a.timestamp - b.timestamp))
    for (const q of s.questionsAnswered) if (q.topic) last.set(q.topic, q.correct);
  const recent = [...last.entries()].filter(([, ok]) => !ok).map(([t]) => t);
  return [...new Set([...stable, ...recent])].slice(0, 3);
}

export function allCourseViews(now = new Date()): CourseView[] {
  return getSemester(now).courses.map((c) => courseView(c, now));
}

/** Questions for a 5-question trial, preferring wrong or unseen ones. */
export function pickTrial(courseId: string, n = 5, rng: () => number = Math.random): Question[] {
  const history = sessionsFor(courseId).flatMap((s) =>
    s.questionsAnswered.map((q) => ({ courseId, questionId: q.questionId, correct: q.correct, atMs: s.timestamp })),
  );
  const ids = trialQuestionPick(questionsFor(courseId), history, n, rng);
  return ids.map((id) => questionById(id)).filter((q): q is Question => !!q);
}

export interface ForgeGain {
  courseId: string;
  sparksGained: number;
  levelsGained: number;
  level: number;
}

/**
 * Record answers. Only CORRECT answers to study questions earn sparks/forge
 * levels: nothing is earned for ticking "done" on real work.
 */
export function recordSession(
  courseId: string,
  answers: { questionId: string; correct: boolean }[],
  source: 'trial' | 'battle',
  now = Date.now(),
): ForgeGain {
  if (!answers.length) return { courseId, sparksGained: 0, levelsGained: 0, level: forgeLevel(courseId) };
  const correct = answers.filter((a) => a.correct).length;
  let levelsGained = 0;
  let level = 0;
  save((d) => {
    d.sessions.push({
      courseId,
      timestamp: now,
      score: Math.round((correct / answers.length) * 100),
      questionsAnswered: answers.map((a) => ({ ...a, topic: questionById(a.questionId)?.topic })),
      source,
    });
    let sp = (d.sparks[courseId] ?? 0) + correct;
    level = d.forge[courseId] ?? 0;
    while (sp >= SPARKS_PER_LEVEL && level < MAX_FORGE) {
      sp -= SPARKS_PER_LEVEL;
      level++;
      levelsGained++;
    }
    d.sparks[courseId] = level >= MAX_FORGE ? 0 : sp;
    d.forge[courseId] = level;
  });
  return { courseId, sparksGained: correct, levelsGained, level };
}

/** Tower bonuses from forge level (studying = weapons). */
export function forgeBonus(level: number): { damage: number; fireRate: number; range: number } {
  return forgeMultipliers(level);
}

export function formatDue(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function inDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
