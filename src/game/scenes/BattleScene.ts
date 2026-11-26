/**
 * BattleScene: the semester siege. Kiro's pure rules (src/core: wave, sim,
 * targeting, neglect, qte) drive the state; this scene renders it in the
 * "Haunted Study" style and connects every battle to real study:
 * - Scout report before each wave (what is due this week, readiness, Train).
 * - Duels (R18): pick a deadline and break its seals with questions from its course.
 * - Bosses (exams) trigger quick-time exam questions at 50% HP.
 * - Sentinels are forged by practice trials (forge levels from the War Room).
 * - Debrief after each wave maps the battle back to real study actions.
 * Ref: tasks.md phases 3–7, R13, R15–R17; art-direction.md
 */

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Palette, getCourseColor } from '../palette';
import { Layout, laneY } from '../layout';
import { prefersReducedMotion } from '../fx/Atmosphere';
import { Battlefield3D } from '../../game3d/Battlefield3D';
import { mountLayer } from '../../ui/stage';
import { generateWave, campaignWeeks, tutorialWave } from '../../core/wave';
import { stepSimulation, type SimConfig, type SimEvent } from '../../core/sim';
import { shouldTriggerQTE, resolveQTE } from '../../core/qte';
import { mulberry32 } from '../../core/rng';
import { BALANCE } from '../../core/balance';
import { sealsFor, applyAnswer, creepSpeed } from '../../core/duel';
import type { Semester, GameState, EnemyStats } from '../../core/types';
import { getSemester, questionsFor, recordSession, forgeLevel, readinessFor, courseView, type Question } from '../../study/model';
import { load, save } from '../../save/save';
import { Hud, titleCard, scoutReport, debrief, duelCard, qteCard, pauseMenu, coach, type ScoutGroup } from '../../ui/BattleUI';
import { clearLayers } from '../../ui/stage';
import { openTrial } from '../../ui/TrialPanel';
import { runTour, hasSeen } from '../../ui/Tour';
import { sfx, startDrone, stopDrone } from '../../audio/sfx';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;


type Phase = 'scout' | 'intro' | 'fight' | 'check' | 'duel' | 'qte' | 'debrief' | 'paused' | 'over';

interface WaveStats {
  kills: number;
  breaches: Record<string, number>;
  bossesSlain: string[];
  checks: { ok: number; total: number };
  qte: { ok: number; total: number };
}

export class BattleScene extends Phaser.Scene {
  private semester!: Semester;
  private gameState!: GameState;
  private phase: Phase = 'scout';
  private phaseBeforePause: Phase = 'fight';
  private waveStartTimeMs = 0;
  private waveTotal = 0;
  private weeks: { waveIndex: number; weekNumber: number; itemCount: number }[] = [];
  private tutorial = false;
  private tutorialStep = 0;
  private reduced = false;
  private rng = mulberry32(Date.now() & 0xffff);
  private timeScale = 1;
  private clearing = false;
  private targetId: string | null = null;
  private streak = 0;
  private lastHudTarget = '';

  private view!: Battlefield3D;
  private labels?: HTMLDivElement;
  private towerKeys = new Map<string, string>(); // "x,y" -> tower key
  private socketsOpen = new Set<string>();
  private enemyMeta = new Map<string, { courseId: string; label: string; isBoss: boolean; lane: number }>();
  private qteDone = new Map<string, number>();
  private enrageUntil = new Map<string, number>();
  private hud?: Hud;
  private stats: WaveStats = this.freshStats();
  private sessionAnswers = new Map<string, { questionId: string; correct: boolean }[]>();
  private overlay?: HTMLElement;
  private coachEl?: HTMLElement;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(data?: { tutorial?: boolean }) {
    const { width: W, height: H } = this.cameras.main;
    this.reduced = prefersReducedMotion();
    this.semester = getSemester();
    this.weeks = campaignWeeks(this.semester, Date.now());
    this.tutorial = data?.tutorial ?? !load().tutorialDone;
    this.tutorialStep = 0;
    this.towerKeys.clear();
    this.socketsOpen.clear();
    this.enemyMeta.clear();
    this.qteDone.clear();
    this.enrageUntil.clear();
    this.sessionAnswers.clear();
    this.timeScale = 1;
    void W;
    void H;

    // The 3D battlefield renders over the Phaser canvas; DOM labels float above it.
    this.labels = mountLayer('enemy-labels');
    this.view = new Battlefield3D(document.getElementById('game-container')!, this.labels, this.reduced);
    this.view.onEnemyClick = (id) => {
      if (this.phase !== 'fight') return;
      this.setTarget(id);
      void this.openDuel(id);
    };
    this.drawLaneLabels();

    this.initializeGameState();

    this.hud = new Hud({
      onCheck: () => void this.openDuel(),
      onSpecial: () => void this.openDuel(),
      onPause: () => this.togglePause(),
    });
    this.setupInput();
    this.events.once('shutdown', () => this.teardown());

    this.cameras.main.fadeIn(this.reduced ? 0 : 500, 7, 6, 11);
    startDrone();
    if (this.tutorial) this.time.delayedCall(400, () => this.beginTutorial());
    else this.time.delayedCall(350, () => this.showScout());
  }

  // ───────────────────────── setup ─────────────────────────

  private freshStats(): WaveStats {
    return { kills: 0, breaches: {}, bossesSlain: [], checks: { ok: 0, total: 0 }, qte: { ok: 0, total: 0 } };
  }

  private initializeGameState(): void {
    const saved = load().campaign.wave;
    this.gameState = {
      wave: this.tutorial ? 0 : Math.min(Math.max(1, saved), Math.max(1, this.weeks.length)),
      gold: 60,
      fortressHp: 100,
      maxFortressHp: 100,
      towers: [],
      enemies: [],
      pending: [],
      chargeMeter: 0,
      special: 0,
      answeredQuestions: [],
      lastAnswerTime: 0,
      timeMs: 0,
    };
  }

  /** Course names along the far end of each lane (DOM, crisp at any scale). */
  private drawLaneLabels(): void {
    const html = this.semester.courses
      .slice(0, Layout.LANE_COUNT)
      .map((c, i) => {
        const at = this.view.laneScreen(i);
        return `<div class="lane-name" style="left:${at.x}px;top:${at.y}px;--c:${hex(getCourseColor(c.id))}">${c.title}</div>`;
      })
      .join('');
    mountLayer('lane-names', html);
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault();
      void this.openDuel();
    });
    kb.on('keydown-C', () => void this.openDuel());
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      if (this.phase === 'fight') this.cycleTarget(e.shiftKey ? -1 : 1);
    });
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-M', () => this.hud?.toggleMute());
    kb.on('keydown-ESC', () => {
      if (this.phase === 'fight') this.togglePause();
    });
  }

  // ───────────────────────── targeting & duels ─────────────────────────

  private nearestEnemies(): EnemyStats[] {
    return [...this.gameState.enemies].sort((a, b) => b.pathProgress - a.pathProgress);
  }

  private setTarget(id: string | null): void {
    this.targetId = id;
    this.view.setTarget(id);
  }

  private cycleTarget(dir: number): void {
    const list = this.nearestEnemies();
    if (!list.length) return;
    const i = list.findIndex((e) => e.id === this.targetId);
    const next = list[(i + dir + list.length) % list.length];
    this.setTarget(next.id);
  }

  /**
   * Duel one deadline with questions from its own course (R18). Each correct
   * answer breaks a seal (Kiro's applyAnswer); a wrong one lets it lurch
   * closer but shows the explanation. Time slows while you think.
   */
  private async openDuel(id?: string): Promise<void> {
    if (this.phase !== 'fight') return;
    const pick = (id && this.gameState.enemies.find((e) => e.id === id)) || this.gameState.enemies.find((e) => e.id === this.targetId) || this.nearestEnemies()[0];
    if (!pick) return;
    this.setTarget(pick.id);
    this.phase = 'duel';
    this.timeScale = 0.2;
    this.view.setSlowmo(true);
    const course = this.semester.courses.find((c) => c.id === pick.courseId)!;
    const color = getCourseColor(pick.courseId);
    if (this.tutorial) this.advanceTutorial(2);
    while (this.phase === 'duel') {
      const e = this.gameState.enemies.find((x) => x.id === pick.id);
      if (!e) break;
      const q = this.pickQuestion(e.courseId);
      const ok = await duelCard(q, {
        name: e.isMinion ? `${e.label} (minion)` : e.label,
        courseTitle: course.title,
        color: hex(color),
        seals: Math.ceil(e.hp),
        maxSeals: Math.ceil(e.maxHp),
        daysLeft: e.daysLeft,
        streak: this.streak,
      });
      if (ok === null || this.phase !== 'duel') break;
      this.stats.checks.total++;
      this.noteAnswer(e.courseId, q.id, ok);
      const live = this.gameState.enemies.find((x) => x.id === pick.id);
      if (!live) break;
      const span = Layout.ENEMY_SPAWN_X - Layout.FORTRESS_X_MAX;
      const res = applyAnswer({ seals: Math.ceil(live.hp), maxSeals: Math.ceil(live.maxHp), progress: live.pathProgress }, ok, this.streak);
      if (ok) {
        this.streak++;
        this.stats.checks.ok++;
        this.view.strike(live.id, color);
        sfx('crit');
        this.floatLabel(live.id, res.damage > 1 ? `−${res.damage} seals` : '−1 seal', 0xe9dcc0, 17);
        await new Promise((r) => setTimeout(r, 420));
        const still = this.gameState.enemies.find((x) => x.id === pick.id);
        if (!still) break;
        still.hp = res.state.seals;
        this.view.moveEnemy(still.id, still.x, still.y, still.hp / still.maxHp);
        if (res.state.seals <= 0) {
          if (!still.isMinion) this.floatLabel(still.id, 'DEFEATED', 0xf2b45a, 34);
          this.killEnemy(still);
          this.hud?.caption(`${still.label} is defeated: you are readier for it`, 'good');
          if (this.tutorial) this.advanceTutorial(3);
          break;
        }
      } else {
        this.streak = 0;
        live.x = Math.max(Layout.FORTRESS_X_MAX + 1, live.x - res.lurch * span);
        live.pathProgress = live.progress = res.state.progress;
        this.floatLabel(live.id, 'creeps closer', 0xc9636b, 15);
        this.hud?.caption('Wrong: it creeps closer. Read the explanation, it comes back.', 'bad');
      }
    }
    this.view.setSlowmo(false);
    this.timeScale = 1;
    if (this.phase === 'duel') this.phase = 'fight';
    const next = this.nearestEnemies()[0];
    this.setTarget(next?.id ?? null);
  }

  // ───────────────────────── wave flow ─────────────────────────

  private weekOf(wave: number): number {
    return this.weeks.find((w) => w.waveIndex === wave)?.weekNumber ?? wave;
  }

  private prepareWave(wave: number): EnemyStats[] {
    const now = Date.now();
    const list = wave === 0 ? tutorialWave(this.semester, now, this.rng) : generateWave(this.semester, wave, now, this.rng);
    // Duel combat (R18): at most two minions per deadline, seals instead of HP,
    // slow creeping so a week plays like a study session.
    const minionsPer = new Map<string, number>();
    const span = Layout.ENEMY_SPAWN_X - Layout.FORTRESS_X_MAX;
    const kept = list.filter((e) => {
      if (!e.isMinion) return true;
      const k = e.parentItemId ?? e.itemId;
      const n = (minionsPer.get(k) ?? 0) + 1;
      minionsPer.set(k, n);
      return n <= (wave === 0 ? 1 : 2);
    });
    void BALANCE;
    return kept.map((e, i) => {
      const lane = Math.min(Layout.LANE_COUNT - 1, Math.max(0, e.lane));
      const y = laneY(lane) + (e.isMinion ? Phaser.Math.Between(-26, 26) : 0);
      const item = this.semester.courses.flatMap((c) => c.items).find((it) => it.id === (e.parentItemId ?? e.itemId));
      const seals = sealsFor(e, item?.points ?? 20);
      // Training in the War Room pre-weakens that course's deadlines.
      const pre = e.isMinion ? 0 : Math.min(seals - 1, Math.floor(forgeLevel(e.courseId) / 2));
      const speed = creepSpeed(e.type, !!e.isMinion, e.daysLeft) * span * (wave === 0 ? 1.6 : 1);
      return {
        ...e, lane, x: Layout.ENEMY_SPAWN_X, y, pathProgress: 0, progress: 0,
        hp: seals - pre, maxHp: seals, speed, damage: e.isMinion ? 5 : e.type === 'exam' ? 30 : 15,
        spawnDelayMs: wave === 0 ? i * 1500 : e.spawnDelayMs * 2.5,
      };
    });
  }

  private showScout(): void {
    this.phase = 'scout';
    const wave = this.gameState.wave;
    const preview = this.prepareWave(wave);
    const groups = new Map<string, ScoutGroup>();
    for (const e of preview) {
      const course = this.semester.courses.find((c) => c.id === e.courseId);
      if (!course) continue;
      const g = groups.get(e.courseId) ?? {
        courseId: e.courseId,
        title: course.title,
        color: hex(getCourseColor(e.courseId)),
        names: [],
        readiness: readinessFor(e.courseId),
        count: 0,
      };
      g.count++;
      if (!e.isMinion && !g.names.includes(e.label)) g.names.push(e.label);
      groups.set(e.courseId, g);
    }
    const week = `Week ${this.weekOf(wave)} of the siege · wave ${wave} of ${this.weeks.length}`;
    this.overlay = scoutReport(
      week,
      [...groups.values()],
      (courseId) => {
        this.overlay?.remove();
        openTrial(courseId, () => {
          this.refreshForge(courseId);
          this.showScout();
        });
      },
      () => {
        this.overlay?.remove();
        this.startWave(preview);
      },
    );
  }

  private async startWave(enemies: EnemyStats[]): Promise<void> {
    this.phase = 'intro';
    this.clearing = false;
    this.stats = this.freshStats();
    this.waveTotal = enemies.length;
    const wave = this.gameState.wave;
    const boss = enemies.find((e) => e.type === 'exam' && !e.isMinion);
    const main = boss ?? enemies.find((e) => !e.isMinion);
    sfx('bell');
    this.hud?.caption('A bell tolls: the wave begins');
    const eyebrow = wave === 0 ? 'The first night' : `Week ${this.weekOf(wave)}`;
    const title = boss ? `${boss.label.replace(/Examination/, 'Exam')} rises` : main ? `${main.label} approaches` : 'Silence';
    const sub = boss ? `${boss.courseId} · due ${boss.daysLeft <= 1 ? 'in a day' : `in ${boss.daysLeft} days`}` : `${enemies.length} creatures in the fog`;
    await titleCard(eyebrow, title, sub, !!boss);
    this.gameState.pending = enemies;
    this.waveStartTimeMs = this.gameState.timeMs;
    this.phase = 'fight';
    if (this.tutorial) this.advanceTutorial(1);
    else if (!hasSeen('battle')) this.battleTour();
  }

  /** First real battle: a guided tour of every control, with the siege paused. */
  private battleTour(): void {
    this.phase = 'check';
    runTour(
      'battle',
      [
        { target: '.hud-wave', art: 'timeline', title: 'This week of your semester', body: 'Each wave is one real week. The creatures are what is due in it, crawling slowly toward your semester.' },
        { target: '.hud-hp', art: 'hp', title: 'Your semester', body: 'Every deadline that reaches the altar costs integrity. At zero, the semester falls.' },
        { target: { x: 380, y: 150, w: 760, h: 560 }, art: 'deadline', title: 'The horde', body: 'Each creature carries its coursework on a scroll. Exams are crowned wraiths with many seals; quizzes are cursed pages.' },
        { target: '.hud-btn.check', art: 'study', title: 'Duel', body: 'Click a creature (or <span class="dd-kbd">Tab</span> to target, <span class="dd-kbd">Space</span> to duel). Answer questions from its course: each correct answer breaks a seal.' },
        { target: null, art: 'qte', title: 'Last stand', body: 'If an exam reaches the duel zone, time slows and a timed question appears. Know it, and you strike twice.' },
        { target: '.hud-right', art: 'keys', title: 'Controls', body: '<span class="dd-kbd">P</span> pause, <span class="dd-kbd">M</span> sound. Reduced motion lives in the pause menu. Every sound also appears as a caption.' },
      ],
      () => {
        if (this.phase === 'check') this.phase = 'fight';
      },
    );
  }

  private onWaveCleared(): void {
    if (this.phase === 'over') return;
    this.phase = 'debrief';
    sfx('victory');
    const wave = this.gameState.wave;
    this.gameState.gold += 40;
    this.gameState.fortressHp = Math.min(this.gameState.maxFortressHp, this.gameState.fortressHp + 10);
    this.flushSessions();

    if (this.tutorial) {
      this.endTutorial();
      return;
    }
    const last = wave >= this.weeks.length;
    save((d) => {
      d.campaign.wave = last ? 1 : wave + 1;
      d.campaign.bestWave = Math.max(d.campaign.bestWave, wave);
    });
    const lines = [
      `<b>${this.stats.kills}</b> creatures banished${this.stats.bossesSlain.length ? `, including <b>${this.stats.bossesSlain.join(', ')}</b>` : ''}.`,
      `Fortress integrity <b>${Math.ceil(this.gameState.fortressHp)}%</b> &middot; Gold <b>${this.gameState.gold}</b>`,
      this.stats.checks.total + this.stats.qte.total
        ? `Study answers in battle: <b>${this.stats.checks.ok + this.stats.qte.ok} / ${this.stats.checks.total + this.stats.qte.total}</b> correct.`
        : 'You did not answer a single question this wave.',
    ];
    const advice = this.adviceFor(true);
    if (last) {
      this.phase = 'over';
      this.overlay = debrief(
        { title: 'The semester is saved', lines, advice, primary: 'Return to the War Room', tone: 'win' },
        () => this.toWarRoom(),
      );
      return;
    }
    this.overlay = debrief(
      { title: `Week ${this.weekOf(wave)} holds`, lines, advice, primary: 'Scout the next week', secondary: 'War Room', tone: 'wave' },
      () => {
        this.overlay?.remove();
        this.gameState.wave++;
        this.showScout();
      },
      () => this.toWarRoom(),
    );
  }

  private onDefeat(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    sfx('defeat');
    this.flushSessions();
    this.view.breach(1);
    const breached = Object.entries(this.stats.breaches).sort((a, b) => b[1] - a[1]);
    const lines = [
      `The fog swallowed the grimoire in week ${this.weekOf(this.gameState.wave)}.`,
      breached.length
        ? `Breaches: ${breached.map(([c, n]) => `<b>${this.semester.courses.find((x) => x.id === c)?.title ?? c}</b> ×${n}`).join(', ')}`
        : '',
    ].filter(Boolean);
    this.overlay = debrief(
      { title: 'The semester has fallen', lines, advice: this.adviceFor(false), primary: 'Train in the War Room', secondary: 'Retry the week', tone: 'lose' },
      () => this.toWarRoom(),
      () => this.scene.restart({ tutorial: false }),
    );
  }

  /** Turn battle facts into real study advice (R17). */
  private adviceFor(won: boolean): string[] {
    const out: string[] = [];
    const breachedCourses = Object.keys(this.stats.breaches);
    const thisWaveCourses = new Set(this.gameState.towers.map((t) => t.courseId));
    const views = this.semester.courses.filter((c) => thisWaveCourses.has(c.id)).map((c) => courseView(c));
    for (const v of views
      .filter((v) => breachedCourses.includes(v.course.id) || (v.next && v.next.days <= 7 && v.readiness < 60))
      .slice(0, 3)) {
      if (!v.next) continue;
      out.push(
        `<b>${v.next.name}</b> (${v.course.title}) is ${v.next.days <= 1 ? 'due very soon' : `due in ${v.next.days} days`}. Readiness ${v.readiness}%: ${
          v.recommendedTrials > 0 ? `${v.recommendedTrials} practice trial${v.recommendedTrials > 1 ? 's' : ''} recommended` : 'one more trial keeps it sharp'
        }.`,
      );
      if (v.weakTopics.length) out.push(`Revisit in ${v.course.title}: <b>${v.weakTopics.join(', ')}</b>.`);
    }
    if (!out.length && won) out.push('Every lane held. Keep one short trial a day to stay ahead of the next week.');
    return out;
  }

  // ───────────────────────── study actions ─────────────────────────

  private pickQuestion(courseId: string): Question {
    const pool = questionsFor(courseId);
    const seen = new Set(this.gameState.answeredQuestions);
    const fresh = pool.filter((q) => !seen.has(q.id));
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(this.rng() * list.length)];
  }

  private noteAnswer(courseId: string, questionId: string, correct: boolean): void {
    this.gameState.answeredQuestions.push(questionId);
    const arr = this.sessionAnswers.get(courseId) ?? [];
    arr.push({ questionId, correct });
    this.sessionAnswers.set(courseId, arr);
  }

  /** Battle answers count toward readiness/forge too (correct answers only earn). */
  private flushSessions(): void {
    for (const [courseId, answers] of this.sessionAnswers) {
      const gain = recordSession(courseId, answers, 'battle');
      if (gain.levelsGained) this.hud?.caption(`${courseId} forge level ${gain.level}`, 'good');
    }
    this.sessionAnswers.clear();
  }

  private damageEnemy(e: EnemyStats, amount: number, color: number): void {
    const before = e.hp / e.maxHp;
    e.hp -= amount;
    this.view.hitEnemy(e.id);
    this.view.hitSpark(e.x, e.y, color);
    this.floatNumber(e.id, Math.round(amount), color);
    if (e.hp <= 0) {
      this.killEnemy(e);
      return;
    }
    this.view.moveEnemy(e.id, e.x, e.y, e.hp / e.maxHp);
    this.maybeQTE(e, before, e.hp / e.maxHp);
  }

  private killEnemy(e: EnemyStats): void {
    this.gameState.enemies = this.gameState.enemies.filter((x) => x.id !== e.id);
    this.onKillFx(e.id, e.x, e.y, e.courseId);
    // Kills outside the simulation (duels, QTE crit) can empty the field; the
    // sim only reports waveCleared for its own kills, so check here too.
    if (!this.gameState.enemies.length && !this.gameState.pending.length && !this.clearing) {
      this.clearing = true;
      this.time.delayedCall(700, () => this.onWaveCleared());
    }
  }

  private maybeQTE(e: EnemyStats, before: number, after: number): void {
    if (this.phase !== 'fight') return;
    const count = this.qteDone.get(e.id) ?? 0;
    const max = e.type === 'exam' ? 1 : 2;
    if (count >= max) return;
    if (!shouldTriggerQTE(e, before, after, false)) return;
    this.qteDone.set(e.id, count + 1);
    void this.runQTE(e);
  }

  private async runQTE(e: EnemyStats): Promise<void> {
    this.phase = 'qte';
    this.timeScale = 0.2;
    const course = this.semester.courses.find((c) => c.id === e.courseId)!;
    const q = this.pickQuestion(e.courseId);
    const extra = load().settings.extraTime || this.reduced;
    this.view.setSlowmo(true);
    this.hud?.caption('Heartbeat: a quick-time exam', 'bad');
    const ok = await qteCard(q, course.title, hex(getCourseColor(e.courseId)), extra ? 16000 : 8000, extra);
    this.view.setSlowmo(false);
    this.timeScale = 1;
    if (this.phase !== 'qte') return;
    this.phase = 'fight';
    this.stats.qte.total++;
    this.noteAnswer(e.courseId, q.id, ok);
    const live = this.gameState.enemies.find((x) => x.id === e.id);
    const outcome = resolveQTE({ enemyId: e.id, question: { ...q, courseId: e.courseId }, timeRemaining: 0, maxTime: 1, startedAt: 0 }, ok ? q.correctIndex : null, 60);
    if (outcome.success) {
      this.stats.qte.ok++;
      sfx('crit');
      this.hud?.caption('Critical strike: knowledge cuts deep', 'good');
      if (live) {
        this.view.strike(live.id, 0xffffff);
        this.damageEnemy(live, Math.min(live.hp, 2), 0xffffff);
      }
    } else if (live && outcome.enrage) {
      sfx('enrage');
      this.hud?.caption(`${live.label} is enraged`, 'bad');
      live.speed *= outcome.enrage.speedMult;
      live.damage = Math.round(live.damage * outcome.enrage.damageMult);
      this.enrageUntil.set(live.id, this.gameState.timeMs + outcome.enrage.durationMs);
      this.view.setEnraged(live.id, true);
      this.floatLabel(live.id, 'ENRAGED', 0xff6b74);
    }
  }

  // ───────────────────────── tutorial ─────────────────────────

  private beginTutorial(): void {
    this.gameState.wave = 0;
    this.coachEl = coach(
      'Every creature is a <b>real deadline</b> from your courses, crawling toward your semester. Its scroll shows what it is and how many days are left.',
      1000,
      420,
    );
    this.time.delayedCall(this.reduced ? 3000 : 5200, () => {
      this.coachEl?.remove();
      void this.startWave(this.prepareWave(0));
    });
  }

  private advanceTutorial(step: number): void {
    if (!this.tutorial || step <= this.tutorialStep) return;
    this.tutorialStep = step;
    this.coachEl?.remove();
    document.querySelector('.hud-btn.check')?.classList.remove('beckon');
    if (step === 1) {
      this.time.delayedCall(1800, () => {
        if (this.tutorialStep !== 1 || this.phase !== 'fight') return;
        this.coachEl = coach('<b>Click a creature</b> (or press <span class="dd-kbd">Space</span>) to duel it with questions from <b>its own course</b>.', 1000, 420);
        document.querySelector('.hud-btn.check')?.classList.add('beckon');
      });
    } else if (step === 3) {
      this.coachEl = coach('Each correct answer breaks a <b>seal</b>. Wrong answers let it creep closer, but show you why. Exams have many seals: beat one and you are ready for it.', 1000, 420);
      this.time.delayedCall(6500, () => this.coachEl?.remove());
    }
  }

  private endTutorial(): void {
    this.coachEl?.remove();
    save((d) => (d.tutorialDone = true));
    this.overlay = debrief(
      {
        title: 'The first night is survived',
        lines: [
          'Deadlines become creatures. <b>Studying is your weapon.</b>',
          'Pick a deadline and duel it with questions from its course: every correct answer breaks a seal.',
          'Training in the War Room weakens a course\'s deadlines before they even arrive.',
        ],
        advice: [],
        primary: 'Enter the War Room',
        secondary: 'Fight week 1 now',
        tone: 'win',
      },
      () => this.toWarRoom(),
      () => this.scene.restart({ tutorial: false }),
    );
  }

  // ───────────────────────── frame loop ─────────────────────────

  update(_time: number, deltaRaw: number): void {

    if (this.phase === 'fight' || this.phase === 'qte' || this.phase === 'check') {
      const dt = this.phase === 'check' ? 0 : Math.min(50, deltaRaw) * this.timeScale;
      if (dt > 0) this.step(dt);
    }

    const hp = this.gameState.fortressHp;
    const defeated = this.stats.kills;
    this.hud?.update({
      waveLabel: this.gameState.wave === 0 ? 'The first night' : `Week ${this.weekOf(this.gameState.wave)}`,
      waveSub: this.gameState.wave === 0 ? 'Tutorial' : `Wave ${this.gameState.wave} of ${this.weeks.length}`,
      hp,
      maxHp: this.gameState.maxFortressHp,
      gold: this.gameState.gold,
      charge: this.gameState.special,
      progress: this.waveTotal ? Math.min(1, defeated / this.waveTotal) : 0,
    });
    const tgt = this.gameState.enemies.find((e) => e.id === this.targetId);
    if (!tgt && this.phase === 'fight' && this.gameState.enemies.length) this.setTarget(this.nearestEnemies()[0].id);
    const tt = tgt ? `Target: <b>${tgt.label}</b> · ${Math.ceil(tgt.hp)} seal${Math.ceil(tgt.hp) === 1 ? '' : 's'}` : '';
    if (tt !== this.lastHudTarget) {
      this.lastHudTarget = tt;
      this.hud?.setTarget(tt);
    }
    this.view.setDanger(Phaser.Math.Clamp((0.5 - hp / this.gameState.maxFortressHp) * 1.6, 0, 0.8));
    this.view.update(deltaRaw);

    if (this.phase === 'fight' && hp <= 0) this.onDefeat();
  }

  private step(dt: number): void {
    const config: SimConfig = { fortressX: Layout.FORTRESS_X_MAX, spawnX: Layout.ENEMY_SPAWN_X, waveStartTimeMs: this.waveStartTimeMs };
    const hpBefore = new Map(this.gameState.enemies.map((e) => [e.id, e.hp / e.maxHp]));
    const res = stepSimulation(this.gameState, dt, config, this.rng);
    this.gameState = res.state;
    // Expire enrage
    for (const [id, until] of this.enrageUntil) {
      if (this.gameState.timeMs > until) {
        this.enrageUntil.delete(id);
        this.view.setEnraged(id, false);
      }
    }
    this.handleEvents(res.events, hpBefore);
    // The exam arrives: every boss that crosses into the duel zone forces a
    // quick-time question when it reaches the duel zone.
    if (this.phase === 'fight') {
      for (const e of this.gameState.enemies) {
        if (e.type !== 'exam' || e.isMinion || this.qteDone.has(e.id)) continue;
        if (e.x < 860) {
          this.qteDone.set(e.id, 1);
          void this.runQTE(e);
          break;
        }
      }
    }
    for (const e of this.gameState.enemies) {
      this.view.moveEnemy(e.id, e.x, e.y, e.hp / e.maxHp);
      const meta = this.enemyMeta.get(e.id);
      if (e.neglected && meta && !meta.label.startsWith('!')) {
        meta.label = `!${meta.label}`;
        if (!e.isMinion) {
          this.floatLabel(e.id, 'NEGLECTED', 0xff9a5a);
          this.hud?.caption(`${e.label} grows stronger while neglected`, 'bad');
        }
      }
    }
  }

  private handleEvents(events: SimEvent[], hpBefore: Map<string, number>): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'spawn': {
          const e = ev.enemy;
          this.enemyMeta.set(e.id, { courseId: e.courseId, label: e.label, isBoss: e.type === 'exam' && !e.isMinion, lane: e.lane });
          this.view.addEnemy(e.id, e.type, !!e.isMinion, e.x, e.y, getCourseColor(e.courseId), e.isMinion ? null : e.label, e.daysLeft);
          if (e.isOverdue) this.view.setEnraged(e.id, true);
          break;
        }
        case 'projectile': {
          const key = this.towerKeys.get(`${ev.fromX},${ev.fromY}`);
          if (!key) break;
          this.view.towerFire(key);
          this.view.bolt(key, ev.toX, ev.toY, getCourseColor(key.split('#')[0]));
          break;
        }
        case 'hit': {
          sfx('hit');
          this.view.hitEnemy(ev.enemyId);
          const e = this.gameState.enemies.find((x) => x.id === ev.enemyId);
          if (e) this.maybeQTE(e, hpBefore.get(e.id) ?? 1, e.hp / e.maxHp);
          break;
        }
        case 'kill': {
          const meta = this.enemyMeta.get(ev.enemyId);
          this.onKillFx(ev.enemyId, ev.x, ev.y, meta?.courseId ?? '');
          break;
        }
        case 'fortressHit': {
          sfx('fortress');
          const meta = this.enemyMeta.get(ev.enemyId);
          const courseId = meta?.courseId ?? '?';
          this.stats.breaches[courseId] = (this.stats.breaches[courseId] ?? 0) + 1;
          this.view.removeEnemy(ev.enemyId);
          this.enemyMeta.delete(ev.enemyId);
          this.stats.kills++; // it leaves the field either way; progress counts it
          this.onBreach(ev.damage);
          break;
        }
        case 'waveCleared':
          if (!this.clearing) {
            this.clearing = true;
            this.time.delayedCall(700, () => this.onWaveCleared());
          }
          break;
      }
    }
  }



  // ───────────────────────── effects ─────────────────────────

  private onKillFx(id: string, _x: number, _y: number, courseId: string): void {
    const meta = this.enemyMeta.get(id);
    this.stats.kills++;
    sfx('kill');
    if (meta?.isBoss) {
      this.stats.bossesSlain.push(meta.label.replace(/^!/, ''));
      this.hud?.caption('A great enemy falls', 'good');
    }
    const screen = this.view.enemyScreen(id);
    this.view.killEnemy(id, getCourseColor(courseId));
    this.enemyMeta.delete(id);
    // A gold coin arcs to the HUD counter
    if (screen && !this.reduced && this.labels) {
      const coin = document.createElement('div');
      coin.className = 'coin-fly';
      coin.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
      this.labels.appendChild(coin);
      gsap.to(coin, {
        x: 1062 - screen.x,
        y: 40 - screen.y,
        duration: 0.7,
        ease: 'power2.in',
        onComplete: () => {
          coin.remove();
          this.hud?.goldPulse();
        },
      });
    }
  }

  private onBreach(damage: number): void {
    this.hud?.caption(`A deadline breaks through: −${damage}`, 'bad');
    this.view.breach(1 - this.gameState.fortressHp / this.gameState.maxFortressHp);
  }

  private floatNumber(id: string, n: number, color: number): void {
    this.floatLabel(id, String(n), color, 20);
  }

  /** Floating combat text above a creature (DOM, projected from 3D). */
  private floatLabel(id: string, s: string, color: number, size = 15): void {
    const at = this.view.enemyScreen(id);
    if (!at || !this.labels) return;
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = s;
    el.style.cssText = `left:${at.x}px;top:${at.y}px;color:${hex(color)};font-size:${size}px`;
    this.labels.appendChild(el);
    gsap.to(el, { y: -40, opacity: 0, duration: this.reduced ? 0.6 : 1, ease: 'power2.out', onComplete: () => el.remove() });
  }

  /** Training from the scout report pre-weakens that course's waiting deadlines. */
  private refreshForge(courseId: string): void {
    const pre = Math.floor(forgeLevel(courseId) / 2);
    for (const e of this.gameState.pending) {
      if (e.courseId !== courseId || e.isMinion) continue;
      e.hp = Math.max(1, Math.min(e.hp, e.maxHp - pre));
    }
  }

  // ───────────────────────── pause / exit ─────────────────────────

  private togglePause(): void {
    if (this.phase === 'paused') {
      this.overlay?.remove();
      this.phase = this.phaseBeforePause;
      return;
    }
    if (this.phase !== 'fight') return;
    this.phaseBeforePause = this.phase;
    this.phase = 'paused';
    const reducedOn = load().settings.reducedMotion;
    this.overlay = pauseMenu(
      () => this.togglePause(),
      () => this.toWarRoom(),
      () => {
        save((d) => (d.settings.reducedMotion = !d.settings.reducedMotion));
        this.reduced = prefersReducedMotion();
        this.overlay?.remove();
        this.phase = 'fight';
        this.togglePause();
      },
      reducedOn,
    );
  }

  private toWarRoom(): void {
    this.flushSessions();
    this.overlay?.remove();
    this.phase = 'over';
    this.cameras.main.fadeOut(this.reduced ? 0 : 400, 7, 6, 11);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('WarRoomScene'));
    if (this.reduced) this.scene.start('WarRoomScene');
  }

  private teardown(): void {
    stopDrone();
    this.view?.dispose();
    this.labels?.remove();
    clearLayers('.lane-names, .enemy-labels');
    this.hud?.destroy();
    this.hud = undefined;
    this.overlay?.remove();
    this.coachEl?.remove();
    clearLayers('.overlay, .coach-layer, .title-card, .battle-hud');
    gsap.killTweensOf('*');
    this.input.keyboard?.removeAllListeners();
  }
}

// Keep Palette referenced for consumers that import from this module.
export const BATTLE_PALETTE = Palette;
