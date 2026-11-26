/**
 * Core type definitions for Deadline Defense.
 * NO Phaser imports allowed in this file.
 */

export type CourseId = string; // "CV101", "PHO101", etc.

export type ItemType = "assignment" | "quiz" | "exam" | "project" | "presentation";

/**
 * A coursework item with a resolved absolute due date.
 * This is what the game uses at runtime after resolving demo data.
 */
export interface CourseworkItem {
  id: string; // unique ID, e.g., "CV101-midterm"
  courseId: CourseId;
  name: string;
  type: ItemType;
  dueDate: Date;
  points: number; // weight in gradebook
  grade: number | null; // 0-100 or null if future
}

/**
 * Demo data format (stored in JSON).
 * Uses relative daysOffset instead of absolute dates.
 */
export interface DemoCourseworkItem {
  id: string;
  courseId: CourseId;
  name: string;
  daysOffset: number; // relative days from "today"
  points: number;
  grade: number | null;
  type: ItemType;
}

export interface Course {
  id: CourseId;
  title: string;
  color: string; // hex color for UI/tower
  items: CourseworkItem[];
}

export interface DemoCourse {
  id: CourseId;
  title: string;
  color: string;
  items: DemoCourseworkItem[];
}

export interface Semester {
  courses: Course[];
  startDate: Date; // for relative date conversion
}

export interface DemoSemester {
  courses: DemoCourse[];
}

export interface EnemyStats {
  id: string;
  courseId: CourseId;
  itemId: string;
  type: ItemType;
  hp: number;
  maxHp: number;
  speed: number; // pixels per second
  damage: number; // damage to fortress if reaches end
  x: number;
  y: number;
  pathProgress: number; // 0-1 along lane
  spawnedAt: number; // timestamp
  lastDamagedAt: number | null;
  neglected: boolean; // buff applied?
  qteTriggered?: boolean; // for exam bosses
}

export interface TowerStats {
  courseId: CourseId;
  x: number;
  y: number;
  range: number;
  damage: number;
  fireRate: number; // shots per second
  lastFiredAt: number;
  upgrades: {
    damage: number; // level 0-3
    speed: number; // level 0-3
    range: number; // level 0-2
  };
}

/**
 * Game state must be serializable (no Set, Map, or Date objects in nested structures).
 * Use string[] instead of Set<string> for answeredQuestions.
 */
export interface GameState {
  wave: number;
  gold: number;
  fortressHp: number;
  maxFortressHp: number;
  towers: TowerStats[];
  enemies: EnemyStats[];
  chargeMeter: number; // 0-100
  answeredQuestions: string[]; // question IDs (use array, not Set, for serialization)
  lastAnswerTime: number;
}

export interface CheckpointQuestion {
  id: string;
  courseId: CourseId;
  question: string;
  choices: string[]; // 4 choices
  correctIndex: number; // 0-3
}
