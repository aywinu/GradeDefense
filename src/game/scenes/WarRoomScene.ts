/**
 * WarRoomScene: the useful home screen (R15). One card per course with grade,
 * readiness, threat and the next big enemies; a semester timeline of
 * tombstones; and the next battle. Training opens a practice trial (R16).
 */
import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Atmosphere, prefersReducedMotion } from '../fx/Atmosphere';
import { mountLayer, clearLayers } from '../../ui/stage';
import { allCourseViews, getSemester, formatDue, inDays, type CourseView } from '../../study/model';
import { openTrial } from '../../ui/TrialPanel';
import { getCourseColor } from '../palette';
import { campaignLength } from '../../core/wave';
import { load } from '../../save/save';
import { Graveyard } from '../fx/Graveyard';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const ICONS: Record<string, string> = {
  exam: '<svg class="ico" viewBox="0 0 16 18"><path d="M2 17V7a6 6 0 0 1 12 0v10z" fill="currentColor" opacity=".85"/><path d="M8 6v6M5.5 8.5h5" stroke="#120f1a" stroke-width="1.6"/></svg>',
  project: '<svg class="ico" viewBox="0 0 16 18"><path d="M3 2h10v14H3z" fill="currentColor" opacity=".8"/><path d="M5 6h6M5 9h6M5 12h4" stroke="#120f1a" stroke-width="1.2"/></svg>',
  presentation: '<svg class="ico" viewBox="0 0 16 18"><path d="M8 1l2.2 4.6 5 .6-3.7 3.4 1 5L8 12.2 3.5 14.6l1-5L.8 6.2l5-.6z" fill="currentColor" opacity=".85"/></svg>',
  quiz: '<svg class="ico" viewBox="0 0 16 18"><circle cx="8" cy="9" r="6" fill="currentColor" opacity=".8"/><path d="M6.3 7.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 12.4v.2" stroke="#120f1a" stroke-width="1.4" fill="none"/></svg>',
  assignment: '<svg class="ico" viewBox="0 0 16 18"><path d="M3 1h7l3 3v13H3z" fill="currentColor" opacity=".8"/></svg>',
};

export class WarRoomScene extends Phaser.Scene {
  private atmosphere?: Atmosphere;
  private layer?: HTMLDivElement;
  private busy = false;
  private graveyard?: Graveyard;

  constructor() {
    super({ key: 'WarRoomScene' });
  }

  create() {
    const { width: W, height: H } = this.cameras.main;
    this.busy = false;
    this.atmosphere = new Atmosphere(this, { width: W, height: H, fog: 0.35 });
    this.graveyard = new Graveyard(this, W, H);
    this.render();
    this.cameras.main.fadeIn(prefersReducedMotion() ? 0 : 600, 7, 6, 11);
    this.events.once('shutdown', () => clearLayers('.warroom'));
  }

  private render(animate = true) {
    clearLayers('.warroom');
    const now = new Date();
    const views = allCourseViews(now);
    const sem = getSemester(now);
    const save = load();
    const totalWaves = campaignLength(sem, now.getTime());

    const nextBattle = views
      .flatMap((v) => v.big.map((b) => ({ ...b, view: v })))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    const avgReady = Math.round(views.reduce((s, v) => s + v.readiness, 0) / Math.max(1, views.length));
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const source = save.semester.source === 'demo' ? 'Demo semester' : save.semester.source === 'moodle' ? 'From your Moodle' : 'Imported calendar';

    const cards = views.map((v) => this.card(v)).join('');
    const layer = mountLayer(
      'warroom',
      `
      <header class="wr-header">
        <div>
          <div class="wr-eyebrow">${dateStr} &middot; ${source}</div>
          <div class="wr-title">The War Room</div>
          <div class="wr-sub">Average readiness <b>${avgReady}%</b> across ${views.length} courses. ${
            totalWaves > 0 ? `The siege lasts <b>${totalWaves} waves</b> until your last deadline.` : 'No deadlines ahead.'
          }</div>
        </div>
        ${
          nextBattle
            ? `<div class="epitaph" data-interactive>
            <div class="here">Here waits</div>
            <div class="what">${nextBattle.name}</div>
            <div class="when">${nextBattle.view.course.title} &middot; ${formatDue(nextBattle.dueDate)} &middot; <b>${inDays(nextBattle.days)}</b></div>
            <button class="dd-btn" data-action="battle">Defend<span class="dd-kbd">Enter</span></button>
          </div>`
            : `<button class="dd-btn" data-action="battle">Defend<span class="dd-kbd">Enter</span></button>`
        }
      </header>
      <section class="wr-grid" aria-label="Courses">${cards}</section>
      ${this.timeline(views, now)}
    `,
    );
    this.layer = layer;

    layer.querySelectorAll<HTMLButtonElement>('[data-train]').forEach((b) =>
      b.addEventListener('click', () => this.train(b.dataset.train!)),
    );
    layer.querySelector<HTMLButtonElement>('[data-action="battle"]')?.addEventListener('click', () => this.battle());
    this.input.keyboard?.removeAllListeners();
    this.input.keyboard?.on('keydown-ENTER', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return; // let the focused button handle it
      this.battle();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.back());

    if (animate && !prefersReducedMotion()) {
      const lit = layer.querySelectorAll('.candles i.lit');
      gsap.from(layer.querySelector('.wr-header'), { opacity: 0, y: -16, duration: 0.7, ease: 'power3.out' });
      gsap.from(layer.querySelectorAll('.course-card'), { opacity: 0, y: 12, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.15 });
      gsap.from(layer.querySelectorAll('.tl-stone'), { opacity: 0, y: 20, duration: 0.5, stagger: 0.02, ease: 'back.out(2)', delay: 0.5 });
      if (lit.length) gsap.from(lit, { opacity: 0, duration: 0.4, stagger: 0.015, delay: 0.5 });
    }
  }

  private card(v: CourseView): string {
    const c = hex(getCourseColor(v.course.id));
    const grade = v.grade === null ? '—' : `${Math.round(v.grade)}%`;
    const enemies = v.big.length
      ? v.big
          .map(
            (b) => `<li class="${b.days <= 7 ? 'soon' : ''}">${ICONS[b.type] ?? ICONS.assignment}<span class="nm">${b.name}</span><span class="dt">${formatDue(b.dueDate)}, ${inDays(b.days)}</span></li>`,
          )
          .join('')
      : '<li class="none">No great enemies on the horizon.</li>';
    const advice = v.next
      ? v.recommendedTrials > 0
        ? `${v.recommendedTrials} trial${v.recommendedTrials > 1 ? 's' : ''} recommended before ${v.next.name.replace(/ - .*/, '')}`
        : `Ready for ${v.next.name.replace(/ - .*/, '')}`
      : 'Keep your edge sharp';
    const weak = v.weakTopics.length ? `<div class="weak">Revisit: <span>${v.weakTopics.join(', ')}</span></div>` : '';
    const lit = Math.round(v.readiness / 10);
    const candles = Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join('');
    const threatWord: Record<string, string> = { Low: 'Quiet', Medium: 'Stirring', High: 'Looming', Critical: 'Dire' };
    return `
      <article class="course-card" style="--c:${c}" aria-label="${v.course.title}">
        <div class="cc-top">
          <div class="seal" aria-hidden="true">${v.course.id.replace(/\d+$/, '')}</div>
          <div>
            <div class="cc-name">${v.course.title}</div>
            <div class="cc-meta">Grade <b>${grade}</b> &middot; Forge <b>${'◆'.repeat(v.forge)}${'◇'.repeat(5 - v.forge)}</b></div>
          </div>
          <span class="threat ${v.threat.toLowerCase()}" title="Threat level: ${v.threat}">${threatWord[v.threat]}</span>
        </div>
        <div class="readiness" aria-label="Readiness ${v.readiness} percent">
          <span class="lbl">Readiness</span><span class="candles" aria-hidden="true">${candles}</span><span class="pct">${v.readiness}%</span>
        </div>
        <ul class="enemies">${enemies}</ul>
        ${weak}
        <div class="cc-actions">
          <button class="train-btn" data-train="${v.course.id}" aria-label="Train ${v.course.title}: ${advice}">Train</button>
          <span class="advice-ink">${advice}</span>
        </div>
      </article>`;
  }

  private timeline(views: CourseView[], now: Date): string {
    const items = views.flatMap((v) =>
      v.course.items
        .filter((i) => i.grade === null && i.dueDate.getTime() >= now.getTime() - 86400000)
        .map((i) => ({ i, c: hex(getCourseColor(v.course.id)), code: v.course.id })),
    );
    if (!items.length) return '<div class="timeline"></div>';
    const maxDays = Math.max(14, ...items.map(({ i }) => (i.dueDate.getTime() - now.getTime()) / 86400000)) + 3;
    const x = (days: number) => 48 + 40 + (days / maxDays) * (1600 - 96 - 80);
    const weeks: string[] = [];
    for (let w = 1; w * 7 < maxDays; w++) weeks.push(`<div class="tl-week" style="left:${x(w * 7)}px">W${w}</div>`);
    const stones = items
      .map(({ i, c, code }) => {
        const d = Math.max(0, (i.dueDate.getTime() - now.getTime()) / 86400000);
        const size = i.points >= 100 ? [22, 44] : i.points >= 50 ? [18, 34] : [13, 24];
        return `<div class="tl-stone" tabindex="0" style="left:${x(d)}px;--c:${c};--w:${size[0]}px;--h:${size[1]}px" aria-label="${i.name}, ${code}, ${formatDue(i.dueDate)}">
          <div class="tip"><b>${i.name}</b>${code} &middot; ${formatDue(i.dueDate)} &middot; ${i.points} pts</div></div>`;
      })
      .join('');
    return `<div class="timeline" aria-label="Semester timeline"><div class="tl-axis"></div><div class="tl-today" style="left:${x(0)}px"></div>${weeks.join('')}${stones}</div>`;
  }

  private train(courseId: string) {
    if (this.busy) return;
    this.busy = true;
    openTrial(courseId, () => {
      this.busy = false;
      this.render(false);
    });
  }

  private battle() {
    if (this.busy) return;
    this.busy = true;
    if (this.layer) gsap.to(this.layer, { opacity: 0, duration: 0.35 });
    this.cameras.main.fadeOut(450, 7, 6, 11);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('BattleScene'));
  }

  private back() {
    if (this.busy) return;
    this.scene.start('TitleScene');
  }

  update(_t: number, dt: number) {
    this.atmosphere?.update(dt);
    this.graveyard?.update(dt);
  }
}
