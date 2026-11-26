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
- [ ] 1.2.1: Create `src/core/types.ts` with `CourseworkItem`, `Course`, `Semester`, `EnemyStats`, `TowerStats`, `GameState`, `CheckpointQuestion` (Ref: design.md Data Models)
- [ ] 1.2.2: Add JSDoc comments to all exported types (Ref: NFR3)

### 1.3: Scoring Logic (Pure Functions)
- [ ] 1.3.1: Create `src/core/scoring.ts` with `calculateUrgency`, `calculateRisk`, `calculateWeight`, `priorityScore` (Ref: design.md Scoring Formulas, R3.2)
- [ ] 1.3.2: Implement `enemyHpMultiplier`, `enemySpeedMultiplier`, `fortressDamage` (Ref: R3.2, R3.3)
- [ ] 1.3.3: Write unit tests in `src/core/scoring.test.ts`: urgency bounds, priority monotonicity, HP/speed scaling (Ref: design.md Unit Tests)
  - [ ] Test urgency at 0, 7, 14, 21+ days
  - [ ] Test priority increases as deadline approaches (fixed grade/points)
  - [ ] Test HP multiplier ≥ 1.0
  - [ ] Test speed multiplier ≥ 1.0
- [ ] 1.3.4: Write property-based tests in `src/core/scoring.prop.test.ts` using fast-check (Ref: design.md Property-Based Tests)
  - [ ] Urgency bounds: `0.1 ≤ urgency ≤ 1.0` for days ≥ 0
  - [ ] HP/speed multipliers always positive
  - [ ] Determinism: same inputs → same output
- [ ] 1.3.5: Run `npm run test:core` and verify 90% coverage (Ref: NFR3)

### 1.4: Wave Generation
- [ ] 1.4.1: Create `src/core/wave.ts` with `generateWave(semester, waveNumber, currentDate): EnemyStats[]` (Ref: design.md BattleScene Wave System)
- [ ] 1.4.2: Implement logic: filter items due within 7 days, sort by priority score, spawn top N (Ref: R3.2)
- [ ] 1.4.3: Implement `createEnemy(item, currentDate): EnemyStats` with base stats per type (Ref: R3.1)
- [ ] 1.4.4: Write unit tests in `src/core/wave.test.ts`: verify enemy count, HP scaling, type mapping (Ref: R3.1, R3.2)

### 1.5: Targeting Logic
- [ ] 1.5.1: Create `src/core/targeting.ts` with `selectTarget(tower, enemies): EnemyStats | null` (Ref: design.md Targeting, R4.3)
- [ ] 1.5.2: Implement priority: same course > closest to fortress > highest HP (Ref: R4.3)
- [ ] 1.5.3: Write unit tests in `src/core/targeting.test.ts`: verify target selection with various scenarios (Ref: R4.3)

### 1.6: Neglect Logic
- [ ] 1.6.1: Create `src/core/neglect.ts` with `applyNeglectBuff(enemy, now): EnemyStats` (Ref: design.md Neglect Check, R3.4)
- [ ] 1.6.2: Implement 60s threshold, +50% HP, +25% speed, once-per-enemy flag (Ref: R3.4)
- [ ] 1.6.3: Write unit tests in `src/core/neglect.test.ts`: verify buff timing and application (Ref: R3.4)

---

## Phase 2: Demo Data

### 2.1: Demo Semester Conversion
- [ ] 2.1.1: Create `scripts/convert-demo.ts` to read `reference/coursepilot/course_plan.json` (Ref: R2.1)
- [ ] 2.1.2: Convert `days` offset to `daysOffset` (keep as relative integers, NOT absolute dates) (Ref: R2.1, R2.2)
- [ ] 2.1.3: Infer `type` from `name` via regex (quiz/exam/project/presentation/assignment) (Ref: R2.2, R3.1)
- [ ] 2.1.4: Assign 6 course colors from palette (Ref: design.md Art Direction)
- [ ] 2.1.5: Output to `src/data/demo.json` with schema: items have `daysOffset: number`, NOT `dueDate` (Ref: R2.2)
- [ ] 2.1.6: Create `src/core/semester.ts` with `resolveSemester(demo, now): Semester` to compute absolute due dates at runtime (Ref: R2.2)
- [ ] 2.1.7: Write unit tests in `src/core/semester.test.ts`: verify date resolution for past/future offsets (Ref: R2.2)
- [ ] 2.1.6: Run script and verify 6 courses, 30+ items, valid JSON (Ref: R2.1)

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
- [ ] 3.1.1: Create `src/game/scenes/BootScene.ts` extending Phaser.Scene (Ref: design.md Scene Flow)
- [ ] 3.1.2: Wait for fonts with `await document.fonts.ready` in BootScene (fonts loaded via <link> in index.html) (Ref: design.md Fonts)
- [ ] 3.1.3: Preload placeholder sprites (1x1 colored rectangles for towers/enemies) (Ref: design.md Procedural Art)
- [ ] 3.1.4: Transition to TitleScene on load complete (Ref: design.md Scene Flow)

### 3.2: Title Scene (Minimal)
- [ ] 3.2.1: Create `src/game/scenes/TitleScene.ts` (Ref: R1.1)
- [ ] 3.2.2: Display logo text "Deadline Defense" with Cinzel font, blood-red color (Ref: R1.1, design.md Art Direction)
- [ ] 3.2.3: Add "Start" button (Phaser Text or DOM element) (Ref: R1.1)
- [ ] 3.2.4: Wire button to transition to BattleScene (skip tutorial for now) (Ref: design.md Scene Flow)
- [ ] 3.2.5: Keyboard navigation: Enter to start (Ref: R1.1)

### 3.3: Battle Scene (Core Loop)
- [ ] 3.3.1: Create `src/game/scenes/BattleScene.ts` (Ref: design.md BattleScene)
- [ ] 3.3.2: Load demo data from `src/data/demo.json` (Ref: R2.1)
- [ ] 3.3.3: Set up 6 horizontal lanes (y-positions for each course) (Ref: design.md BattleScene Layout)
- [ ] 3.3.4: Draw fortress graphic at x=50 (simple rectangle with health bar) (Ref: R1.2)
- [ ] 3.3.5: Initialize game state: `wave=1`, `gold=0`, `fortressHp=100`, `towers=[]`, `enemies=[]` (Ref: design.md Data Models)

### 3.4: Tower Placement
- [ ] 3.4.1: Spawn 6 towers (one per course) at fixed positions (x=200, y per lane) (Ref: R4.1)
- [ ] 3.4.2: Draw tower sprites (colored circles with course color, 20px radius) (Ref: design.md Procedural Art)
- [ ] 3.4.3: Add range circle visual (semi-transparent circle, range=150px) (Ref: R4.1)

### 3.5: Enemy Spawning (Wave 1)
- [ ] 3.5.1: Call `generateWave(semester, 1, new Date())` from `src/core/wave.ts` (Ref: R3.2)
- [ ] 3.5.2: Spawn enemy sprites at x=1200, y per lane (colored rectangles per type) (Ref: R3.1)
- [ ] 3.5.3: Store enemy data in `gameState.enemies` array (Ref: design.md Data Models)

### 3.6: Enemy Movement
- [ ] 3.6.1: In `update()`, move enemies left by `enemy.speed * delta` (Ref: R3.2)
- [ ] 3.6.2: Update `pathProgress = 1 - (x / 1200)` (Ref: design.md Data Models)
- [ ] 3.6.3: If `x < 50`, apply fortress damage and remove enemy (Ref: R3.3)
- [ ] 3.6.4: Display fortress HP in HUD (Ref: R1.2)

### 3.7: Tower Firing
- [ ] 3.7.1: In `update()`, for each tower, call `selectTarget(tower, enemies)` (Ref: R4.3)
- [ ] 3.7.2: If target found and fire rate allows, draw projectile (line or small circle) from tower to target (Ref: R4.1)
- [ ] 3.7.3: Apply damage to enemy HP (Ref: R4.1)
- [ ] 3.7.4: Update `lastFiredAt` timestamp (Ref: design.md Data Models)
- [ ] 3.7.5: If enemy HP ≤ 0, remove sprite and grant +10 gold (Ref: R8.2)

### 3.8: Wave End
- [ ] 3.8.1: Detect when all enemies defeated (Ref: R8.2)
- [ ] 3.8.2: Grant +50 gold bonus, +10% fortress HP regen (Ref: R8.2)
- [ ] 3.8.3: Display "Wave Complete" text (GSAP fade in/out) (Ref: R8.2)
- [ ] 3.8.4: Start next wave after 3s delay (Ref: design.md BattleScene)

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

## Phase 6: Tutorial

### 6.1: Tutorial Scene
- [ ] 6.1.1: Create `src/game/scenes/TutorialScene.ts` (Ref: R7.1)
- [ ] 6.1.2: Spawn 1 weak enemy (assignment, 7 days out, low HP) (Ref: R7.1)
- [ ] 6.1.3: Show overlay tooltip: "This is an enemy. Click to target." (DOM + GSAP) (Ref: R7.1)
- [ ] 6.1.4: Wait for player to click enemy or tower (Ref: R7.1)
- [ ] 6.1.5: Show tooltip: "Press C to open study checkpoint." (Ref: R7.1)
- [ ] 6.1.6: Wait for player to press C (Ref: R7.1)
- [ ] 6.1.7: Show tooltip: "Answer correctly to charge your special attack." (Ref: R7.1)
- [ ] 6.1.8: Wait for player to answer 1 question (Ref: R7.1)
- [ ] 6.1.9: Show tooltip: "Defeat the enemy!" (Ref: R7.1)
- [ ] 6.1.10: When enemy defeated or reaches fortress, end tutorial and transition to BattleScene (Ref: R7.1)

### 6.2: Tutorial Skip & Persistence
- [ ] 6.2.1: Add "Skip Tutorial (Esc)" text to TutorialScene (Ref: R7.1)
- [ ] 6.2.2: On Esc, transition to BattleScene (Ref: R7.1)
- [ ] 6.2.3: Save `tutorialCompleted: true` to localStorage on completion (Ref: R7.1, R10.1)
- [ ] 6.2.4: In TitleScene, check localStorage; if completed, skip tutorial on Start (Ref: R7.1)

### 6.3: Tutorial Timing
- [ ] 6.3.1: Manually playtest: verify tutorial completes in ~60s (Ref: R7.1)
- [ ] 6.3.2: Adjust delays/text if too slow or fast (Ref: R7.1)

---

## Phase 7: Theme Polish

### 7.1: Color Palette Tokens
- [ ] 7.1.1: Create `src/styles/tokens.css` with CSS custom properties for all colors (Ref: design.md Art Direction)
- [ ] 7.1.2: Verify WCAG AA contrast ratios with browser DevTools (Ref: R9.3)
- [ ] 7.1.3: Document palette in README or CREDITS.md (Ref: R12.1)

### 7.2: Title Screen Polish
- [ ] 7.2.1: Add dark gradient background (CSS or Phaser Graphics) (Ref: design.md TitleScene)
- [ ] 7.2.2: Add fog particle emitter (Phaser Particles) (Ref: design.md TitleScene)
- [ ] 7.2.3: Animate logo entrance with GSAP (scale + fade) (Ref: R1.1)
- [ ] 7.2.4: Animate buttons stagger (GSAP timeline) (Ref: design.md TitleScene)
- [ ] 7.2.5: Add background audio loop (Howler, CC0 or synthesised, volume 0.3) (Ref: design.md TitleScene)

### 7.3: Battlefield Visuals
- [ ] 7.3.1: Replace placeholder tower sprites with procedural graphics (Phaser Graphics API: turret shape) (Ref: design.md Procedural Art)
- [ ] 7.3.2: Replace placeholder enemy sprites with type-specific shapes (circles for quiz, rectangles for assignment, large composite for exam) (Ref: R3.1, design.md Procedural Art)
- [ ] 7.3.3: Add neglected glow effect to enemies (Phaser FX pipeline or glow filter) (Ref: R3.4)
- [ ] 7.3.4: Add tombstones/ghosts for past items (SVG data URIs, tinted per course) (Ref: R3.5, R1.2)
- [ ] 7.3.5: Draw lane dividers (subtle lines, low opacity) (Ref: design.md BattleScene Layout)

### 7.4: Audio & SFX
- [ ] 7.4.1: Synthesise tower fire sound with ZzFX (short blip) (Ref: design.md Audio)
- [ ] 7.4.2: Synthesise enemy hit sound (impact) (Ref: design.md Audio)
- [ ] 7.4.3: Synthesise special attack sound (explosion) (Ref: design.md Audio)
- [ ] 7.4.4: Synthesise wave complete sound (victory chime) (Ref: design.md Audio)
- [ ] 7.4.5: Add all sounds to Howler, play on events (Ref: design.md Audio)
- [ ] 7.4.6: Create `CREDITS.md` and list any CC0 assets used (Ref: NFR4)

### 7.5: Animations & Juice
- [ ] 7.5.1: Add particle effect on enemy death (Phaser particles: small explosion) (Ref: R8.2)
- [ ] 7.5.2: Add coin sparkle effect on gold gain (particle or sprite animation) (Ref: R8.2)
- [ ] 7.5.3: Add screen shake on fortress damage (Phaser camera shake, 200ms) (Ref: design.md BattleScene)
- [ ] 7.5.4: Add HP bar above enemies (Phaser Graphics, red/green) (Ref: R3)
- [ ] 7.5.5: Add tower range circle on hover (Phaser Graphics, toggle visibility) (Ref: R4.1)

### 7.6: Reduced Motion Support
- [ ] 7.6.1: Detect `prefers-reduced-motion: reduce` in `src/ui/motion.ts` (Ref: R9.2, design.md Reduced Motion)
- [ ] 7.6.2: Disable GSAP animations (duration=0) if reduced motion (Ref: R9.2)
- [ ] 7.6.3: Disable camera shake if reduced motion (Ref: R9.2)
- [ ] 7.6.4: Reduce particle count by 90% if reduced motion (Ref: R9.2)
- [ ] 7.6.5: Manually test with browser DevTools (emulate prefers-reduced-motion) (Ref: R9.2)

---

## Phase 8: Tower Upgrades

### 8.1: Upgrade UI
- [ ] 8.1.1: Create `src/ui/UpgradePanel.ts` as DOM overlay (Ref: R4.2)
- [ ] 8.1.2: Display when tower clicked: show 3 upgrade paths (Damage, Speed, Range) with costs and current level (Ref: R4.2)
- [ ] 8.1.3: Keyboard shortcut: `U` to open upgrade panel for selected tower (Ref: R9.1)

### 8.2: Upgrade Logic
- [ ] 8.2.1: Create `src/core/upgrades.ts` with `canUpgrade(tower, path, gold): boolean` and `applyUpgrade(tower, path): TowerStats` (Ref: R4.2)
- [ ] 8.2.2: Implement cost/max level checks (Damage/Speed: 50 gold, 3 levels; Range: 75 gold, 2 levels) (Ref: R4.2)
- [ ] 8.2.3: Update tower stats: damage +5, fireRate +0.5, range +50px (Ref: R4.2)
- [ ] 8.2.4: Write unit tests in `src/core/upgrades.test.ts`: verify costs, max levels, stat changes (Ref: R4.2)

### 8.3: Upgrade Integration
- [ ] 8.3.1: Wire upgrade buttons to call `applyUpgrade` and deduct gold (Ref: R4.2)
- [ ] 8.3.2: Update tower visual (larger sprite or brighter color) on upgrade (Ref: R4.2)
- [ ] 8.3.3: Persist upgrades in game state (Ref: R4.2)

---

## Phase 9: Moodle Calendar Import

### 9.1: ICS Parser
- [ ] 9.1.1: Install `ical.js` (npm package) (Ref: design.md Import Modules)
- [ ] 8.1.2: Create `src/import/ics.ts` with `parseICS(icsText): ICSEvent[]` (Ref: design.md ICS Parser, R6.1)
- [ ] 8.1.3: Implement `inferItemType(summary): ItemType` with regex (Ref: design.md ICS Parser, R6.2)
- [ ] 8.1.4: Implement `extractCourseId(summary, categories): CourseId` (Ref: design.md ICS Parser, R6.2)
- [ ] 8.1.5: Write unit tests in `src/import/ics.test.ts`: verify parsing with sample .ics file (Ref: R6.1)

### 8.2: Import UI
- [ ] 8.2.1: Add "Import Moodle Calendar" button to TitleScene (Ref: R6.1)
- [ ] 8.2.2: Create file input (type=file, accept=.ics) in `src/ui/ImportPanel.ts` (Ref: R6.1)
- [ ] 8.2.3: On file selected, read with FileReader, call `parseICS` (Ref: R6.1)
- [ ] 8.2.4: Convert ICSEvent[] to Semester data (merge or replace demo) (Ref: R6.1)
- [ ] 8.2.5: Handle parsing errors with user-friendly message (Ref: R6.1, R6.3)
- [ ] 8.2.6: Store imported data in localStorage (Ref: R6.1)

### 8.3: Import Integration
- [ ] 8.3.1: In BattleScene, check localStorage for imported data before loading demo (Ref: R6.1)
- [ ] 8.3.2: Manually test with real Moodle .ics export (Ref: R6.1)
- [ ] 8.3.3: Verify no backend requests in browser DevTools Network tab (Ref: R6.3)

---

## Phase 10: PDF Question Generator (Optional)

### 10.1: PDF Text Extraction
- [ ] 10.1.1: Create `src/import/pdf.ts` with `extractText(file): Promise<string>` (Ref: design.md PDF Question Generator, R5.5)
- [ ] 9.1.2: Configure pdf.js worker path (`public/pdf.worker.min.js`) (Ref: design.md PDF Question Generator)
- [ ] 9.1.3: Write unit tests with sample PDF (Ref: R5.5)

### 9.2: Cloze Question Generation
- [ ] 9.2.1: Implement `generateClozeQuestions(text, count): CheckpointQuestion[]` (Ref: design.md PDF Question Generator, R5.5)
- [ ] 9.2.2: Extract sentences with capitalized nouns (simple heuristic) (Ref: R5.5)
- [ ] 9.2.3: Blank one term per sentence, generate 3 distractors (Ref: R5.5)
- [ ] 9.2.4: Write unit tests: verify generated questions are valid (Ref: R5.5)

### 9.3: PDF Import UI
- [ ] 9.3.1: Add "Upload PDF" button to CheckpointPanel (Ref: R5.5)
- [ ] 9.3.2: On file selected, call `extractText` → `generateClozeQuestions` (Ref: R5.5)
- [ ] 9.3.3: Add generated questions to available pool (Ref: R5.5)
- [ ] 9.3.4: Handle errors with fallback message (Ref: R5.5)
- [ ] 9.3.5: Verify <5s processing time for 50-page PDF (Ref: R5.5)

---

## Phase 11: Persistence

### 11.1: Save System
- [ ] 11.1.1: Create `src/save/save.ts` with `save(state, settings): void` and `load(): SaveData | null` (Ref: design.md Persistence, R10.1)
- [ ] 10.1.2: Implement versioning (CURRENT_VERSION = "1.0.0") (Ref: R10.1)
- [ ] 10.1.3: Wrap all localStorage calls in try/catch (Ref: R10.1)
- [ ] 10.1.4: Write unit tests in `src/save/save.test.ts`: save/load/migrate (Ref: R10.1)

### 10.2: Auto-Save Triggers
- [ ] 10.2.1: Call `save()` after each wave end (Ref: R10.2)
- [ ] 10.2.2: Call `save()` after answering a checkpoint (Ref: R10.2)
- [ ] 10.2.3: Call `save()` after upgrading a tower (Ref: R10.2)
- [ ] 10.2.4: Call `save()` on page visibility change (window blur) (Ref: R10.2)
- [ ] 10.2.5: Verify saves are synchronous (no race conditions) (Ref: R10.2)

### 10.3: Load on Boot
- [ ] 10.3.1: In TitleScene, call `load()` and populate game state if save exists (Ref: R10.1)
- [ ] 10.3.2: Show "Continue" button if save found (Ref: R1.1)
- [ ] 10.3.3: Handle version mismatch: discard old saves with user warning (Ref: R10.1)

---

## Phase 12: Accessibility

### 12.1: Keyboard Controls
- [ ] 12.1.1: Implement all keyboard shortcuts in `src/ui/keyboard.ts`: C, Esc, Space, M, 1-4, Tab, Enter, Arrows (Ref: R9.1, design.md Keyboard Navigation)
- [ ] 11.1.2: Add focus indicators (2px outline) to all interactive elements (Ref: R9.1, design.md Focus Indicators)
- [ ] 11.1.3: Verify Tab cycles through towers (Ref: R9.1)
- [ ] 11.1.4: Manually test with keyboard only (no mouse) (Ref: R9.1)

### 11.2: Mute Toggle
- [ ] 11.2.1: Add mute button to HUD (Ref: R9.5)
- [ ] 11.2.2: Listen for `M` key, toggle Howler mute (Ref: R9.5)
- [ ] 11.2.3: Show muted icon when active (Ref: R9.5)
- [ ] 11.2.4: Persist mute state in localStorage (Ref: R9.5)

### 11.3: Visual Captions
- [ ] 11.3.1: Implement `showCaption(text)` in `src/ui/captions.ts` (Ref: design.md Visual Captions, R9.4)
- [ ] 11.3.2: Call on events: tower fires, special attack, wave complete (Ref: R9.4)
- [ ] 11.3.3: Manually test with audio muted (Ref: R9.4)

### 11.4: Contrast Check
- [ ] 11.4.1: Use browser DevTools to verify all text has ≥4.5:1 contrast (Ref: R9.3)
- [ ] 11.4.2: Use browser DevTools to verify all UI elements have ≥3:1 contrast (Ref: R9.3)
- [ ] 11.4.3: Adjust colors in `tokens.css` if needed (Ref: R9.3)

---

## Phase 13: Moodle Block & LMS Showcase

### 13.1: Moodle Block Plugin Structure
- [ ] 13.1.1: Create `moodle/block_gradedefense/version.php` with plugin metadata (Ref: R14.1)
- [ ] 13.1.2: Create `moodle/block_gradedefense/block_gradedefense.php` extending `block_base` (Ref: R14.1)
- [ ] 13.1.3: Create `moodle/block_gradedefense/lang/en/block_gradedefense.php` with strings (Ref: R14.1)
- [ ] 13.1.4: Create `moodle/block_gradedefense/styles.css` for iframe styling (Ref: R14.1)
- [ ] 13.1.5: Verify plugin structure matches Moodle 4.5 standards (Ref: R14.1)

### 13.2: Moodle Calendar Data Integration
- [ ] 13.2.1: In `block_gradedefense.php`, fetch user calendar events via `core_calendar_get_calendar_upcoming_view` (Ref: R14.2)
- [ ] 13.2.2: Transform Moodle events to game JSON schema (name, courseId, dueDate, points, type) (Ref: R14.2)
- [ ] 13.2.3: Embed game iframe with deployed URL (Ref: R14.2)
- [ ] 13.2.4: Send JSON payload via postMessage after iframe load (Ref: R14.2)
- [ ] 13.2.5: Document postMessage contract in `docs/moodle-integration.md` (Ref: R14.2)

### 13.3: Game postMessage Handler
- [ ] 13.3.1: Create `src/import/postmessage.ts` with message handler (Ref: R14.2)
- [ ] 13.3.2: Implement schema validation (TypeScript type guard) (Ref: R14.2)
- [ ] 13.3.3: Implement origin check with configurable allowlist (Ref: R14.2, R14.4)
- [ ] 13.3.4: On valid message, replace demo data with Moodle data (Ref: R14.2)
- [ ] 13.3.5: On invalid message, log error and fall back to demo (Ref: R14.2)
- [ ] 13.3.6: Write unit tests in `src/import/postmessage.test.ts`: verify validation, origin check (Ref: R14.2)

### 13.4: LMS Showcase Page
- [ ] 13.4.1: Create `showcase/lms.html` with generic LMS dashboard layout (Ref: R14.3)
- [ ] 13.4.2: Embed game iframe styled as a block (Ref: R14.3)
- [ ] 13.4.3: Load `src/data/demo.json` and send via postMessage (same contract as Moodle) (Ref: R14.3)
- [ ] 13.4.4: Use generic branding ("My Learning Portal"), NO Moodle trademarks (Ref: R14.3)
- [ ] 13.4.5: Verify postMessage integration works identically to real block (Ref: R14.3)

### 13.5: Security Review
- [ ] 13.5.1: Code review: confirm no tokens in URLs or postMessage payloads (Ref: R14.4)
- [ ] 13.5.2: Code review: confirm no PII stored in localStorage (Ref: R14.4)
- [ ] 13.5.3: Code review: confirm no client-side Moodle API calls (Ref: R14.4)
- [ ] 13.5.4: Manually test with malformed postMessage (verify graceful handling) (Ref: R14.2)
- [ ] 13.5.5: Manually test with untrusted origin (verify rejection) (Ref: R14.2)

---

## Phase 14: Build & Smoke Tests

### 14.1: Build Configuration
- [ ] 14.1.1: Verify `vite.config.ts` base path is set for production (Ref: R11.2, design.md Build Configuration)
- [ ] 12.1.2: Run `npm run build` and verify output in `dist/` (Ref: R11.1)
- [ ] 12.1.3: Verify build has zero TypeScript errors (Ref: NFR3)
- [ ] 12.1.4: Verify output is <10 MB uncompressed (Ref: R11.1)
- [ ] 12.1.5: Test locally with `npx vite preview` at sub-path (Ref: R11.2)

### 12.2: Playwright Smoke Tests
- [ ] 12.2.1: Create `tests/e2e/smoke.spec.ts` (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.2: Test: game boots without console errors (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.3: Test: first wave starts (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.4: Test: checkpoint panel opens (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.5: Test: mute toggle works (Ref: design.md Playwright Smoke Tests)
- [ ] 12.2.6: Run `npx playwright test` and verify all pass (Ref: NFR3)

### 12.3: Performance Verification
- [ ] 12.3.1: Run game with 20 enemies on screen, verify 60 FPS in browser DevTools (Ref: NFR2)
- [ ] 12.3.2: Measure checkpoint answer latency (<100ms) (Ref: NFR2)
- [ ] 12.3.3: Measure build time (<30s) (Ref: NFR2)

---

## Phase 15: Kiro Hooks

### 15.1: Post-Save Hook for Core Tests
- [ ] 15.1.1: Create `.kiro/hooks/post-save.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.1.2: Add logic: if file in `src/core/`, run `npm run test:core` (Ref: design.md Kiro Hooks)
- [ ] 13.1.3: Make executable: `chmod +x .kiro/hooks/post-save.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.1.4: Test by editing a file in `src/core/` and saving (Ref: design.md Kiro Hooks)

### 13.2: Pre-Commit Hook for Full Test Suite
- [ ] 13.2.1: Create `.kiro/hooks/pre-commit.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.2.2: Add logic: run `npm run build`, `npm run test`, `npx playwright test` (Ref: design.md Kiro Hooks)
- [ ] 13.2.3: Make executable: `chmod +x .kiro/hooks/pre-commit.sh` (Ref: design.md Kiro Hooks)
- [ ] 13.2.4: Test by committing a change (Ref: design.md Kiro Hooks)

---

## Phase 16: Final Polish & Documentation

### 16.1: README.md
- [ ] 16.1.1: Write README with project description, features, demo link, local setup instructions (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.1.2: Add screenshot/GIF of gameplay (Ref: HACKATHON_STRATEGY.md Presentation)
- [ ] 14.1.3: Add license badge (MIT) (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

### 14.2: CREDITS.md
- [ ] 14.2.1: List all third-party assets (CC0, CC-BY) with links and licenses (Ref: NFR4)
- [ ] 14.2.2: List fonts (Cinzel, Inter, Creepster with OFL license) (Ref: NFR4)
- [ ] 14.2.3: List any CC0 audio if used (Ref: NFR4)

### 14.3: KIRO_USAGE.md
- [ ] 14.3.1: Document how Kiro was used: specs, steering, hooks, agents, CLI/IDE (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.3.2: Be honest about what worked and what didn't (Ref: HACKATHON_STRATEGY.md Technological Implementation)

### 14.4: Demo Video Script
- [ ] 14.4.1: Write script (<3 min): hook (10s), Moodle import demo, live combat, checkpoint answer, special attack, Kiro workflow segment (Ref: HACKATHON_STRATEGY.md Presentation)
- [ ] 14.4.2: Record screen capture (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.4.3: Edit with no copyrighted music (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.4.4: Upload to YouTube as unlisted (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

### 14.5: External Playtesting
- [ ] 14.5.1: Recruit 2 external users for 5-min playtest (Ref: R12.2)
- [ ] 14.5.2: Collect feedback on polish, bugs, confusion (Ref: R12.2)
- [ ] 14.5.3: Fix critical bugs identified (Ref: R12.2)

### 14.6: Deployment
- [ ] 14.6.1: Deploy `dist/` to GitHub Pages (Ref: R11.2)
- [ ] 14.6.2: Verify live URL works with no 404s (Ref: R11.2)
- [ ] 14.6.3: Test on 3 browsers: Chrome, Firefox, Safari (Ref: NFR1)

### 14.7: Final Verification
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
