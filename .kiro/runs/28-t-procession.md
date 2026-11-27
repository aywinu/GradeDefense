Spec amendment + pure core module for "The Procession" (R19). The product owner found that many simultaneous creatures and minions feel slow and chaotic and don't teach prioritisation. New model: the battlefield is the semester calendar. Each real deadline is one creature; its distance from the altar IS its days left. The player chooses which deadline to weaken. When a deadline's due date arrives, it is resolved: the seals still unbroken cost grade in that course, in proportion to the item's weight in the course. A 10-point lab barely matters; a 100-point midterm can fail the course.

Touch ONLY: .kiro/specs/deadline-defense/requirements.md (append R19, mark R18.3 and R18.4 as SUPERSEDED by R19 in their headings), .kiro/specs/deadline-defense/tasks.md (append a "19. The Procession" section with sub-tasks, ticked as you finish), and create src/core/procession.ts, src/core/procession.test.ts, src/core/procession.prop.test.ts. Do not edit other files. Reuse `sealsFor` from src/core/duel.ts and the types in src/core/types.ts. No Date.now(), no rendering imports (tech.md).

R19 (EARS) must cover: calendar lane (position = days left / horizon), at most N visible deadlines (the nearest ones), arrival resolution with weight-proportional grade loss, projected course grades including already-graded items, failing a course below 50, wrong answers cost time (the clock jumps), and a final transcript.

API of src/core/procession.ts (export exactly these names):

```ts
export const PROCESSION = {
  horizonDays: 14,      // a deadline enters the lane 14 days before it is due
  maxVisible: 4,        // at most 4 deadlines on the field at once
  secondsPerDay: 6,     // real seconds per semester day while fighting
  duelTimeScale: 0.25,  // the clock runs at 25% while a question is open
  wrongAnswerDays: 0.5, // a wrong answer wastes half a day
  unpreparedFloor: 25,  // an item met with all seals intact scores 25%
  passGrade: 50,
} as const;

export type Verdict = 'ready' | 'partial' | 'unprepared';
export interface ProcessionItem {
  itemId: string; courseId: string; label: string; type: ItemType;
  points: number; dueDay: number;  // days after the procession start (float, >= 0)
  seals: number; maxSeals: number; // maxSeals = sealsFor({type,isMinion:false}, points)
  resolved: boolean; score: number | null; // item score 0-100 once resolved
  verdict: Verdict | null;
}
export interface ProcessionState {
  day: number;                       // current semester day (float, starts at 0)
  items: ProcessionItem[];           // all upcoming items, sorted by dueDay then itemId
  graded: Record<string, { points: number; earned: number }>; // per course: already-graded items (points, points*grade/100)
  totals: Record<string, number>;    // per course: total points of ALL its items (graded + upcoming)
}
export interface Arrival { itemId: string; courseId: string; label: string; verdict: Verdict; score: number; gradeBefore: number; gradeAfter: number }

export function buildProcession(semester: Semester, now: Date): ProcessionState;
// upcoming = items with grade === null and dueDate >= now; dueDay = (dueDate - now) / 86400000. Graded items (grade !== null) go into `graded`. Ungraded items already past due are ignored.
export function itemScore(seals: number, maxSeals: number): number;
// 100 when seals = 0, unpreparedFloor when seals = maxSeals, linear in between, rounded to 1 decimal.
export function verdictFor(seals: number, maxSeals: number): Verdict; // 0 → ready, <= half → partial, else unprepared
export function courseGrade(state: ProcessionState, courseId: string): number;
// projected grade 0-100: (graded.earned + Σ resolved items points*score/100 + Σ unresolved items points*1.0) / totals * 100, 1 decimal. Unresolved items count as fully ready (optimistic projection). A course with no points → 100.
export function visible(state: ProcessionState): ProcessionItem[];
// unresolved items with dueDay - day <= horizonDays, nearest first, at most maxVisible.
export function laneProgress(item: ProcessionItem, day: number): number; // clamp(1 - (dueDay - day) / horizonDays, 0, 1)
export function breakSeals(state: ProcessionState, itemId: string, n: number): ProcessionState;
// remove n seals (never below 0). When seals reach 0 the item is resolved immediately as 'ready' with score 100. Unknown or resolved ids → state unchanged. Immutable.
export function advance(state: ProcessionState, days: number): { state: ProcessionState; arrivals: Arrival[] };
// day += max(0, days); every unresolved item with dueDay <= new day resolves with itemScore/verdictFor, in due order; each Arrival records the course grade before and after. Immutable.
export function failedCourses(state: ProcessionState): string[]; // courses with courseGrade < passGrade
export function isFinished(state: ProcessionState): boolean; // every item resolved
export function letterGrade(grade: number): 'A' | 'B' | 'C' | 'D' | 'F'; // >=90 A, >=80 B, >=70 C, >=50 D, else F
```

Tests (Vitest + fast-check):
- unit: on the demo semester (src/data/demo.json via resolveSemester at a fixed date), the first visible deadlines are CV101 midterm, PHO101 quiz and MATH101 midterm; an unprepared 100-point exam in a 250-point course costs 30 grade points (100 × 0.75 / 250 × 100), a 10-point lab costs 3; breaking all seals early means no loss; failing both CV101 big items unprepared fails the course.
- properties: grades stay in [0, 100]; breaking more seals before an arrival never lowers the grade; advance(a) then advance(b) equals advance(a + b) (same grades and resolved set); visible() never returns more than maxVisible or a resolved item; laneProgress in [0, 1]; every item resolves exactly once; determinism.
Verify: `npx vitest run src/core` and `npx tsc --noEmit` pass.
