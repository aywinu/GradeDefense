/**
 * BattleScene: the semester procession (R19). The battlefield is the
 * calendar: each real deadline is one creature, its distance from the altar
 * is its days left, and the altar is today. Kiro's pure rules drive it:
 * - src/core/procession.ts: the clock, arrivals, weight-proportional grade loss.
 * - src/core/duel.ts: seals and the damage of an answer (streaks break two).
 * - src/core/qte.ts: the last stand when an exam is a day away.
 * This scene renders the rules in the "Haunted Study" style and connects
 * them to real study: scout report (weights + readiness + Train), duels with
 * the course's own questions, and a final projected transcript with advice.
 * Ref: tasks.md phases 3–7, 18, 19; R13, R15–R19; art-direction.md
 */

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Palette, getCourseColor } from '../palette';
import { Layout, laneY } from '../layout';
import { prefersReducedMotion } from '../fx/Atmosphere';
import { Battlefield3D } from '../../game3d/Battlefield3D';
import { preloadSkeletons } from '../../game3d/skeletons';
import { mountLayer, clearLayers } from '../../ui/stage';
import { resolveQTE } from '../../core/qte';
import { mulberry32 } from '../../core/rng';
import { applyAnswer } from '../../core/duel';
import {
  PROCESSION,
  buildProcession,
  breakSeals,
  advance,
  visible,
  laneProgress,
  courseGrade,
  failedCourses,
  isFinished,
  letterGrade,
  type ProcessionState,
  type ProcessionItem,
  type Arrival,
} from '../../core/procession';
import type { Semester } from '../../core/types';
import { getSemester, questionsFor, recordSession, forgeLevel, readinessFor, courseView, type Question } from '../../study/model';
import { load, save } from '../../save/save';
import { Hud, titleCard, scoutReport, debrief, duelCard, qteCard, pauseMenu, coach, weekBanner, type ScoutRow } from '../../ui/BattleUI';
import { openTrial } from '../../ui/TrialPanel';
import { runTour, hasSeen } from '../../ui/Tour';
import { sfx, startDrone, stopDrone } from '../../audio/sfx';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const shortName = (s: string) => s.replace(/Examination/, 'Exam');

type Phase = 'scout' | 'intro' | 'fight' | 'duel' | 'qte' | 'tour' | 'paused' | 'over';

export class BattleScene extends Phaser.Scene {
  private semester!: Semester;
  /** The procession state (Kiro's pure model). Exposed for tests and the demo recorder. */
  state!: ProcessionState;
  phase: Phase = 'scout';
  private phaseBeforePause: Phase = 'fight';
  private reduced = false;
  private rng = mulberry32(Date.now() & 0xffff);
  private timeScale = 1;
  private hasten = false;
  private targetId: string | null = null;
  private streak = 0;
  private lastHudTarget = '';
  private lastWeek = -1;
  private tutorial = false;
  private tutorialStep = 0;
  private answered: string[] = [];
  private stats = { ok: 0, total: 0, defeated: [] as string[], arrivals: [] as Arrival[] };

  private view!: Battlefield3D;
  private labels?: HTMLDivElement;
  /** Creatures on the field: itemId -> lane slot. */
  private field = new Map<string, { lane: number; offset: number }>();
  private qteDone = new Set<string>();
  private hud?: Hud;
  private sessionAnswers = new Map<string, { questionId: string; correct: boolean }[]>();
  private overlay?: HTMLElement;
  private coachEl?: HTMLElement;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(data?: { fresh?: boolean }) {
    this.reduced = prefersReducedMotion();
    this.semester = getSemester();
    this.field.clear();
    this.qteDone.clear();
    this.sessionAnswers.clear();
    this.answered = [];
    this.timeScale = 1;
    this.hasten = false;
    this.streak = 0;
    this.stats = { ok: 0, total: 0, defeated: [], arrivals: [] };
    this.tutorial = !load().tutorialDone;
    this.tutorialStep = 0;

    this.labels = mountLayer('enemy-labels');
    this.view = new Battlefield3D(document.getElementById('game-container')!, this.labels, this.reduced);
    this.view.onEnemyHover = () => sfx('hover');
    this.view.onEnemyClick = (id) => {
      if (this.phase !== 'fight') return;
      sfx('select');
      this.setTarget(id);
      void this.openDuel(id);
    };
    this.drawLaneLabels();
    this.loadState(!!data?.fresh);
    this.lastWeek = Math.floor(this.state.day / 7);

    this.hud = new Hud({
      onCheck: () => void this.openDuel(),
      onHasten: () => this.toggleHasten(),
      onPause: () => this.togglePause(),
    });
    this.setupInput();
    this.events.once('shutdown', () => this.teardown());

    this.cameras.main.fadeIn(this.reduced ? 0 : 500, 7, 6, 11);
    startDrone();
    // The rigged skeletons load once (about 1.8 MB); the scout report waits for them.
    void preloadSkeletons().then(() => {
      if (!this.sys.isActive()) return;
      this.syncField(true);
      this.time.delayedCall(250, () => this.showScout());
    });
  }

  // ───────────────────────── state ─────────────────────────

  private semesterKey(): string {
    const s = load().semester;
    return s.source === 'demo' ? 'demo' : `${s.source}:${s.importedAt}`;
  }

  /** Resume the saved procession for this semester, or build a fresh one. */
  private loadState(fresh: boolean): void {
    const saved = load().procession;
    const key = this.semesterKey();
    const st = saved?.state as ProcessionState | undefined;
    if (!fresh && saved && saved.key === key && st && Array.isArray(st.items) && typeof st.day === 'number' && !isFinished(st)) {
      this.state = st;
    } else {
      this.state = buildProcession(this.semester, new Date());
    }
    this.applyTraining();
  }

  /** Training in the War Room pre-weakens that course's deadlines (never fully). */
  private applyTraining(): void {
    let s = this.state;
    for (const it of s.items) {
      if (it.resolved) continue;
      const cap = Math.max(1, it.maxSeals - Math.floor(forgeLevel(it.courseId) / 2));
      if (it.seals > cap) s = breakSeals(s, it.itemId, it.seals - cap);
    }
    this.state = s;
  }

  private persist(): void {
    const key = this.semesterKey();
    save((d) => (d.procession = isFinished(this.state) ? null : { key, state: this.state }));
  }

  private item(id: string | null | undefined): ProcessionItem | undefined {
    return id ? this.state.items.find((i) => i.itemId === id && !i.resolved) : undefined;
  }

  private weightOf(it: ProcessionItem): number {
    return (it.points / Math.max(1, this.state.totals[it.courseId] ?? it.points)) * 100;
  }

  private lastDay(): number {
    return Math.max(1, ...this.state.items.map((i) => i.dueDay));
  }

  /** Number of creatures on the field (for tests). */
  fieldCount(): number {
    return this.field.size;
  }

  // ───────────────────────── field ─────────────────────────

  private laneOf(courseId: string): number {
    const i = this.semester.courses.findIndex((c) => c.id === courseId);
    return Math.min(Layout.LANE_COUNT - 1, Math.max(0, i));
  }

  private posOf(it: ProcessionItem, slot: { lane: number; offset: number }): { x: number; y: number } {
    const span = Layout.ENEMY_SPAWN_X - Layout.FORTRESS_X_MAX;
    const x = Layout.ENEMY_SPAWN_X - laneProgress(it, this.state.day) * span;
    return { x, y: laneY(slot.lane) + slot.offset };
  }

  private whenText(it: ProcessionItem): string {
    const d = it.dueDay - this.state.day;
    const when = d < 1 ? 'due today' : d < 2 ? 'due tomorrow' : `in ${Math.floor(d)} days`;
    return `${when} · ${Math.round(this.weightOf(it))}% of grade`;
  }

  /** Spawn creatures that entered the horizon; move everyone to their calendar position. */
  private syncField(initial = false): void {
    const vis = visible(this.state);
    for (const it of vis) {
      if (this.field.has(it.itemId)) continue;
      const lane = this.laneOf(it.courseId);
      const same = [...this.field.values()].filter((f) => f.lane === lane).length;
      const slot = { lane, offset: same === 0 ? 0 : same % 2 ? -30 : 30 };
      this.field.set(it.itemId, slot);
      const p = this.posOf(it, slot);
      this.view.addEnemy(it.itemId, it.type, false, p.x, p.y, getCourseColor(it.courseId), it.label, Math.floor(it.dueDay - this.state.day));
      if (!initial && !this.tutorial) {
        sfx('rise');
        this.hud?.caption(`${shortName(it.label)} emerges from the fog: ${Math.round(this.weightOf(it))}% of ${this.courseTitle(it.courseId)}`);
      }
    }
    for (const [id, slot] of this.field) {
      const it = this.item(id);
      if (!it) continue;
      const p = this.posOf(it, slot);
      this.view.moveEnemy(id, p.x, p.y, it.seals / it.maxSeals);
      const d = it.dueDay - this.state.day;
      this.view.setEnemyInfo(id, this.whenText(it), d <= 3, it.seals / it.maxSeals);
    }
  }

  private courseTitle(courseId: string): string {
    return this.semester.courses.find((c) => c.id === courseId)?.title ?? courseId;
  }

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

  // ───────────────────────── input ─────────────────────────

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault();
      void this.openDuel();
    });
    kb.on('keydown-C', () => void this.openDuel());
    kb.on('keydown-F', () => this.toggleHasten());
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

  private toggleHasten(): void {
    if (this.phase !== 'fight') return;
    this.hasten = !this.hasten;
    this.hud?.caption(this.hasten ? 'Time hastens' : 'Time slows to its usual pace');
  }

  // ───────────────────────── targeting & duels ─────────────────────────

  private nearest(): ProcessionItem[] {
    return [...this.field.keys()].map((id) => this.item(id)).filter((x): x is ProcessionItem => !!x).sort((a, b) => a.dueDay - b.dueDay);
  }

  setTarget(id: string | null): void {
    this.targetId = id;
    this.view.setTarget(id);
  }

  private cycleTarget(dir: number): void {
    const list = this.nearest();
    if (!list.length) return;
    const i = list.findIndex((e) => e.itemId === this.targetId);
    this.setTarget(list[(i + dir + list.length) % list.length].itemId);
  }

  /**
   * Duel one deadline with questions from its own course. A correct answer
   * breaks a seal (two on a streak of three, Kiro's applyAnswer). A wrong
   * answer costs half a day: the whole calendar lurches forward. The clock
   * keeps running at a quarter of its pace while a question is open.
   */
  async openDuel(id?: string): Promise<void> {
    if (this.phase !== 'fight') return;
    const pick = this.item(id) ?? this.item(this.targetId) ?? this.nearest()[0];
    if (!pick) return;
    this.setTarget(pick.itemId);
    this.phase = 'duel';
    this.hasten = false;
    this.timeScale = PROCESSION.duelTimeScale;
    this.view.setSlowmo(true);
    const color = getCourseColor(pick.courseId);
    if (this.tutorial) this.advanceTutorial(2);
    while (this.phase === 'duel') {
      const it = this.item(pick.itemId);
      if (!it) break;
      const q = this.pickQuestion(it.courseId);
      const ok = await duelCard(q, {
        name: shortName(it.label),
        courseTitle: this.courseTitle(it.courseId),
        color: hex(color),
        seals: it.seals,
        maxSeals: it.maxSeals,
        daysLeft: it.dueDay - this.state.day,
        streak: this.streak,
        weight: this.weightOf(it),
      });
      if (ok === null || this.phase !== 'duel') break;
      this.stats.total++;
      this.noteAnswer(it.courseId, q.id, ok);
      const live = this.item(pick.itemId);
      if (!live) break; // it arrived while you were thinking
      const res = applyAnswer({ seals: live.seals, maxSeals: live.maxSeals, progress: 0 }, ok, this.streak);
      if (ok) {
        this.streak++;
        this.stats.ok++;
        this.view.strike(live.itemId, color);
        sfx('crit');
        this.floatLabel(live.itemId, res.damage > 1 ? `−${res.damage} seals` : '−1 seal', 0xe9dcc0, res.damage > 1 ? 22 : 17);
        await new Promise((r) => setTimeout(r, 420));
        if (!this.item(pick.itemId)) break;
        this.state = breakSeals(this.state, live.itemId, res.damage);
        const after = this.state.items.find((i) => i.itemId === live.itemId)!;
        if (after.resolved) {
          this.defeat(after);
          break;
        }
        this.syncField();
      } else {
        this.streak = 0;
        this.floatLabel(live.itemId, '−½ day', 0xc9636b, 18);
        this.view.taunt(live.itemId);
        this.hud?.caption('Wrong: half a day slips away. Read why, it will come back.', 'bad');
        this.tick(PROCESSION.wrongAnswerDays);
      }
    }
    this.view.setSlowmo(false);
    this.timeScale = 1;
    if (this.phase === 'duel') this.phase = 'fight';
    this.setTarget(this.nearest()[0]?.itemId ?? null);
  }

  private defeat(it: ProcessionItem): void {
    this.stats.defeated.push(shortName(it.label));
    this.floatLabel(it.itemId, 'DEFEATED', 0xf2b45a, 34);
    sfx('kill');
    sfx('bones');
    if (it.type === 'exam' || it.type === 'project') this.hud?.caption('A great deadline falls', 'good');
    this.hud?.caption(`${shortName(it.label)} is defeated: you are ready for it`, 'good');
    this.view.killEnemy(it.itemId, getCourseColor(it.courseId));
    this.field.delete(it.itemId);
    if (this.tutorial) this.advanceTutorial(3);
    this.persist();
    this.time.delayedCall(400, () => this.syncField());
    if (isFinished(this.state)) this.time.delayedCall(1200, () => this.onFinished());
  }

  // ───────────────────────── the clock ─────────────────────────

  /** Advance the semester clock by `days` and resolve whatever arrives. */
  private tick(days: number): void {
    if (days <= 0) return;
    const res = advance(this.state, days);
    this.state = res.state;
    for (const a of res.arrivals) this.onArrival(a);
    const week = Math.floor(this.state.day / 7);
    if (week !== this.lastWeek) {
      this.lastWeek = week;
      sfx('bell');
      weekBanner(`Week ${week + 1}`, this.dayLabel());
      this.persist();
    }
    this.syncField();
    if (res.arrivals.length) {
      this.persist();
      const failed = failedCourses(this.state);
      if (failed.length) this.time.delayedCall(1400, () => this.onFailed(failed));
      else if (isFinished(this.state)) this.time.delayedCall(1600, () => this.onFinished());
    }
  }

  private onArrival(a: Arrival): void {
    this.stats.arrivals.push(a);
    const loss = Math.max(0, a.gradeBefore - a.gradeAfter);
    const severity = Math.min(1, loss / 30);
    const title = this.courseTitle(a.courseId);
    if (this.field.has(a.itemId)) {
      this.floatLabel(a.itemId, loss > 0 ? `−${loss.toFixed(1)} ${title}` : 'ready', loss > 8 ? 0xff5a64 : 0xe9a06b, 18 + severity * 18);
      this.view.arrive(a.itemId, severity);
      this.field.delete(a.itemId);
    }
    if (this.targetId === a.itemId) this.setTarget(null);
    sfx(severity > 0.4 ? 'arrive' : 'fortress');
    this.hud?.gradeHit(a.courseId);
    const verdict = a.verdict === 'partial' ? 'half-prepared' : 'unprepared';
    this.hud?.caption(
      severity > 0.4
        ? `${shortName(a.label)} arrives ${verdict}: ${title} drops ${loss.toFixed(1)} points`
        : `${shortName(a.label)} arrives ${verdict}: ${title} −${loss.toFixed(1)}. Barely a scratch.`,
      'bad',
    );
    this.view.setCracks(1 - Math.min(...this.semester.courses.map((c) => courseGrade(this.state, c.id))) / 60);
  }

  private dayLabel(): string {
    const d = new Date(Date.now() + this.state.day * 86400000);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ───────────────────────── flow ─────────────────────────

  private scoutRows(): ScoutRow[] {
    return visible(this.state).map((it) => ({
      itemId: it.itemId,
      courseId: it.courseId,
      name: it.label,
      courseTitle: this.courseTitle(it.courseId),
      color: hex(getCourseColor(it.courseId)),
      days: it.dueDay - this.state.day,
      weight: this.weightOf(it),
      seals: it.seals,
      maxSeals: it.maxSeals,
      readiness: readinessFor(it.courseId),
    }));
  }

  private showScout(): void {
    this.phase = 'scout';
    const heading = `Week ${Math.floor(this.state.day / 7) + 1} · the next 14 days`;
    this.overlay = scoutReport(
      heading,
      this.scoutRows(),
      (courseId) => {
        this.overlay?.remove();
        openTrial(courseId, () => {
          this.applyTraining();
          this.syncField();
          this.showScout();
        });
      },
      () => {
        this.overlay?.remove();
        void this.begin();
      },
      this.state.day > 0 ? 'Resume the semester' : 'Begin the battle',
    );
  }

  private async begin(): Promise<void> {
    this.phase = 'intro';
    sfx('bell');
    this.hud?.caption('A bell tolls: the procession begins');
    const first = visible(this.state).sort((a, b) => b.points - a.points)[0];
    const eyebrow = `Week ${Math.floor(this.state.day / 7) + 1}`;
    const title = first ? `${shortName(first.label)} approaches` : 'Silence';
    const sub = first ? `${this.courseTitle(first.courseId)} · ${Math.round(this.weightOf(first))}% of the grade · ${this.whenText(first).split(' · ')[0]}` : 'Nothing is due';
    await titleCard(eyebrow, title, sub, first?.type === 'exam');
    this.phase = 'fight';
    this.setTarget(this.nearest()[0]?.itemId ?? null);
    if (this.tutorial) this.beginTutorial();
    else if (!hasSeen('battle')) this.battleTour();
  }

  private battleTour(): void {
    this.phase = 'tour';
    runTour(
      'battle',
      [
        { target: '.hud-wave', art: 'timeline', title: 'The calendar is the battlefield', body: 'Distance is time. Each creature is one real deadline; the altar on the left is today. Everything moves at the pace of your semester.' },
        { target: '.hud-grades', art: 'hp', title: 'Your projected grades', body: 'When a deadline arrives, every seal still on it costs grade in that course, in proportion to its weight. Below 50, the course is failed.' },
        { target: { x: 380, y: 150, w: 760, h: 560 }, art: 'deadline', title: 'Choose your battles', body: 'A 10-point lab barely scratches. A 100-point exam can fail the course. Its scroll shows the days left and its share of the grade.' },
        { target: '.hud-btn.check', art: 'study', title: 'Duel', body: 'Click a creature (or <span class="dd-kbd">Tab</span>, <span class="dd-kbd">Space</span>). Answer questions from its course: each correct answer breaks a seal. A wrong one costs half a day.' },
        { target: '.hud-btn.hasten', art: 'keys', title: 'Hasten time', body: 'Ready for what is coming? <span class="dd-kbd">F</span> speeds the calendar up. When an exam is a day away, a timed last stand begins.' },
      ],
      () => {
        if (this.phase === 'tour') this.phase = 'fight';
      },
    );
  }

  private transcriptHtml(): string {
    const rows = this.semester.courses
      .map((c) => {
        const g = courseGrade(this.state, c.id);
        const l = letterGrade(g);
        return `<div class="tr-row ${g < 50 ? 'fail' : ''}" style="--c:${hex(getCourseColor(c.id))}"><span class="tr-c">${c.title}</span><span class="tr-bar"><i style="width:${g}%"></i></span><b>${g.toFixed(1)}</b><em>${l}</em></div>`;
      })
      .join('');
    return `<div class="transcript">${rows}</div>`;
  }

  private onFinished(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    sfx('victory');
    this.flushSessions();
    save((d) => (d.procession = null));
    const worst = [...this.stats.arrivals].sort((a, b) => b.gradeBefore - b.gradeAfter - (a.gradeBefore - a.gradeAfter))[0];
    this.overlay = debrief(
      {
        title: 'The term is over',
        lines: [
          'Your projected transcript:',
          this.transcriptHtml(),
          `<b>${this.stats.defeated.length}</b> deadline${this.stats.defeated.length === 1 ? '' : 's'} met ready · study answers <b>${this.stats.ok} / ${this.stats.total}</b> correct.`,
          worst && worst.gradeBefore - worst.gradeAfter > 1
            ? `Costliest: <b>${shortName(worst.label)}</b> (${this.courseTitle(worst.courseId)}), −${(worst.gradeBefore - worst.gradeAfter).toFixed(1)}.`
            : '',
        ].filter(Boolean),
        advice: this.adviceFor(),
        primary: 'Return to the War Room',
        tone: 'win',
      },
      () => this.toWarRoom(),
    );
  }

  private onFailed(failed: string[]): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    sfx('defeat');
    this.flushSessions();
    this.view.breach(1);
    save((d) => (d.procession = null));
    const names = failed.map((c) => this.courseTitle(c)).join(' and ');
    this.overlay = debrief(
      {
        title: `You failed ${names}`,
        lines: [this.transcriptHtml(), 'Too many seals were still on its heaviest deadlines when they arrived.'],
        advice: this.adviceFor(),
        primary: 'Train in the War Room',
        secondary: 'Retry the semester',
        tone: 'lose',
      },
      () => this.toWarRoom(),
      () => this.scene.restart({ fresh: true }),
    );
  }

  /** Turn the battle into real study advice (R17). */
  private adviceFor(): string[] {
    const out: string[] = [];
    const hurt = new Set(this.stats.arrivals.filter((a) => a.gradeBefore - a.gradeAfter > 2).map((a) => a.courseId));
    const views = this.semester.courses.map((c) => courseView(c));
    for (const v of views.filter((v) => hurt.has(v.course.id) || (v.next && v.next.days <= 14 && v.readiness < 60)).slice(0, 3)) {
      if (v.next)
        out.push(
          `<b>${v.next.name}</b> (${v.course.title}) is ${v.next.days <= 1 ? 'due very soon' : `due in ${v.next.days} days`}. Readiness ${v.readiness}%: ${
            v.recommendedTrials > 0 ? `${v.recommendedTrials} practice trial${v.recommendedTrials > 1 ? 's' : ''} recommended` : 'one more trial keeps it sharp'
          }.`,
        );
      if (v.weakTopics.length) out.push(`Revisit in ${v.course.title}: <b>${v.weakTopics.join(', ')}</b>.`);
    }
    if (!out.length) out.push('Every course held. Keep one short trial a day to stay ahead of the real calendar.');
    return out;
  }

  // ───────────────────────── study ─────────────────────────

  private pickQuestion(courseId: string): Question {
    const pool = questionsFor(courseId);
    const seen = new Set(this.answered);
    const fresh = pool.filter((q) => !seen.has(q.id));
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(this.rng() * list.length)];
  }

  private noteAnswer(courseId: string, questionId: string, correct: boolean): void {
    this.answered.push(questionId);
    const arr = this.sessionAnswers.get(courseId) ?? [];
    arr.push({ questionId, correct });
    this.sessionAnswers.set(courseId, arr);
  }

  private flushSessions(): void {
    for (const [courseId, answers] of this.sessionAnswers) {
      const gain = recordSession(courseId, answers, 'battle');
      if (gain.levelsGained) this.hud?.caption(`${courseId} forge level ${gain.level}`, 'good');
    }
    this.sessionAnswers.clear();
  }

  /** The last stand: an exam or project one day out with seals left gets one timed question. */
  private async runQTE(it: ProcessionItem): Promise<void> {
    this.phase = 'qte';
    this.hasten = false;
    this.timeScale = 0;
    const q = this.pickQuestion(it.courseId);
    const extra = load().settings.extraTime || this.reduced;
    this.view.setSlowmo(true);
    this.setTarget(it.itemId);
    this.hud?.caption(`Heartbeat: ${shortName(it.label)} is a day away. Last stand.`, 'bad');
    const ok = await qteCard(q, this.courseTitle(it.courseId), hex(getCourseColor(it.courseId)), extra ? 16000 : 9000, extra);
    this.view.setSlowmo(false);
    this.timeScale = 1;
    if (this.phase !== 'qte') return;
    this.phase = 'fight';
    this.stats.total++;
    this.noteAnswer(it.courseId, q.id, ok);
    const outcome = resolveQTE({ enemyId: it.itemId, question: { ...q, courseId: it.courseId }, timeRemaining: 0, maxTime: 1, startedAt: 0 }, ok ? q.correctIndex : null, 60);
    const live = this.item(it.itemId);
    if (outcome.success && live) {
      this.stats.ok++;
      sfx('crit');
      this.view.strike(live.itemId, 0xffffff);
      this.floatLabel(live.itemId, '−2 seals', 0xffffff, 24);
      this.hud?.caption('Critical strike: knowledge cuts deep', 'good');
      this.state = breakSeals(this.state, live.itemId, 2);
      const after = this.state.items.find((i) => i.itemId === live.itemId)!;
      if (after.resolved) this.defeat(after);
      else this.syncField();
    } else if (live) {
      sfx('enrage');
      this.view.setEnraged(live.itemId, true);
      this.floatLabel(live.itemId, 'ENRAGED', 0xff6b74);
      this.hud?.caption(`${shortName(live.label)} is enraged: it will hit hard`, 'bad');
    }
  }

  // ───────────────────────── tutorial ─────────────────────────

  /** The first battle is the tutorial: the clock waits until you have duelled once. */
  private beginTutorial(): void {
    this.coachEl = coach(
      'The battlefield is your <b>calendar</b>. Each creature is a real deadline; the altar on the left is <b>today</b>. The closer it is, the sooner it is due.',
      1000,
      420,
    );
    this.time.delayedCall(this.reduced ? 2500 : 5000, () => this.advanceTutorial(1));
  }

  private advanceTutorial(step: number): void {
    if (!this.tutorial || step <= this.tutorialStep) return;
    this.tutorialStep = step;
    this.coachEl?.remove();
    document.querySelector('.hud-btn.check')?.classList.remove('beckon');
    if (step === 1) {
      this.coachEl = coach('<b>Click a creature</b> (or press <span class="dd-kbd">Space</span>) to duel it with questions from <b>its own course</b>.', 1000, 420);
      document.querySelector('.hud-btn.check')?.classList.add('beckon');
    } else if (step === 3) {
      this.coachEl = coach(
        'Defeated: you are ready for it. When a deadline <b>arrives</b>, every seal left on it costs grade, by its weight. Watch your grades at the top left.',
        1000,
        420,
      );
      save((d) => (d.tutorialDone = true));
      this.tutorial = false;
      this.time.delayedCall(7000, () => this.coachEl?.remove());
    }
  }

  // ───────────────────────── frame loop ─────────────────────────

  update(_time: number, deltaRaw: number): void {
    const running = this.phase === 'fight' || this.phase === 'duel';
    const waiting = this.tutorial && this.tutorialStep < 3 && this.phase === 'fight';
    if (running && !waiting) {
      const empty = this.field.size === 0;
      const speed = this.timeScale * (this.hasten || empty ? (empty ? 8 : 4) : 1);
      this.tick((Math.min(50, deltaRaw) / 1000 / PROCESSION.secondsPerDay) * speed);
      if (this.phase === 'fight') this.checkLastStand();
    }

    const day = this.state.day;
    this.hud?.update({
      waveLabel: `Week ${Math.floor(day / 7) + 1}`,
      waveSub: `Day ${Math.floor(day) + 1} · ${this.dayLabel()}`,
      grades: this.semester.courses.map((c) => {
        const g = courseGrade(this.state, c.id);
        return { courseId: c.id, short: c.id.replace(/\d+$/, ''), title: c.title, color: hex(getCourseColor(c.id)), grade: g, letter: letterGrade(g) };
      }),
      progress: Math.min(1, day / this.lastDay()),
      hasten: this.hasten,
    });
    const tgt = this.item(this.targetId);
    if (!tgt && this.phase === 'fight' && this.field.size) this.setTarget(this.nearest()[0].itemId);
    const tt = tgt ? `Target: <b>${shortName(tgt.label)}</b> · ${tgt.seals} seal${tgt.seals === 1 ? '' : 's'} · ${Math.round(this.weightOf(tgt))}%` : '';
    if (tt !== this.lastHudTarget) {
      this.lastHudTarget = tt;
      this.hud?.setTarget(tt);
    }
    const low = Math.min(...this.semester.courses.map((c) => courseGrade(this.state, c.id)));
    this.view.setDanger(Phaser.Math.Clamp((75 - low) / 40, 0, 0.8));
    this.view.update(deltaRaw);
  }

  private checkLastStand(): void {
    for (const it of visible(this.state)) {
      if (this.qteDone.has(it.itemId) || it.seals === 0) continue;
      if (it.type !== 'exam' && it.type !== 'project') continue;
      if (it.dueDay - this.state.day <= 1) {
        this.qteDone.add(it.itemId);
        void this.runQTE(it);
        return;
      }
    }
  }

  // ───────────────────────── effects ─────────────────────────

  private floatLabel(id: string, s: string, color: number, size = 15): void {
    const at = this.view.enemyScreen(id);
    if (!at || !this.labels) return;
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = s;
    el.style.cssText = `left:${Math.max(190, Math.min(1420, at.x))}px;top:${Math.max(130, at.y)}px;color:${hex(color)};font-size:${size}px`;
    this.labels.appendChild(el);
    gsap.to(el, { y: -46, opacity: 0, duration: this.reduced ? 0.6 : 1.4, ease: 'power2.out', onComplete: () => el.remove() });
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
    if (this.phase !== 'over') this.persist();
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
    clearLayers('.overlay, .coach-layer, .title-card, .battle-hud, .week-banner');
    gsap.killTweensOf('*');
    this.input.keyboard?.removeAllListeners();
  }
}

// Keep Palette referenced for consumers that import from this module.
export const BATTLE_PALETTE = Palette;
