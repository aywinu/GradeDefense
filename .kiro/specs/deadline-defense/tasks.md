# Tasks — Deadline Defense

Implementation ordered for vertical slice: core rules + tests → demo data → battlefield → checkpoints → tutorial → polish → import → save → a11y → build/test.

---

## Phase 1: Core Rules & Testing Infrastructure

### 1.1: Project Setup
- [x] 1.1.1: Verify Vite 8, TypeScript strict, Phaser 4, GSAP, Howler, pdf.js, Vitest, fast-check, Playwright in `package.json` (Ref: tech.md)
- [x] 1.1.2: Configure `vite.config.ts` with base path for sub-path deployment (Ref: R11.2)
- [x] 1.1.3: Configure `vitest.config.ts` for `src/core/` coverage target 90% (Ref: design.md Testing Strategy)
- [x] 1.1.4: Configure `playwright.config.ts` for Chromium only (Ref: NFR1)
- [x] 1.1.5: Create `tsconfig.json` with strict mode, paths aliases (`@core`, `@game`, `@ui`, `@data`) (Ref: tech.md)

### 1.2: Core Type Definitions
- [x] 1.2.1: Create `src/core/types.ts` with `CourseworkItem`, `Course`, `Semester`, `EnemyStats`, `TowerStats`, `GameState`, `CheckpointQuestion` (Ref: design.md Data Models)
- [x] 1.2.2: Add JSDoc comments to all exported types (Ref: NFR3)

### 1.3: Scoring Logic (Pure Functions)
- [x] 1.3.1: Create `src/core/scoring.ts` with `calculateUrgency`, `calculateRisk`, `calculateWeight`, `priorityScore` (Ref: design.md Scoring Formulas, R3.2)
- [x] 1.3.2: Implement `enemyHpMultiplier`, `enemySpeedMultiplier`, `fortressDamage` (Ref: R3.2, R3.3)
- [x] 1.3.3: Write unit tests in `src/core/scoring.test.ts`: urgency bounds, priority monotonicity, HP/speed scaling (Ref: design.md Unit Tests)
  - [x] Test urgency at 0, 7, 14, 21+ days
  - [x] Test priority increases as deadline approaches (fixed grade/points)
  - [x] Test HP multiplier ≥ 1.0
  - [x] Test speed multiplier ≥ 1.0
- [x] 1.3.4: Write property-based tests in `src/core/scoring.prop.test.ts` using fast-check (Ref: design.md Property-Based Tests)
  - [x] Urgency bounds: `0.1 ≤ urgency ≤ 1.0` for days ≥ 0
  - [x] HP/speed multipliers always positive
  - [x] Determinism: same inputs → same output
- [ ] 1.3.5: Run `npm run test:core` and verify 90% coverage (Ref: NFR3)

### 1.4: Wave Generation
- [x] 1.4.1: Create `src/core/wave.ts` with `generateWave(semester, waveNumber, currentDate): EnemyStats[]` (Ref: design.md BattleScene Wave System)
- [x] 1.4.2: Implement logic: filter items due within 7 days, sort by priority score, spawn top N (Ref: R3.2)
- [x] 1.4.3: Implement `createEnemy(item, currentDate): EnemyStats` with base stats per type (Ref: R3.1)
- [x] 1.4.4: Write unit tests in `src/core/wave.test.ts`: verify enemy count, HP scaling, type mapping (Ref: R3.1, R3.2)

### 1.5: Targeting Logic
- [x] 1.5.1: Create `src/core/targeting.ts` with `selectTarget(tower, enemies): EnemyStats | null` (Ref: design.md Targeting, R4.3)
- [x] 1.5.2: Implement priority: same course > closest to fortress > highest HP (Ref: R4.3)
- [x] 1.5.3: Write unit tests in `src/core/targeting.test.ts`: verify target selection with various scenarios (Ref: R4.3)

### 1.6: Neglect Logic
- [x] 1.6.1: Create `src/core/neglect.ts` with `applyNeglectBuff(enemy, now): EnemyStats` (Ref: design.md Neglect Check, R3.4)
- [x] 1.6.2: Implement 60s threshold, +50% HP, +25% speed, once-per-enemy flag (Ref: R3.4)
- [x] 1.6.3: Write unit tests in `src/core/neglect.test.ts`: verify buff timing and application (Ref: R3.4)

### 1.7: Semester Campaign Waves
- [x] 1.7.1: Create `src/core/rng.ts` with `mulberry32(seed): RngFunction` for deterministic RNG (Ref: design.md, tech.md)
- [x] 1.7.2: Update `src/core/wave.ts` to implement campaign system: `campaignLength(semester, now)` (1-10 weeks), wave k covers [(k-1)*7, k*7) days (Ref: product.md, design.md)
- [x] 1.7.3: Implement spawn groups: assignments → 1 shambler + 2 minions, quizzes → 4-6 swarmers, exams → 1 boss + 6 minions, projects → multi-phase + 3 minions (Ref: art-direction.md)
- [x] 1.7.4: Add overdue handling: items with days < 0 join wave 1 with +25% speed "overdue" buff (Ref: design.md)
- [x] 1.7.5: Add wave 1 tutorial cap: max one shambler group + a few minions, push overflow to wave 2 (Ref: design.md) [NOTE: Tutorial cap removed from core logic, can be handled by game scene]
- [x] 1.7.6: Update EnemyStats in `src/core/types.ts`: add `lane` (course index), remove x/y if needed, add `spawnDelayMs`, `label`, `daysLeft` (Ref: design.md)
- [x] 1.7.7: Update wave tests: verify spawn groups, wave sizes ≤ 40, campaignLength in [1,10], every ungraded item appears exactly once across campaign (Ref: design.md)
- [x] 1.7.8: Update property tests: verify determinism with seeded RNG, all creatures reference real items (Ref: design.md)
- [x] 1.7.9: Run `npx vitest run` and `npm run build` to verify (Ref: tech.md)

### 1.8: Wave Generation Improvements
- [x] 1.8.1: Skip empty weeks in campaign: return list of non-empty weeks with original week numbers
- [x] 1.8.2: Add `week` field to wave metadata so UI can show "Week 6"
- [x] 1.8.3: Spread spawns over 25-40s for full waves: order groups by due date, minions trail leaders by 0.4-1.2s
- [x] 1.8.4: Add `tutorialWave(semester, now, rng)`: exactly 1 shambler (lowest-points assignment) + 2 draft minions, low HP, slow
- [x] 1.8.5: Cap exam boss HP to max ~4x full-urgency assignment HP
- [x] 1.8.6: Update tests: verify no empty waves, delays non-decreasing within groups, tutorialWave has 3 creatures
- [x] 1.8.7: Run `npx vitest run` and `npm run build` to verify (Ref: tech.md)

---

## Phase 2: Demo Data

### 2.1: Demo Semester Conversion
- [x] 2.1.1: Create `scripts/convert-demo.ts` to read `reference/coursepilot/course_plan.json` (Ref: R2.1) [SKIPPED: wrote demo.json directly]
- [x] 2.1.2: Convert `days` offset to `daysOffset` (keep as relative integers, NOT absolute dates) (Ref: R2.1, R2.2)
- [x] 2.1.3: Infer `type` from `name` via regex (quiz/exam/project/presentation/assignment) (Ref: R2.2, R3.1)
- [x] 2.1.4: Assign 6 course colors from palette (Ref: design.md Art Direction)
- [x] 2.1.5: Output to `src/data/demo.json` with schema: items have `daysOffset: number`, NOT `dueDate` (Ref: R2.2)
- [x] 2.1.6: Create `src/core/semester.ts` with `resolveSemester(demo, now): Semester` to compute absolute due dates at runtime (Ref: R2.2)
- [x] 2.1.7: Write unit tests in `src/core/semester.test.ts`: verify date resolution for past/future offsets (Ref: R2.2)
- [x] 2.1.8: Run script and verify 6 courses, 30+ items, valid JSON (Ref: R2.1) [verified via tests]

### 2.2: Checkpoint Questions
- [ ] 2.2.1: Create `src/data/checkpoints.json` with 8 questions per course (48 total) (Ref: R5.1, design.md Data Generation)
- [ ] 2.2.2: Write questions for CV101 (Computer Vision): convolution, feature matching, object detection, etc. (Ref: design.md Checkpoint Questions)
- [ ] 2.2.3: Write questions for PHO101 (Photonics): interference, diffraction, fiber optics, etc.
- [ ] 2.2.4: Write questions for MGT101 (Management): leadership, teams, decision-making, etc.
- [ ] 2.2.5: Write questions for DSA101 (Data Structures & Algorithms): Big-O, sorting, trees, graphs, etc.
- [ ] 2.2.6: Write questions for MKT101 (Digital Marketing): funnel, SEO, personas, ROI, etc.
- [ ] 2.2.7: Write questions for MATH101 (Linear Algebra): matrices, eigenvalues, determinants, etc.
- [ ] 2.2.8: Validate JSON schema matches `CheckpointQuestion[]` (Ref: design.md Data Models)

---

## Phase 3: Battlefield (Minimal Phaser Scene)

### 3.1: Phaser Boot Scene
- [x] 3.1.1: Create `src/game/scenes/BootScene.ts` extending Phaser.Scene (Ref: design.md Scene Flow)
- [x] 3.1.2: Wait for fonts with `await document.fonts.ready` in BootScene (fonts loaded via <link> in index.html) (Ref: design.md Fonts)
- [x] 3.1.3: Preload placeholder sprites (1x1 colored rectangles for towers/enemies) (Ref: design.md Procedural Art) [SKIPPED: not needed for minimal scenes]
- [x] 3.1.4: Transition to TitleScene on load complete (Ref: design.md Scene Flow)

### 3.2: Title Scene (Minimal)
- [x] 3.2.1: Create `src/game/scenes/TitleScene.ts` (Ref: R1.1)
- [x] 3.2.2: Display logo text "Deadline Defense" with Cinzel font, blood-red color (Ref: R1.1, design.md Art Direction)
- [x] 3.2.3: Add "Start" button (Phaser Text or DOM element) (Ref: R1.1)
- [x] 3.2.4: Wire button to transition to BattleScene (skip tutorial for now) (Ref: design.md Scene Flow)
- [x] 3.2.5: Keyboard navigation: Enter to start (Ref: R1.1)

### 3.3: Battle Scene (Core Loop)
- [x] 3.3.1: Create `src/game/scenes/BattleScene.ts` (Ref: design.md BattleScene)
- [x] 3.3.2: Load demo data from `src/data/demo.json` (Ref: R2.1)
- [x] 3.3.3: Set up 6 horizontal lanes (y-positions for each course) (Ref: design.md BattleScene Layout)
- [x] 3.3.4: Draw fortress graphic at x=50 (simple rectangle with health bar) (Ref: R1.2)
- [x] 3.3.5: Initialize game state: `wave=1`, `gold=0`, `fortressHp=100`, `towers=[]`, `enemies=[]` (Ref: design.md Data Models)

### 3.4: Tower Placement
- [x] 3.4.1: Spawn 6 towers (one per course) at fixed positions (x=200, y per lane) (Ref: R4.1)
- [x] 3.4.2: Draw tower sprites (colored circles with course color, 20px radius) (Ref: design.md Procedural Art)
- [x] 3.4.3: Add range circle visual (semi-transparent circle, range=150px) (Ref: R4.1)

### 3.5: Enemy Spawning (Wave 1)
- [x] 3.5.1: Call `generateWave(semester, 1, new Date())` from `src/core/wave.ts` (Ref: R3.2)
- [x] 3.5.2: Spawn enemy sprites at x=1200, y per lane (colored rectangles per type) (Ref: R3.1)
- [x] 3.5.3: Store enemy data in `gameState.enemies` array (Ref: design.md Data Models)

### 3.6: Enemy Movement
- [x] 3.6.1: In `update()`, move enemies left by `enemy.speed * delta` (Ref: R3.2)
- [x] 3.6.2: Update `pathProgress = 1 - (x / 1200)` (Ref: design.md Data Models)
- [x] 3.6.3: If `x < 50`, apply fortress damage and remove enemy (Ref: R3.3)
- [x] 3.6.4: Display fortress HP in HUD (Ref: R1.2)

### 3.7: Tower Firing
- [x] 3.7.1: In `update()`, for each tower, call `selectTarget(tower, enemies)` (Ref: R4.3)
- [x] 3.7.2: If target found and fire rate allows, draw projectile (line or small circle) from tower to target (Ref: R4.1)
- [x] 3.7.3: Apply damage to enemy HP (Ref: R4.1)
- [x] 3.7.4: Update `lastFiredAt` timestamp (Ref: design.md Data Models)
- [x] 3.7.5: If enemy HP ≤ 0, remove sprite and grant +10 gold (Ref: R8.2)

### 3.8: Wave End
- [x] 3.8.1: Detect when all enemies defeated (Ref: R8.2)
- [x] 3.8.2: Grant +50 gold bonus, +10% fortress HP regen (Ref: R8.2)
- [x] 3.8.3: Display "Wave Complete" text (GSAP fade in/out) (Ref: R8.2)
- [x] 3.8.4: Start next wave after 3s delay (Ref: design.md BattleScene)

### 3.9: First Playthrough Verification
- [ ] 3.9.1: Run `npm run dev` and manually test: boot → title → battle → wave 1 completes (Ref: R1.1, R1.2)
- [ ] 3.9.2: Verify enemies move, towers fire, HP decreases, gold increases (Ref: R3, R4, R8)

---

## Phase 4: Study Checkpoints

### 4.1: Checkpoint Data Loading
- [ ] 4.1.1: Load `src/data/checkpoints.json` in BattleScene (Ref: R5.1)
- [ ] 4.1.2: Store in game state: `availableQuestions: CheckpointQuestion[]` (Ref: design.md Data Models)

### 4.2: Checkpoint Panel UI
- [ ] 4.2.1: Create `src/ui/CheckpointPanel.ts` as DOM overlay (not Phaser, for accessibility) (Ref: R5.2)
- [ ] 4.2.2: HTML structure: question text, 4 answer buttons, charge meter, close button (Ref: R5.2)
- [ ] 4.2.3: Style with CSS: dark background, high-contrast text, 44px+ button size (Ref: R9.3, R5.2)
- [ ] 4.2.4: Position overlay centered, z-index above Phaser canvas (Ref: R5.2)

### 4.3: Checkpoint Open/Close
- [ ] 4.3.1: Listen for `C` key in BattleScene, emit `open-checkpoint` event (Ref: R5.2, R9.1)
- [ ] 4.3.2: CheckpointPanel shows, selects random unanswered question from current course (Ref: R5.2)
- [ ] 4.3.3: Listen for `Esc` key to close panel (Ref: R5.2, R9.1)
- [ ] 4.3.4: Keyboard navigation: 1-4 keys to select answer (Ref: R5.2, R9.1)

### 4.4: Answer Validation
- [ ] 4.4.1: On answer selected, compare to `correctIndex` (Ref: R5.3)
- [ ] 4.4.2: If correct: add +25% to charge meter, show "Correct! +25%" GSAP animation (Ref: R5.3)
- [ ] 4.4.3: If wrong: show "Try another question" message, no punishment (Ref: R5.3)
- [ ] 4.4.4: Mark question as answered (store ID + timestamp) (Ref: R5.3)
- [ ] 4.4.5: Close panel after 1s feedback delay (Ref: R5.3)

### 4.5: Charge Meter Display
- [ ] 4.5.1: Create `src/ui/HUD.ts` as DOM overlay (Ref: design.md BattleScene)
- [ ] 4.5.2: Display charge meter (0-100%) as progress bar in top-right (Ref: R5.2)
- [ ] 4.5.3: Update meter on correct answer (Ref: R5.3)

### 4.6: Special Attack
- [ ] 4.6.1: Listen for `Space` key in BattleScene (Ref: R5.4, R9.1)
- [ ] 4.6.2: If charge ≥ 100%, trigger AOE damage to all enemies of selected course (Ref: R5.4)
- [ ] 4.6.3: Reset charge to 0% (Ref: R5.4)
- [ ] 4.6.4: Display dramatic particle effect (Phaser particles, flash screen white) (Ref: R5.4)
- [ ] 4.6.5: Play special attack sound (Howler, synthesised with ZzFX) (Ref: R5.4, design.md Audio)

### 4.7: Checkpoint Integration Test
- [ ] 4.7.1: Manually test: press C, answer 4 questions correctly, charge to 100%, fire special attack (Ref: R5)
- [ ] 4.7.2: Verify no punishment for wrong answers (Ref: R5.3)

---

## Phase 5: Quick-Time Exam Events (QTE)

### 5.1: QTE Core Rules
- [ ] 5.1.1: Create `src/core/qte.ts` with `QTEState`, `QTESettings`, `QTEOutcome` types (Ref: R13.5, design.md QTE)
- [ ] 5.1.2: Implement `startQTE(enemy, question, settings): QTEState` with time based on extraTime setting (Ref: R13.1, R13.2)
- [ ] 5.1.3: Implement `updateQTE(state, deltaTime): QTEState` with clamped timer (Ref: R13.5)
- [ ] 5.1.4: Implement `resolveQTE(state, answerIndex | null, baseDamage): QTEOutcome` (Ref: R13.3, R13.5)
- [ ] 5.1.5: Write unit tests in `src/core/qte.test.ts`: correct/wrong/timeout outcomes, extraTime doubling (Ref: R13.5)
- [ ] 5.1.6: Write property-based tests in `src/core/qte.prop.test.ts`: timer bounds, determinism, non-negative time (Ref: R13.5, design.md QTE)

### 5.2: QTE Trigger Logic
- [ ] 5.2.1: In BattleScene.update(), detect exam enemy at 50% HP (Ref: R13.1)
- [ ] 5.2.2: Detect multi-phase enemy phase transition (Ref: R13.1)
- [ ] 5.2.3: Call `startQTE(enemy, question, settings)` and set `qteTriggered` flag on enemy (Ref: R13.1)
- [ ] 5.2.4: Set Phaser time scale to 0.2 (20% speed) (Ref: R13.1)
- [ ] 5.2.5: Pause enemy movement and tower firing during QTE (Ref: R13.1)

### 5.3: QTE UI Panel
- [ ] 5.3.1: Create `src/ui/QTEPanel.ts` as DOM overlay (Ref: R13.1)
- [ ] 5.3.2: Display question text, 4 answer buttons, countdown timer (large font, high contrast) (Ref: R13.1)
- [ ] 5.3.3: Update timer display every frame (Ref: R13.1)
- [ ] 5.3.4: Style with pulsing border or glow effect to indicate urgency (Ref: R13.1)

### 5.4: QTE Input Handling
- [ ] 5.4.1: Listen for keyboard keys 1-4 during QTE (Ref: R13.4)
- [ ] 5.4.2: Listen for mouse/touch on answer buttons (Ref: R13.4)
- [ ] 5.4.3: Disable other game controls (C, Space, etc.) during QTE (Ref: R13.4)
- [ ] 5.4.4: ESC key does not close QTE (Ref: R13.4)
- [ ] 5.4.5: Verify input latency <50ms (Ref: R13.4)

### 5.5: QTE Outcomes
- [ ] 5.5.1: On correct answer: call `resolveQTE`, apply 3× critical hit damage to enemy (Ref: R13.3)
- [ ] 5.5.2: Display dramatic visual effect: screen flash (white), particle burst, slow-motion kill cam (0.5s at 10% speed) (Ref: R13.3)
- [ ] 5.5.3: Play special sound effect (Howler, synthesised with ZzFX) (Ref: R13.3)
- [ ] 5.5.4: On wrong/timeout: apply enrage buff (+50% damage, +25% speed for 10s) (Ref: R13.3)
- [ ] 5.5.5: Display "Enraged!" text above enemy with red glow (Ref: R13.3)
- [ ] 5.5.6: Resume normal time scale (1.0) after outcome resolves (Ref: R13.3)

### 5.6: QTE Accessibility Setting
- [ ] 5.6.1: Add "Extra Time (QTE)" toggle to settings menu (Ref: R13.2)
- [ ] 5.6.2: Persist setting in localStorage (Ref: R13.2)
- [ ] 5.6.3: Load setting in BattleScene and pass to `startQTE` (Ref: R13.2)
- [ ] 5.6.4: Display indicator in QTE panel when extra time is active (e.g., "+8s" badge) (Ref: R13.2)

### 5.7: QTE Integration Test
- [ ] 5.7.1: Manually test: damage exam boss to 50% HP, verify QTE triggers (Ref: R13.1)
- [ ] 5.7.2: Answer correctly, verify critical hit and visual effect (Ref: R13.3)
- [ ] 5.7.3: Answer incorrectly, verify enrage buff applies (Ref: R13.3)
- [ ] 5.7.4: Let timer expire, verify same outcome as wrong answer (Ref: R13.3)
- [ ] 5.7.5: Enable extra time, verify 16s timer (Ref: R13.2)

---

## Phase 6: War Room & Study Loop

### 6.1: Readiness Core Rules
- [ ] 6.1.1: Create `src/core/readiness.ts` with `TrialResult`, `CourseReadiness` types (Ref: design.md Readiness & Study Loop)
- [ ] 6.1.2: Implement `calculateReadiness(trialHistory, now): number` with recency weighting (last 7 days = 2×, older = 1×) (Ref: R16.3)
- [ ] 6.1.3: Implement `identifyWeakTopics(trialHistory): string[]` with <50% correct rate threshold (Ref: R16.3)
- [ ] 6.1.4: Implement `recommendTrialCount(daysUntilDue, readiness): number` with formula `ceil((daysUntilDue - 1) * (1 - readiness/100))` (Ref: R17.3)
- [ ] 6.1.5: Implement `threatLevel(priorityScore): 'Low' | 'Medium' | 'High' | 'Critical'` with thresholds (Ref: R15.1)
- [ ] 6.1.6: Write unit tests in `src/core/readiness.test.ts`: verify readiness bounds [0,100], weak topics threshold, trial recommendations ≥0 (Ref: design.md Readiness property tests)
- [ ] 6.1.7: Write property-based tests in `src/core/readiness.prop.test.ts`: readiness bounds, monotonic improvement, recency weighting, determinism (Ref: design.md Readiness property tests)
- [ ] 6.1.8: Run `npm run test:core` and verify 90% coverage (Ref: NFR3)

### 6.2: War Room Scene (Minimal)
- [ ] 6.2.1: Create `src/game/scenes/WarRoomScene.ts` extending Phaser.Scene (Ref: design.md Scene Flow)
- [ ] 6.2.2: Load demo semester data and compute course grades from past items (Ref: R15.1)
- [ ] 6.2.3: Display title "War Room" with tagline "Plan your defense" (Ref: R15.1)
- [ ] 6.2.4: Add "Start Wave" button (transitions to Scout Report overlay) (Ref: R17.1)
- [ ] 6.2.5: Update TitleScene: "Start" button now transitions to WarRoomScene (not BattleScene) (Ref: design.md Scene Flow)

### 6.3: Course Status Cards
- [ ] 6.3.1: Create `src/ui/warroom/CourseCard.ts` as DOM component (Ref: design.md War Room UI)
- [ ] 6.3.2: Display one card per course (6 total) with course ID badge (colored with palette color) (Ref: R15.1)
- [ ] 6.3.3: Display current grade (computed from past items with grades, or "N/A") (Ref: R15.1)
- [ ] 6.3.4: Display threat level (Low/Medium/High/Critical icon + text, color-coded) computed from priority score of upcoming items (Ref: R15.1)
- [ ] 6.3.5: Display next 1-3 big enemies (exams, projects, high-weight assignments ≥50 pts) with name, date, points, days remaining (Ref: R15.1)
- [ ] 6.3.6: Add "Train" button to each card (Ref: R16.1)
- [ ] 6.3.7: Style cards with grimoire page aesthetic (dark parchment, ink borders, ornamental corners) (Ref: design.md War Room UI, art-direction.md)
- [ ] 6.3.8: Add GSAP entrance animation (cards fade in with stagger) (Ref: design.md War Room UI)

### 6.4: Semester Timeline
- [ ] 6.4.1: Create `src/ui/warroom/Timeline.ts` as DOM/Canvas component (Ref: design.md War Room UI)
- [ ] 6.4.2: Render horizontal timeline spanning from "today" to furthest deadline (up to 10 weeks) (Ref: R15.2)
- [ ] 6.4.3: Render tombstone markers (small SVG cross icons) for each future deadline, positioned proportionally by days from now (Ref: R15.2)
- [ ] 6.4.4: Tint each tombstone with its course color (Ref: R15.2)
- [ ] 6.4.5: Mark current date with vertical line or glow (Ref: R15.2)
- [ ] 6.4.6: Add hover tooltip showing item name, date, points on tombstone hover (Ref: R15.2)
- [ ] 6.4.7: Make timeline horizontally scrollable if span >90 days (Ref: R15.2)
- [ ] 6.4.8: Add GSAP entrance animation (tombstones rise from bottom with stagger) (Ref: design.md War Room UI)

### 6.5: Trial Scene (5-Question Practice)
- [ ] 6.5.1: Create `src/game/scenes/TrialScene.ts` extending Phaser.Scene or DOM screen (Ref: design.md War Room UI)
- [ ] 6.5.2: Accept course ID as parameter (passed from War Room "Train" button) (Ref: R16.2)
- [ ] 6.5.3: Load 5 random unanswered questions from that course's checkpoint pool (Ref: R16.2)
- [ ] 6.5.4: Display question counter "Question 1/5" (Ref: design.md Trial Scene)
- [ ] 6.5.5: Display question text (large, Spectral font) and 4 answer buttons (Ref: R16.2)
- [ ] 6.5.6: Handle keyboard input (1-4 keys) and mouse/touch on buttons (Ref: R16.2)
- [ ] 6.5.7: Show immediate feedback after each answer: "Correct!" (green) or "Incorrect. Answer: B" (red) with 1s delay (Ref: R16.2)
- [ ] 6.5.8: Track answers (questionId, correct, topic) in TrialResult (Ref: design.md Readiness)
- [ ] 6.5.9: After 5 questions, compute score (0-100%) and display score screen (Ref: R16.2)
- [ ] 6.5.10: If score ≥70%, grant tower upgrade currency (+50 gold or +1 upgrade token) (Ref: R16.4)
- [ ] 6.5.11: If score ≥90%, additionally charge special attack meter by +33% (Ref: R16.4)
- [ ] 6.5.12: Save TrialResult to localStorage (append to trial history for that course) (Ref: R16.3)
- [ ] 6.5.13: Update readiness score for that course using `calculateReadiness` (Ref: R16.3)
- [ ] 6.5.14: Transition back to WarRoomScene after score screen (Ref: design.md Trial Scene)
- [ ] 6.5.15: Style with grimoire page aesthetic, GSAP page flip transitions between questions (Ref: design.md Trial Scene)

### 6.6: Battle Plan Overlay
- [ ] 6.6.1: Create `src/ui/warroom/BattlePlan.ts` as DOM modal overlay (Ref: design.md War Room UI)
- [ ] 6.6.2: Trigger when big enemy (exam, project, or ≥50 pts) clicked in course card (Ref: R16.1)
- [ ] 6.6.3: Display enemy details: name, type, due date, weight, days remaining (Ref: R16.1)
- [ ] 6.6.4: Extract and display topics to review (from checkpoint questions for that course) (Ref: R16.1)
- [ ] 6.6.5: Display current readiness % for that course (large number, color-coded red/yellow/green) (Ref: R16.1)
- [ ] 6.6.6: Display weak topics (from `identifyWeakTopics`) if any exist (Ref: R16.1)
- [ ] 6.6.7: Display recommended trial count using `recommendTrialCount(daysUntilDue, readiness)` (Ref: R16.1)
- [ ] 6.6.8: Add "Train now" button (primary CTA, launches Trial Scene for this course) (Ref: R16.1)
- [ ] 6.6.9: Add close button (Esc key or X icon) (Ref: design.md Battle Plan Overlay)
- [ ] 6.6.10: Style with dark semi-transparent backdrop, centered grimoire panel, GSAP ink-bleed entrance (Ref: design.md Battle Plan Overlay)

### 6.7: Scout Report Overlay
- [ ] 6.7.1: Create `src/ui/warroom/ScoutReport.ts` as DOM modal overlay (Ref: design.md War Room UI)
- [ ] 6.7.2: Trigger when "Start Wave" button clicked in War Room (Ref: R17.1)
- [ ] 6.7.3: Display wave preview: list upcoming enemies in this wave (names, types, courses) (Ref: R17.1)
- [ ] 6.7.4: Display current readiness % for each course represented in wave (Ref: R17.1)
- [ ] 6.7.5: If any course readiness <60%, show recommendation: "Your CV readiness is 40%. Train before the battle?" (highlight lowest course in red) (Ref: R17.1)
- [ ] 6.7.6: Add "Train now" button (opens Trial Scene for weakest course) (Ref: R17.1)
- [ ] 6.7.7: Add "Start battle" button (proceeds to BattleScene) (Ref: R17.1)
- [ ] 6.7.8: Handle Esc key to close (same as "Start battle") (Ref: R17.1)
- [ ] 6.7.9: Style with smaller overlay (top 1/3 of screen), GSAP slide from top entrance (Ref: design.md Scout Report Overlay)
- [ ] 6.7.10: Keyboard navigation: Tab to cycle, Enter to select (Ref: R17.1)

### 6.8: Debrief Overlay
- [ ] 6.8.1: Create `src/ui/warroom/Debrief.ts` as DOM modal overlay (Ref: design.md War Room UI)
- [ ] 6.8.2: Trigger after wave ends (victory or defeat) in BattleScene (Ref: R17.2)
- [ ] 6.8.3: Display outcome: "VICTORY" or "DEFEAT" (large text) (Ref: R17.2)
- [ ] 6.8.4: Display performance summary: enemies defeated (X/Y), fortress damage (Z pts), gold earned (+G) (Ref: R17.2)
- [ ] 6.8.5: Generate real-world mapping: 2-3 sentences linking game events to real deadlines (Ref: R17.2, R17.3)
  - [ ] If exam enemy survived → "The Midterm boss broke through: your [course] readiness is low."
  - [ ] Compute recommended trials using `recommendTrialCount` → "2 trials recommended before [date]."
  - [ ] If tower was overwhelmed → "Quiz enemies overwhelmed the [course] tower: practice [weak topics]."
- [ ] 6.8.6: Display next deadline reminder: "Next big enemy: [name] in [days] days" (Ref: R17.2)
- [ ] 6.8.7: Prioritize feedback for high-weight items (≥50 pts) over low-weight (Ref: R17.3)
- [ ] 6.8.8: Add "Return to War Room" button (primary CTA, transitions to WarRoomScene) (Ref: R17.2)
- [ ] 6.8.9: Handle Esc or Enter key to close (same as button) (Ref: R17.2)
- [ ] 6.8.10: Style with full-screen overlay, centered panel (victory = green accent, defeat = red accent), GSAP fade + scale entrance (Ref: design.md Debrief Overlay)
- [ ] 6.8.11: Update BattleScene: after wave ends, show Debrief overlay instead of immediately starting next wave (Ref: design.md Scene Flow)

### 6.9: War Room Integration Test
- [ ] 6.9.1: Manually test: boot → title → war room → see 6 course cards with grades, threat levels, next enemies (Ref: R15)
- [ ] 6.9.2: Test: click "Train" on a course → complete 5-question trial → verify score, rewards, readiness update (Ref: R16)
- [ ] 6.9.3: Test: complete trial with ≥70% score → verify tower upgrade currency granted (Ref: R16.4)
- [ ] 6.9.4: Test: complete trial with ≥90% score → verify +33% special charge (Ref: R16.4)
- [ ] 6.9.5: Test: click big enemy in course card → see Battle Plan with topics, readiness, recommended trials (Ref: R16.1)
- [ ] 6.9.6: Test: click "Start Wave" → see Scout Report with wave preview, readiness check, recommendation (Ref: R17.1)
- [ ] 6.9.7: Test: proceed to battle → complete wave → see Debrief with outcome, mapping to real deadlines, recommendations (Ref: R17.2)
- [ ] 6.9.8: Test: return to War Room from Debrief → verify updated grades, threat levels (Ref: R17.2)
- [ ] 6.9.9: Test: semester timeline shows all deadlines as tombstones, current date marker (Ref: R15.2)
- [ ] 6.9.10: Verify keyboard navigation works in all War Room screens (Tab, Enter, Esc) (Ref: R15, R16, R17)

---

## Phase 7: Tutorial

### 7.1: Tutorial Scene
- [ ] 7.1.1: Create `src/game/scenes/TutorialScene.ts` (Ref: R7.1)
- [ ] 7.1.2: Spawn 1 weak enemy (assignment, 7 days out, low HP) (Ref: R7.1)
- [ ] 7.1.3: Show overlay tooltip: "This is an enemy. Click to target." (DOM + GSAP) (Ref: R7.1)
- [ ] 7.1.4: Wait for player to click enemy or tower (Ref: R7.1)
- [ ] 7.1.5: Show tooltip: "Press C to open study checkpoint." (Ref: R7.1)
- [ ] 7.1.6: Wait for player to press C (Ref: R7.1)
- [ ] 7.1.7: Show tooltip: "Answer correctly to charge your special attack." (Ref: R7.1)
- [ ] 7.1.8: Wait for player to answer 1 question (Ref: R7.1)
- [ ] 7.1.9: Show tooltip: "Defeat the enemy!" (Ref: R7.1)
- [ ] 7.1.10: When enemy defeated or reaches fortress, end tutorial and transition to BattleScene (Ref: R7.1)

### 7.2: Tutorial Skip & Persistence
- [ ] 7.2.1: Add "Skip Tutorial (Esc)" text to TutorialScene (Ref: R7.1)
- [ ] 7.2.2: On Esc, transition to BattleScene (Ref: R7.1)
- [ ] 7.2.3: Save `tutorialCompleted: true` to localStorage on completion (Ref: R7.1, R10.1)
- [ ] 7.2.4: In TitleScene, check localStorage; if completed, skip tutorial on Start (Ref: R7.1)

### 7.3: Tutorial Timing
- [ ] 7.3.1: Manually playtest: verify tutorial completes in ~60s (Ref: R7.1)
- [ ] 7.3.2: Adjust delays/text if too slow or fast (Ref: R7.1)

---

## Phase 8: Theme Polish

### 8.1: Color Palette Tokens
- [ ] 7.1.1: Create `src/styles/tokens.css` with CSS custom properties for all colors (Ref: design.md Art Direction)
- [ ] 7.1.2: Verify WCAG AA contrast ratios with browser DevTools (Ref: R9.3)
- [ ] 7.1.3: Document palette in README or CREDITS.md (Ref: R12.1)

### 8.2: Title Screen Polish
- [ ] 7.2.1: Add dark gradient background (CSS or Phaser Graphics) (Ref: design.md TitleScene)
- [ ] 7.2.2: Add fog particle emitter (Phaser Particles) (Ref: design.md TitleScene)
- [ ] 7.2.3: Animate logo entrance with GSAP (scale + fade) (Ref: R1.1)
- [ ] 7.2.4: Animate buttons stagger (GSAP timeline) (Ref: design.md TitleScene)
- [ ] 7.2.5: Add background audio loop (Howler, CC0 or synthesised, volume 0.3) (Ref: design.md TitleScene)

### 8.3: Battlefield Visuals
- [ ] 7.3.1: Replace placeholder tower sprites with procedural graphics (Phaser Graphics API: turret shape) (Ref: design.md Procedural Art)
- [ ] 7.3.2: Replace placeholder enemy sprites with type-specific shapes (circles for quiz, rectangles for assignment, large composite for exam) (Ref: R3.1, design.md Procedural Art)
- [ ] 7.3.3: Add neglected glow effect to enemies (Phaser FX pipeline or glow filter) (Ref: R3.4)
- [ ] 7.3.4: Add tombstones/ghosts for past items (SVG data URIs, tinted per course) (Ref: R3.5, R1.2)
- [ ] 7.3.5: Draw lane dividers (subtle lines, low opacity) (Ref: design.md BattleScene Layout)

### 8.4: Audio & SFX
- [ ] 7.4.1: Synthesise tower fire sound with ZzFX (short blip) (Ref: design.md Audio)
- [ ] 7.4.2: Synthesise enemy hit sound (impact) (Ref: design.md Audio)
- [ ] 7.4.3: Synthesise special attack sound (explosion) (Ref: design.md Audio)
- [ ] 7.4.4: Synthesise wave complete sound (victory chime) (Ref: design.md Audio)
- [ ] 7.4.5: Add all sounds to Howler, play on events (Ref: design.md Audio)
- [ ] 7.4.6: Create `CREDITS.md` and list any CC0 assets used (Ref: NFR4)

### 8.5: Animations & Juice
- [ ] 7.5.1: Add particle effect on enemy death (Phaser particles: small explosion) (Ref: R8.2)
- [ ] 7.5.2: Add coin sparkle effect on gold gain (particle or sprite animation) (Ref: R8.2)
- [ ] 7.5.3: Add screen shake on fortress damage (Phaser camera shake, 200ms) (Ref: design.md BattleScene)
- [ ] 7.5.4: Add HP bar above enemies (Phaser Graphics, red/green) (Ref: R3)
- [ ] 7.5.5: Add tower range circle on hover (Phaser Graphics, toggle visibility) (Ref: R4.1)

### 8.6: Reduced Motion Support
- [ ] 7.6.1: Detect `prefers-reduced-motion: reduce` in `src/ui/motion.ts` (Ref: R9.2, design.md Reduced Motion)
- [ ] 7.6.2: Disable GSAP animations (duration=0) if reduced motion (Ref: R9.2)
- [ ] 7.6.3: Disable camera shake if reduced motion (Ref: R9.2)
- [ ] 7.6.4: Reduce particle count by 90% if reduced motion (Ref: R9.2)
- [ ] 7.6.5: Manually test with browser DevTools (emulate prefers-reduced-motion) (Ref: R9.2)

---

## Phase 9: Tower Upgrades

### 9.1: Upgrade UI
- [ ] 8.1.1: Create `src/ui/UpgradePanel.ts` as DOM overlay (Ref: R4.2)
- [ ] 8.1.2: Display when tower clicked: show 3 upgrade paths (Damage, Speed, Range) with costs and current level (Ref: R4.2)
- [ ] 8.1.3: Keyboard shortcut: `U` to open upgrade panel for selected tower (Ref: R9.1)

### 9.2: Upgrade Logic
- [ ] 8.2.1: Create `src/core/upgrades.ts` with `canUpgrade(tower, path, gold): boolean` and `applyUpgrade(tower, path): TowerStats` (Ref: R4.2)
- [ ] 8.2.2: Implement cost/max level checks (Damage/Speed: 50 gold, 3 levels; Range: 75 gold, 2 levels) (Ref: R4.2)
- [ ] 8.2.3: Update tower stats: damage +5, fireRate +0.5, range +50px (Ref: R4.2)
- [ ] 8.2.4: Write unit tests in `src/core/upgrades.test.ts`: verify costs, max levels, stat changes (Ref: R4.2)

### 9.3: Upgrade Integration
- [ ] 8.3.1: Wire upgrade buttons to call `applyUpgrade` and deduct gold (Ref: R4.2)
- [ ] 8.3.2: Update tower visual (larger sprite or brighter color) on upgrade (Ref: R4.2)
- [ ] 8.3.3: Persist upgrades in game state (Ref: R4.2)

---

## Phase 10: Moodle Calendar Import

### 10.1: ICS Parser
- [ ] 9.1.1: Install `ical.js` (npm package) (Ref: design.md Import Modules)
- [ ] 8.1.2: Create `src/import/ics.ts` with `parseICS(icsText): ICSEvent[]` (Ref: design.md ICS Parser, R6.1)
- [ ] 8.1.3: Implement `inferItemType(summary): ItemType` with regex (Ref: design.md ICS Parser, R6.2)
- [ ] 8.1.4: Implement `extractCourseId(summary, categories): CourseId` (Ref: design.md ICS Parser, R6.2)
- [ ] 8.1.5: Write unit tests in `src/import/ics.test.ts`: verify parsing with sample .ics file (Ref: R6.1)

### 10.2: Import UI
- [ ] 8.2.1: Add "Import Moodle Calendar" button to TitleScene (Ref: R6.1)
- [ ] 8.2.2: Create file input (type=file, accept=.ics) in `src/ui/ImportPanel.ts` (Ref: R6.1)
- [ ] 8.2.3: On file selected, read with FileReader, call `parseICS` (Ref: R6.1)
- [ ] 8.2.4: Convert ICSEvent[] to Semester data (merge or replace demo) (Ref: R6.1)
- [ ] 8.2.5: Handle parsing errors with user-friendly message (Ref: R6.1, R6.3)
- [ ] 8.2.6: Store imported data in localStorage (Ref: R6.1)

### 10.3: Import Integration
- [ ] 8.3.1: In BattleScene, check localStorage for imported data before loading demo (Ref: R6.1)
- [ ] 8.3.2: Manually test with real Moodle .ics export (Ref: R6.1)
- [ ] 8.3.3: Verify no backend requests in browser DevTools Network tab (Ref: R6.3)

---

## Phase 11: PDF Question Generator (Optional)

### 11.1: PDF Text Extraction
- [ ] 10.1.1: Create `src/import/pdf.ts` with `extractText(file): Promise<string>` (Ref: design.md PDF Question Generator, R5.5)
- [ ] 9.1.2: Configure pdf.js worker path (`public/pdf.worker.min.js`) (Ref: design.md PDF Question Generator)
- [ ] 9.1.3: Write unit tests with sample PDF (Ref: R5.5)

### 11.2: Cloze Question Generation
- [ ] 9.2.1: Implement `generateClozeQuestions(text, count): CheckpointQuestion[]` (Ref: design.md PDF Question Generator, R5.5)
- [ ] 9.2.2: Extract sentences with capitalized nouns (simple heuristic) (Ref: R5.5)
- [ ] 9.2.3: Blank one term per sentence, generate 3 distractors (Ref: R5.5)
- [ ] 9.2.4: Write unit tests: verify generated questions are valid (Ref: R5.5)

### 11.3: PDF Import UI
- [ ] 9.3.1: Add "Upload PDF" button to CheckpointPanel (Ref: R5.5)
- [ ] 9.3.2: On file selected, call `extractText` → `generateClozeQuestions` (Ref: R5.5)
- [ ] 9.3.3: Add generated questions to available pool (Ref: R5.5)
- [ ] 9.3.4: Handle errors with fallback message (Ref: R5.5)
- [ ] 9.3.5: Verify <5s processing time for 50-page PDF (Ref: R5.5)

---

## Phase 12: Persistence

### 12.1: Save System
- [ ] 11.1.1: Create `src/save/save.ts` with `save(state, settings): void` and `load(): SaveData | null` (Ref: design.md Persistence, R10.1)
- [ ] 10.1.2: Implement versioning (CURRENT_VERSION = "1.0.0") (Ref: R10.1)
- [ ] 10.1.3: Wrap all localStorage calls in try/catch (Ref: R10.1)
- [ ] 10.1.4: Write unit tests in `src/save/save.test.ts`: save/load/migrate (Ref: R10.1)

### 12.2: Auto-Save Triggers
- [ ] 10.2.1: Call `save()` after each wave end (Ref: R10.2)
- [ ] 10.2.2: Call `save()` after answering a checkpoint (Ref: R10.2)
- [ ] 10.2.3: Call `save()` after upgrading a tower (Ref: R10.2)
- [ ] 10.2.4: Call `save()` on page visibility change (window blur) (Ref: R10.2)
- [ ] 10.2.5: Verify saves are synchronous (no race conditions) (Ref: R10.2)

### 12.3: Load on Boot
- [ ] 10.3.1: In TitleScene, call `load()` and populate game state if save exists (Ref: R10.1)
- [ ] 10.3.2: Show "Continue" button if save found (Ref: R1.1)
- [ ] 10.3.3: Handle version mismatch: discard old saves with user warning (Ref: R10.1)

---

## Phase 13: Accessibility

### 13.1: Keyboard Controls
- [ ] 12.1.1: Implement all keyboard shortcuts in `src/ui/keyboard.ts`: C, Esc, Space, M, 1-4, Tab, Enter, Arrows (Ref: R9.1, design.md Keyboard Navigation)
- [ ] 11.1.2: Add focus indicators (2px outline) to all interactive elements (Ref: R9.1, design.md Focus Indicators)
- [ ] 11.1.3: Verify Tab cycles through towers (Ref: R9.1)
- [ ] 11.1.4: Manually test with keyboard only (no mouse) (Ref: R9.1)

### 13.2: Mute Toggle
- [ ] 11.2.1: Add mute button to HUD (Ref: R9.5)
- [ ] 11.2.2: Listen for `M` key, toggle Howler mute (Ref: R9.5)
- [ ] 11.2.3: Show muted icon when active (Ref: R9.5)
- [ ] 11.2.4: Persist mute state in localStorage (Ref: R9.5)

### 13.3: Visual Captions
- [ ] 11.3.1: Implement `showCaption(text)` in `src/ui/captions.ts` (Ref: design.md Visual Captions, R9.4)
- [ ] 11.3.2: Call on events: tower fires, special attack, wave complete (Ref: R9.4)
- [ ] 11.3.3: Manually test with audio muted (Ref: R9.4)

### 13.4: Contrast Check
- [ ] 11.4.1: Use browser DevTools to verify all text has ≥4.5:1 contrast (Ref: R9.3)
- [ ] 11.4.2: Use browser DevTools to verify all UI elements have ≥3:1 contrast (Ref: R9.3)
- [ ] 11.4.3: Adjust colors in `tokens.css` if needed (Ref: R9.3)

---

## Phase 14: Moodle Block & LMS Showcase

### 14.1: Moodle Block Plugin Structure
- [ ] 13.1.1: Create `moodle/block_gradedefense/version.php` with plugin metadata (Ref: R14.1)
- [ ] 13.1.2: Create `moodle/block_gradedefense/block_gradedefense.php` extending `block_base` (Ref: R14.1)
- [ ] 13.1.3: Create `moodle/block_gradedefense/lang/en/block_gradedefense.php` with strings (Ref: R14.1)
- [ ] 13.1.4: Create `moodle/block_gradedefense/styles.css` for iframe styling (Ref: R14.1)
- [ ] 13.1.5: Verify plugin structure matches Moodle 4.5 standards (Ref: R14.1)

### 14.2: Moodle Calendar Data Integration
- [ ] 13.2.1: In `block_gradedefense.php`, fetch user calendar events via `core_calendar_get_calendar_upcoming_view` (Ref: R14.2)
- [ ] 13.2.2: Transform Moodle events to game JSON schema (name, courseId, dueDate, points, type) (Ref: R14.2)
- [ ] 13.2.3: Embed game iframe with deployed URL (Ref: R14.2)
- [ ] 13.2.4: Send JSON payload via postMessage after iframe load (Ref: R14.2)
- [ ] 13.2.5: Document postMessage contract in `docs/moodle-integration.md` (Ref: R14.2)

### 14.3: Game postMessage Handler
- [ ] 13.3.1: Create `src/import/postmessage.ts` with message handler (Ref: R14.2)
- [ ] 13.3.2: Implement schema validation (TypeScript type guard) (Ref: R14.2)
- [ ] 13.3.3: Implement origin check with configurable allowlist (Ref: R14.2, R14.4)
- [ ] 13.3.4: On valid message, replace demo data with Moodle data (Ref: R14.2)
- [ ] 13.3.5: On invalid message, log error and fall back to demo (Ref: R14.2)
- [ ] 13.3.6: Write unit tests in `src/import/postmessage.test.ts`: verify validation, origin check (Ref: R14.2)

### 14.4: LMS Showcase Page
- [ ] 13.4.1: Create `showcase/lms.html` with generic LMS dashboard layout (Ref: R14.3)
- [ ] 13.4.2: Embed game iframe styled as a block (Ref: R14.3)
- [ ] 13.4.3: Load `src/data/demo.json` and send via postMessage (same contract as Moodle) (Ref: R14.3)
- [ ] 13.4.4: Use generic branding ("My Learning Portal"), NO Moodle trademarks (Ref: R14.3)
- [ ] 13.4.5: Verify postMessage integration works identically to real block (Ref: R14.3)

### 14.5: Security Review
- [ ] 13.5.1: Code review: confirm no tokens in URLs or postMessage payloads (Ref: R14.4)
- [ ] 13.5.2: Code review: confirm no PII stored in localStorage (Ref: R14.4)
- [ ] 13.5.3: Code review: confirm no client-side Moodle API calls (Ref: R14.4)
- [ ] 13.5.4: Manually test with malformed postMessage (verify graceful handling) (Ref: R14.2)
- [ ] 13.5.5: Manually test with untrusted origin (verify rejection) (Ref: R14.2)

---

## Phase 15: Build & Smoke Tests

### 15.1: Build Configuration
- [ ] 14.1.1: Verify `vite.config.ts` base path is set for production (Ref: R11.2, design.md Build Configuration)
- [ ] 12.1.2: Run `npm run build` and verify output in `dist/` (Ref: R11.1)
- [ ] 12.1.3: Verify build has zero TypeScript errors (Ref: NFR3)
- [ ] 12.1.4: Verify output is <10 MB uncompressed (Ref: R11.1)
- [ ] 12.1.5: Test locally with `npx vite preview` at sub-path (Ref: R11.2)

### 15.2: Playwright Smoke Tests
- [ ] 12.2.1: Create `tests/e2e/smoke.spec.ts` (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.2: Test: game boots without console errors (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.3: Test: first wave starts (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.4: Test: checkpoint panel opens (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.5: Test: mute toggle works (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.6: Run `npx playwright test` and verify all pass (Ref: NFR3)

### 15.3: Performance Verification
- [ ] 12.3.1: Run game with 20 enemies on screen, verify 60 FPS in browser DevTools (Ref: NFR2)
- [ ] 12.3.2: Measure checkpoint answer latency (<100ms) (Ref: NFR2)
- [ ] 12.3.3: Measure build time (<30s) (Ref: NFR2)

---

## Phase 16: Kiro Hooks

### 16.1: Post-Save Hook for Core Tests
- [ ] 15.1.1: Create `.kiro/hooks/post-save.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.1.2: Add logic: if file in `src/core/`, run `npm run test:core` (Ref: design.md Kiro Hooks)
- [ ] 13.1.3: Make executable: `chmod +x .kiro/hooks/post-save.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.1.4: Test by editing a file in `src/core/` and saving (Ref: design.md Kiro Hooks)

### 16.2: Pre-Commit Hook for Full Test Suite
- [ ] 13.2.1: Create `.kiro/hooks/pre-commit.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.2.2: Add logic: run `npm run build`, `npm run test`, `npx playwright test` (Ref: design.md Kiro Hooks)
- [ ] 13.2.3: Make executable: `chmod +x .kiro/hooks/pre-commit.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.2.4: Test by committing a change (Ref: design.md Kiro Hooks)

---

## Phase 17: Final Polish & Documentation

### 17.1: README.md
- [ ] 16.1.1: Write README with project description, features, demo link, local setup instructions (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.1.2: Add screenshot/GIF of gameplay (Ref: HACKATHON_STRATEGY.md Presentation)
- [ ] 14.1.3: Add license badge (MIT) (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

### 17.2: CREDITS.md
- [ ] 14.2.1: List all third-party assets (CC0, CC-BY) with links and licenses (Ref: NFR4)
- [ ] 14.2.2: List fonts (Cinzel, Inter, Creepster with OFL license) (Ref: NFR4)
- [ ] 14.2.3: List any CC0 audio if used (Ref: NFR4)

### 17.3: KIRO_USAGE.md
- [ ] 14.3.1: Document how Kiro was used: specs, steering, hooks, agents, CLI/IDE (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.3.2: Be honest about what worked and what didn't (Ref: HACKATHON_STRATEGY.md Technological Implementation)

### 17.4: Demo Video Script
- [ ] 14.4.1: Write script (<3 min): hook (10s), Moodle import demo, live combat, checkpoint answer, special attack, Kiro workflow segment (Ref: HACKATHON_STRATEGY.md Presentation)
- [ ] 14.4.2: Record screen capture (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.4.3: Edit with no copyrighted music (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.4.4: Upload to YouTube as unlisted (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

### 17.5: External Playtesting
- [ ] 14.5.1: Recruit 2 external users for 5-min playtest (Ref: R12.2)
- [ ] 14.5.2: Collect feedback on polish, bugs, confusion (Ref: R12.2)
- [ ] 14.5.3: Fix critical bugs identified (Ref: R12.2)

### 17.6: Deployment
- [ ] 14.6.1: Deploy `dist/` to GitHub Pages (Ref: R11.2)
- [ ] 14.6.2: Verify live URL works with no 404s (Ref: R11.2)
- [ ] 14.6.3: Test on 3 browsers: Chrome, Firefox, Safari (Ref: NFR1)

### 17.7: Final Verification
- [ ] 14.7.1: Run `npm run build` with zero errors (Ref: tech.md)
- [ ] 14.7.2: Run `npx vitest run` with all tests passing (Ref: tech.md)
- [ ] 14.7.3: Run `npx playwright test` with all tests passing (Ref: tech.md)
- [ ] 14.7.4: Verify `.kiro/` directory is committed and not gitignored (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.7.5: Verify MIT license in repo (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

---

## Summary

Tasks are ordered for vertical slice development:
1. **Core rules + tests** (pure TypeScript, testable)
2. **Demo data** (convert coursepilot reference with daysOffset, runtime resolution)
3. **Minimal Phaser battlefield** (one wave playable)
4. **Checkpoints** (UI + rewards)
5. **Quick-Time Exam Events (QTE)** (boss encounters with time pressure)
6. **Tutorial** (played onboarding)
7. **Theme polish** (spooky UI, audio, animations)
8. **Tower upgrades** (progression system)
9. **Moodle import** (real deadlines via ICS)
10. **PDF questions** (optional, no paid AI)
11. **Persistence** (save/load)
12. **Accessibility** (keyboard, reduced motion, captions, extra time for QTE)
13. **Moodle block + LMS showcase** (integration demo, postMessage contract)
14. **Build/smoke tests** (Playwright Chromium, performance)
15. **Kiro hooks** (test-on-save, pre-commit)
16. **Final polish** (README, demo video with QTE + showcase, deployment)

Each phase delivers a playable or testable increment. Kiro agents can work on independent phases in parallel (e.g., checkpoint UI while another agent works on PDF import, or QTE while Moodle block is being developed).
