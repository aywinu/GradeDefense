# Requirements — Deadline Defense

## Overview
A dark-fantasy tower-defense game where the student's real semester is the fortress and their coursework is the horde. For the Kiroween 2026 Costume Contest: haunting UI that is polished, memorable, and serves the function.

---

## R1: Title Screen & Theme

### R1.1: Haunting Title Screen
**WHEN** the game loads,  
**THE SYSTEM SHALL** display a title screen with:
- Game logo "Deadline Defense" with tagline "Your semester is under siege."
- Dark-fantasy art direction (see design.md palette)
- Animated entrance (GSAP)
- Options: "Start", "Continue" (if save exists), "Settings"
- Background audio loop (CC0/synthesised)

**ACCEPTANCE:**
- Loads in <3s on a typical broadband connection
- Animation respects `prefers-reduced-motion`
- Keyboard navigation works (Enter to select, arrows/tab to navigate)

### R1.2: Semester Fortress Theme
**WHEN** the player enters the battlefield,  
**THE SYSTEM SHALL** present a haunted fortress visual metaphor where:
- Each course is a tower or defensive position
- Enemies approach from lanes corresponding to their course
- The fortress health represents the player's semester GPA
- Fallen enemies (past items with grades) are visible as ghosts or tombstones

**ACCEPTANCE:**
- Visuals reinforce the "semester under siege" metaphor
- Course towers are distinguishable by color/icon
- Past vs future items are visually distinct

---

## R2: Demo Semester Data

### R2.1: Bundled Demo Courses
**WHEN** the game boots with no imported data,  
**THE SYSTEM SHALL** load a bundled demo semester with:
- 6 courses from `reference/coursepilot/course_plan.json` (CV101, PHO101, MGT101, DSA101, MKT101, MATH101)
- Due dates **computed at runtime** from relative offsets so the demo never goes stale
- Past items (grade ≠ null) marked as "fallen" (already defeated)
- Future items (grade = null) become enemies

**ACCEPTANCE:**
- Opening the game on any date produces a playable semester with ~3-6 upcoming deadlines within 2-7 days
- Past items do not spawn as enemies
- Each course has 1-2 items due "soon" (within 7 days)

### R2.2: Demo Data Schema
**WHEN** storing demo data in `src/data/demo.json`,  
**THE SYSTEM SHALL** use relative offsets, NOT absolute dates:
- `name: string`
- `courseId: string` (CV101, etc.)
- `daysOffset: number` (relative days from "today", e.g., -7 for past, +3 for upcoming)
- `points: number` (weight)
- `grade: number | null` (0-100)
- `type: "assignment" | "quiz" | "exam" | "project" | "presentation"` (inferred from name)

**WHEN** loading demo data at runtime,  
**THE SYSTEM SHALL** call a pure function `resolveSemester(demo, now)` in `src/core/semester.ts` to compute absolute `dueDate` values:
- `dueDate = new Date(now.getTime() + daysOffset * 86400000)`

**ACCEPTANCE:**
- `src/data/demo.json` contains NO absolute dates (only daysOffset integers)
- `resolveSemester` is a pure function with zero side effects
- JSON schema validates in TypeScript strict mode
- All 6 courses represented
- At least 30 total items

---

## R3: Enemy Mapping & Scaling

### R3.1: Enemy Type Mapping
**WHEN** spawning an enemy for a coursework item,  
**THE SYSTEM SHALL** map:
- **Assignment** → shambling enemy (slow, medium HP, predictable path)
- **Quiz** → fast swarmer (quick, low HP, erratic movement)
- **Exam** → boss (slow, high HP, special attack, multi-phase)
- **Project** → multi-phase enemy (spawns in stages as deadline nears)
- **Presentation** → multi-phase enemy (similar to project)

**ACCEPTANCE:**
- Each type has distinct sprite/animation
- Exam bosses have ≥2 phases
- Projects spawn preview enemies 7+ days out, main enemy <7 days

### R3.2: Strength Scaling by Deadline Proximity
**WHEN** computing enemy stats,  
**THE SYSTEM SHALL** scale strength using:
- `urgency = max(0.1, 1 - (daysUntil / 21))`  
  (saturates at 3 weeks, adapted from priority.py)
- HP multiplier: `1 + urgency * 2` (up to 3× HP for items due today)
- Speed multiplier: `1 + urgency * 0.5` (up to 1.5× speed)

**ACCEPTANCE:**
- An item due in 21 days has urgency ~0.1
- An item due today has urgency = 1.0
- HP/speed scale smoothly
- Unit tests cover edge cases (overdue, far future)

### R3.3: Strength Scaling by Weight (Points)
**WHEN** computing enemy stats,  
**THE SYSTEM SHALL** scale strength by weight:
- HP multiplier: `1 + (points / 100)`  
  (100-point exam = 2× HP; 10-point quiz = 1.1× HP)
- Damage to fortress: proportional to `points`

**ACCEPTANCE:**
- A 100-point exam is significantly tougher than a 10-point quiz
- Reaching the fortress with a high-points enemy causes large damage

### R3.4: Neglected Items Grow Stronger
**WHEN** an enemy has been on the battlefield for >60 seconds without damage,  
**THE SYSTEM SHALL** apply a "neglected" buff:
- HP +50%
- Glow/pulse visual effect
- Speed +25%

**ACCEPTANCE:**
- Buff applies exactly once per enemy
- Visual indicator is clear
- Can be unit-tested without Phaser (time-based logic in core)

### R3.5: Past Items with Grades
**WHEN** loading past items (grade ≠ null),  
**IF** grade ≥ 70,  
**THE SYSTEM SHALL** display them as "fallen" decorations (tombstones, faded sprites) with no gameplay effect.

**WHEN** loading past items (grade ≠ null),  
**IF** grade < 70,  
**THE SYSTEM SHALL** spawn them as "haunting ghosts" (weak enemies, low priority, visual reminder of past struggles).

**ACCEPTANCE:**
- High-grade past items are purely decorative
- Low-grade past items are distinguishable, low-threat enemies
- No gameplay reward for marking real tasks "done"

---

## R4: Towers & Defenders

### R4.1: Towers Per Course
**WHEN** the game starts,  
**THE SYSTEM SHALL** provide one tower slot per course.

**WHEN** the player selects a course slot,  
**THE SYSTEM SHALL** allow placing a tower of that course's type with initial stats:
- Range: 150px
- Damage: 10
- Fire rate: 1 shot/sec
- Cost: 0 (pre-placed at start)

**ACCEPTANCE:**
- 6 towers (one per course) are available at wave 1
- Each tower auto-targets enemies from its course

### R4.2: Tower Upgrades
**WHEN** the player has earned upgrade currency (from study checkpoints),  
**THE SYSTEM SHALL** allow upgrading a tower in one of three paths:
- **Damage** (cost 50): +5 damage per level, max 3 levels
- **Speed** (cost 50): +0.5 fire rate per level, max 3 levels
- **Range** (cost 75): +50px range per level, max 2 levels

**ACCEPTANCE:**
- UI shows available upgrades and costs
- Upgrades persist across waves
- Keyboard shortcut to open upgrade menu

### R4.3: Tower Targeting
**WHEN** multiple enemies are in range,  
**THE SYSTEM SHALL** prioritize:
1. Enemies from the tower's course
2. Closest to fortress
3. Highest HP

**ACCEPTANCE:**
- Tower does not fire when no valid target
- Targeting logic is pure function (unit-testable)

---

## R5: Study Checkpoints

### R5.1: Bundled Multiple-Choice Questions
**WHEN** the game loads demo data,  
**THE SYSTEM SHALL** include ~8 multiple-choice questions per course (48 total) with:
- Question text
- 4 answer choices (1 correct)
- Topic matching the course title

**ACCEPTANCE:**
- Questions are original (no copyrighted exam content)
- Topics: Computer Vision, Photonics, Management, Data Structures & Algorithms, Digital Marketing, Linear Algebra
- Stored in `src/data/checkpoints.json`

### R5.2: Checkpoint UI
**WHEN** the player opens the study checkpoint panel (hotkey: `C`),  
**THE SYSTEM SHALL** display:
- A random unanswered question from the current course
- 4 answer buttons
- Current charge meter (0-100%)

**ACCEPTANCE:**
- Panel overlays the battlefield without pausing the game
- Keyboard navigation (1-4 keys to answer, Esc to close)
- Touch-friendly buttons ≥44px

### R5.3: Correct Answer Charges Attack
**WHEN** the player answers correctly,  
**THE SYSTEM SHALL**:
- Add +25% to the charge meter
- Display "Correct! +25% charge" feedback (GSAP animation)
- Remove that question from the pool for 5 minutes

**ACCEPTANCE:**
- Charge meter fills to 100% after 4 correct answers
- No punishment for wrong answers beyond missed charge
- Visual feedback completes in <1s

### R5.4: Charged Special Attack
**WHEN** the charge meter reaches 100%,  
**THE SYSTEM SHALL** enable a "Special Attack" button that:
- Deals massive AOE damage to all enemies of one course
- Consumes the full charge (resets to 0%)
- Has dramatic visual/audio feedback

**ACCEPTANCE:**
- Hotkey: `Space`
- Course selection (if multiple courses have enemies): quick radial menu or auto-target most dangerous
- Cannot be used at 0% charge

### R5.5: Optional PDF Questions
**WHEN** the player uploads a PDF (input type=file),  
**IF** pdf.js successfully extracts text,  
**THE SYSTEM SHALL** generate simple cloze questions:
- Extract sentences with key terms (nouns, capitalized words)
- Blank one term per sentence
- Present as fill-in-the-blank (4 choices: correct + 3 random terms from same PDF)

**WHEN** PDF extraction or question generation fails,  
**THE SYSTEM SHALL** fall back to bundled questions with a user-visible error message.

**ACCEPTANCE:**
- No paid AI API calls
- Generated questions are playable (not grammatically broken)
- PDF processing is client-side only
- Performance: <5s for a 50-page PDF

---

## R6: Moodle Calendar Import

### R6.1: ICS File Upload
**WHEN** the player clicks "Import Moodle Calendar",  
**THE SYSTEM SHALL** show a file input (accept=".ics").

**WHEN** an .ics file is selected,  
**THE SYSTEM SHALL**:
- Parse it client-side (no server upload)
- Extract VEVENT entries with SUMMARY, DTSTART, DESCRIPTION
- Map SUMMARY to coursework items (regex match for "assignment", "quiz", "exam", "project", "presentation")
- Merge with or replace demo data

**ACCEPTANCE:**
- Works with Moodle's standard calendar export format
- Parsing errors show user-friendly message, not a crash
- No credentials or tokens in the file are logged or stored

### R6.2: Deadline Mapping
**WHEN** parsing an ICS VEVENT,  
**THE SYSTEM SHALL** infer:
- `type` from SUMMARY (case-insensitive keywords)
- `points` = 20 (default; Moodle calendar does not include weights)
- `courseId` from CATEGORIES field or SUMMARY prefix (e.g., "CV101:")

**ACCEPTANCE:**
- At least 80% of Moodle events are correctly typed
- Ambiguous events default to "assignment"

### R6.3: No Backend Requirement
**WHEN** importing data,  
**THE SYSTEM SHALL NOT**:
- Make HTTP requests to Moodle servers
- Require login credentials
- Store tokens or session data

**ACCEPTANCE:**
- Static build works offline after initial load
- No CORS or authentication errors

---

## R7: Tutorial

### R7.1: Played Tutorial (First Wave)
**WHEN** a new player starts the game,  
**THE SYSTEM SHALL** launch a tutorial wave that:
- Spawns 1 weak shambler (assignment due in 7 days)
- Shows overlay tooltips: "This is an enemy. Click to target."
- Guides: "Press C to open study checkpoint."
- Prompts answering 1 question
- Ends when enemy is defeated or reaches fortress

**ACCEPTANCE:**
- Tutorial completes in ~60 seconds
- Skippable (Esc key)
- Never repeats (localStorage flag)

### R7.2: No Text-Heavy Onboarding
**THE SYSTEM SHALL NOT** require reading a manual or lengthy instructions before play.

**ACCEPTANCE:**
- Zero splash screens with paragraphs of text
- All mechanics taught through gameplay

---

## R8: Rewards

### R8.1: No Reward for Marking Tasks Done
**THE SYSTEM SHALL NOT** grant any in-game benefit (currency, upgrades, HP) for:
- Clicking "complete" on a real task
- Self-reporting task completion
- Any action not verified by gameplay (answering checkpoints) or time (wave survival)

**ACCEPTANCE:**
- No "mark as done" button in the UI
- Rewards come exclusively from correct checkpoint answers and defeating enemies

### R8.2: Gameplay Rewards
**WHEN** the player defeats an enemy,  
**THE SYSTEM SHALL** grant:
- +10 gold (generic currency for upgrades)
- Visual/audio feedback (coin sparkle, chime)

**WHEN** a wave ends,  
**THE SYSTEM SHALL** grant:
- +50 gold bonus
- Fortress HP regeneration (+10%)

**ACCEPTANCE:**
- Rewards are immediate and visible
- No grinding or wait timers

---

## R9: Accessibility

### R9.1: Keyboard Play
**THE SYSTEM SHALL** support full keyboard control:
- Arrow keys: navigate menus
- Enter/Space: select
- 1-4: answer checkpoint questions
- C: open checkpoint panel
- Esc: close panels/pause
- Tab: cycle through towers

**ACCEPTANCE:**
- No mouse-only interactions
- Focus indicators visible (2px outline, high contrast)

### R9.2: Reduced Motion
**WHEN** `prefers-reduced-motion: reduce` is detected,  
**THE SYSTEM SHALL**:
- Disable GSAP entrance animations
- Reduce particle effects
- Disable camera shake

**ACCEPTANCE:**
- Game remains playable with reduced motion
- Core mechanics unaffected

### R9.3: Readable Contrast
**THE SYSTEM SHALL** use WCAG AA compliant contrast ratios:
- Text on backgrounds: ≥4.5:1
- UI elements: ≥3:1

**ACCEPTANCE:**
- Automated contrast check in design tokens (task in tasks.md)
- Manual review with browser DevTools

### R9.4: Captions & Visual Cues
**WHEN** audio events occur (attack, special attack, wave end),  
**THE SYSTEM SHALL** show visual indicators:
- Text captions (e.g., "Tower fires")
- Screen flash or icon

**ACCEPTANCE:**
- Game is playable with audio muted
- No critical information is audio-only

### R9.5: Mute Toggle
**THE SYSTEM SHALL** provide a mute button (hotkey: M) that:
- Disables all Howler audio
- Persists in localStorage
- Shows muted icon

**ACCEPTANCE:**
- Instant toggle, no lag
- State survives page reload

---

## R10: Persistence

### R10.1: Versioned Save System
**THE SYSTEM SHALL** save to localStorage with:
- Save version number (semver-style, e.g., "1.0.0")
- Player progress: wave number, gold, tower upgrades
- Answered checkpoints (timestamp)
- Settings (muted, completed tutorial)

**WHEN** loading a save with a mismatched version,  
**THE SYSTEM SHALL**:
- Attempt migration if minor version change
- Discard save and start fresh if major version change, with a user warning

**ACCEPTANCE:**
- try/catch around all localStorage calls
- No crash if localStorage is disabled or full
- Unit tests for save/load/migrate

### R10.2: Save Triggers
**THE SYSTEM SHALL** auto-save:
- After each wave
- When answering a checkpoint
- When upgrading a tower
- On visibility change (page blur)

**ACCEPTANCE:**
- Save operations are synchronous (no async race conditions)
- Save errors are logged but do not block gameplay

---

## R11: Static Build & Hosting

### R11.1: Build Output
**WHEN** `npm run build` completes,  
**THE SYSTEM SHALL** output to `dist/` with:
- index.html (paths relative or absolute for sub-path deployment)
- Bundled JS/CSS with content hashes
- Assets in `dist/assets/`

**ACCEPTANCE:**
- Build succeeds with zero TypeScript errors
- Output is <10 MB uncompressed

### R11.2: GitHub Pages Sub-Path
**THE SYSTEM SHALL** support deployment to `https://user.github.io/deadline-defense/` by:
- Setting Vite `base: '/deadline-defense/'` in production mode
- Using relative asset paths

**ACCEPTANCE:**
- Game loads and runs at a sub-path URL
- No 404s for assets in browser DevTools Network tab

---

## R13: Quick-Time Exam Events

### R13.1: QTE Trigger Conditions
**WHEN** an exam (boss) or multi-phase enemy reaches a phase threshold (50% HP for exams; phase transition for projects/presentations),  
**THE SYSTEM SHALL**:
- Slow game speed to 20% (time scale 0.2)
- Display a multiple-choice question from that course
- Show a visible countdown timer (default 8 seconds)
- Pause enemy movement and tower firing during the QTE

**ACCEPTANCE:**
- Game speed transitions smoothly (ease-in-out, 0.3s)
- QTE triggers exactly once per phase threshold
- Timer is clearly visible (large font, contrasting color)

### R13.2: QTE Accessibility (Extra Time)
**WHEN** the "extra time" or reduced-motion accessibility setting is enabled,  
**THE SYSTEM SHALL** extend the QTE countdown to 16 seconds.

**ACCEPTANCE:**
- Setting persists in localStorage
- Timer duration updates immediately when setting changes
- UI indicates extended time mode is active

### R13.3: QTE Answer Outcomes
**WHEN** the player answers correctly within the time limit,  
**THE SYSTEM SHALL**:
- Deal critical hit damage (3× normal tower damage) to the triggering enemy
- Display dramatic visual effect (screen flash, particle burst, slow-motion kill cam for 0.5s)
- Play special sound effect
- Resume normal game speed

**WHEN** the player answers incorrectly or the timer expires,  
**THE SYSTEM SHALL**:
- Trigger boss enrage: +50% damage and +25% speed for 10 seconds
- Display "Enraged!" visual indicator above enemy
- Resume normal game speed

**ACCEPTANCE:**
- Correct answer always results in critical hit (deterministic)
- Enrage buff is temporary and visible
- No punishment beyond enrage (no fortress damage)

### R13.4: QTE Input
**WHEN** a QTE is active,  
**THE SYSTEM SHALL** accept answers via:
- Keyboard keys 1-4 (same as checkpoint panel)
- Mouse/touch on answer buttons

**ACCEPTANCE:**
- Input is responsive (<50ms latency)
- Other game controls are disabled during QTE
- ESC key does not close QTE (must answer or timeout)

### R13.5: QTE Core Rules
**THE SYSTEM SHALL** implement QTE timer and outcome logic as pure functions in `src/core/qte.ts` with:
- `startQTE(enemy, question, settings): QTEState` — initializes countdown based on accessibility settings
- `updateQTE(state, deltaTime): QTEState` — decrements timer, ensures timer never negative
- `resolveQTE(state, answerIndex | null): QTEOutcome` — deterministic outcome (crit or enrage) based on correctness

**ACCEPTANCE:**
- Zero Phaser imports in `src/core/qte.ts`
- Property-based tests verify: timer bounds (0 ≤ t ≤ maxTime), determinism (same inputs → same output), no negative time
- Unit tests cover: correct answer, wrong answer, timeout, extended time mode

---

## R15: War Room (Home Screen)

### R15.1: Course Status Cards
**WHEN** the player enters the War Room (home screen, before any battle),  
**THE SYSTEM SHALL** display one card per course with:
- Current grade (computed from past items with grades, or "N/A" if no graded items)
- Threat level (derived from priority score of upcoming items: "Low" / "Medium" / "High" / "Critical")
- Next 1-3 big enemies (exams, projects, high-weight assignments) with real dates, weights, and days remaining (e.g., "Midterm Examination: Thu 3 Dec, 100 pts, in 4 days")

**ACCEPTANCE:**
- One card per course (6 total for demo semester)
- Cards are visually distinct (course color accent from palette)
- Threat level uses priority score thresholds (<0.3 = Low, 0.3-0.5 = Medium, 0.5-0.7 = High, ≥0.7 = Critical)
- Dates and weights are accurate (from real coursework items)

### R15.2: Semester Timeline
**WHEN** the player views the War Room,  
**THE SYSTEM SHALL** display a horizontal semester timeline showing:
- All future deadlines as tombstones (small vertical markers) on a calendar strip
- Each tombstone is tinted with its course color
- Current date is marked with a vertical line or indicator
- Tombstones are positioned proportionally by date (days from now)

**ACCEPTANCE:**
- Timeline spans from "today" to the furthest deadline (up to 10 weeks)
- Hovering/clicking a tombstone shows item name and date
- Timeline is scrollable if deadlines span >3 months

---

## R16: Battle Plan & Practice Trials

### R16.1: Battle Plan for Big Enemies
**WHEN** the player selects a big enemy (exam, project, or high-weight assignment) in the War Room,  
**THE SYSTEM SHALL** display a battle plan card with:
- Topics to review (extracted from that course's checkpoint questions and, if loaded, PDF topics)
- Number of study sessions (practice trials) remaining before the due date (1 trial per day recommended)
- Current readiness % for that course (see R16.3)
- "Train now" button to start a practice trial

**ACCEPTANCE:**
- Topics are listed as short phrases (e.g., "Matrix multiplication", "Eigenvalues")
- Study sessions count is computed as `max(0, daysUntilDue - 1)` (at least one day buffer)
- Readiness % is displayed with color coding (red <40%, yellow 40-70%, green >70%)
- "Train now" button is prominent and accessible via keyboard (Enter)

### R16.2: Practice Trials (5-Question Training)
**WHEN** the player clicks "Train now" or selects "Train" from the War Room menu,  
**THE SYSTEM SHALL** present a 5-question practice trial for the selected course:
- Questions are drawn from that course's checkpoint pool (or generated from PDF if loaded)
- Each question is multiple-choice (4 options)
- Immediate feedback after each answer (correct/incorrect with explanation if available)
- Score is computed as percentage correct (0-100%)

**ACCEPTANCE:**
- Trial completes in <2 minutes (no time limit per question)
- Trial does not pause or affect ongoing game waves
- Trial can be accessed from War Room or pre-wave Scout report
- Questions are not repeated within a single trial

### R16.3: Readiness Tracking per Course
**WHEN** the player completes a practice trial,  
**THE SYSTEM SHALL**:
- Update the readiness score for that course (weighted average of recent trial scores with recency weighting)
- Track trial history (timestamp, score, topic coverage)
- Display readiness % in War Room course cards and Scout reports
- Identify weak topics (questions consistently answered incorrectly) and list them in the Battle Plan

**ACCEPTANCE:**
- Readiness score is in [0, 100] (pure function, unit-testable)
- More correct answers never lowers readiness (monotonic improvement within a trial)
- Recency weighting: recent trials (last 7 days) have 2× weight vs older trials
- Weak topics are listed if answer rate <50% across all trials for that topic
- Readiness % is persisted in localStorage

### R16.4: Tower Upgrades from Training
**WHEN** the player completes a practice trial with score ≥70%,  
**THE SYSTEM SHALL** grant:
- Tower upgrade currency for that course (e.g., +50 gold or +1 upgrade token per trial)
- Visual feedback: "Training complete! Tower upgraded." with GSAP animation

**WHEN** the player completes a practice trial with score ≥90%,  
**THE SYSTEM SHALL** additionally:
- Charge the special attack meter by +33% for that course

**ACCEPTANCE:**
- Currency/upgrades are granted immediately after trial ends
- No reward for scores <70% (encourages re-training on weak topics)
- Upgrades are course-specific (not generic gold pool)
- Visual feedback completes in <1s

---

## R17: Scout Report & Debrief

### R17.1: Scout Report (Pre-Wave)
**WHEN** the player is about to start a wave (from War Room or after previous wave),  
**THE SYSTEM SHALL** display a Scout Report overlay with:
- Upcoming enemies in this wave (names, types, courses)
- Current readiness % for each course represented in the wave
- Recommendation: "Your CV readiness is 40%. Train before the battle?" if any course readiness <60%
- Options: "Train now" (opens practice trial for weakest course) or "Start battle" (proceeds to wave)

**ACCEPTANCE:**
- Scout report is shown immediately after clicking "Start Wave" in War Room
- Report is skippable (Esc or "Start battle" button)
- Readiness % is accurate (from latest trial scores)
- Recommendation highlights the weakest course (lowest readiness % among wave participants)
- Keyboard navigation: Tab to cycle, Enter to select

### R17.2: Debrief (Post-Wave)
**WHEN** a wave ends (victory or defeat),  
**THE SYSTEM SHALL** display a Debrief overlay with:
- Wave outcome: "Victory" or "Defeat"
- Performance summary: enemies defeated, fortress damage taken, gold earned
- Real-world mapping: "The Midterm boss broke through: your CV readiness is low. 2 trials recommended before Thursday."
- Specific recommendations per course based on enemy outcomes (e.g., if exam enemy survived → "High priority: train CV101 before Dec 3")
- Next deadline reminder: "Next big enemy: DSA Quiz in 3 days"

**ACCEPTANCE:**
- Debrief is shown immediately after wave ends (before returning to War Room)
- Mapping is specific: mentions exact enemy names (e.g., "Midterm Examination") and real due dates
- Recommendations are actionable: specific trial counts and deadlines
- "Return to War Room" button is prominent
- Debrief can be dismissed with Esc or Enter

### R17.3: Real-World Context in Feedback
**WHEN** generating Scout reports or Debriefs,  
**THE SYSTEM SHALL**:
- Use real coursework item names (not generic "Enemy A")
- Use real due dates and days remaining
- Compute recommended trial count as `ceil((daysUntilDue - 1) * (1 - readiness/100))` (more trials needed if readiness is low and deadline is close)
- Prioritize feedback for high-weight items (exams, projects) over low-weight quizzes

**ACCEPTANCE:**
- Zero placeholder text (e.g., no "TODO" or "generic enemy")
- Trial recommendations are non-negative integers (pure function, unit-testable)
- Feedback is concise (<3 sentences per course in Debrief)
- High-weight items (≥50 points) are always mentioned if present in wave

---

## R14: Moodle Block & LMS Showcase

### R14.1: Moodle Block Plugin Structure
**THE SYSTEM SHALL** include a Moodle 4.5 block plugin at `moodle/block_gradedefense/` with:
- `version.php`: plugin metadata (version, requires Moodle 4.5+, component name `block_gradedefense`)
- `block_gradedefense.php`: block class extending `block_base`, renders iframe embedding the static game
- `lang/en/block_gradedefense.php`: English language strings (block title, description)
- `styles.css`: iframe styling (responsive, 100% width, min-height 600px)

**ACCEPTANCE:**
- Plugin installs without errors on a fresh Moodle 4.5 instance
- Block can be added to any Moodle page via "Add a block"
- Iframe loads the deployed game URL

### R14.2: Moodle Calendar Data Integration
**WHEN** the Moodle block renders,  
**THE SYSTEM SHALL**:
- Fetch the current user's upcoming calendar events via Moodle's `core_calendar_get_calendar_upcoming_view` API (server-side)
- Transform events to the same JSON schema as demo.json (name, courseId, dueDate, points, type)
- Pass the JSON payload to the game via `postMessage` after iframe load

**WHEN** the game receives a postMessage,  
**THE SYSTEM SHALL**:
- Validate the payload schema (TypeScript type guard)
- Verify the message origin matches expected Moodle domain (configurable allowlist)
- If valid, replace demo data with Moodle data
- If invalid, log error to console and fall back to demo data

**ACCEPTANCE:**
- postMessage contract is documented in `docs/moodle-integration.md`
- Game handles malformed or malicious postMessage gracefully (no crash)
- Origin check prevents XSS from untrusted domains

### R14.3: LMS Showcase Page
**THE SYSTEM SHALL** include a static page `showcase/lms.html` that:
- Imitates a generic LMS dashboard layout (sidebar with course list, main content area)
- Embeds the game in an iframe styled as a "block"
- Loads demo semester data from `src/data/demo.json` and sends it via postMessage (same contract as Moodle block)
- Uses NO Moodle trademarks, logos, or copyrighted UI elements

**ACCEPTANCE:**
- Page is visually distinct from Moodle (generic branding: "My Learning Portal")
- postMessage integration works identically to real Moodle block
- Suitable for demo video recording

### R14.4: Security & Privacy
**THE SYSTEM SHALL NOT**:
- Include Moodle session tokens or user credentials in URLs or postMessage payloads
- Store Moodle user data in localStorage (only the transformed coursework JSON, no PII)
- Make client-side requests to Moodle APIs (all Moodle data fetching is server-side in the block)

**ACCEPTANCE:**
- Code review confirms no tokens in repo or logs
- postMessage payload contains only coursework data (no user names, emails, or session IDs)

---

## R12: Costume Contest Criteria

### R12.1: Haunting UI
**THE SYSTEM SHALL** present a dark-fantasy aesthetic:
- Color palette: deep purples, blood reds, bone whites, shadow blacks (tokens in design.md)
- Fonts: Google Fonts with OFL license (e.g., Cinzel, Creepster)
- Animations: GSAP for smooth, eerie transitions
- Particle effects: fog, embers, ghostly trails (canvas or WebGL)

**ACCEPTANCE:**
- Visuals are cohesive and polished
- Spooky design serves the function (e.g., enemy glow = neglected deadline)
- No placeholder or Lorem Ipsum content

### R12.2: Polished & Memorable
**THE SYSTEM SHALL**:
- Load quickly (<3s)
- Run at 60 FPS on a mid-range laptop (2023 MacBook Air M2)
- Have no visible bugs in the first 5 minutes of play

**ACCEPTANCE:**
- Playwright smoke tests pass (see tasks.md)
- Manual playtesting by 2 external users confirms polish

---

## Non-Functional Requirements

### NFR1: Browser Compatibility
**THE SYSTEM SHALL** run on:
- Chrome 120+ (CI-tested with Playwright)
- Edge 120+ (Chromium-based, CI-tested)
- Firefox 120+ (should work, not CI-tested)
- Safari 17+ (should work, not CI-tested)

**CI TESTING:** Only Chromium (Chrome/Edge) is installed in the CI environment. Firefox and Safari compatibility is verified manually during final polish.

### NFR2: Performance
- 60 FPS with 20 enemies on screen
- Checkpoint answer latency <100ms
- Build time <30s on a 4-core CPU

### NFR3: Code Quality
- TypeScript strict mode, zero errors
- Core rules (src/core) have 90% test coverage
- Property-based tests for scoring formulas
- Playwright smoke tests pass

### NFR4: Licensing
- All assets CC0, CC-BY, or original
- Fonts: OFL
- No copyrighted music
- CREDITS.md lists all third-party assets
