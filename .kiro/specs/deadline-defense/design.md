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

## Scene Flow (`src/game/scenes/`)

```
┌──────────┐
│ BootScene│  Load assets (sprites, audio, fonts via WebFont)
└────┬─────┘
     ↓
┌──────────┐
│TitleScene│  Animated title, Start/Continue/Settings buttons
└────┬─────┘
     ↓ (if tutorial not completed)
┌──────────┐
│TutorScene│  One-wave tutorial, overlay tooltips
└────┬─────┘
     ↓
┌──────────┐
│BattleScn │  Main gameplay: wave spawning, tower firing, checkpoint panel
└────┬─────┘
     ↓ (fortress HP = 0)
┌──────────┐
│ GameOver │  Stats, Retry button
└──────────┘
```

### BattleScene Responsibilities
- Render towers, enemies, fortress, lanes
- Handle input: mouse click (select tower), keyboard (shortcuts)
- Spawn enemies from wave data (computed by `src/core/wave.ts`)
- Call `src/core/targeting.ts` for tower target selection
- Apply damage, update HP
- Trigger sound effects (Howler) and particle effects
- Display HUD overlay (gold, HP, charge meter) via `src/ui/hud.ts`

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
