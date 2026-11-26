/**
 * BattleScene: the semester siege. Kiro's pure rules (src/core: wave, sim,
 * targeting, neglect, qte) drive the state; this scene renders it in the
 * "Haunted Study" style and connects every battle to real study:
 * - Scout report before each wave (what is due this week, readiness, Train).
 * - Study checkpoints (C) charge the Lantern of Knowledge (Space).
 * - Bosses (exams) trigger quick-time exam questions at 50% HP.
 * - Sentinels are forged by practice trials (forge levels from the War Room).
 * - Debrief after each wave maps the battle back to real study actions.
 * Ref: tasks.md phases 3–7, R13, R15–R17; art-direction.md
 */

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Palette, getCourseColor } from '../palette';
import { Layout, laneY } from '../layout';
import { TowerView } from '../entities/TowerView';
import { EnemyView } from '../entities/EnemyView';
import { Atmosphere, prefersReducedMotion } from '../fx/Atmosphere';
import { generateWave, campaignWeeks, tutorialWave } from '../../core/wave';
import { stepSimulation, type SimConfig, type SimEvent } from '../../core/sim';
import { shouldTriggerQTE, resolveQTE } from '../../core/qte';
import { mulberry32 } from '../../core/rng';
import type { Semester, GameState, EnemyStats, TowerStats } from '../../core/types';
import { getSemester, questionsFor, recordSession, forgeLevel, forgeBonus, readinessFor, courseView, type Question } from '../../study/model';
import { load, save } from '../../save/save';
import { Hud, titleCard, scoutReport, debrief, quickCheck, qteCard, pauseMenu, coach, type ScoutGroup } from '../../ui/BattleUI';
import { clearLayers } from '../../ui/stage';
import { openTrial } from '../../ui/TrialPanel';
import { sfx, startDrone, stopDrone } from '../../audio/sfx';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Sentinel sockets per lane (x positions). Socket 0 starts built. */
const SOCKETS = [300, 640, 980];
const SOCKET_COST = [0, 60, 110];
const BASE_TOWER = { damage: 14, fireRate: 1.1, range: 290 };
const SPECIAL_DAMAGE = 140;
const CHECK_CHARGE = 34;

type Phase = 'scout' | 'intro' | 'fight' | 'check' | 'qte' | 'debrief' | 'paused' | 'over';

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

  private towerViews = new Map<string, TowerView>();
  private enemyViews = new Map<string, EnemyView>();
  private socketViews = new Map<string, Phaser.GameObjects.Container>();
  private qteDone = new Map<string, number>();
  private enrageUntil = new Map<string, number>();
  private atmosphere?: Atmosphere;
  private hud?: Hud;
  private fortressCracks!: Phaser.GameObjects.Graphics;
  private dangerGlow!: Phaser.GameObjects.Image;
  private bolts!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private souls!: Phaser.GameObjects.Particles.ParticleEmitter;
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
    this.towerViews.clear();
    this.enemyViews.clear();
    this.socketViews.clear();
    this.qteDone.clear();
    this.enrageUntil.clear();
    this.sessionAnswers.clear();
    this.timeScale = 1;

    const laneH = (Layout.LANE_END_Y - Layout.LANE_START_Y) / Layout.LANE_COUNT;
    this.atmosphere = new Atmosphere(this, {
      width: W,
      height: H,
      fog: 0.3,
      frontFog: 0.07,
      vignette: 0.35,
      candleX: 176,
      lanes: this.semester.courses.slice(0, Layout.LANE_COUNT).map((c, i) => ({ y: laneY(i), color: getCourseColor(c.id), height: laneH })),
    });
    this.drawLaneLabels();
    this.drawFortress();
    this.createEmitters();

    this.initializeGameState();
    this.spawnSentinels();

    this.hud = new Hud({
      onCheck: () => this.openCheckpoint(),
      onSpecial: () => this.castLantern(),
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

  private drawLaneLabels(): void {
    this.semester.courses.slice(0, Layout.LANE_COUNT).forEach((c, i) => {
      const y = laneY(i);
      const color = getCourseColor(c.id);
      this.add
        .text(1580, y - 48, c.title.toUpperCase(), {
          fontFamily: 'Cinzel, Georgia, serif',
          fontStyle: '700',
          fontSize: '13px',
          color: hex(color),
        })
        .setOrigin(1, 0.5)
        .setAlpha(0.55)
        .setLetterSpacing(3)
        .setDepth(-50);
    });
  }

  private drawFortress(): void {
    const x = 76;
    const y = Layout.CANVAS_HEIGHT / 2 + 20;
    const c = this.add.container(x, y).setDepth(12);
    const g = this.add.graphics();
    // Desk slab running the full height of the lanes
    g.fillGradientStyle(0x2b2033, 0x1d1828, 0x15101d, 0x0d0a14, 1);
    g.fillRect(-76, -(Layout.LANE_END_Y - Layout.LANE_START_Y) / 2 - 20, 128, Layout.LANE_END_Y - Layout.LANE_START_Y + 40);
    g.lineStyle(2, 0xf2b45a, 0.35);
    g.lineBetween(52, -400, 52, 400);
    // Open grimoire
    g.fillStyle(0x07060b, 0.6);
    g.fillEllipse(-10, 96, 150, 26);
    g.fillGradientStyle(0xefe2c4, 0xdcc79c, 0xcbb88f, 0xb8a27a, 1);
    g.fillRoundedRect(-70, -60, 64, 150, 4);
    g.fillRoundedRect(-4, -60, 64, 150, 4);
    g.lineStyle(1, 0x5a4630, 0.6);
    for (let i = 0; i < 9; i++) {
      g.lineBetween(-62, -44 + i * 14, -14, -44 + i * 14);
      g.lineBetween(4, -44 + i * 14, 52, -44 + i * 14);
    }
    g.lineStyle(2, 0x3b2a17, 1);
    g.lineBetween(-5, -60, -5, 90);
    this.fortressCracks = this.add.graphics();
    const glow = this.add.image(-5, 10, 'glow-soft').setTint(0xf2b45a).setScale(1.5, 1.8).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    const label = this.add
      .text(-5, 118, 'YOUR SEMESTER', { fontFamily: 'Cinzel, Georgia, serif', fontStyle: '700', fontSize: '12px', color: '#f2b45a' })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    c.add([g, glow, this.fortressCracks, label]);
    this.dangerGlow = this.add.image(0, Layout.CANVAS_HEIGHT / 2, 'glow-soft').setTint(0xb3202c).setScale(2.5, 7).setAlpha(0).setDepth(11);
    this.dangerGlow.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createEmitters(): void {
    this.bolts = this.add
      .particles(0, 0, 'wisp', {
        lifespan: 260,
        speed: 0,
        scale: { start: 0.32, end: 0.05 },
        alpha: { start: 0.85, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(30);
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        lifespan: { min: 220, max: 420 },
        speed: { min: 80, max: 260 },
        angle: { min: 0, max: 360 },
        rotate: { onEmit: () => 0, onUpdate: (p: Phaser.GameObjects.Particles.Particle) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(31);
    this.souls = this.add
      .particles(0, 0, 'glow', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 30, max: 140 },
        angle: { min: 200, max: 340 },
        gravityY: -60,
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.9, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(31);
  }

  private towerKey(courseId: string, socket: number) {
    return `${courseId}#${socket}`;
  }

  private spawnSentinels(): void {
    this.semester.courses.slice(0, Layout.LANE_COUNT).forEach((course, lane) => {
      SOCKETS.forEach((sx, socket) => {
        if (socket === 0) this.buildTower(course.id, lane, socket, true);
        else this.addSocket(course.id, lane, socket, sx);
      });
    });
  }

  private towerStats(courseId: string, x: number, y: number): TowerStats {
    const b = forgeBonus(forgeLevel(courseId));
    return {
      courseId,
      x,
      y,
      range: BASE_TOWER.range * b.range,
      damage: BASE_TOWER.damage * b.damage,
      fireRate: BASE_TOWER.fireRate * b.fireRate,
      lastFiredAt: -9999,
      upgrades: { damage: 0, speed: 0, range: 0 },
    };
  }

  private buildTower(courseId: string, lane: number, socket: number, free = false): boolean {
    const cost = SOCKET_COST[socket];
    if (!free) {
      if (this.gameState.gold < cost) {
        this.hud?.caption(`Need ${cost} gold to raise a sentinel`, 'bad');
        return false;
      }
      this.gameState.gold -= cost;
    }
    const x = SOCKETS[socket];
    const y = laneY(lane) + 8;
    const stats = this.towerStats(courseId, x, y);
    this.gameState.towers.push(stats);
    const view = new TowerView(this, x, y, courseId, stats.range, forgeLevel(courseId));
    this.towerViews.set(this.towerKey(courseId, socket), view);
    const sock = this.socketViews.get(this.towerKey(courseId, socket));
    sock?.destroy();
    this.socketViews.delete(this.towerKey(courseId, socket));
    if (!free) {
      sfx('forge');
      this.hud?.caption('A sentinel rises', 'good');
      if (!this.reduced) {
        view.setScale(0.2).setAlpha(0);
        this.tweens.add({ targets: view, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
      }
      this.souls.explode(14, x, y - 20);
    }
    return true;
  }

  private addSocket(courseId: string, lane: number, socket: number, x: number): void {
    const y = laneY(lane) + 8;
    const color = getCourseColor(courseId);
    const c = this.add.container(x, y).setDepth(9);
    const g = this.add.graphics();
    g.lineStyle(1.2, 0xcfc3a8, 0.22);
    g.strokeEllipse(0, 26, 56, 16);
    g.lineStyle(1, color, 0.2);
    g.strokeEllipse(0, 26, 40, 10);
    const cost = this.add
      .text(0, 2, `${SOCKET_COST[socket]}`, { fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '700', fontSize: '13px', color: '#f2b45a' })
      .setOrigin(0.5)
      .setAlpha(0);
    const coin = this.add.circle(-16, 2, 5, 0xf2b45a, 0.9).setAlpha(0);
    c.add([g, coin, cost]);
    c.setSize(70, 70);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => {
      c.setScale(1.08);
      cost.setAlpha(0.95);
      coin.setAlpha(0.9);
    });
    c.on('pointerout', () => {
      c.setScale(1);
      cost.setAlpha(0);
      coin.setAlpha(0);
    });
    c.on('pointerup', () => {
      if (this.phase === 'fight' || this.phase === 'scout' || this.phase === 'intro') this.buildTower(courseId, lane, socket);
    });
    this.socketViews.set(this.towerKey(courseId, socket), c);
    if (!this.reduced) this.tweens.add({ targets: g, alpha: { from: 0.6, to: 1 }, yoyo: true, repeat: -1, duration: 1400 + socket * 200 });
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-C', () => this.openCheckpoint());
    kb.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault();
      this.castLantern();
    });
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-M', () => this.hud?.toggleMute());
    kb.on('keydown-ESC', () => {
      if (this.phase === 'fight') this.togglePause();
    });
    // Number keys 1-6 + B raise the next sentinel in that lane (keyboard building).
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.phase !== 'fight' || !e.shiftKey) return;
      const lane = Number(e.key) - 1;
      if (!(lane >= 0 && lane < Layout.LANE_COUNT)) return;
      const course = this.semester.courses[lane];
      if (!course) return;
      for (let s = 1; s < SOCKETS.length; s++) {
        if (this.socketViews.has(this.towerKey(course.id, s))) {
          this.buildTower(course.id, lane, s);
          break;
        }
      }
    });
  }

  // ───────────────────────── wave flow ─────────────────────────

  private weekOf(wave: number): number {
    return this.weeks.find((w) => w.waveIndex === wave)?.weekNumber ?? wave;
  }

  private prepareWave(wave: number): EnemyStats[] {
    const now = Date.now();
    const list = wave === 0 ? tutorialWave(this.semester, now, this.rng) : generateWave(this.semester, wave, now, this.rng);
    return list.map((e) => {
      const lane = Math.min(Layout.LANE_COUNT - 1, Math.max(0, e.lane));
      const y = laneY(lane) + (e.isMinion ? Phaser.Math.Between(-26, 26) : 0);
      return { ...e, lane, x: Layout.ENEMY_SPAWN_X, y, pathProgress: 0, progress: 0 };
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
        : 'You did not open a single book this wave. The Lantern stayed dark.',
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
    this.cameras.main.shake(this.reduced ? 0 : 400, 0.01);
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

  /** Lane under the most pressure: the course whose creatures are closest to the desk. */
  private pressuredCourse(): string {
    let best: { id: string; p: number } | null = null;
    for (const e of this.gameState.enemies) {
      const p = e.pathProgress + (e.isMinion ? 0 : 0.2);
      if (!best || p > best.p) best = { id: e.courseId, p };
    }
    return best?.id ?? this.semester.courses[0].id;
  }

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

  private async openCheckpoint(): Promise<void> {
    if (this.phase !== 'fight') return;
    this.phase = 'check';
    const courseId = this.pressuredCourse();
    const course = this.semester.courses.find((c) => c.id === courseId)!;
    const q = this.pickQuestion(courseId);
    const result = await quickCheck(q, course.title, hex(getCourseColor(courseId)));
    if (this.phase !== 'check') return; // scene left meanwhile
    if (result !== null) {
      this.stats.checks.total++;
      this.noteAnswer(courseId, q.id, result);
      if (result) {
        this.stats.checks.ok++;
        this.gameState.special = Math.min(100, this.gameState.special + CHECK_CHARGE);
        this.hud?.caption(`Correct: the Lantern gathers light (+${CHECK_CHARGE}%)`, 'good');
        if (this.gameState.special >= 100) this.hud?.caption('The Lantern is ready: press Space', 'good');
      } else {
        this.hud?.caption('Missed: the explanation is your weapon next time');
      }
    }
    this.phase = 'fight';
    if (this.tutorial && result !== null) this.advanceTutorial(3);
  }

  private castLantern(): void {
    if (this.phase !== 'fight') return;
    if (this.gameState.special < 100) {
      this.hud?.caption('The Lantern needs light: answer study checkpoints (C)');
      return;
    }
    this.gameState.special = 0;
    sfx('special');
    this.hud?.caption('Lantern of Knowledge: every creature burns', 'good');
    const W = Layout.CANVAS_WIDTH;
    const beam = this.add.image(0, Layout.CANVAS_HEIGHT / 2, 'glow-soft').setTint(0x6ee7d0).setScale(1.5, 8).setAlpha(0.9).setDepth(40);
    beam.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: beam, x: W + 200, scaleX: 3, duration: this.reduced ? 1 : 700, ease: 'Sine.easeIn', onComplete: () => beam.destroy() });
    if (!this.reduced) this.cameras.main.flash(250, 110, 231, 208);
    for (const e of [...this.gameState.enemies]) {
      const delay = this.reduced ? 0 : (e.x / W) * 700;
      this.time.delayedCall(delay, () => {
        const live = this.gameState.enemies.find((x) => x.id === e.id);
        if (!live) return;
        this.damageEnemy(live, SPECIAL_DAMAGE, 0x6ee7d0);
      });
    }
    if (this.tutorial) this.advanceTutorial(4);
  }

  /** Apply out-of-sim damage (Lantern, QTE crits) and handle kills consistently. */
  private damageEnemy(e: EnemyStats, amount: number, color: number): void {
    const before = e.hp / e.maxHp;
    e.hp -= amount;
    const view = this.enemyViews.get(e.id);
    view?.hitFlash(this.time.now);
    this.sparks.setParticleTint(color);
    this.sparks.explode(10, e.x, e.y);
    this.floatNumber(e.x, e.y - 30, Math.round(amount), color);
    if (e.hp <= 0) {
      this.killEnemy(e);
      return;
    }
    view?.updateHpBar(e.hp, e.maxHp);
    this.maybeQTE(e, before, e.hp / e.maxHp);
  }

  private killEnemy(e: EnemyStats): void {
    this.gameState.enemies = this.gameState.enemies.filter((x) => x.id !== e.id);
    this.gameState.gold += e.isMinion ? 4 : 12;
    this.onKillFx(e.id, e.x, e.y, e.courseId);
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
    let gray: { active: boolean } | null = null;
    try {
      const cm = this.cameras.main.filters.internal.addColorMatrix();
      cm.colorMatrix.saturate(-0.7);
      gray = cm;
    } catch {
      /* filters unavailable */
    }
    this.hud?.caption('Heartbeat: a quick-time exam', 'bad');
    const ok = await qteCard(q, course.title, hex(getCourseColor(e.courseId)), extra ? 16000 : 8000, extra);
    if (gray) this.cameras.main.filters.internal.remove(gray as never);
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
      if (!this.reduced) this.cameras.main.flash(180, 255, 255, 255);
      if (live) this.damageEnemy(live, Math.max(outcome.damage ?? 0, live.maxHp * 0.35), 0xffffff);
    } else if (live && outcome.enrage) {
      sfx('enrage');
      this.hud?.caption(`${live.label} is enraged`, 'bad');
      live.speed *= outcome.enrage.speedMult;
      live.damage = Math.round(live.damage * outcome.enrage.damageMult);
      this.enrageUntil.set(live.id, this.gameState.timeMs + outcome.enrage.durationMs);
      this.enemyViews.get(live.id)?.setEnraged(true);
      this.floatText(live.x, live.y - 70, 'ENRAGED', 0xff6b74);
    }
  }

  // ───────────────────────── tutorial ─────────────────────────

  private beginTutorial(): void {
    this.gameState.wave = 0;
    this.gameState.gold = 120;
    this.coachEl = coach(
      'Every creature is a <b>real deadline</b> from your courses. Its scroll shows what it is and how many days are left.<br/><br/>Your sentinels fight on their own. <b>You</b> fight by studying.',
      800,
      470,
    );
    const go = this.add.text(0, 0, '');
    go.destroy();
    this.time.delayedCall(this.reduced ? 3000 : 5200, () => {
      this.coachEl?.remove();
      void this.startWave(this.prepareWave(0));
    });
  }

  private advanceTutorial(step: number): void {
    if (!this.tutorial || step <= this.tutorialStep) return;
    this.tutorialStep = step;
    this.coachEl?.remove();
    if (step === 1) {
      this.time.delayedCall(2500, () => {
        if (this.tutorialStep !== 1 || this.phase !== 'fight') return;
        this.coachEl = coach('Press <span class="dd-kbd">C</span> to open a <b>study checkpoint</b>. A correct answer charges the Lantern.', 1330, 150, 'up');
        this.tutorialStep = 2;
      });
    } else if (step === 3) {
      if (this.gameState.special >= 100) this.showLanternCoach();
      else {
        this.gameState.special = Math.max(this.gameState.special, 100); // the tutorial lends a full charge
        this.showLanternCoach();
      }
    } else if (step === 4) {
      this.coachEl = coach('Gold from banished creatures raises new <b>sentinels</b> on the glowing runes. Click one.', 640, 560, 'up');
      this.time.delayedCall(6000, () => this.coachEl?.remove());
    }
  }

  private showLanternCoach(): void {
    this.coachEl = coach('The Lantern is full. Press <span class="dd-kbd">Space</span> to burn every creature on the field.', 1400, 150, 'up');
  }

  private endTutorial(): void {
    this.coachEl?.remove();
    save((d) => (d.tutorialDone = true));
    this.overlay = debrief(
      {
        title: 'The first night is survived',
        lines: [
          'Deadlines become creatures. <b>Studying is your weapon.</b>',
          'Correct answers charge the Lantern and, in the War Room, forge stronger sentinels.',
          'Exams arrive as bosses. When one breaks, a <b>quick-time exam</b> question decides the blow.',
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
    const now = this.time.now;
    this.atmosphere?.update(deltaRaw);
    for (const v of this.towerViews.values()) v.tick(now, this.reduced);
    for (const v of this.enemyViews.values()) v.tick(now, this.reduced);

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
    this.dangerGlow.setAlpha(Phaser.Math.Clamp((0.5 - hp / this.gameState.maxFortressHp) * 1.2, 0, 0.6));

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
        this.enemyViews.get(id)?.setEnraged(false);
      }
    }
    this.handleEvents(res.events, hpBefore);
    for (const e of this.gameState.enemies) {
      const v = this.enemyViews.get(e.id);
      if (!v) continue;
      v.setPosition(e.x, e.y);
      v.updateHpBar(e.hp, e.maxHp);
      if (e.neglected && !v.getData('neglected')) {
        v.setData('neglected', true);
        v.setNeglected();
        this.floatText(e.x, e.y - 60, 'NEGLECTED', 0xff9a5a);
        this.hud?.caption(`${e.label} grows stronger while neglected`, 'bad');
      }
    }
  }

  private handleEvents(events: SimEvent[], hpBefore: Map<string, number>): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'spawn': {
          const e = ev.enemy;
          const v = new EnemyView(this, e.x, e.y, e.courseId, e.type, e.label, e.daysLeft, !!e.isMinion);
          if (e.isOverdue) v.applyOverdueEffect();
          this.enemyViews.set(e.id, v);
          if (!this.reduced) {
            v.setAlpha(0);
            this.tweens.add({ targets: v, alpha: 1, duration: 600 });
          }
          break;
        }
        case 'projectile': {
          const tv = [...this.towerViews.values()].find((t) => Math.abs(t.x - ev.fromX) < 1 && Math.abs(t.y - ev.fromY) < 1);
          tv?.fire(this.time.now);
          this.boltFx(ev.fromX, ev.fromY - 40, ev.toX, ev.toY, getCourseColor(tv?.courseId ?? ''));
          break;
        }
        case 'hit': {
          sfx('hit');
          this.enemyViews.get(ev.enemyId)?.hitFlash(this.time.now);
          const e = this.gameState.enemies.find((x) => x.id === ev.enemyId);
          if (e) this.maybeQTE(e, hpBefore.get(e.id) ?? 1, e.hp / e.maxHp);
          break;
        }
        case 'kill': {
          const e = this.gameState.enemies.find((x) => x.id === ev.enemyId);
          this.onKillFx(ev.enemyId, ev.x, ev.y, e?.courseId ?? '');
          break;
        }
        case 'fortressHit': {
          sfx('fortress');
          const view = this.enemyViews.get(ev.enemyId);
          const courseId = view ? [...this.semester.courses].find((c) => c.id === (view.getData('course') as string))?.id : undefined;
          this.stats.breaches[courseId ?? this.laneCourse(view?.y)] = (this.stats.breaches[courseId ?? this.laneCourse(view?.y)] ?? 0) + 1;
          view?.destroy();
          this.enemyViews.delete(ev.enemyId);
          this.stats.kills++; // it leaves the field either way; progress counts it
          this.onBreach(ev.damage);
          break;
        }
        case 'waveCleared':
          this.time.delayedCall(700, () => this.onWaveCleared());
          break;
      }
    }
  }

  private laneCourse(y?: number): string {
    if (y === undefined) return '?';
    const lane = Math.round((y - Layout.LANE_START_Y) / ((Layout.LANE_END_Y - Layout.LANE_START_Y) / Layout.LANE_COUNT) - 0.5);
    return this.semester.courses[Phaser.Math.Clamp(lane, 0, this.semester.courses.length - 1)]?.id ?? '?';
  }

  // ───────────────────────── effects ─────────────────────────

  private boltFx(x0: number, y0: number, x1: number, y1: number, color: number): void {
    const head = this.add.image(x0, y0, 'wisp').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45, 0.3).setDepth(30);
    head.rotation = Math.atan2(y1 - y0, x1 - x0);
    this.bolts.setParticleTint(color);
    const dur = Phaser.Math.Clamp(Phaser.Math.Distance.Between(x0, y0, x1, y1) / 1.6, 80, 220);
    this.tweens.add({
      targets: head,
      x: x1,
      y: y1,
      duration: dur,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        if (!this.reduced) this.bolts.emitParticleAt(head.x, head.y, 1);
      },
      onComplete: () => {
        this.sparks.setParticleTint(color);
        this.sparks.explode(this.reduced ? 2 : 5, x1, y1);
        head.destroy();
      },
    });
  }

  private onKillFx(id: string, x: number, y: number, courseId: string): void {
    const v = this.enemyViews.get(id);
    const color = getCourseColor(courseId);
    this.stats.kills++;
    sfx('kill');
    if (v) {
      if (v.isBoss) {
        this.stats.bossesSlain.push((v.list.find((o) => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined)?.text ?? 'a boss');
        if (!this.reduced) this.cameras.main.shake(250, 0.006);
        this.hud?.caption('A great enemy falls', 'good');
      }
      this.enemyViews.delete(id);
      if (this.reduced) v.destroy();
      else this.tweens.add({ targets: v, alpha: 0, scale: 1.25, y: v.y - 20, duration: 320, onComplete: () => v.destroy() });
    }
    this.souls.setParticleTint(color);
    this.souls.explode(this.reduced ? 4 : v?.isBoss ? 40 : 12, x, y);
    // Coin arcs to the HUD gold counter
    if (!this.reduced) {
      const coin = this.add.circle(x, y, 5, 0xf2b45a).setDepth(45);
      this.tweens.add({
        targets: coin,
        x: 1080,
        y: 40,
        duration: 650,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          coin.destroy();
          this.hud?.goldPulse();
        },
      });
    }
  }

  private onBreach(damage: number): void {
    this.hud?.caption(`A deadline breaks through: −${damage}`, 'bad');
    if (!this.reduced) {
      this.cameras.main.shake(220, 0.006);
      this.tweens.add({ targets: this.dangerGlow, alpha: { from: 0.8, to: this.dangerGlow.alpha }, duration: 500 });
    }
    // Cracks on the grimoire grow as integrity drops
    const f = 1 - this.gameState.fortressHp / this.gameState.maxFortressHp;
    const g = this.fortressCracks;
    g.clear();
    g.lineStyle(2, 0x07060b, 0.9);
    const n = Math.floor(f * 10);
    const r = mulberry32(7);
    for (let i = 0; i < n; i++) {
      let x = -70 + r() * 130;
      let y = -60 + r() * 150;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.strokePath();
    }
  }

  private floatNumber(x: number, y: number, n: number, color: number): void {
    this.floatText(x, y, String(n), color, 18);
  }

  private floatText(x: number, y: number, s: string, color: number, size = 16): void {
    const t = this.add
      .text(x, y, s, { fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '700', fontSize: `${size}px`, color: hex(color), stroke: '#07060b', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: this.reduced ? 600 : 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private refreshForge(courseId: string): void {
    const lvl = forgeLevel(courseId);
    const b = forgeBonus(lvl);
    for (const t of this.gameState.towers) {
      if (t.courseId !== courseId) continue;
      t.damage = BASE_TOWER.damage * b.damage;
      t.fireRate = BASE_TOWER.fireRate * b.fireRate;
      t.range = BASE_TOWER.range * b.range;
    }
    for (const [k, v] of this.towerViews) if (k.startsWith(`${courseId}#`)) v.setForge(lvl);
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
