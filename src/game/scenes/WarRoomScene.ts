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
import { preloadSkeletons } from '../../game3d/skeletons';
import { load } from '../../save/save';
import { Graveyard } from '../fx/Graveyard';
import { runTour, hasSeen } from '../../ui/Tour';
import { parseICS, icsToSemester } from '../../import/ics';
import { save as saveData } from '../../save/save';
import { invalidateSemester, hasCourseQuestions, notesQuestions, saveNotes } from '../../study/model';
import { notesToQuestions } from '../../import/notes';
import { mulberry32 } from '../../core/rng';

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
  private selected: string | null = null;
  private views: CourseView[] = [];

  constructor() {
    super({ key: 'WarRoomScene' });
  }

  create() {
    const { width: W, height: H } = this.cameras.main;
    this.busy = false;
    this.atmosphere = new Atmosphere(this, { width: W, height: H, fog: 0.35 });
    this.graveyard = new Graveyard(this, W, H);
    this.render();
    void preloadSkeletons(); // warm the battle's models while the student reads
    if (!hasSeen('warroom')) this.time.delayedCall(prefersReducedMotion() ? 50 : 1400, () => this.tour());
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

    // The single most useful action tonight: the course with the nearest big
    // enemy weighted by how unprepared the student is.
    const ranked = [...views].sort((x, y) => this.urgency(y) - this.urgency(x));
    const focus = ranked[0];
    this.selected = this.selected && views.some((v) => v.course.id === this.selected) ? this.selected : focus?.course.id ?? null;
    const counsel = focus?.next
      ? focus.recommendedTrials > 0
        ? `Tonight's counsel: train <b>${focus.course.title}</b>. ${focus.next.name} comes ${inDays(focus.next.days)} and your readiness is ${focus.readiness}%.`
        : `Tonight's counsel: your defences hold. Face the siege, or sharpen <b>${focus.course.title}</b> before ${focus.next.name}.`
      : 'No deadlines ahead. The study is quiet tonight.';

    const rows = views.map((v) => this.row(v)).join('');
    const layer = mountLayer(
      'warroom',
      `
      <header class="wr-header">
        <div>
          <div class="wr-eyebrow">${dateStr} &middot; ${source}
            <button class="link-btn" data-import title="Import your real deadlines from a calendar export (.ics), e.g. Moodle → Calendar → Export">Import calendar</button>
            ${save.semester.source !== 'demo' ? '<button class="link-btn" data-demo>Use demo</button>' : ''}
            <input type="file" accept=".ics,text/calendar" data-file hidden />
          </div>
          <div class="wr-title">The War Room</div>
          <p class="wr-counsel">${counsel}</p>
          <div class="wr-cta">
            ${focus ? `<button class="dd-btn" data-train="${focus.course.id}">Train ${focus.course.title}<span class="dd-kbd">T</span></button>` : ''}
            <button class="dd-btn secondary" data-action="battle">Face the semester<span class="dd-kbd">Enter</span></button>
          </div>
        </div>
        ${
          nextBattle
            ? `<div class="epitaph" aria-label="Next great enemy">
            <div class="here">Here waits</div>
            <div class="what">${nextBattle.name}</div>
            <div class="when">${nextBattle.view.course.title} &middot; ${formatDue(nextBattle.dueDate)} &middot; <b>${inDays(nextBattle.days)}</b></div>
          </div>`
            : ''
        }
      </header>
      <section class="wr-body">
        <ol class="wr-list" aria-label="Courses (select one for details)">${rows}</ol>
        <div class="wr-detail" aria-live="polite"></div>
      </section>
      ${this.timeline(views, now)}
      <div class="wr-foot">Average readiness ${avgReady}% &middot; ${totalWaves > 0 ? `${totalWaves} weeks until your last deadline` : 'nothing due ahead'} &middot; <span class="dd-kbd">↑</span><span class="dd-kbd">↓</span> browse courses</div>
    `,
    );
    this.layer = layer;
    this.views = views;
    this.showDetail(this.selected);

    layer.querySelectorAll<HTMLButtonElement>('.wr-row').forEach((b) => {
      b.addEventListener('click', () => this.showDetail(b.dataset.course!));
      b.addEventListener('focus', () => this.showDetail(b.dataset.course!));
    });
    const file = layer.querySelector<HTMLInputElement>('[data-file]')!;
    layer.querySelector('[data-import]')?.addEventListener('click', () => file.click());
    file.addEventListener('change', () => void this.importIcs(file.files?.[0]));
    layer.querySelector('[data-demo]')?.addEventListener('click', () => {
      saveData((d) => (d.semester = { source: 'demo' }));
      invalidateSemester();
      this.render(false);
    });
    layer.querySelectorAll<HTMLButtonElement>('.wr-cta [data-train]').forEach((b) => b.addEventListener('click', () => this.train(b.dataset.train!)));
    layer.querySelector<HTMLButtonElement>('[data-action="battle"]')?.addEventListener('click', () => this.battle());
    this.input.keyboard?.removeAllListeners();
    this.input.keyboard?.on('keydown-ENTER', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return; // let the focused button handle it
      this.battle();
    });
    this.input.keyboard?.on('keydown-T', () => this.selected && this.train(this.selected));
    this.input.keyboard?.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard?.on('keydown-ESC', () => this.back());

    if (animate && !prefersReducedMotion()) {
      gsap.from(layer.querySelector('.wr-header'), { opacity: 0, y: -12, duration: 0.7, ease: 'power3.out' });
      gsap.from(layer.querySelectorAll('.wr-row'), { opacity: 0, x: -10, duration: 0.5, stagger: 0.05, ease: 'power3.out', delay: 0.15 });
      gsap.from(layer.querySelector('.wr-detail'), { opacity: 0, duration: 0.6, delay: 0.3 });
      gsap.from(layer.querySelectorAll('.tl-stone'), { opacity: 0, y: 14, duration: 0.5, stagger: 0.02, ease: 'power2.out', delay: 0.5 });
    }
  }

  /** Turn the student's notes into cloze questions for one course (no upload, no AI). */
  private async importNotes(courseId: string, f?: File) {
    if (!f) return;
    this.toast('Reading your notes…');
    try {
      let text: string;
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const { extractPdfText } = await import('../../import/pdf');
        text = await extractPdfText(f);
      } else text = await f.text();
      const qs = notesToQuestions(text, courseId, mulberry32(text.length), 24);
      if (!qs.length) throw new Error('No definitions found to build questions from. Try lecture notes or a summary with full sentences.');
      saveNotes(courseId, f.name, qs.map((q, i) => ({ ...q, id: `${courseId}-notes-${i}` })));
      this.render(false);
      this.toast(`Forged ${qs.length} questions from ${f.name}. Train to use them.`);
    } catch (e) {
      this.toast(e instanceof Error ? e.message : 'Those notes could not be read.');
    }
  }

  /** Import a calendar export (.ics), parsed entirely in the browser. */
  private async importIcs(f?: File) {
    if (!f) return;
    try {
      const text = await f.text();
      const sem = icsToSemester(parseICS(text), new Date());
      const items = sem.courses.reduce((n, c) => n + c.items.length, 0);
      if (!items) throw new Error('No upcoming deadlines found in that calendar.');
      saveData((d) => (d.semester = { source: 'ics', json: JSON.stringify(sem), importedAt: Date.now() }));
      invalidateSemester();
      this.render(false);
      this.toast(`Imported ${items} deadlines across ${sem.courses.length} courses. Nothing left your browser.`);
    } catch (e) {
      this.toast(e instanceof Error ? e.message : 'That file could not be read as a calendar.');
    }
  }

  private toast(msg: string) {
    const t = document.createElement('div');
    t.className = 'wr-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    this.layer?.appendChild(t);
    gsap.fromTo(t, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 });
    setTimeout(() => gsap.to(t, { opacity: 0, duration: 0.4, onComplete: () => t.remove() }), 4200);
  }

  /** First-visit guided tour of every control on this screen. */
  tour() {
    this.busy = true;
    runTour(
      'warroom',
      [
        { target: null, art: 'deadline', title: 'Your semester is under siege', body: 'Every real deadline from your courses becomes a creature. Exams are bosses, quizzes are swarms. You defend by <b>studying</b>.' },
        { target: '.wr-counsel', art: 'epitaph', title: "Tonight's counsel", body: 'One sentence that tells you the single most useful thing to do right now, based on dates, weights and how ready you are.' },
        { target: '.wr-cta [data-train]', art: 'train', title: 'Train', body: 'A five-question practice trial for one course. Correct answers raise your readiness and <b>pre-weaken</b> that course\'s deadlines before the battle. Key <span class="dd-kbd">T</span>.' },
        { target: '.wr-list', art: 'candles', title: 'Your courses', body: 'Each lit candle is 10% readiness. The word on the right is the threat level. Use <span class="dd-kbd">↑</span><span class="dd-kbd">↓</span> or click a course to see its details.' },
        { target: '.wr-detail', art: 'train', title: 'Battle plan', body: 'The great enemies of the selected course with real dates and weights, how many trials to do before each, and the topics you missed.' },
        { target: '[data-import]', art: 'timeline', title: 'Your real semester', body: 'Export your calendar from Moodle (Calendar → Export → .ics) and import it here. It is parsed in your browser; nothing is uploaded. Or install our Moodle block and it arrives on its own.' },
        { target: '.epitaph', art: 'epitaph', title: 'Here waits…', body: 'The next big deadline across all courses, carved in stone so you never lose sight of it.' },
        { target: '.timeline', art: 'timeline', title: 'The graveyard of deadlines', body: 'Your whole semester as tombstones. Bigger stones weigh more. Hover one to read it.' },
        { target: '[data-action="battle"]', art: 'lantern', title: 'Face the semester', body: 'Your calendar becomes the battlefield. Pick a deadline and duel it with questions from its own course; whatever arrives unprepared costs grade, by its weight. Key <span class="dd-kbd">Enter</span>.' },
      ],
      () => {
        this.busy = false;
      },
    );
  }

  private urgency(v: CourseView): number {
    if (!v.next) return 0;
    return (1 - v.readiness / 100) * (v.next.points / 100 + 0.3) * (1 / Math.max(1, v.next.days));
  }

  private moveSelection(d: number) {
    const ids = this.views.map((v) => v.course.id);
    const i = Math.max(0, ids.indexOf(this.selected ?? ids[0]));
    const next = ids[(i + d + ids.length) % ids.length];
    this.layer?.querySelector<HTMLButtonElement>(`.wr-row[data-course="${next}"]`)?.focus();
  }

  private readonly threatWord: Record<string, string> = { Low: 'Quiet', Medium: 'Stirring', High: 'Looming', Critical: 'Dire' };

  private candles(readiness: number): string {
    const lit = Math.round(readiness / 10);
    return Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join('');
  }

  /** One compact line per course. */
  private row(v: CourseView): string {
    const c = hex(getCourseColor(v.course.id));
    const next = v.next ? `${v.next.name.replace(/ - .*/, '')}, ${inDays(v.next.days)}` : 'Nothing due';
    return `<li><button class="wr-row" data-course="${v.course.id}" style="--c:${c}" aria-label="${v.course.title}: readiness ${v.readiness}%, threat ${v.threat}, next ${next}">
      <span class="seal" aria-hidden="true">${v.course.id.replace(/\d+$/, '')}</span>
      <span class="r-name">${v.course.title}</span>
      <span class="candles" aria-hidden="true">${this.candles(v.readiness)}</span>
      <span class="threat ${v.threat.toLowerCase()}">${this.threatWord[v.threat]}</span>
      <span class="r-next ${v.next && v.next.days <= 7 ? 'soon' : ''}">${next}</span>
    </button></li>`;
  }

  /** Full details for one course (only on selection, to avoid overload). */
  private showDetail(courseId: string | null) {
    if (!courseId || !this.layer) return;
    this.selected = courseId;
    const v = this.views.find((x) => x.course.id === courseId);
    if (!v) return;
    this.layer.querySelectorAll('.wr-row').forEach((r) => r.classList.toggle('on', (r as HTMLElement).dataset.course === courseId));
    const grade = v.grade === null ? '—' : `${Math.round(v.grade)}%`;
    const enemies = v.big.length
      ? v.big
          .map((b) => `<li class="${b.days <= 7 ? 'soon' : ''}">${ICONS[b.type] ?? ICONS.assignment}<span class="nm">${b.name}</span><span class="dt">${formatDue(b.dueDate)}, ${inDays(b.days)} &middot; <b class="wt">${Math.round((b.points / Math.max(1, v.course.items.reduce((t, i) => t + i.points, 0))) * 100)}% of the grade</b></span></li>`)
          .join('')
      : '<li class="none">No great enemies on the horizon.</li>';
    const plan = v.next
      ? v.recommendedTrials > 0
        ? `${v.recommendedTrials} practice trial${v.recommendedTrials > 1 ? 's' : ''} before ${v.next.name.replace(/ - .*/, '')}. Each one weakens its deadline before the battle.`
        : `Ready for ${v.next.name.replace(/ - .*/, '')}. One trial a day keeps it that way.`
      : 'Nothing due. Keep your edge sharp.';
    const d = this.layer.querySelector<HTMLDivElement>('.wr-detail')!;
    d.style.setProperty('--c', hex(getCourseColor(v.course.id)));
    d.innerHTML = `
      <div class="d-head"><span class="seal" aria-hidden="true">${v.course.id.replace(/\d+$/, '')}</span><div><div class="d-name">${v.course.title}</div>
        <div class="cc-meta">Grade so far <b>${grade}</b> &middot; Readiness <b>${v.readiness}%</b> &middot; Forge <b>${'◆'.repeat(v.forge)}${'◇'.repeat(5 - v.forge)}</b></div></div></div>
      <div class="d-label">Great enemies</div>
      <ul class="enemies">${enemies}</ul>
      <div class="d-label">Battle plan</div>
      <p class="d-plan">${plan}</p>
      ${v.weakTopics.length ? `<p class="weak">Revisit: <span>${v.weakTopics.join(', ')}</span></p>` : ''}
      <div class="d-actions">
        <button class="train-btn" data-train="${v.course.id}">Train ${v.course.title}</button>
        <button class="link-btn" data-notes title="Turn your own lecture notes or slides (PDF or text) into practice questions, locally in your browser">${
          notesQuestions(v.course.id).length ? `Notes: ${notesQuestions(v.course.id).length} questions · replace` : 'Add your notes (PDF)'
        }</button>
        <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" data-notes-file hidden />
      </div>
      ${hasCourseQuestions(v.course.id) ? '' : '<p class="weak">No question bank for this course yet: trials use study-skill questions until you add notes.</p>'}`;
    d.querySelector<HTMLButtonElement>('[data-train]')!.addEventListener('click', () => this.train(v.course.id));
    const nf = d.querySelector<HTMLInputElement>('[data-notes-file]')!;
    d.querySelector('[data-notes]')!.addEventListener('click', () => nf.click());
    nf.addEventListener('change', () => void this.importNotes(v.course.id, nf.files?.[0]));
    if (!prefersReducedMotion()) gsap.fromTo(d.children, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.03 });
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
