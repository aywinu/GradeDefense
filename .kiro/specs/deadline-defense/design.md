# Design — Deadline Defense

## Architecture

### High-Level Layers

```
┌─────────────────────────────────────────────────────────────┐
│  src/ui/   DOM overlays, GSAP animations, React-free       │
│            (title screen, checkpoint panel, HUD)           │
└─────────────────────────────────────────────────────────────┘
                            ↓ calls
┌─────────────────────────────────────────────────────────────┐
│  src/game/  Phaser 4 scenes (Boot, Title, Battle, etc.)   │
│            Renders battlefield, handles input, dispatches   │
└─────────────────────────────────────────────────────────────┘
                            ↓ calls
┌─────────────────────────────────────────────────────────────┐
│  src/core/  Pure TypeScript rules (NO Phaser imports)     │
│            Scoring, wave generation, targeting, upgrades    │
│            → Unit-testable, property-testable              │
└─────────────────────────────────────────────────────────────┘
                            ↓ reads
┌─────────────────────────────────────────────────────────────┐
│  src/data/  Static JSON (demo semester, checkpoints)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  src/import/  ICS parser, PDF text extractor (client-side) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  src/save/  Versioned localStorage wrapper with try/catch   │
└─────────────────────────────────────────────────────────────┘
```

### Core Principles
1. **Pure Core**: `src/core/` has zero runtime dependencies on Phaser, DOM, or localStorage. All game rules are pure functions `(state, input) → (newState, effects)`.
2. **Data Flow**: UI/Phaser scenes call core functions, receive effects (spawn enemy, play sound), and handle rendering/audio.
3. **Testability**: Core logic can be unit-tested in milliseconds with Vitest. Property-based tests (fast-check) verify invariants.
4. **Static Assets**: No external CDN or API calls. All data bundled in `dist/`.

---

## Data Models (TypeScript)

### Core Types (`src/core/types.ts`)

```typescript
export type CourseId = string; // "CV101", "PHO101", etc.

export type ItemType = "assignment" | "quiz" | "exam" | "project" | "presentation";

export interface CourseworkItem {
  id: string; // unique ID, e.g., "CV101-midterm"
  courseId: CourseId;
  name: string;
  type: ItemType;
  dueDate: Date;
  points: number; // weight in gradebook
  grade: number | null; // 0-100 or null if future
}

export interface Course {
  id: CourseId;
  title: string;
  color: string; // hex color for UI/tower
  items: CourseworkItem[];
}

export interface Semester {
  courses: Course[];
  startDate: Date; // for relative date conversion
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

export interface GameState {
  wave: number;
  gold: number;
  fortressHp: number;
  maxFortressHp: number;
  towers: TowerStats[];
  enemies: EnemyStats[];
  chargeMeter: number; // 0-100
  answeredQuestions: Set<string>; // question IDs
  lastAnswerTime: number;
}

export interface CheckpointQuestion {
  id: string;
  courseId: CourseId;
  question: string;
  choices: string[]; // 4 choices
  correctIndex: number; // 0-3
}
```

---

## Scoring Formulas (Pure TypeScript)

Adapted from `reference/coursepilot/priority.py` into new TypeScript code written during the submission period.

### `src/core/scoring.ts`

```typescript
export function calculateUrgency(daysUntilDue: number): number {
  // Saturates at 3 weeks out
  return Math.max(0.1, 1 - daysUntilDue / 21);
}

export function calculateRisk(grade: number | null): number {
  // Unknown grade = medium risk
  if (grade === null) return 0.5;
  return (100 - grade) / 100;
}

export function calculateWeight(points: number): number {
  return points / 100;
}

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

export function enemyHpMultiplier(urgency: number, points: number): number {
  return (1 + urgency * 2) * (1 + points / 100);
}

export function enemySpeedMultiplier(urgency: number): number {
  return 1 + urgency * 0.5;
}

export function fortressDamage(points: number): number {
  // High-weight items deal more damage if they reach the end
  return Math.round(points / 10);
}
```

### Property-Based Tests (Invariants)

Using `fast-check`, we verify:

1. **Urgency Bounds**: `0.1 ≤ urgency ≤ 1.0` for any `daysUntilDue ≥ 0`
2. **Priority Monotonicity**: For fixed grade and points, priority increases as deadline approaches
3. **HP Scaling Positive**: `enemyHpMultiplier(...) ≥ 1.0`
4. **Speed Scaling Positive**: `enemySpeedMultiplier(...) ≥ 1.0`
5. **Damage Non-Negative**: `fortressDamage(...) ≥ 0`
6. **Score Determinism**: Same inputs always produce same output (no random/Date.now in scoring)

---

## Readiness & Study Loop (`src/core/readiness.ts`)

Tracks student readiness per course based on practice trial history with recency weighting.

### Core Functions

```typescript
export interface TrialResult {
  courseId: CourseId;
  timestamp: number; // Date.now()
  score: number; // 0-100
  questionsAnswered: { questionId: string; correct: boolean; topic?: string }[];
}

export interface CourseReadiness {
  courseId: CourseId;
  readiness: number; // 0-100, weighted average of recent trial scores
  trialHistory: TrialResult[];
  weakTopics: string[]; // topics with <50% correct rate
}

export function calculateReadiness(trialHistory: TrialResult[], now: number): number {
  // Weighted average with recency weighting (last 7 days = 2× weight, older = 1×)
  if (trialHistory.length === 0) return 0;
  
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  for (const trial of trialHistory) {
    const daysAgo = (now - trial.timestamp) / 86400000;
    const weight = daysAgo <= 7 ? 2.0 : 1.0;
    totalWeightedScore += trial.score * weight;
    totalWeight += weight;
  }
  
  return Math.min(100, totalWeightedScore / totalWeight);
}

export function identifyWeakTopics(trialHistory: TrialResult[]): string[] {
  // Count correct/incorrect per topic
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
  
  // Return topics with <50% correct rate
  return Array.from(topicStats.entries())
    .filter(([_, stats]) => stats.total >= 3 && stats.correct / stats.total < 0.5)
    .map(([topic, _]) => topic)
    .sort();
}

export function recommendTrialCount(
  daysUntilDue: number,
  readiness: number
): number {
  // More trials needed if readiness is low and deadline is close
  if (daysUntilDue <= 0) return 0;
  const gap = 1 - readiness / 100; // 0 (fully ready) to 1 (not ready)
  return Math.max(0, Math.ceil((daysUntilDue - 1) * gap));
}

export function threatLevel(priorityScore: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (priorityScore < 0.3) return 'Low';
  if (priorityScore < 0.5) return 'Medium';
  if (priorityScore < 0.7) return 'High';
  return 'Critical';
}
```

### Property-Based Tests (Invariants)

Using `fast-check`, verify:

1. **Readiness Bounds**: `0 ≤ readiness ≤ 100` for any trial history
2. **Monotonic Improvement**: Adding a trial with score ≥ current readiness never lowers readiness
3. **Recency Weighting**: Recent trials (≤7 days) have 2× impact vs older trials
4. **Trial Recommendations Non-Negative**: `recommendTrialCount(...) ≥ 0`
5. **Weak Topic Thresholds**: Topics appear in weak list only if <50% correct rate across ≥3 questions
6. **Determinism**: Same inputs → same outputs (no Date.now in readiness calculation, only in trial timestamps)

---

## Duel Combat (`src/core/duel.ts`)

**Design Change (2026-11-27):** No sentinels, no Lantern of Knowledge. The player directly targets deadline-creatures and weakens them by answering questions from the creature's course. This replaces the passive tower-defense model with active, skill-based combat.

### Core Mechanic

Each creature has **seals** (shields that must be broken to defeat it). The player chooses a creature, answers a question from its course, and:
- **Correct answer**: breaks 1 seal (2 if the player has a ≥3-answer streak)
- **Wrong answer**: shows explanation, creature lurches +6% closer to the altar

Creatures advance slowly (~3-6 minutes per wave if unanswered), so defeating a big enemy (exam with 8-10 seals) means you have studied for it.

### Pure Functions

```typescript
export interface DuelState {
  seals: number; // remaining seals (creature defeated when 0)
  maxSeals: number; // initial seals (for UI)
  progress: number; // 0-1 toward altar
}

export interface ApplyAnswerResult {
  state: DuelState;
  damage: number; // seals broken (1 or 2)
  lurch: number; // progress added (0.06 if wrong, 0 if correct)
}

/**
 * Compute initial seals based on creature type and points.
 */
export function sealsFor(
  enemy: Pick<EnemyStats, 'type' | 'isMinion'>,
  points: number
): number;

/**
 * Apply an answer to a duel state.
 * - Correct: damage 1 (2 if streak ≥ 3), no lurch
 * - Wrong: damage 0, lurch +0.06
 */
export function applyAnswer(
  state: DuelState,
  correct: boolean,
  streak: number
): ApplyAnswerResult;

/**
 * Compute creature movement speed (progress per second).
 * Regular creatures: ~180-300s to cross.
 * Exams: ~360s to cross.
 * Overdue items: 25% faster.
 */
export function creepSpeed(
  type: ItemType,
  isMinion: boolean,
  daysLeft: number
): number;

export function isDefeated(state: DuelState): boolean;
export function reachedAltar(state: DuelState): boolean;
```

### Seal Counts

| Type               | Base Seals | Bonus                |
|--------------------|------------|----------------------|
| Minion             | 1          | —                    |
| Quiz               | 2          | —                    |
| Assignment         | 3          | +1 if points ≥ 50    |
| Project/Presentation | 5        | —                    |
| Exam               | 8          | +2 if points ≥ 100   |

### Movement Speed Targets

| Type               | Target Crossing Time (if unanswered) |
|--------------------|--------------------------------------|
| Minion             | ~120s                                |
| Quiz               | ~180s                                |
| Assignment         | ~240s                                |
| Project/Presentation | ~300s                              |
| Exam               | ~360s                                |

Overdue items (daysLeft < 0) are 25% faster.

### Property Tests (Invariants)

Using `fast-check`, verify:

1. **Seals Bounds**: `0 ≤ seals ≤ maxSeals` after any answer
2. **Progress Bounds**: `0 ≤ progress ≤ 1` after any answer
3. **Correct Answers Never Increase Progress**: `applyAnswer(s, true, _).state.progress === s.progress`
4. **Wrong Answers Never Decrease Seals**: `applyAnswer(s, false, _).state.seals === s.seals`
5. **Damage Capped**: `damage ≤ seals` before the answer
6. **Defeat Requires N Correct Answers**: With no streak (streak=0), defeating a creature with N seals requires exactly N correct answers
7. **Speed Always Positive**: `creepSpeed(...) > 0` and finite for all inputs
8. **Determinism**: Same inputs → same outputs (no Date.now, no random)

---

## Scene Flow (`src/game/scenes/`)

```
┌──────────┐
│ BootScene│  Load assets (sprites, audio, fonts via WebFont)
└────┬─────┘
     ↓
┌──────────┐
│TitleScene│  Animated title, Start/Continue/Settings buttons
└────┬─────┘
     ↓
┌──────────┐
│WarRoom   │  Home screen: course cards with grades/threat levels, semester timeline,
│  Scene   │  "Train" and "Start Wave" buttons, Battle Plan for big enemies
└────┬─────┘
     │
     ├─→ (Train) ──→ ┌────────────┐
     │                │ Trial Scene│  5-question practice trial for selected course
     │                └─────┬──────┘
     │                      ↓ (back to War Room)
     │
     └─→ (Start Wave) ──→ ┌──────────┐
                           │Scout Rprt│  Pre-wave: upcoming enemies, readiness check,
                           │  Overlay │  "Train now" or "Start battle"
                           └────┬─────┘
                                ↓ (Start battle)
                           ┌──────────┐
                           │BattleScn │  Main gameplay: wave spawning, tower firing, checkpoint panel
                           └────┬─────┘
                                ↓ (wave ends)
                           ┌──────────┐
                           │ Debrief  │  Post-wave: outcome, performance, real-world mapping,
                           │  Overlay │  recommendations, next deadline reminder
                           └────┬─────┘
                                ↓
                           ┌──────────┐
                           │WarRoom   │  (loop back for next wave or more training)
                           │  Scene   │
                           └──────────┘
                                │
                                ↓ (fortress HP = 0)
                           ┌──────────┐
                           │ GameOver │  Stats, Retry button → War Room
                           └──────────┘
```

**Note**: Tutorial (TutorScene) is inserted before first War Room visit if `tutorialCompleted === false`.

### War Room Scene Responsibilities
- Display course status cards (grade, threat level, next big enemies)
- Render semester timeline (tombstones for all deadlines)
- Handle "Train" button → open Trial Scene for selected course
- Handle "Start Wave" button → show Scout Report overlay
- Display Battle Plan overlay when big enemy selected (topics, readiness, recommended trials)

### BattleScene Responsibilities
- Render towers, enemies, fortress, lanes
- Handle input: mouse click (select tower), keyboard (shortcuts)
- Spawn enemies from wave data (computed by `src/core/wave.ts`)
- Call `src/core/targeting.ts` for tower target selection
- Apply damage, update HP
- Trigger sound effects (Howler) and particle effects
- Display HUD overlay (gold, HP, charge meter) via `src/ui/hud.ts`

---

## War Room UI Design (`src/ui/warroom/`)

The War Room is a DOM-based screen (not Phaser canvas) for accessibility and rich text layout. Uses GSAP for animations.

### Layout Structure

```
┌────────────────────────────────────────────────────────┐
│  DEADLINE DEFENSE                        [Settings] [?]│
├────────────────────────────────────────────────────────┤
│  Semester Timeline (horizontal scroll)                 │
│  [==================|=====|==|=====|==============]    │
│   Nov 28  Dec 5  Dec 12  Dec 19  Dec 26  Jan 2        │
│    (tombstones positioned by date, course-colored)     │
├────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │ CV101   │  │ PHO101  │  │ MGT101  │  (3 cards/row)│
│  │ Grade: B│  │ Grade: A│  │ Grade:--│               │
│  │ 🔥 HIGH │  │ ⚡ MEDIUM│  │ 💀 CRIT.│               │
│  │ Midterm │  │ Quiz    │  │ Project │               │
│  │ Dec 3   │  │ Nov 30  │  │ Dec 10  │               │
│  │ 100 pts │  │ 20 pts  │  │ 80 pts  │               │
│  │ in 5d   │  │ in 2d   │  │ in 12d  │               │
│  │ [Train] │  │ [Train] │  │ [Train] │               │
│  └─────────┘  └─────────┘  └─────────┘               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │ DSA101  │  │ MKT101  │  │ MATH101 │               │
│  │ ...     │  │ ...     │  │ ...     │               │
│  └─────────┘  └─────────┘  └─────────┘               │
├────────────────────────────────────────────────────────┤
│                   [START WAVE]           [TRAIN ALL]  │
└────────────────────────────────────────────────────────┘
```

### Course Card Component (`src/ui/warroom/CourseCard.ts`)

DOM element with:
- **Header**: Course ID badge (colored with course color from palette)
- **Grade**: Current grade (computed from past items) or "N/A"
- **Threat indicator**: Icon + text ("Low" / "Medium" / "High" / "Critical") with color coding
- **Next big enemies**: List of 1-3 upcoming high-priority items (name, date, points, days remaining)
- **Train button**: Launches Trial Scene for this course
- **Click to expand**: Shows Battle Plan overlay (topics, readiness %, recommended trials)

Style:
- Dark parchment background (grimoire page aesthetic, see art-direction.md)
- Ink borders, ornamental corner flourishes (inline SVG)
- Hover: subtle glow (candle gold accent)
- Focus: ring in candle gold for keyboard nav

### Semester Timeline Component (`src/ui/warroom/Timeline.ts`)

Horizontal strip with:
- **Tombstone markers**: One per future deadline, positioned proportionally by days from now
- **Course color tint**: Each tombstone uses its course color
- **Current date marker**: Vertical line or glow at "today"
- **Hover tooltip**: Shows item name, date, points on tombstone hover
- **Scrollable**: Horizontal scroll if timeline spans >90 days

Rendering:
- Canvas or SVG for tombstone shapes (small cross icons)
- CSS transitions for smooth scroll
- GSAP entrance animation (tombstones rise from bottom, stagger)

### Battle Plan Overlay (`src/ui/warroom/BattlePlan.ts`)

Modal overlay (appears when big enemy clicked in course card):
- **Enemy details**: Name, type, due date, weight, days remaining
- **Topics to review**: Bulleted list (extracted from checkpoint questions for that course)
- **Readiness %**: Large number with color coding (red/yellow/green)
- **Weak topics**: List of topics with <50% correct rate (if any)
- **Recommended trials**: "2 practice sessions before Dec 3" (computed from `recommendTrialCount`)
- **Train now button**: Primary CTA, launches Trial Scene for this course
- **Close button**: Esc key or X button

Style:
- Dark semi-transparent backdrop (vignette effect)
- Centered panel (grimoire page style)
- GSAP entrance: ink-bleed wipe from center

### Scout Report Overlay (`src/ui/warroom/ScoutReport.ts`)

Modal overlay (appears when "Start Wave" clicked):
- **Wave preview**: "This week: Midterm (CV101), Quiz (PHO101), Assignment (DSA101)"
- **Readiness check**: List courses in wave with current readiness % (highlight lowest in red if <60%)
- **Recommendation**: "Your CV readiness is 40%. Train before the battle?" (shows if any <60%)
- **Options**: "Train now" (opens Trial Scene for weakest course) or "Start battle" (proceeds to BattleScene)

Style:
- Smaller overlay than Battle Plan (top 1/3 of screen)
- Quick dismissal (Esc or Enter)
- GSAP entrance: slide from top

### Debrief Overlay (`src/ui/warroom/Debrief.ts`)

Modal overlay (appears after wave ends):
- **Outcome**: "VICTORY" or "DEFEAT" (large text)
- **Performance**: Enemies defeated (X/Y), fortress damage (Z pts), gold earned (+G)
- **Real-world mapping**: 2-3 sentences linking game events to real deadlines, e.g.:
  - "The Midterm boss broke through: your CV readiness is low."
  - "2 trials recommended before Thursday."
  - "Quiz enemies overwhelmed the DSA tower: practice data structures."
- **Next deadline**: "Next big enemy: MKT Project in 8 days"
- **Return to War Room button**: Primary CTA

Style:
- Full-screen overlay (dark backdrop)
- Centered panel (victory = green accent, defeat = red accent)
- GSAP entrance: fade + scale from 0.8

### Trial Scene (`src/game/scenes/TrialScene.ts`)

Phaser scene or DOM screen for 5-question practice:
- **Question counter**: "Question 2/5" (top-left)
- **Question text**: Large, readable (Spectral font)
- **4 answer buttons**: Labeled A-D or 1-4, keyboard shortcuts (1-4 keys)
- **Immediate feedback**: After answer, show "Correct!" (green) or "Incorrect. Answer: B" (red) with 1s delay
- **Score display**: After 5 questions, show "Score: 4/5 (80%)" with performance message
- **Rewards**: If score ≥70%, show "Tower upgrade earned!" and "+33% special charge" (if ≥90%)
- **Return to War Room**: After score screen

Style:
- Grimoire page aesthetic (dark parchment, ink text)
- GSAP transitions between questions (page flip effect)
- No time limit (untimed practice)

---

## Data Generation

### Demo Semester Conversion (`src/data/demo.json`)

Convert `reference/coursepilot/course_plan.json` with:
- `days` offset → `daysOffset: number` (store relative days, NOT absolute dates)
- `name` → infer `type` via regex:
  - `/quiz/i` → "quiz"
  - `/exam/i` → "exam"
  - `/project|presentation/i` → "project"/"presentation"
  - else → "assignment"
- Assign colors: 6 distinct hues from palette

**Runtime Resolution** (`src/core/semester.ts`):
- Pure function `resolveSemester(demo, now): Semester` computes absolute due dates:
  - `dueDate = new Date(now.getTime() + daysOffset * 86400000)`
- Called once at game boot with `Date.now()`
- This ensures demo dates never go stale (always relative to "today")

### Checkpoint Questions (`src/data/checkpoints.json`)

8 questions × 6 courses = 48 questions. Topics:

1. **CV101 (Computer Vision)**:
   - Convolution kernel size/stride
   - Feature descriptor types (SIFT, ORB)
   - Object detection architectures (YOLO, R-CNN)
   - Image preprocessing techniques
   - Edge detection methods
   - Color space conversions
   - Camera calibration
   - 3D reconstruction basics

2. **PHO101 (Photonics)**:
   - Wave interference patterns
   - Diffraction grating equations
   - Fiber optic modes
   - Waveguide properties
   - Optical coupling efficiency
   - Laser principles
   - Photon energy calculation
   - Refractive index

3. **MGT101 (Management)**:
   - Leadership styles
   - Team development stages (Tuckman)
   - Decision-making models
   - Organizational culture types
   - Project charter components
   - Conflict resolution strategies
   - Change management
   - Stakeholder analysis

4. **DSA101 (Data Structures & Algorithms)**:
   - Big-O notation
   - Sorting algorithm complexity
   - Binary search trees
   - Hash table collision handling
   - Graph traversal (DFS/BFS)
   - Dynamic programming
   - Recursion vs iteration
   - Queue/stack operations

5. **MKT101 (Digital Marketing)**:
   - Marketing funnel stages
   - SEO vs SEM
   - Consumer persona elements
   - A/B testing
   - Social media metrics (CTR, engagement)
   - Campaign ROI calculation
   - Content marketing types
   - Email segmentation

6. **MATH101 (Linear Algebra)**:
   - Matrix multiplication properties
   - Eigenvalue/eigenvector definition
   - Determinant calculation
   - Vector space basis
   - Linear independence
   - Orthogonality
   - Matrix rank
   - Inverse matrix conditions

---

## Art Direction

### Color Palette (`src/styles/tokens.css`)

```css
:root {
  /* Haunting primary colors */
  --color-bg-dark: #0a0a0f; /* deep void */
  --color-bg-layer: #1a1a2e; /* shadowed stone */
  --color-accent-blood: #c1121f; /* blood red */
  --color-accent-bone: #f0ead6; /* bone white */
  --color-accent-soul: #9d4edd; /* ethereal purple */
  --color-accent-ember: #ff6d00; /* ember orange */
  
  /* Course colors (distinguish 6 courses) */
  --color-course-cv: #3a86ff; /* icy blue */
  --color-course-pho: #8338ec; /* mystic violet */
  --color-course-mgt: #fb5607; /* forge orange */
  --color-course-dsa: #ffbe0b; /* lightning yellow */
  --color-course-mkt: #ff006e; /* chaotic magenta */
  --color-course-math: #06ffa5; /* spectral green */
  
  /* UI contrast (WCAG AA) */
  --color-text-primary: #f8f9fa; /* 15.3:1 on bg-dark */
  --color-text-secondary: #adb5bd; /* 8.6:1 */
  --color-border: #343a40;
  
  /* Interaction states */
  --color-hover: #495057;
  --color-focus: #9d4edd; /* matches accent-soul */
  --color-disabled: #495057;
}
```

### Fonts (Google Fonts, OFL License)

- **Headers/Logo**: [Cinzel](https://fonts.google.com/specimen/Cinzel) (serif, ancient/fantasy feel)
- **Body/UI**: [Inter](https://fonts.google.com/specimen/Inter) (sans-serif, readable)
- **Accent/Spooky**: [Creepster](https://fonts.google.com/specimen/Creepster) (optional for special effects)

Load via `<link>` in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;600&family=Creepster&display=swap" rel="stylesheet">
```

Wait for fonts in BootScene before transitioning:
```typescript
async create() {
  await document.fonts.ready;
  this.scene.start('TitleScene');
}
```

### Procedural/Vector Art

To avoid licensing issues, all sprites/backgrounds are:
- **Generated in code** (canvas draw commands, procedural shapes)
- **Vector paths** (SVG embedded as data URIs)
- **Particle effects** (WebGL shaders or Phaser particle emitters)

Examples:
- **Towers**: Phaser Graphics API, draw fortress turrets with course color
- **Enemies**: Simple geometric shapes with glow effects (circles for swarmers, rectangles for shamblers, multi-phase bosses are composite shapes)
- **Background**: Gradient + fog particles (Phaser Particles.ParticleEmitter)
- **Tombstones**: SVG data URI of a cross shape, tinted per course

No raster images except for generated textures.

### Audio (CC0 or Synthesised)

- **Background music**: 8-bit dark theme looped, synthesised with [jsfxr](https://sfxr.me/) or [ZzFX](https://github.com/KilledByAPixel/ZzFX) (CC0)
- **SFX**: Tower fire, enemy hit, special attack, wave complete — all synthesised via WebAudio or ZzFX
- **Attribution**: Any CC0 assets listed in `CREDITS.md`

---

## Import Modules

### `src/import/ics.ts` — Moodle Calendar Parser

```typescript
import ICAL from 'ical.js';

export interface ICSEvent {
  summary: string; // "CV101: Midterm Examination"
  start: Date;
  description?: string;
  categories?: string[];
}

export function parseICS(icsText: string): ICSEvent[] {
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');
  
  return vevents.map(ve => {
    const event = new ICAL.Event(ve);
    return {
      summary: event.summary,
      start: event.startDate.toJSDate(),
      description: event.description,
      categories: ve.getFirstPropertyValue('categories')?.split(',') ?? []
    };
  });
}

export function inferItemType(summary: string): ItemType {
  const lower = summary.toLowerCase();
  if (/quiz/i.test(lower)) return 'quiz';
  if (/exam/i.test(lower)) return 'exam';
  if (/project/i.test(lower)) return 'project';
  if (/presentation/i.test(lower)) return 'presentation';
  return 'assignment';
}

export function extractCourseId(summary: string, categories: string[]): CourseId {
  // Try category first (Moodle often exports course shortname)
  if (categories.length > 0) return categories[0];
  
  // Try prefix pattern "CV101: ..."
  const match = summary.match(/^([A-Z]{2,4}\d{3}):/);
  return match ? match[1] : 'UNKNOWN';
}
```

### `src/import/pdf.ts` — PDF Question Generator (Optional)

```typescript
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'; // bundled in public/

export async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(' ');
  }
  return text;
}

export function generateClozeQuestions(text: string, count: number): CheckpointQuestion[] {
  // Simple heuristic: find sentences with capitalized nouns
  const sentences = text.match(/[A-Z][^.!?]*[.!?]/g) ?? [];
  const keyTerms = new Set(
    text.match(/\b[A-Z][a-z]+\b/g)?.slice(0, 100) ?? []
  );
  
  const questions: CheckpointQuestion[] = [];
  for (let i = 0; i < Math.min(count, sentences.length); i++) {
    const sentence = sentences[i];
    const terms = Array.from(keyTerms).filter(t => sentence.includes(t));
    if (terms.length === 0) continue;
    
    const correctTerm = terms[Math.floor(Math.random() * terms.length)];
    const questionText = sentence.replace(correctTerm, '______');
    const distractors = Array.from(keyTerms)
      .filter(t => t !== correctTerm)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const choices = [correctTerm, ...distractors].sort(() => Math.random() - 0.5);
    
    questions.push({
      id: `pdf-${i}`,
      courseId: 'PDF', // generic; user can assign
      question: questionText,
      choices,
      correctIndex: choices.indexOf(correctTerm)
    });
  }
  
  return questions;
}
```

---

## Testing Strategy

### Unit Tests (`src/core/*.test.ts`)

Using Vitest:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateUrgency, priorityScore } from './scoring';

describe('scoring', () => {
  it('urgency saturates at 21 days', () => {
    expect(calculateUrgency(21)).toBeCloseTo(0.1);
    expect(calculateUrgency(0)).toBe(1.0);
  });

  it('priority increases as deadline approaches', () => {
    const scoreA = priorityScore(14, 80, 50);
    const scoreB = priorityScore(7, 80, 50);
    expect(scoreB).toBeGreaterThan(scoreA);
  });
});
```

**Coverage target**: 90% for `src/core/`.

### Property-Based Tests (`src/core/*.prop.test.ts`)

Using fast-check:

```typescript
import { fc, test } from '@fast-check/vitest';
import { calculateUrgency, enemyHpMultiplier } from './scoring';

test.prop([fc.integer({ min: 0, max: 100 })])(
  'urgency is always between 0.1 and 1.0',
  (days) => {
    const u = calculateUrgency(days);
    expect(u).toBeGreaterThanOrEqual(0.1);
    expect(u).toBeLessThanOrEqual(1.0);
  }
);

test.prop([fc.float({ min: 0.1, max: 1.0 }), fc.integer({ min: 0, max: 200 })])(
  'HP multiplier is always >= 1.0',
  (urgency, points) => {
    expect(enemyHpMultiplier(urgency, points)).toBeGreaterThanOrEqual(1.0);
  }
);
```

**Properties to verify**:
- Urgency bounds
- Priority monotonicity (deadline proximity)
- HP/speed multipliers positive
- Damage non-negative
- Determinism (no random in core rules)

### Integration Tests (Vitest, mock Phaser objects)

Test scene transitions, game state updates:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { BattleScene } from './BattleScene';

describe('BattleScene', () => {
  it('spawns enemies at wave start', () => {
    const scene = new BattleScene();
    scene.create();
    expect(scene.enemies.length).toBeGreaterThan(0);
  });
});
```

### Playwright Smoke Tests (`tests/e2e/smoke.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test('game boots without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.goto('/');
  await page.waitForSelector('canvas'); // Phaser canvas
  expect(errors).toHaveLength(0);
});

test('first wave starts', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Start');
  await page.waitForTimeout(2000); // allow wave spawn
  const enemyCount = await page.locator('.enemy').count(); // hypothetical DOM marker
  expect(enemyCount).toBeGreaterThan(0);
});

test('checkpoint panel opens', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Start');
  await page.keyboard.press('c');
  await expect(page.locator('.checkpoint-panel')).toBeVisible();
});
```

**Coverage**: Boot, Start, Tutorial, First Wave, Checkpoint Open, Mute Toggle.

### Kiro Hooks (`.kiro/hooks/`)

**`post-save.sh`**: Run Vitest on `src/core/` file changes:

```bash
#!/usr/bin/env bash
# Trigger: any .ts file in src/core/ saved

if [[ "$KIRO_FILE_PATH" == src/core/*.ts ]]; then
  echo "Running tests for core rules..."
  npm run test:core
fi
```

**`pre-commit.sh`**: Run build + tests:

```bash
#!/usr/bin/env bash
npm run build
npm run test
npx playwright test
```

---

## Scene Implementation Details

### TitleScene (`src/game/scenes/TitleScene.ts`)

- Background: dark gradient + fog particles
- Logo: Cinzel font, blood-red glow (Phaser Text + shadow pipeline)
- Buttons: GSAP stagger animation on entrance
- Audio: dark ambient loop (Howler, volume 0.3)

### BattleScene (`src/game/scenes/BattleScene.ts`)

**Layout**:
- 6 horizontal lanes (one per course)
- Towers on left side, enemies spawn right, move left
- Fortress graphic at far left (health bar above)

**Wave System** (`src/core/wave.ts`):
```typescript
export function generateWave(
  semester: Semester,
  waveNumber: number,
  currentDate: Date
): EnemyStats[] {
  // Filter to items due within next 7 days
  const upcoming = semester.courses.flatMap(c => 
    c.items.filter(item => {
      const daysUntil = (item.dueDate.getTime() - currentDate.getTime()) / 86400000;
      return daysUntil >= 0 && daysUntil <= 7;
    })
  );
  
  // Sort by priority score
  upcoming.sort((a, b) => {
    const daysA = (a.dueDate.getTime() - currentDate.getTime()) / 86400000;
    const daysB = (b.dueDate.getTime() - currentDate.getTime()) / 86400000;
    return priorityScore(daysB, b.grade, b.points) - priorityScore(daysA, a.grade, a.points);
  });
  
  // Spawn top N items (N = 5 + waveNumber)
  return upcoming.slice(0, 5 + waveNumber).map(item => createEnemy(item, currentDate));
}

function createEnemy(item: CourseworkItem, currentDate: Date): EnemyStats {
  const daysUntil = (item.dueDate.getTime() - currentDate.getTime()) / 86400000;
  const urgency = calculateUrgency(daysUntil);
  
  const baseHp = { assignment: 50, quiz: 30, exam: 200, project: 150, presentation: 150 }[item.type];
  const baseSpeed = { assignment: 30, quiz: 60, exam: 20, project: 25, presentation: 25 }[item.type];
  
  return {
    id: item.id,
    courseId: item.courseId,
    itemId: item.id,
    type: item.type,
    hp: baseHp * enemyHpMultiplier(urgency, item.points),
    maxHp: baseHp * enemyHpMultiplier(urgency, item.points),
    speed: baseSpeed * enemySpeedMultiplier(urgency),
    damage: fortressDamage(item.points),
    x: 1200, // right edge
    y: laneY(item.courseId), // per-course lane
    pathProgress: 0,
    spawnedAt: Date.now(),
    lastDamagedAt: null,
    neglected: false
  };
}
```

**Targeting** (`src/core/targeting.ts`):
```typescript
export function selectTarget(
  tower: TowerStats,
  enemies: EnemyStats[]
): EnemyStats | null {
  const inRange = enemies.filter(e => 
    distance(tower, e) <= tower.range && e.hp > 0
  );
  
  if (inRange.length === 0) return null;
  
  // Priority: same course > closest to fortress > highest HP
  const sameCourse = inRange.filter(e => e.courseId === tower.courseId);
  const candidates = sameCourse.length > 0 ? sameCourse : inRange;
  
  candidates.sort((a, b) => {
    if (a.pathProgress !== b.pathProgress) return b.pathProgress - a.pathProgress;
    return b.hp - a.hp;
  });
  
  return candidates[0];
}

function distance(a: { x: number, y: number }, b: { x: number, y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
```

**Neglect Check** (runs every frame):
```typescript
export function applyNeglectBuff(enemy: EnemyStats, now: number): EnemyStats {
  if (enemy.neglected) return enemy;
  if (enemy.lastDamagedAt !== null) return enemy;
  if (now - enemy.spawnedAt < 60000) return enemy; // 60s threshold
  
  return {
    ...enemy,
    hp: enemy.hp * 1.5,
    maxHp: enemy.maxHp * 1.5,
    speed: enemy.speed * 1.25,
    neglected: true
  };
}
```

---

## Quick-Time Events (QTE)

### QTE Core Rules (`src/core/qte.ts`)

```typescript
export interface QTESettings {
  extraTime: boolean; // accessibility setting
}

export interface QTEState {
  enemyId: string;
  question: CheckpointQuestion;
  timeRemaining: number; // milliseconds
  maxTime: number; // 8000 or 16000 based on settings
  startedAt: number; // timestamp
}

export interface QTEOutcome {
  success: boolean;
  damage?: number; // critical hit damage if success
  enrageDuration?: number; // 10000ms if failure
}

export function startQTE(
  enemy: EnemyStats,
  question: CheckpointQuestion,
  settings: QTESettings
): QTEState {
  const maxTime = settings.extraTime ? 16000 : 8000;
  return {
    enemyId: enemy.id,
    question,
    timeRemaining: maxTime,
    maxTime,
    startedAt: Date.now()
  };
}

export function updateQTE(state: QTEState, deltaTime: number): QTEState {
  return {
    ...state,
    timeRemaining: Math.max(0, state.timeRemaining - deltaTime)
  };
}

export function resolveQTE(
  state: QTEState,
  answerIndex: number | null, // null = timeout
  baseDamage: number
): QTEOutcome {
  const isCorrect = answerIndex === state.question.correctIndex;
  
  if (isCorrect) {
    return {
      success: true,
      damage: baseDamage * 3 // critical hit
    };
  } else {
    return {
      success: false,
      enrageDuration: 10000 // 10 seconds
    };
  }
}
```

### Property-Based Tests (Invariants)

Using `fast-check`, verify:

1. **Timer Bounds**: `0 ≤ timeRemaining ≤ maxTime` for any sequence of `updateQTE` calls
2. **Determinism**: Same `(state, answerIndex)` → same `QTEOutcome`
3. **Non-Negative Time**: `timeRemaining` never negative after any number of updates
4. **Extra Time Doubles Duration**: `startQTE(..., {extraTime: true}).maxTime === 16000`

### BattleScene Integration

```typescript
// In BattleScene.update()
for (const enemy of this.enemies) {
  if (enemy.type === 'exam' && enemy.hp / enemy.maxHp <= 0.5 && !enemy.qteTriggered) {
    this.triggerQTE(enemy);
    enemy.qteTriggered = true;
  }
}

private triggerQTE(enemy: EnemyStats): void {
  const question = this.selectRandomQuestion(enemy.courseId);
  const settings = { extraTime: this.loadSettings().extraTime };
  
  this.qteState = startQTE(enemy, question, settings);
  this.physics.world.timeScale = 0.2; // slow to 20%
  this.showQTEPanel(this.qteState);
}

private onQTEAnswer(answerIndex: number): void {
  const outcome = resolveQTE(this.qteState, answerIndex, this.baseTowerDamage);
  
  if (outcome.success) {
    this.applyCriticalHit(this.qteState.enemyId, outcome.damage);
    this.playCriticalHitEffect();
  } else {
    this.applyEnrage(this.qteState.enemyId, outcome.enrageDuration);
  }
  
  this.physics.world.timeScale = 1.0; // resume normal speed
  this.hideQTEPanel();
}
```

---

## Persistence (`src/save/save.ts`)

```typescript
const SAVE_KEY = 'deadline-defense-save';
const CURRENT_VERSION = '1.0.0';

export interface SaveData {
  version: string;
  wave: number;
  gold: number;
  towerUpgrades: Record<CourseId, TowerStats['upgrades']>;
  answeredQuestions: string[];
  settings: {
    muted: boolean;
    tutorialCompleted: boolean;
  };
  timestamp: number;
}

export function save(state: GameState, settings: { muted: boolean, tutorialCompleted: boolean }): void {
  try {
    const data: SaveData = {
      version: CURRENT_VERSION,
      wave: state.wave,
      gold: state.gold,
      towerUpgrades: Object.fromEntries(
        state.towers.map(t => [t.courseId, t.upgrades])
      ),
      answeredQuestions: Array.from(state.answeredQuestions),
      settings,
      timestamp: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Save failed:', err);
  }
}

export function load(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    
    const data = JSON.parse(raw) as SaveData;
    
    // Version check
    if (data.version !== CURRENT_VERSION) {
      console.warn('Save version mismatch:', data.version, 'vs', CURRENT_VERSION);
      return null; // discard old saves
    }
    
    return data;
  } catch (err) {
    console.error('Load failed:', err);
    return null;
  }
}
```

---

## Accessibility Implementation

### Keyboard Navigation (`src/ui/keyboard.ts`)

```typescript
export function setupKeyboard(scene: Phaser.Scene): void {
  scene.input.keyboard?.on('keydown-C', () => {
    // Open checkpoint panel
    scene.events.emit('open-checkpoint');
  });
  
  scene.input.keyboard?.on('keydown-ESC', () => {
    // Close panels / pause
    scene.events.emit('close-panel');
  });
  
  scene.input.keyboard?.on('keydown-SPACE', () => {
    // Fire special attack
    scene.events.emit('special-attack');
  });
  
  scene.input.keyboard?.on('keydown-M', () => {
    // Toggle mute
    scene.events.emit('toggle-mute');
  });
  
  // Answer keys 1-4
  ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => {
    scene.input.keyboard?.on(`keydown-${key}`, () => {
      scene.events.emit('answer-checkpoint', i);
    });
  });
}
```

### Reduced Motion (`src/ui/motion.ts`)

```typescript
export function respectReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function gsapConfig(): gsap.TweenVars {
  if (respectReducedMotion()) {
    return { duration: 0 }; // instant
  }
  return {}; // default
}
```

Apply in GSAP calls:
```typescript
gsap.to(element, { ...gsapConfig(), opacity: 1 });
```

### Focus Indicators (`src/styles/global.css`)

```css
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

### Visual Captions (`src/ui/captions.ts`)

```typescript
export function showCaption(text: string, duration = 2000): void {
  const el = document.createElement('div');
  el.className = 'caption';
  el.textContent = text;
  document.body.appendChild(el);
  
  gsap.to(el, { opacity: 0, duration: 0.5, delay: duration / 1000, onComplete: () => el.remove() });
}
```

Call on events:
```typescript
tower.fire();
showCaption('Tower fires');
```

---

## Build Configuration

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/deadline-defense/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['gsap', 'howler', 'pdfjs-dist']
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
```

---

## Performance Optimizations

1. **Object Pooling**: Reuse enemy/projectile sprites (Phaser GameObjectPool)
2. **Spatial Hashing**: For collision/range checks (avoid O(n²))
3. **Throttle Checks**: Neglect check runs every 2s, not every frame
4. **Lazy Load PDFs**: Only load pdf.js worker when user uploads a file
5. **Asset Compression**: Minify JSON, inline small SVGs

---

## Summary

This design establishes:
- **Pure core rules** (`src/core/`) with no Phaser imports, enabling fast unit and property-based tests
- **Scoring formulas** adapted from priority.py into new TypeScript
- **Scene flow** from title → tutorial → battle → game over
- **Procedural art** (no licensing issues) with a haunting dark-fantasy palette
- **Client-side import** for Moodle .ics files and optional PDF question generation
- **Accessibility**: keyboard control, reduced motion, contrast, captions
- **Testability**: Vitest unit tests, fast-check properties, Playwright smoke tests, Kiro hooks

All components are designed for static hosting (no backend), fast build times, and modular implementation by Kiro agents.
