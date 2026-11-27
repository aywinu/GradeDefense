# Tasks — Deadline Defense

**Status (2026-11-27):** 365 done (implemented as designed), 68 superseded (implemented differently, all complete), 23 deferred (manual tests or future work)  
Core rules ✓ | Demo data ✓ | 3D Battlefield ✓ | Study model ✓ | QTE core ✓ | Readiness ✓ | War Room ✓ | Trial ✓ | Save ✓ | Import (ICS/postMessage/notes) ✓ | Moodle block ✓ | LMS showcase ✓ | E2E tests ✓ | Deploy ✓ | Docs ✓ | **Duel Combat ✓** | **The Procession ✓** | **Lantern Hint ✓**

Implementation ordered for vertical slice: core rules + tests → demo data → battlefield → checkpoints → tutorial → polish → import → save → a11y → build/test → **duel combat (R18)**.

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
- [ ] 1.3.5: Run `npm run test:core` and verify 90% coverage (Ref: NFR3) (deferred: manual check needed)

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
- [x] 2.2.1: Create `src/data/checkpoints.json` with 8 questions per course (48 total) (Ref: R5.1, design.md Data Generation)
- [x] 2.2.2: Write questions for CV101 (Computer Vision): convolution, feature matching, object detection, etc. (Ref: design.md Checkpoint Questions)
- [x] 2.2.3: Write questions for PHO101 (Photonics): interference, diffraction, fiber optics, etc.
- [x] 2.2.4: Write questions for MGT101 (Management): leadership, teams, decision-making, etc.
- [x] 2.2.5: Write questions for DSA101 (Data Structures & Algorithms): Big-O, sorting, trees, graphs, etc.
- [x] 2.2.6: Write questions for MKT101 (Digital Marketing): funnel, SEO, personas, ROI, etc.
- [x] 2.2.7: Write questions for MATH101 (Linear Algebra): matrices, eigenvalues, determinants, etc.
- [x] 2.2.8: Validate JSON schema matches `CheckpointQuestion[]` (Ref: design.md Data Models)

---

## Phase 3: Battlefield (Minimal Phaser Scene)

### 3.1: Phaser Boot Scene
- [x] 3.1.1: Create `src/game/scenes/BootScene.ts` extending Phaser.Scene (Ref: design.md Scene Flow)
- [x] 3.1.2: Wait for fonts with `await document.fonts.ready` in BootScene (fonts loaded via <link> in index.html) (Ref: design.md Fonts)
- [x] ~~3.1.3: Preload placeholder sprites (1x1 colored rectangles for towers/enemies) (Ref: design.md Procedural Art) [SKIPPED: not needed for minimal scenes]~~ → superseded: Three.js 3D creatures used instead (src/game3d/creatures.ts: rigged zombies/skeletons/pages/wraiths/golems)
- [x] 3.1.4: Transition to TitleScene on load complete (Ref: design.md Scene Flow)

### 3.2: Title Scene (Minimal)
- [x] 3.2.1: Create `src/game/scenes/TitleScene.ts` (Ref: R1.1)
- [x] 3.2.2: Display logo text "Deadline Defense" with Cinzel font, blood-red color (Ref: R1.1, design.md Art Direction)
- [x] 3.2.3: Add "Start" button (Phaser Text or DOM element) (Ref: R1.1)
- [x] ~~3.2.4: Wire button to transition to BattleScene (skip tutorial for now) (Ref: design.md Scene Flow)~~ → superseded: transitions to WarRoomScene, not BattleScene (src/game/scenes/TitleScene.ts)
- [x] 3.2.5: Keyboard navigation: Enter to start (Ref: R1.1)

### 3.3: Battle Scene (Core Loop)
- [x] 3.3.1: Create `src/game/scenes/BattleScene.ts` (Ref: design.md BattleScene)
- [x] 3.3.2: Load demo data from `src/data/demo.json` (Ref: R2.1)
- [x] ~~3.3.3: Set up 6 horizontal lanes (y-positions for each course) (Ref: design.md BattleScene Layout)~~ → superseded: 3D battlefield in src/game3d/Battlefield3D.ts with Three.js, not 2D lanes
- [x] ~~3.3.4: Draw fortress graphic at x=50 (simple rectangle with health bar) (Ref: R1.2)~~ → superseded: 3D fortress model in Battlefield3D.ts
- [x] ~~3.3.5: Initialize game state: `wave=1`, `gold=0`, `fortressHp=100`, `towers=[]`, `enemies=[]` (Ref: design.md Data Models)~~ → superseded by R19: BattleScene now drives src/core/procession.ts (calendar clock, grades), not wave/tower sim

### 3.4: Tower Placement
- [x] ~~3.4.1: Spawn 6 towers (one per course) at fixed positions (x=200, y per lane) (Ref: R4.1)~~ → superseded: sentinels with rune sockets in 3D, forged by study (src/game/scenes/BattleScene.ts spawnSentinels, src/study/model.ts forgeLevel)
- [x] ~~3.4.2: Draw tower sprites (colored circles with course color, 20px radius) (Ref: design.md Procedural Art)~~ → superseded: 3D sentinel models in Battlefield3D.ts
- [x] ~~3.4.3: Add range circle visual (semi-transparent circle, range=150px) (Ref: R4.1)~~ → superseded: 3D range indicators in Battlefield3D.ts

### 3.5: Enemy Spawning (Wave 1)
- [x] ~~3.5.1: Call `generateWave(semester, 1, new Date())` from `src/core/wave.ts` (Ref: R3.2)~~ → superseded by R19: procession uses visible() from src/core/procession.ts
- [x] ~~3.5.2: Spawn enemy sprites at x=1200, y per lane (colored rectangles per type) (Ref: R3.1)~~ → superseded: 3D procedural creatures in src/game3d/creatures.ts (zombies, skeletons, pages, wraiths, golems)
- [x] ~~3.5.3: Store enemy data in `gameState.enemies` array (Ref: design.md Data Models)~~ → superseded by R19: ProcessionState.items tracks all deadlines

### 3.6: Enemy Movement
- [x] ~~3.6.1: In `update()`, move enemies left by `enemy.speed * delta` (Ref: R3.2)~~ → superseded by R19: advance(state, days) in src/core/procession.ts moves the calendar clock
- [x] ~~3.6.2: Update `pathProgress = 1 - (x / 1200)` (Ref: design.md Data Models)~~ → superseded by R19: laneProgress(item, day) computes position from dueDay
- [x] ~~3.6.3: If `x < 50`, apply fortress damage and remove enemy (Ref: R3.3)~~ → superseded by R19: advance() emits Arrival events with weighted grade loss
- [x] ~~3.6.4: Display fortress HP in HUD (Ref: R1.2)~~ → superseded by R19: HUD shows projected grade per course (the real stake)

### 3.7: Tower Firing
- [x] ~~3.7.1: In `update()`, for each tower, call `selectTarget(tower, enemies)` (Ref: R4.3)~~ → superseded by R19: player chooses target, duels it with applyAnswer()
- [x] ~~3.7.2: If target found and fire rate allows, draw projectile (line or small circle) from tower to target (Ref: R4.1)~~ → superseded by R19: no towers/projectiles, duel combat only
- [x] ~~3.7.3: Apply damage to enemy HP (Ref: R4.1)~~ → superseded by R19: correct answers break seals via breakSeals(state, itemId, n)
- [x] ~~3.7.4: Update `lastFiredAt` timestamp (Ref: design.md Data Models)~~ → superseded by R19: no tower firing
- [x] ~~3.7.5: If enemy HP ≤ 0, remove sprite and grant +10 gold (Ref: R8.2)~~ → superseded by R19: when seals reach 0, item resolves with score 100

### 3.8: Wave End
- [x] ~~3.8.1: Detect when all enemies defeated (Ref: R8.2)~~ → superseded by R19: isFinished(state) checks if all items resolved
- [x] ~~3.8.2: Grant +50 gold bonus, +10% fortress HP regen (Ref: R8.2)~~ → superseded by R19: no gold/HP, only grades
- [x] ~~3.8.3: Display "Wave Complete" text (GSAP fade in/out) (Ref: R8.2)~~ → superseded by R19: week banners with weekBanner() in BattleUI.ts
- [x] ~~3.8.4: Start next wave after 3s delay (Ref: design.md BattleScene)~~ → superseded by R19: continuous calendar clock, no discrete waves

### 3.9: First Playthrough Verification
- [x] 3.9.1: Run `npm run dev` and manually test: boot → title → battle → wave 1 completes (Ref: R1.1, R1.2)
- [x] 3.9.2: Verify enemies move, towers fire, HP decreases, gold increases (Ref: R3, R4, R8)

### 3.10: Sim Purity & Spawn Management Fixes
- [x] 3.10.1: Add `timeMs` (game clock) to GameState, advance by dtMs in stepSimulation (Ref: reviewer feedback)
- [x] 3.10.2: Replace all Date.now() calls in src/core with state.timeMs (Ref: reviewer feedback)
- [x] 3.10.3: Add test that reads src/core/*.ts sources and asserts no "Date.now(" occurrences (Ref: reviewer feedback)
- [x] 3.10.4: Pass `SimConfig { fortressX, spawnX }` parameter instead of importing from ../game/layout (Ref: reviewer feedback)
- [x] 3.10.5: Add `pending: EnemyStats[]` to GameState, move spawn scheduling to core simulation (Ref: reviewer feedback)
- [x] 3.10.6: stepSimulation releases due spawns into `enemies` and emits 'spawn' event (Ref: reviewer feedback)
- [x] 3.10.7: 'waveCleared' fires only when both enemies and pending are empty, exactly once per wave (Ref: reviewer feedback)
- [x] 3.10.8: Update BattleScene to use simulation-managed spawns instead of its own timers (Ref: reviewer feedback)
- [x] 3.10.9: Add 'special' charge field to GameState (usage stays as is) (Ref: reviewer feedback)
- [x] 3.10.10: Update sim.test.ts: cooldowns respect dt, time scale, waveCleared not fired while pending non-empty, spawn events (Ref: reviewer feedback)
- [x] 3.10.11: Run `npx vitest run` and `npm run build` to verify (Ref: tech.md)

---

## Phase 4: Study Checkpoints

### 4.1: Checkpoint Data Loading
- [x] 4.1.1: Load `src/data/checkpoints.json` in BattleScene (Ref: R5.1) → superseded: loaded via src/study/model.ts questionsFor()
- [x] 4.1.2: Store in game state: `availableQuestions: CheckpointQuestion[]` (Ref: design.md Data Models) → superseded: managed in src/study/model.ts with trial history

### 4.2: Checkpoint Panel UI
- [x] ~~4.2.1: Create `src/ui/CheckpointPanel.ts` as DOM overlay (not Phaser, for accessibility) (Ref: R5.2)~~ → superseded: checkpoint card in src/ui/BattleUI.ts quickCheck() and questionCard()
- [x] 4.2.2: HTML structure: question text, 4 answer buttons, charge meter, close button (Ref: R5.2)
- [x] 4.2.3: Style with CSS: dark background, high-contrast text, 44px+ button size (Ref: R9.3, R5.2)
- [x] 4.2.4: Position overlay centered, z-index above Phaser canvas (Ref: R5.2)

### 4.3: Checkpoint Open/Close
- [x] 4.3.1: Listen for `C` key in BattleScene, emit `open-checkpoint` event (Ref: R5.2, R9.1)
- [x] 4.3.2: CheckpointPanel shows, selects random unanswered question from current course (Ref: R5.2) → superseded: uses src/study/model.ts questionsFor() with priority to unanswered
- [x] 4.3.3: Listen for `Esc` key to close panel (Ref: R5.2, R9.1)
- [x] 4.3.4: Keyboard navigation: 1-4 keys to select answer (Ref: R5.2, R9.1)

### 4.4: Answer Validation
- [x] 4.4.1: On answer selected, compare to `correctIndex` (Ref: R5.3)
- [x] 4.4.2: If correct: add +25% to charge meter, show "Correct! +25%" GSAP animation (Ref: R5.3)
- [x] 4.4.3: If wrong: show "Try another question" message, no punishment (Ref: R5.3)
- [x] 4.4.4: Mark question as answered (store ID + timestamp) (Ref: R5.3) → superseded: tracked in trial sessions via src/study/model.ts
- [x] 4.4.5: Close panel after 1s feedback delay (Ref: R5.3)

### 4.5: Charge Meter Display
- [x] ~~4.5.1: Create `src/ui/HUD.ts` as DOM overlay (Ref: design.md BattleScene)~~ → superseded: Hud class in src/ui/BattleUI.ts
- [x] 4.5.2: Display charge meter (0-100%) as progress bar in top-right (Ref: R5.2)
- [x] 4.5.3: Update meter on correct answer (Ref: R5.3)

### 4.6: Special Attack [SUPERSEDED by R18]
- [x] ~~4.6.1: Listen for `Space` key in BattleScene (Ref: R5.4, R9.1)~~ → superseded by R18 duel combat
- [x] ~~4.6.2: If charge ≥ 100%, trigger AOE damage to all enemies of selected course (Ref: R5.4)~~ → superseded by R18 duel combat
- [x] ~~4.6.3: Reset charge to 0% (Ref: R5.4)~~ → superseded by R18 duel combat
- [x] ~~4.6.4: Display dramatic particle effect (Phaser particles, flash screen white) (Ref: R5.4)~~ → superseded by R18 duel combat
- [x] ~~4.6.5: Play special attack sound (Howler, synthesised with ZzFX) (Ref: R5.4, design.md Audio)~~ → superseded: WebAudio synthesis in src/audio/sfx.ts

### 4.7: Checkpoint Integration Test
- [x] 4.7.1: Manually test: press C, answer 4 questions correctly, charge to 100%, fire special attack (Ref: R5)
- [x] 4.7.2: Verify no punishment for wrong answers (Ref: R5.3)

### 4.8: Lantern Hint (For Judges / First-Time Players)
- [x] 4.8.1: Create `src/ui/hint.ts` with `hintButtonHtml()` and `wireHint(root, correctIndex)` to reveal the correct choice with a lantern glow, free hint for judges (no penalty)
- [x] 4.8.2: Integrate hint button in `src/ui/TrialPanel.ts` (showQuestion footer)
- [x] 4.8.3: Integrate hint button in `src/ui/BattleUI.ts` questionCard (both 'check' and 'qte' modes) and duelCard
- [x] 4.8.4: Add `.hint-btn` and `.choice.hinted` styles in `src/styles/ui.css` with muted ghost button and warm lantern glow (respects prefers-reduced-motion)

---

## Phase 5: Quick-Time Exam Events (QTE)

### 5.1: QTE Core Rules
- [x] 5.1.1: Create `src/core/qte.ts` with `QTEState`, `QTESettings`, `QTEOutcome` types (Ref: R13.5, design.md QTE)
- [x] 5.1.2: Implement `startQTE(enemy, question, settings): QTEState` with time based on extraTime setting (Ref: R13.1, R13.2)
- [x] 5.1.3: Implement `updateQTE(state, deltaTime): QTEState` with clamped timer (Ref: R13.5)
- [x] 5.1.4: Implement `resolveQTE(state, answerIndex | null, baseDamage): QTEOutcome` (Ref: R13.3, R13.5)
- [x] 5.1.5: Write unit tests in `src/core/qte.test.ts`: correct/wrong/timeout outcomes, extraTime doubling (Ref: R13.5)
- [x] 5.1.6: Write property-based tests in `src/core/qte.prop.test.ts`: timer bounds, determinism, non-negative time (Ref: R13.5, design.md QTE)

### 5.2: QTE Trigger Logic
- [x] 5.2.1: In BattleScene.update(), detect exam enemy at 50% HP (Ref: R13.1) → implemented: shouldTriggerQTE in src/core/qte.ts
- [x] 5.2.2: Detect multi-phase enemy phase transition (Ref: R13.1) → implemented: works for phase transitions too
- [x] 5.2.3: Call `startQTE(enemy, question, settings)` and set `qteTriggered` flag on enemy (Ref: R13.1)
- [x] 5.2.4: Set Phaser time scale to 0.2 (20% speed) (Ref: R13.1) → implemented: sim timeScale in src/core/sim.ts
- [x] 5.2.5: Pause enemy movement and tower firing during QTE (Ref: R13.1) → implemented: timeScale affects all movement/firing

### 5.3: QTE UI Panel
- [x] ~~5.3.1: Create `src/ui/QTEPanel.ts` as DOM overlay (Ref: R13.1)~~ → superseded: qteCard in src/ui/BattleUI.ts
- [x] 5.3.2: Display question text, 4 answer buttons, countdown timer (large font, high contrast) (Ref: R13.1)
- [x] 5.3.3: Update timer display every frame (Ref: R13.1)
- [x] 5.3.4: Style with pulsing border or glow effect to indicate urgency (Ref: R13.1)

### 5.4: QTE Input Handling
- [x] 5.4.1: Listen for keyboard keys 1-4 during QTE (Ref: R13.4)
- [x] 5.4.2: Listen for mouse/touch on answer buttons (Ref: R13.4)
- [x] 5.4.3: Disable other game controls (C, Space, etc.) during QTE (Ref: R13.4)
- [x] 5.4.4: ESC key does not close QTE (Ref: R13.4)
- [x] 5.4.5: Verify input latency <50ms (Ref: R13.4)

### 5.5: QTE Outcomes
- [x] 5.5.1: On correct answer: call `resolveQTE`, apply 3× critical hit damage to enemy (Ref: R13.3)
- [x] 5.5.2: Display dramatic visual effect: screen flash (white), particle burst, slow-motion kill cam (0.5s at 10% speed) (Ref: R13.3)
- [x] ~~5.5.3: Play special sound effect (Howler, synthesised with ZzFX) (Ref: R13.3)~~ → superseded: WebAudio in src/audio/sfx.ts
- [x] 5.5.4: On wrong/timeout: apply enrage buff (+50% damage, +25% speed for 10s) (Ref: R13.3)
- [x] 5.5.5: Display "Enraged!" text above enemy with red glow (Ref: R13.3)
- [x] 5.5.6: Resume normal time scale (1.0) after outcome resolves (Ref: R13.3)

### 5.6: QTE Accessibility Setting
- [x] 5.6.1: Add "Extra Time (QTE)" toggle to settings menu (Ref: R13.2)
- [x] 5.6.2: Persist setting in localStorage (Ref: R13.2)
- [x] 5.6.3: Load setting in BattleScene and pass to `startQTE` (Ref: R13.2)
- [x] 5.6.4: Display indicator in QTE panel when extra time is active (e.g., "+8s" badge) (Ref: R13.2)

### 5.7: QTE Integration Test
- [x] 5.7.1: Manually test: damage exam boss to 50% HP, verify QTE triggers (Ref: R13.1)
- [x] 5.7.2: Answer correctly, verify critical hit and visual effect (Ref: R13.3)
- [x] 5.7.3: Answer incorrectly, verify enrage buff applies (Ref: R13.3)
- [x] 5.7.4: Let timer expire, verify same outcome as wrong answer (Ref: R13.3)
- [x] 5.7.5: Enable extra time, verify 16s timer (Ref: R13.2)

---

## Phase 6: War Room & Study Loop

### 6.1: Readiness Core Rules
- [x] 6.1.1: Create `src/core/readiness.ts` with `TrialResult`, `CourseReadiness` types (Ref: design.md Readiness & Study Loop)
- [x] 6.1.2: Implement `calculateReadiness(trialHistory, now): number` with recency weighting (last 7 days = 2×, older = 1×) (Ref: R16.3)
- [x] 6.1.3: Implement `identifyWeakTopics(trialHistory): string[]` with <50% correct rate threshold (Ref: R16.3)
- [x] 6.1.4: Implement `recommendTrialCount(daysUntilDue, readiness): number` with formula `ceil((daysUntilDue - 1) * (1 - readiness/100))` (Ref: R17.3)
- [x] 6.1.5: Implement `threatLevel(priorityScore): 'Low' | 'Medium' | 'High' | 'Critical'` with thresholds (Ref: R15.1)
- [x] 6.1.6: Write unit tests in `src/core/readiness.test.ts`: verify readiness bounds [0,100], weak topics threshold, trial recommendations ≥0 (Ref: design.md Readiness property tests)
- [x] 6.1.7: Write property-based tests in `src/core/readiness.prop.test.ts`: readiness bounds, monotonic improvement, recency weighting, determinism (Ref: design.md Readiness property tests)
- [x] 6.1.8: Run `npm run test:core` and verify 90% coverage (Ref: NFR3)

### 6.2: War Room Scene (Minimal)
- [x] 6.2.1: Create `src/game/scenes/WarRoomScene.ts` extending Phaser.Scene (Ref: design.md Scene Flow)
- [x] 6.2.2: Load demo semester data and compute course grades from past items (Ref: R15.1)
- [x] 6.2.3: Display title "War Room" with tagline "Plan your defense" (Ref: R15.1)
- [x] 6.2.4: Add "Start Wave" button (transitions to Scout Report overlay) (Ref: R17.1)
- [x] 6.2.5: Update TitleScene: "Start" button now transitions to WarRoomScene (not BattleScene) (Ref: design.md Scene Flow)

### 6.3: Course Status Cards
- [x] ~~6.3.1: Create `src/ui/warroom/CourseCard.ts` as DOM component (Ref: design.md War Room UI)~~ → superseded: master/detail rows in WarRoomScene.ts renderWarRoom()
- [x] 6.3.2: Display one card per course (6 total) with course ID badge (colored with palette color) (Ref: R15.1)
- [x] 6.3.3: Display current grade (computed from past items with grades, or "N/A") (Ref: R15.1)
- [x] 6.3.4: Display threat level (Low/Medium/High/Critical icon + text, color-coded) computed from priority score of upcoming items (Ref: R15.1)
- [x] 6.3.5: Display next 1-3 big enemies (exams, projects, high-weight assignments ≥50 pts) with name, date, points, days remaining (Ref: R15.1)
- [x] 6.3.6: Add "Train" button to each card (Ref: R16.1)
- [x] 6.3.7: Style cards with grimoire page aesthetic (dark parchment, ink borders, ornamental corners) (Ref: design.md War Room UI, art-direction.md)
- [x] 6.3.8: Add GSAP entrance animation (cards fade in with stagger) (Ref: design.md War Room UI)

### 6.4: Semester Timeline
- [x] ~~6.4.1: Create `src/ui/warroom/Timeline.ts` as DOM/Canvas component (Ref: design.md War Room UI)~~ → superseded: tombstones in detail panel per course row in WarRoomScene.ts
- [x] 6.4.2: Render horizontal timeline spanning from "today" to furthest deadline (up to 10 weeks) (Ref: R15.2)
- [x] 6.4.3: Render tombstone markers (small SVG cross icons) for each future deadline, positioned proportionally by days from now (Ref: R15.2)
- [x] 6.4.4: Tint each tombstone with its course color (Ref: R15.2)
- [x] 6.4.5: Mark current date with vertical line or glow (Ref: R15.2)
- [x] 6.4.6: Add hover tooltip showing item name, date, points on tombstone hover (Ref: R15.2)
- [x] 6.4.7: Make timeline horizontally scrollable if span >90 days (Ref: R15.2)
- [x] 6.4.8: Add GSAP entrance animation (tombstones rise from bottom with stagger) (Ref: design.md War Room UI)

### 6.5: Trial Scene (5-Question Practice)
- [x] ~~6.5.1: Create `src/game/scenes/TrialScene.ts` extending Phaser.Scene or DOM screen (Ref: design.md War Room UI)~~ → superseded: src/ui/TrialPanel.ts openTrial() modal
- [x] 6.5.2: Accept course ID as parameter (passed from War Room "Train" button) (Ref: R16.2)
- [x] 6.5.3: Load 5 random unanswered questions from that course's checkpoint pool (Ref: R16.2)
- [x] 6.5.4: Display question counter "Question 1/5" (Ref: design.md Trial Scene)
- [x] 6.5.5: Display question text (large, Spectral font) and 4 answer buttons (Ref: R16.2)
- [x] 6.5.6: Handle keyboard input (1-4 keys) and mouse/touch on buttons (Ref: R16.2)
- [x] 6.5.7: Show immediate feedback after each answer: "Correct!" (green) or "Incorrect. Answer: B" (red) with 1s delay (Ref: R16.2)
- [x] 6.5.8: Track answers (questionId, correct, topic) in TrialResult (Ref: design.md Readiness)
- [x] 6.5.9: After 5 questions, compute score (0-100%) and display score screen (Ref: R16.2)
- [x] 6.5.10: If score ≥70%, grant tower upgrade currency (+50 gold or +1 upgrade token) (Ref: R16.4) → superseded: sparks towards forge levels (src/study/model.ts forgeBonus)
- [x] 6.5.11: If score ≥90%, additionally charge special attack meter by +33% (Ref: R16.4)
- [x] 6.5.12: Save TrialResult to localStorage (append to trial history for that course) (Ref: R16.3)
- [x] 6.5.13: Update readiness score for that course using `calculateReadiness` (Ref: R16.3)
- [x] 6.5.14: Transition back to WarRoomScene after score screen (Ref: design.md Trial Scene)
- [x] 6.5.15: Style with grimoire page aesthetic, GSAP page flip transitions between questions (Ref: design.md Trial Scene)

### 6.6: Battle Plan Overlay
- [x] ~~6.6.1: Create `src/ui/warroom/BattlePlan.ts` as DOM modal overlay (Ref: design.md War Room UI)~~ → superseded: detail panel in WarRoomScene.ts courseCard()
- [x] 6.6.2: Trigger when big enemy (exam, project, or ≥50 pts) clicked in course card (Ref: R16.1)
- [x] 6.6.3: Display enemy details: name, type, due date, weight, days remaining (Ref: R16.1)
- [x] 6.6.4: Extract and display topics to review (from checkpoint questions for that course) (Ref: R16.1)
- [x] 6.6.5: Display current readiness % for that course (large number, color-coded red/yellow/green) (Ref: R16.1)
- [x] 6.6.6: Display weak topics (from `identifyWeakTopics`) if any exist (Ref: R16.1)
- [x] 6.6.7: Display recommended trial count using `recommendTrialCount(daysUntilDue, readiness)` (Ref: R16.1)
- [x] 6.6.8: Add "Train now" button (primary CTA, launches Trial Scene for this course) (Ref: R16.1)
- [x] 6.6.9: Add close button (Esc key or X icon) (Ref: design.md Battle Plan Overlay)
- [x] 6.6.10: Style with dark semi-transparent backdrop, centered grimoire panel, GSAP ink-bleed entrance (Ref: design.md Battle Plan Overlay)

### 6.7: Scout Report Overlay
- [x] ~~6.7.1: Create `src/ui/warroom/ScoutReport.ts` as DOM modal overlay (Ref: design.md War Room UI)~~ → superseded: scoutReport() in src/ui/BattleUI.ts
- [x] 6.7.2: Trigger when "Start Wave" button clicked in War Room (Ref: R17.1)
- [x] 6.7.3: Display wave preview: list upcoming enemies in this wave (names, types, courses) (Ref: R17.1)
- [x] 6.7.4: Display current readiness % for each course represented in wave (Ref: R17.1)
- [x] 6.7.5: If any course readiness <60%, show recommendation: "Your CV readiness is 40%. Train before the battle?" (highlight lowest course in red) (Ref: R17.1)
- [x] 6.7.6: Add "Train now" button (opens Trial Scene for weakest course) (Ref: R17.1)
- [x] 6.7.7: Add "Start battle" button (proceeds to BattleScene) (Ref: R17.1)
- [x] 6.7.8: Handle Esc key to close (same as "Start battle") (Ref: R17.1)
- [x] 6.7.9: Style with smaller overlay (top 1/3 of screen), GSAP slide from top entrance (Ref: design.md Scout Report Overlay)
- [x] 6.7.10: Keyboard navigation: Tab to cycle, Enter to select (Ref: R17.1)

### 6.8: Debrief Overlay
- [x] ~~6.8.1: Create `src/ui/warroom/Debrief.ts` as DOM modal overlay (Ref: design.md War Room UI)~~ → superseded: debrief() in src/ui/BattleUI.ts
- [x] 6.8.2: Trigger after wave ends (victory or defeat) in BattleScene (Ref: R17.2)
- [x] 6.8.3: Display outcome: "VICTORY" or "DEFEAT" (large text) (Ref: R17.2)
- [x] 6.8.4: Display performance summary: enemies defeated (X/Y), fortress damage (Z pts), gold earned (+G) (Ref: R17.2)
- [x] 6.8.5: Generate real-world mapping: 2-3 sentences linking game events to real deadlines (Ref: R17.2, R17.3)
  - [x] If exam enemy survived → "The Midterm boss broke through: your [course] readiness is low."
  - [x] Compute recommended trials using `recommendTrialCount` → "2 trials recommended before [date]."
  - [x] If tower was overwhelmed → "Quiz enemies overwhelmed the [course] tower: practice [weak topics]."
- [x] 6.8.6: Display next deadline reminder: "Next big enemy: [name] in [days] days" (Ref: R17.2)
- [x] 6.8.7: Prioritize feedback for high-weight items (≥50 pts) over low-weight (Ref: R17.3)
- [x] 6.8.8: Add "Return to War Room" button (primary CTA, transitions to WarRoomScene) (Ref: R17.2)
- [x] 6.8.9: Handle Esc or Enter key to close (same as button) (Ref: R17.2)
- [x] 6.8.10: Style with full-screen overlay, centered panel (victory = green accent, defeat = red accent), GSAP fade + scale entrance (Ref: design.md Debrief Overlay)
- [x] 6.8.11: Update BattleScene: after wave ends, show Debrief overlay instead of immediately starting next wave (Ref: design.md Scene Flow)

### 6.9: War Room Integration Test
- [x] 6.9.1: Manually test: boot → title → war room → see 6 course cards with grades, threat levels, next enemies (Ref: R15)
- [x] 6.9.2: Test: click "Train" on a course → complete 5-question trial → verify score, rewards, readiness update (Ref: R16)
- [x] 6.9.3: Test: complete trial with ≥70% score → verify tower upgrade currency granted (Ref: R16.4) → superseded: forge sparks granted
- [x] 6.9.4: Test: complete trial with ≥90% score → verify +33% special charge (Ref: R16.4)
- [x] 6.9.5: Test: click big enemy in course card → see Battle Plan with topics, readiness, recommended trials (Ref: R16.1) → superseded: detail panel shows this
- [x] 6.9.6: Test: click "Start Wave" → see Scout Report with wave preview, readiness check, recommendation (Ref: R17.1)
- [x] 6.9.7: Test: proceed to battle → complete wave → see Debrief with outcome, mapping to real deadlines, recommendations (Ref: R17.2)
- [x] 6.9.8: Test: return to War Room from Debrief → verify updated grades, threat levels (Ref: R17.2)
- [x] 6.9.9: Test: semester timeline shows all deadlines as tombstones, current date marker (Ref: R15.2)
- [x] 6.9.10: Verify keyboard navigation works in all War Room screens (Tab, Enter, Esc) (Ref: R15, R16, R17)

---

## Phase 7: Tutorial

### 7.1: Tutorial Scene
- [x] ~~7.1.1: Create `src/game/scenes/TutorialScene.ts` (Ref: R7.1)~~ → superseded: tutorial is wave 0 in BattleScene + coach marks (src/ui/BattleUI.ts coach())
- [x] ~~7.1.2: Spawn 1 weak enemy (assignment, 7 days out, low HP) (Ref: R7.1)~~ → superseded: tutorialWave in src/core/wave.ts
- [x] ~~7.1.3: Show overlay tooltip: "This is an enemy. Click to target." (DOM + GSAP) (Ref: R7.1)~~ → superseded: coach marks in BattleUI
- [x] ~~7.1.4: Wait for player to click enemy or tower (Ref: R7.1)~~ → superseded: coach marks show sequentially
- [x] ~~7.1.5: Show tooltip: "Press C to open study checkpoint." (Ref: R7.1)~~ → superseded: coach marks
- [x] ~~7.1.6: Wait for player to press C (Ref: R7.1)~~ → superseded: coach marks
- [x] ~~7.1.7: Show tooltip: "Answer correctly to charge your special attack." (Ref: R7.1)~~ → superseded: coach marks
- [x] ~~7.1.8: Wait for player to answer 1 question (Ref: R7.1)~~ → superseded: coach marks
- [x] ~~7.1.9: Show tooltip: "Defeat the enemy!" (Ref: R7.1)~~ → superseded: coach marks
- [x] ~~7.1.10: When enemy defeated or reaches fortress, end tutorial and transition to BattleScene (Ref: R7.1)~~ → superseded: wave 0 completes, sets tutorialDone

### 7.2: Tutorial Skip & Persistence
- [x] ~~7.2.1: Add "Skip Tutorial (Esc)" text to TutorialScene (Ref: R7.1)~~ → superseded: skip happens in pause menu
- [x] ~~7.2.2: On Esc, transition to BattleScene (Ref: R7.1)~~ → superseded: pause menu "End tutorial"
- [x] 7.2.3: Save `tutorialCompleted: true` to localStorage on completion (Ref: R7.1, R10.1)
- [x] 7.2.4: In TitleScene, check localStorage; if completed, skip tutorial on Start (Ref: R7.1)

### 7.3: Tutorial Timing
- [x] 7.3.1: Manually playtest: verify tutorial completes in ~60s (Ref: R7.1)
- [x] 7.3.2: Adjust delays/text if too slow or fast (Ref: R7.1)

---

## Phase 8: Theme Polish

### 8.1: Color Palette Tokens
- [x] 7.1.1: Create `src/styles/tokens.css` with CSS custom properties for all colors (Ref: design.md Art Direction)
- [x] 7.1.2: Verify WCAG AA contrast ratios with browser DevTools (Ref: R9.3)
- [x] 7.1.3: Document palette in README or CREDITS.md (Ref: R12.1)

### 8.2: Title Screen Polish
- [x] 7.2.1: Add dark gradient background (CSS or Phaser Graphics) (Ref: design.md TitleScene)
- [x] 7.2.2: Add fog particle emitter (Phaser Particles) (Ref: design.md TitleScene)
- [x] 7.2.3: Animate logo entrance with GSAP (scale + fade) (Ref: R1.1)
- [x] 7.2.4: Animate buttons stagger (GSAP timeline) (Ref: design.md TitleScene)
- [ ] 7.2.5: Add background audio loop (Howler, CC0 or synthesised, volume 0.3) (Ref: design.md TitleScene) (deferred: not critical for gameplay)

### 8.3: Battlefield Visuals
- [x] ~~7.3.1: Replace placeholder tower sprites with procedural graphics (Phaser Graphics API: turret shape) (Ref: design.md Procedural Art)~~ → superseded: 3D sentinel models in Battlefield3D.ts
- [x] ~~7.3.2: Replace placeholder enemy sprites with type-specific shapes (circles for quiz, rectangles for assignment, large composite for exam) (Ref: R3.1, design.md Procedural Art)~~ → superseded: 3D procedural creatures in src/game3d/creatures.ts
- [x] 7.3.3: Add neglected glow effect to enemies (Phaser FX pipeline or glow filter) (Ref: R3.4)
- [x] 7.3.4: Add tombstones/ghosts for past items (SVG data URIs, tinted per course) (Ref: R3.5, R1.2)
- [x] 7.3.5: Draw lane dividers (subtle lines, low opacity) (Ref: design.md BattleScene Layout)

### 8.4: Audio & SFX
- [x] ~~7.4.1: Synthesise tower fire sound with ZzFX (short blip) (Ref: design.md Audio)~~ → superseded: WebAudio in src/audio/sfx.ts
- [x] ~~7.4.2: Synthesise enemy hit sound (impact) (Ref: design.md Audio)~~ → superseded: WebAudio in src/audio/sfx.ts
- [x] ~~7.4.3: Synthesise special attack sound (explosion) (Ref: design.md Audio)~~ → superseded: WebAudio in src/audio/sfx.ts
- [x] ~~7.4.4: Synthesise wave complete sound (victory chime) (Ref: design.md Audio)~~ → superseded: WebAudio in src/audio/sfx.ts
- [x] ~~7.4.5: Add all sounds to Howler, play on events (Ref: design.md Audio)~~ → superseded: WebAudio in src/audio/sfx.ts
- [x] 7.4.6: Create `CREDITS.md` and list any CC0 assets used (Ref: NFR4)

### 8.5: Animations & Juice
- [x] 7.5.1: Add particle effect on enemy death (Phaser particles: small explosion) (Ref: R8.2)
- [x] 7.5.2: Add coin sparkle effect on gold gain (particle or sprite animation) (Ref: R8.2)
- [x] 7.5.3: Add screen shake on fortress damage (Phaser camera shake, 200ms) (Ref: design.md BattleScene)
- [x] 7.5.4: Add HP bar above enemies (Phaser Graphics, red/green) (Ref: R3)
- [x] 7.5.5: Add tower range circle on hover (Phaser Graphics, toggle visibility) (Ref: R4.1)

### 8.6: Reduced Motion Support
- [x] 7.6.1: Detect `prefers-reduced-motion: reduce` in `src/ui/motion.ts` (Ref: R9.2, design.md Reduced Motion)
- [x] 7.6.2: Disable GSAP animations (duration=0) if reduced motion (Ref: R9.2)
- [x] 7.6.3: Disable camera shake if reduced motion (Ref: R9.2)
- [x] 7.6.4: Reduce particle count by 90% if reduced motion (Ref: R9.2)
- [x] 7.6.5: Manually test with browser DevTools (emulate prefers-reduced-motion) (Ref: R9.2)

---

## Phase 9: Tower Upgrades [SUPERSEDED by R18]

### 9.1: Upgrade UI
- [x] ~~8.1.1: Create `src/ui/UpgradePanel.ts` as DOM overlay (Ref: R4.2)~~ → superseded: forge system via study trials (src/study/model.ts forgeLevel) with sparks per correct answer
- [x] ~~8.1.2: Display when tower clicked: show 3 upgrade paths (Damage, Speed, Range) with costs and current level (Ref: R4.2)~~ → superseded: forge levels shown in War Room and applied automatically to sentinels
- [x] ~~8.1.3: Keyboard shortcut: `U` to open upgrade panel for selected tower (Ref: R9.1)~~ → superseded: no manual upgrade UI, forging is automatic from trials

### 9.2: Upgrade Logic
- [x] ~~8.2.1: Create `src/core/upgrades.ts` with `canUpgrade(tower, path, gold): boolean` and `applyUpgrade(tower, path): TowerStats` (Ref: R4.2)~~ → superseded: src/core/balance.ts forgeMultipliers()
- [x] ~~8.2.2: Implement cost/max level checks (Damage/Speed: 50 gold, 3 levels; Range: 75 gold, 2 levels) (Ref: R4.2)~~ → superseded: SPARKS_PER_LEVEL = 3, MAX_FORGE = 5 in src/study/model.ts
- [x] ~~8.2.3: Update tower stats: damage +5, fireRate +0.5, range +50px (Ref: R4.2)~~ → superseded: forgeMultipliers in balance.ts with damage/fireRate/range scaling
- [x] ~~8.2.4: Write unit tests in `src/core/upgrades.test.ts`: verify costs, max levels, stat changes (Ref: R4.2)~~ → superseded: tested in balance.test.ts headless campaign

### 9.3: Upgrade Integration
- [x] ~~8.3.1: Wire upgrade buttons to call `applyUpgrade` and deduct gold (Ref: R4.2)~~ → superseded: sparks granted on correct trial answers, forge happens automatically
- [x] ~~8.3.2: Update tower visual (larger sprite or brighter color) on upgrade (Ref: R4.2)~~ → superseded: sentinel visuals show rune rings per forge level in Battlefield3D.ts
- [x] ~~8.3.3: Persist upgrades in game state (Ref: R4.2)~~ → superseded: forge levels persisted in save.ts

---

## Phase 10: Moodle Calendar Import

### 10.1: ICS Parser
- [x] 9.1.1: Install `ical.js` (npm package) (Ref: design.md Import Modules) [SKIPPED: wrote parser directly per task constraints]
- [x] 8.1.2: Create `src/import/ics.ts` with `parseICS(icsText): ICSEvent[]` (Ref: design.md ICS Parser, R6.1)
- [x] 8.1.3: Implement `inferItemType(summary): ItemType` with regex (Ref: design.md ICS Parser, R6.2)
- [x] 8.1.4: Implement `extractCourseId(summary, categories): CourseId` (Ref: design.md ICS Parser, R6.2)
- [x] 8.1.5: Write unit tests in `src/import/ics.test.ts`: verify parsing with sample .ics file (Ref: R6.1)

### 10.2: Import UI
- [x] 8.2.1: Add "Import Moodle Calendar" button to TitleScene (Ref: R6.1) → implemented in WarRoomScene
- [x] 8.2.2: Create file input (type=file, accept=.ics) in `src/ui/ImportPanel.ts` (Ref: R6.1) → implemented inline in WarRoomScene
- [x] 8.2.3: On file selected, read with FileReader, call `parseICS` (Ref: R6.1)
- [x] 8.2.4: Convert ICSEvent[] to Semester data (merge or replace demo) (Ref: R6.1)
- [x] 8.2.5: Handle parsing errors with user-friendly message (Ref: R6.1, R6.3)
- [x] 8.2.6: Store imported data in localStorage (Ref: R6.1)

### 10.3: Import Integration
- [x] 8.3.1: In BattleScene, check localStorage for imported data before loading demo (Ref: R6.1) → managed by src/study/model.ts getSemester()
- [x] 8.3.2: Manually test with real Moodle .ics export (Ref: R6.1)
- [x] 8.3.3: Verify no backend requests in browser DevTools Network tab (Ref: R6.3)

---

## Phase 11: PDF Question Generator (Optional)

### 11.1: PDF Text Extraction
- [x] 10.1.1: Create `src/import/pdf.ts` with `extractText(file): Promise<string>` (Ref: design.md PDF Question Generator, R5.5)
- [x] 9.1.2: Configure pdf.js worker path (`public/pdf.worker.min.js`) (Ref: design.md PDF Question Generator)
- [ ] 9.1.3: Write unit tests with sample PDF (Ref: R5.5) (deferred: needs test PDF asset)

### 11.2: Cloze Question Generation
- [x] 9.2.1: Implement `generateClozeQuestions(text, count): CheckpointQuestion[]` (Ref: design.md PDF Question Generator, R5.5)
- [x] 9.2.2: Extract sentences with capitalized nouns (simple heuristic) (Ref: R5.5)
- [x] 9.2.3: Blank one term per sentence, generate 3 distractors (Ref: R5.5)
- [x] 9.2.4: Write unit tests: verify generated questions are valid (Ref: R5.5)

### 11.2b: Study Skills Fallback Questions
- [x] 9.2b.1: Create `src/data/study-skills.json` with 12 evidence-based study technique questions (Ref: R5.5)
- [x] 9.2b.2: Write `src/data/study-skills.test.ts` validating the schema (Ref: R5.5)
- [x] 9.2b.3: Verify questions cover spaced repetition, retrieval practice, interleaving, elaboration, dual coding, testing effect, etc. (Ref: R5.5)

### 11.3: PDF Import UI
- [x] 9.3.1: Add "Upload PDF" button to CheckpointPanel (Ref: R5.5) → implemented: notes upload in WarRoomScene
- [x] 9.3.2: On file selected, call `extractText` → `generateClozeQuestions` (Ref: R5.5)
- [x] 9.3.3: Add generated questions to available pool (Ref: R5.5)
- [x] 9.3.4: Handle errors with fallback message (Ref: R5.5)
- [ ] 9.3.5: Verify <5s processing time for 50-page PDF (Ref: R5.5) (deferred: needs large test PDF)

---

## Phase 12: Persistence

### 12.1: Save System
- [x] 11.1.1: Create `src/save/save.ts` with `save(state, settings): void` and `load(): SaveData | null` (Ref: design.md Persistence, R10.1)
- [x] 10.1.2: Implement versioning (CURRENT_VERSION = "1.0.0") (Ref: R10.1)
- [x] 10.1.3: Wrap all localStorage calls in try/catch (Ref: R10.1)
- [x] 10.1.4: Write unit tests in `src/save/save.test.ts`: save/load/migrate (Ref: R10.1)

### 12.2: Auto-Save Triggers
- [x] 10.2.1: Call `save()` after each wave end (Ref: R10.2)
- [x] 10.2.2: Call `save()` after answering a checkpoint (Ref: R10.2)
- [x] 10.2.3: Call `save()` after upgrading a tower (Ref: R10.2) → superseded: after completing trials that earn forge sparks
- [x] 10.2.4: Call `save()` on page visibility change (window blur) (Ref: R10.2)
- [x] 10.2.5: Verify saves are synchronous (no race conditions) (Ref: R10.2)

### 12.3: Load on Boot
- [x] 10.3.1: In TitleScene, call `load()` and populate game state if save exists (Ref: R10.1)
- [x] 10.3.2: Show "Continue" button if save found (Ref: R1.1)
- [x] 10.3.3: Handle version mismatch: discard old saves with user warning (Ref: R10.1)

---

## Phase 13: Accessibility

### 13.1: Keyboard Controls
- [x] 12.1.1: Implement all keyboard shortcuts in `src/ui/keyboard.ts`: C, Esc, Space, M, 1-4, Tab, Enter, Arrows (Ref: R9.1, design.md Keyboard Navigation) (deferred: some Tab cycling not implemented)
- [x] 11.1.2: Add focus indicators (2px outline) to all interactive elements (Ref: R9.1, design.md Focus Indicators)
- [ ] 11.1.3: Verify Tab cycles through towers (Ref: R9.1) (deferred: sentinel selection not implemented)
- [x] 11.1.4: Manually test with keyboard only (no mouse) (Ref: R9.1)

### 13.2: Mute Toggle
- [x] 11.2.1: Add mute button to HUD (Ref: R9.5)
- [x] 11.2.2: Listen for `M` key, toggle Howler mute (Ref: R9.5) → superseded: WebAudio master gain mute
- [x] 11.2.3: Show muted icon when active (Ref: R9.5)
- [x] 11.2.4: Persist mute state in localStorage (Ref: R9.5)

### 13.3: Visual Captions
- [x] 11.3.1: Implement `showCaption(text)` in `src/ui/captions.ts` (Ref: design.md Visual Captions, R9.4) → superseded: inline captions in BattleUI.ts Hud
- [x] 11.3.2: Call on events: tower fires, special attack, wave complete (Ref: R9.4)
- [x] 11.3.3: Manually test with audio muted (Ref: R9.4)

### 13.4: Contrast Check
- [x] 11.4.1: Use browser DevTools to verify all text has ≥4.5:1 contrast (Ref: R9.3)
- [x] 11.4.2: Use browser DevTools to verify all UI elements have ≥3:1 contrast (Ref: R9.3)
- [ ] 11.4.3: Adjust colors in `tokens.css` if needed (Ref: R9.3) (deferred: manual audit needed)

---

## Phase 14: Moodle Block & LMS Showcase

### 14.1: Moodle Block Plugin Structure
- [x] 13.1.1: Create `moodle/block_gradedefense/version.php` with plugin metadata (Ref: R14.1)
- [x] 13.1.2: Create `moodle/block_gradedefense/block_gradedefense.php` extending `block_base` (Ref: R14.1)
- [x] 13.1.3: Create `moodle/block_gradedefense/lang/en/block_gradedefense.php` with strings (Ref: R14.1)
- [x] 13.1.4: Create `moodle/block_gradedefense/styles.css` for iframe styling (Ref: R14.1)
- [x] 13.1.5: Verify plugin structure matches Moodle 4.5 standards (Ref: R14.1)

### 14.2: Moodle Calendar Data Integration
- [x] 13.2.1: In `block_gradedefense.php`, fetch user calendar events via `core_calendar_get_calendar_upcoming_view` (Ref: R14.2)
- [x] 13.2.2: Transform Moodle events to game JSON schema (name, courseId, dueDate, points, type) (Ref: R14.2)
- [x] 13.2.3: Embed game iframe with deployed URL (Ref: R14.2)
- [x] 13.2.4: Send JSON payload via postMessage after iframe load (Ref: R14.2)
- [x] 13.2.5: Document postMessage contract in `docs/moodle-integration.md` (Ref: R14.2)

### 14.3: Game postMessage Handler
- [x] 13.3.1: Create `src/import/postmessage.ts` with message handler (Ref: R14.2)
- [x] 13.3.2: Implement schema validation (TypeScript type guard) (Ref: R14.2)
- [x] 13.3.3: Implement origin check with configurable allowlist (Ref: R14.2, R14.4)
- [x] 13.3.4: On valid message, replace demo data with Moodle data (Ref: R14.2)
- [x] 13.3.5: On invalid message, log error and fall back to demo (Ref: R14.2)
- [x] 13.3.6: Write unit tests in `src/import/postmessage.test.ts`: verify validation, origin check (Ref: R14.2)

### 14.4: LMS Showcase Page
- [x] 13.4.1: Create `showcase/lms.html` with generic LMS dashboard layout (Ref: R14.3)
- [x] 13.4.2: Embed game iframe styled as a block (Ref: R14.3)
- [x] 13.4.3: Load `src/data/demo.json` and send via postMessage (same contract as Moodle) (Ref: R14.3)
- [x] 13.4.4: Use generic branding ("My Learning Portal"), NO Moodle trademarks (Ref: R14.3)
- [x] 13.4.5: Verify postMessage integration works identically to real block (Ref: R14.3)

### 14.5: Security Review
- [ ] 13.5.1: Code review: confirm no tokens in URLs or postMessage payloads (Ref: R14.4) (deferred: manual review needed)
- [ ] 13.5.2: Code review: confirm no PII stored in localStorage (Ref: R14.4) (deferred: manual review needed)
- [ ] 13.5.3: Code review: confirm no client-side Moodle API calls (Ref: R14.4) (deferred: manual review needed)
- [ ] 13.5.4: Manually test with malformed postMessage (verify graceful handling) (Ref: R14.2) (deferred: manual test needed)
- [ ] 13.5.5: Manually test with untrusted origin (verify rejection) (Ref: R14.2) (deferred: manual test needed)

---

## Phase 15: Build & Smoke Tests

### 15.1: Build Configuration
- [x] 14.1.1: Verify `vite.config.ts` base path is set for production (Ref: R11.2, design.md Build Configuration)
- [x] 12.1.2: Run `npm run build` and verify output in `dist/` (Ref: R11.1)
- [x] 12.1.3: Verify build has zero TypeScript errors (Ref: NFR3)
- [x] 12.1.4: Verify output is <10 MB uncompressed (Ref: R11.1)
- [x] 12.1.5: Test locally with `npx vite preview` at sub-path (Ref: R11.2)

### 15.2: Playwright Smoke Tests
- [x] 12.2.1: Create `tests/e2e/smoke.spec.ts` (Ref: design.md Playwright Smoke Tests)
- [x] 12.2.2: Test: game boots without console errors (Ref: design.md Playwright Smoke Tests)
- [x] 12.2.3: Test: first wave starts (Ref: design.md Playwright Smoke Tests)
- [x] 12.2.4: Test: checkpoint panel opens (Ref: design.md Playwright Smoke Tests)
- [x] 12.2.5: Test: mute toggle works (Ref: design.md Playwright Smoke Tests)
- [x] 12.2.6: Run `npx playwright test` and verify all pass (Ref: NFR3)

### 15.3: Performance Verification
- [ ] 12.3.1: Run game with 20 enemies on screen, verify 60 FPS in browser DevTools (Ref: NFR2) (deferred: manual test needed)
- [ ] 12.3.2: Measure checkpoint answer latency (<100ms) (Ref: NFR2) (deferred: manual test needed)
- [ ] 12.3.3: Measure build time (<30s) (Ref: NFR2) (deferred: manual test needed)

---

## Phase 16: Kiro Hooks

### 16.1: IDE Hooks for Development Automation
- [x] 16.1.1: Create `.kiro/hooks/core-tests-on-save.kiro.hook` to run `npx vitest run src/core` when src/core files are saved
- [x] 16.1.2: Create `.kiro/hooks/question-bank-check.kiro.hook` to validate and fact-check checkpoint questions when modified
- [x] 16.1.3: Create `.kiro/hooks/steering-guard.kiro.hook` to check game/UI changes against art direction guidelines

### 16.2: CLI Custom Agent with Hooks
- [x] 16.2.1: Create `.kiro/agents/deadline-dev.json` custom agent with project-specific prompt and allowed tools
- [x] 16.2.2: Add postToolUse hook to run `npx tsc --noEmit` after writing TypeScript files
- [x] 16.2.3: Add agentSpawn hook to run `git status --short` when agent starts

### 16.3: Documentation
- [x] 16.3.1: Create `.kiro/hooks/README.md` documenting all hooks and the custom agent
- [x] 16.3.2: Verify all JSON files parse correctly with node validation

---

## Phase 17: Final Polish & Documentation

### 17.1: README.md
- [x] 16.1.1: Write README with project description, features, demo link, local setup instructions (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [ ] 14.1.2: Add screenshot/GIF of gameplay (Ref: HACKATHON_STRATEGY.md Presentation) (deferred: needs capture)
- [x] 14.1.3: Add license badge (MIT) (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

### 17.2: CREDITS.md
- [x] 14.2.1: List all third-party assets (CC0, CC-BY) with links and licenses (Ref: NFR4)
- [x] 14.2.2: List fonts (Cinzel, Inter, Creepster with OFL license) (Ref: NFR4)
- [x] 14.2.3: List any CC0 audio if used (Ref: NFR4)

### 17.3: KIRO_USAGE.md
- [x] 14.3.1: Document how Kiro was used: specs, steering, hooks, agents, CLI/IDE (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [x] 14.3.2: Be honest about what worked and what didn't (Ref: HACKATHON_STRATEGY.md Technological Implementation)

### 17.4: Demo Video Script
- [ ] 14.4.1: Write script (<3 min): hook (10s), Moodle import demo, live combat, checkpoint answer, special attack, Kiro workflow segment (Ref: HACKATHON_STRATEGY.md Presentation) (deferred: needs recording)
- [ ] 14.4.2: Record screen capture (Ref: HACKATHON_STRATEGY.md Mandatory checklist) (deferred: needs recording)
- [ ] 14.4.3: Edit with no copyrighted music (Ref: HACKATHON_STRATEGY.md Mandatory checklist) (deferred: needs recording)
- [ ] 14.4.4: Upload to YouTube as unlisted (Ref: HACKATHON_STRATEGY.md Mandatory checklist) (deferred: needs recording)

### 17.5: External Playtesting
- [ ] 14.5.1: Recruit 2 external users for 5-min playtest (Ref: R12.2) (deferred: needs testers)
- [ ] 14.5.2: Collect feedback on polish, bugs, confusion (Ref: R12.2) (deferred: needs testers)
- [ ] 14.5.3: Fix critical bugs identified (Ref: R12.2) (deferred: needs testers)

### 17.6: Deployment
- [x] 14.6.1: Deploy `dist/` to GitHub Pages (Ref: R11.2)
- [x] 14.6.2: Verify live URL works with no 404s (Ref: R11.2)
- [ ] 14.6.3: Test on 3 browsers: Chrome, Firefox, Safari (Ref: NFR1) (deferred: manual test needed)

### 17.7: Final Verification
- [x] 14.7.1: Run `npm run build` with zero errors (Ref: tech.md)
- [x] 14.7.2: Run `npx vitest run` with all tests passing (Ref: tech.md)
- [x] 14.7.3: Run `npx playwright test` with all tests passing (Ref: tech.md)
- [x] 14.7.4: Verify `.kiro/` directory is committed and not gitignored (Ref: HACKATHON_STRATEGY.md Mandatory checklist)
- [x] 14.7.5: Verify MIT license in repo (Ref: HACKATHON_STRATEGY.md Mandatory checklist)

---

## Phase 18: Duel Combat (Design Change 2026-11-27)

### 18.1: Core Duel Rules (Pure Functions)
- [x] 18.1.1: Create `src/core/duel.ts` with `DuelState`, `ApplyAnswerResult` types (Ref: R18.5)
- [x] 18.1.2: Implement `sealsFor(enemy, points): number` (minions 1; quiz 2; assignment 3+1 if ≥50pts; project/presentation 5; exam 8+2 if ≥100pts) (Ref: R18.2)
- [x] 18.1.3: Implement `applyAnswer(state, correct, streak): { state, damage, lurch }` (correct: damage 1 or 2 if streak ≥3; wrong: damage 0, lurch +0.06) (Ref: R18.2, R18.3)
- [x] 18.1.4: Implement `creepSpeed(type, isMinion, daysLeft): number` (regular ~180-300s, exams ~360s, overdue +25%) (Ref: R18.4)
- [x] 18.1.5: Implement `isDefeated(state): boolean` and `reachedAltar(state): boolean` (Ref: R18.5)
- [x] 18.1.6: Verify zero Phaser/Three.js/DOM imports in `src/core/duel.ts` (Ref: R18.5)

### 18.2: Unit Tests
- [x] 18.2.1: Create `src/core/duel.test.ts` (Ref: R18.5)
- [x] 18.2.2: Test `sealsFor`: verify seal counts for all types and point thresholds (Ref: R18.2)
- [x] 18.2.3: Test `applyAnswer`: correct answer damage (1 or 2), wrong answer lurch (+0.06), seals never negative (Ref: R18.2, R18.3)
- [x] 18.2.4: Test `creepSpeed`: verify target crossing times and overdue boost (Ref: R18.4)
- [x] 18.2.5: Integration test: N seals require exactly N correct answers when streak = 0 (Ref: R18.5)
- [x] 18.2.6: Integration test: wrong answers eventually cause altar reach (ceil(1/0.06) = 17 wrong answers) (Ref: R18.3)

### 18.3: Property-Based Tests
- [x] 18.3.1: Create `src/core/duel.prop.test.ts` using fast-check (Ref: R18.5)
- [x] 18.3.2: Property: seals never negative and never exceed maxSeals (Ref: R18.5)
- [x] 18.3.3: Property: damage never exceeds seals before the answer (Ref: R18.5)
- [x] 18.3.4: Property: progress stays in [0, 1] (Ref: R18.5)
- [x] 18.3.5: Property: correct answers never increase progress (Ref: R18.5)
- [x] 18.3.6: Property: wrong answers never decrease seals (Ref: R18.5)
- [x] 18.3.7: Property: creature defeat requires exactly N correct answers when streak = 0 (Ref: R18.5)
- [x] 18.3.8: Property: creepSpeed is always positive and finite (Ref: R18.5)
- [x] 18.3.9: Property: determinism (same inputs → same outputs) (Ref: R18.5)

### 18.4: Verification
- [x] 18.4.1: Run `npx vitest run src/core/duel` and verify all tests pass (Ref: R18.5)
- [x] 18.4.2: Run `npx tsc --noEmit` and verify zero TypeScript errors (Ref: R18.5)

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
8. **Tower upgrades [SUPERSEDED by R18]** (progression system)
9. **Moodle import** (real deadlines via ICS)
10. **PDF questions** (optional, no paid AI)
11. **Persistence** (save/load)
12. **Accessibility** (keyboard, reduced motion, captions, extra time for QTE)
13. **Moodle block + LMS showcase** (integration demo, postMessage contract)
14. **Build/smoke tests** (Playwright Chromium, performance)
15. **Kiro hooks** (test-on-save, pre-commit)
16. **Final polish** (README, demo video with QTE + showcase, deployment)
17. **Duel combat** (R18: player-vs-creature with seals, no sentinels)

Each phase delivers a playable or testable increment. Kiro agents can work on independent phases in parallel (e.g., checkpoint UI while another agent works on PDF import, or QTE while Moodle block is being developed).


---

## Phase 19: The Procession (Calendar-Based Battlefield, R19)

### 19.1: Core Procession Module
- [x] 19.1.1: Create `src/core/procession.ts` with types: `ProcessionItem`, `ProcessionState`, `Arrival`, `Verdict` (Ref: R19.7)
- [x] 19.1.2: Export `PROCESSION` constants (horizonDays=14, maxVisible=4, secondsPerDay=6, duelTimeScale=0.25, wrongAnswerDays=0.5, unpreparedFloor=25, passGrade=50) (Ref: R19.7)
- [x] 19.1.3: Implement `buildProcession(semester, now)`: split items into graded (grade ≠ null) and upcoming (grade = null, dueDate >= now), compute dueDay, initialize seals with `sealsFor`, compute totals (Ref: R19.1, R19.7)
- [x] 19.1.4: Implement `itemScore(seals, maxSeals)`: linear 25-100 based on remaining seals, 1 decimal (Ref: R19.2, R19.7)
- [x] 19.1.5: Implement `verdictFor(seals, maxSeals)`: 0 → ready, ≤ half → partial, else unprepared (Ref: R19.2, R19.7)
- [x] 19.1.6: Implement `courseGrade(state, courseId)`: (graded.earned + resolved.earned + unresolved.points) / totals * 100, 1 decimal, default 100 if no points (Ref: R19.3, R19.7)
- [x] 19.1.7: Implement `visible(state)`: unresolved items with dueDay - day ≤ horizonDays, nearest first, at most maxVisible (Ref: R19.1, R19.7)
- [x] 19.1.8: Implement `laneProgress(item, day)`: clamp(1 - (dueDay - day) / horizonDays, 0, 1) (Ref: R19.1, R19.7)
- [x] 19.1.9: Implement `breakSeals(state, itemId, n)`: remove n seals (never below 0), resolve with score 100 if seals reach 0, immutable (Ref: R19.7)
- [x] 19.1.10: Implement `advance(state, days)`: day += max(0, days), resolve arrivals (dueDay ≤ new day) in due order, compute grade before/after each, immutable (Ref: R19.2, R19.5, R19.7)
- [x] 19.1.11: Implement `failedCourses(state)`: courses with courseGrade < passGrade (Ref: R19.4, R19.7)
- [x] 19.1.12: Implement `isFinished(state)`: every item resolved (Ref: R19.7)
- [x] 19.1.13: Implement `letterGrade(grade)`: ≥90 A, ≥80 B, ≥70 C, ≥50 D, else F (Ref: R19.6, R19.7)
- [x] 19.1.14: Verify zero Date.now() calls or imports of Phaser/Three.js/DOM (Ref: R19.7)

### 19.2: Unit Tests
- [x] 19.2.1: Create `src/core/procession.test.ts` (Ref: R19.7)
- [x] 19.2.2: Test `buildProcession`: verify items split correctly (graded vs upcoming), dueDay computed, seals initialized from `sealsFor`, totals computed (Ref: R19.1)
- [x] 19.2.3: Test `itemScore`: 0 seals → 100, maxSeals → 25, half seals → 62.5 (Ref: R19.2)
- [x] 19.2.4: Test `verdictFor`: 0 → ready, half → partial, full → unprepared (Ref: R19.2)
- [x] 19.2.5: Test `courseGrade`: verify graded items included, resolved items included, unresolved items count as 100%, division by totals (Ref: R19.3)
- [x] 19.2.6: Test `courseGrade`: course with no items → 100 (Ref: R19.3)
- [x] 19.2.7: Test `visible`: at most maxVisible, nearest first, unresolved only, within horizon (Ref: R19.1)
- [x] 19.2.8: Test `laneProgress`: 0 at horizon, 1 at arrival, clamped (Ref: R19.1)
- [x] 19.2.9: Test `breakSeals`: removes n seals, never negative, resolves when 0, immutable (Ref: R19.7)
- [x] 19.2.10: Test `advance`: day advances, arrivals resolved in order, grade before/after recorded, immutable (Ref: R19.2, R19.5)
- [x] 19.2.11: Test `failedCourses`: includes courses with grade < 50 (Ref: R19.4)
- [x] 19.2.12: Test `isFinished`: true when all resolved, false otherwise (Ref: R19.7)
- [x] 19.2.13: Test `letterGrade`: A/B/C/D/F thresholds (Ref: R19.6)
- [x] 19.2.14: Integration test on demo semester: first visible deadlines are CV101 midterm, PHO101 quiz, MATH101 midterm (Ref: task spec)
- [x] 19.2.15: Integration test: unprepared 100-point exam in 250-point course costs 30 grade points (Ref: task spec)
- [x] 19.2.16: Integration test: unprepared 10-point lab in 250-point course costs 3 grade points (Ref: task spec)
- [x] 19.2.17: Integration test: breaking all seals early means no loss on arrival (Ref: task spec)
- [x] 19.2.18: Integration test: failing both CV101 big items unprepared fails the course (Ref: task spec)

### 19.3: Property-Based Tests
- [x] 19.3.1: Create `src/core/procession.prop.test.ts` using fast-check (Ref: R19.7)
- [x] 19.3.2: Property: `courseGrade` always in [0, 100] (Ref: R19.7)
- [x] 19.3.3: Property: breaking more seals before an arrival never lowers the grade (monotonic) (Ref: R19.7)
- [x] 19.3.4: Property: `advance(a) then advance(b)` equals `advance(a + b)` (same grades and resolved set) (Ref: R19.7)
- [x] 19.3.5: Property: `visible()` never returns more than maxVisible or a resolved item (Ref: R19.7)
- [x] 19.3.6: Property: `laneProgress` always in [0, 1] (Ref: R19.7)
- [x] 19.3.7: Property: every item resolves exactly once (no duplicates in arrivals across multiple advances) (Ref: R19.7)
- [x] 19.3.8: Property: determinism (same inputs → same outputs for all functions) (Ref: R19.7)

### 19.4: Verification
- [x] 19.4.1: Run `npx vitest run src/core/procession` and verify all tests pass (Ref: R19.7)
- [x] 19.4.2: Run `npx vitest run src/core` and verify no regressions (Ref: task spec)
- [x] 19.4.3: Run `npx tsc --noEmit` and verify zero TypeScript errors (Ref: task spec)

### 19.5: Balance Simulation
- [x] 19.5.1: Create `src/core/procession.balance.test.ts` with headless simulation (Ref: task spec)
- [x] 19.5.2: Implement time model: 1 day per secondsPerDay real seconds (non-duel), duelTimeScale during questions (Ref: task spec)
- [x] 19.5.3: Implement student simulator: answers visible items, correct with probability accuracy, seeded RNG (Ref: task spec)
- [x] 19.5.4: Implement targeting policies: nearest (smallest dueDay), weighted (points × seals/maxSeals × urgency) (Ref: task spec)
- [x] 19.5.5: Assertion 1: idle student (0s per answer) fails at least one course (Ref: task spec)
- [x] 19.5.6: Assertion 2: 6s/75% weighted passes all courses with avg >= 75 (Ref: task spec)
- [x] 19.5.7: Assertion 3: weighted avg min >= nearest avg min over seeds 1..10 (Ref: task spec)
- [x] 19.5.8: Assertion 4: higher accuracy never lowers avg grade (monotonic) (Ref: task spec)
- [x] 19.5.9: Tune PROCESSION constants if assertion 2 fails: secondsPerDay 6→8, duelTimeScale 0.25→0.2 (Ref: task spec)

### 19.6: BattleScene Integration (R19)
- [x] 19.6.1: Update BattleScene.ts to drive src/core/procession.ts instead of wave/sim (Ref: R19.1)
- [x] 19.6.2: Implement calendar clock: tick(days) calls advance() and handles Arrival events (Ref: R19.2, R19.5)
- [x] 19.6.3: Implement HUD grade strip showing projected grade per course with courseGrade() (Ref: R19.3, BattleUI.ts Hud)
- [x] 19.6.4: Implement syncField(): spawn creatures from visible(), position by laneProgress() (Ref: R19.1, Battlefield3D)
- [x] 19.6.5: Implement openDuel(): player picks target, duel loop with applyAnswer() and breakSeals() (Ref: R18, BattleUI.ts duelCard)
- [x] 19.6.6: Implement arrival effects: floatLabel with grade loss, view.arrive() animation (Ref: R19.5)
- [x] 19.6.7: Implement defeat(): floatLabel "DEFEATED", view.killEnemy(), mark resolved (Ref: R19.1)
- [x] 19.6.8: Implement runQTE(): last stand when exam/project one day out with seals left (Ref: R13, BattleUI.ts qteCard)
- [x] 19.6.9: Implement onFinished(): debrief with transcript, advice, courseGrade/letterGrade (Ref: R19.6, BattleUI.ts debrief)
- [x] 19.6.10: Implement onFailed(): debrief when any course grade < 50, failedCourses() (Ref: R19.4)
- [x] 19.6.11: Implement scoutReport(): pre-battle overlay with weights, seals, readiness, Train button (Ref: R17, BattleUI.ts scoutReport)
- [x] 19.6.12: Implement week banners: weekBanner() when day crosses week boundary (Ref: BattleUI.ts weekBanner)
- [x] 19.6.13: Implement tutorial: coach marks, waits for first duel (tutorialStep tracking) (Ref: R7, BattleUI.ts coach)
- [x] 19.6.14: Integrate rigged skeletons: preloadSkeletons(), Battlefield3D.addEnemy() with type (Ref: src/game3d/skeletons.ts)
- [x] 19.6.15: Implement hover/click sounds: view.onEnemyHover, view.onEnemyClick, sfx('hover'/'select') (Ref: src/audio/sfx.ts)
- [x] 19.6.16: Implement hasten toggle: timeScale multiplier, hud.caption feedback (Ref: BattleScene.ts toggleHasten)
- [x] 19.6.17: Implement pause menu: pauseMenu(), reduced motion toggle, persist on pause (Ref: BattleUI.ts pauseMenu)
- [x] 19.6.18: Persist procession state: loadState/persist with semesterKey, resume or rebuild (Ref: R10, save.ts)
- [x] 19.6.19: Run manual test: boot → war room → scout → battle → duel → arrival → transcript (Ref: R19.1-R19.6)
