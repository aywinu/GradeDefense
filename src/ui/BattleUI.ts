/**
 * Battle DOM UI: HUD, wave title cards, scout report (pre-wave), debrief
 * (post-wave), quick study checkpoint and quick-time exam card. All
 * keyboard-accessible; GSAP animations skip when reduced motion is on.
 */
import { gsap } from 'gsap';
import { mountLayer } from './stage';
import { prefersReducedMotion } from '../game/fx/Atmosphere';
import { isMuted, setMuted, sfx } from '../audio/sfx';
import type { Question } from '../study/model';
import { hintButtonHtml, wireHint } from './hint';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const R = () => prefersReducedMotion();

export interface HudGrade {
  courseId: string;
  short: string;
  title: string;
  color: string;
  grade: number;
  letter: string;
}

export interface HudState {
  waveLabel: string;
  waveSub: string;
  grades: HudGrade[];
  progress: number; // 0..1 of the semester elapsed
  hasten: boolean;
}

/**
 * Battle HUD for the procession (R19): the week and day, a projected grade
 * per course (the thing that is actually at stake), the semester clock, and
 * the duel / hasten controls.
 */
export class Hud {
  readonly el: HTMLDivElement;
  private last = '';
  private gradeKey = '';
  constructor(handlers: { onCheck: () => void; onHasten: () => void; onPause: () => void }) {
    this.el = mountLayer(
      'battle-hud',
      `
      <div class="hud-left">
        <div class="hud-wave"><span class="w"></span><span class="s"></span></div>
        <div class="hud-grades" aria-label="Projected grade per course"></div>
      </div>
      <div class="hud-center" aria-hidden="true"><div class="wave-progress"><i></i></div><div class="wp-l"><span>today</span><span>end of term</span></div></div>
      <div class="hud-right">
        <div class="hud-target" aria-live="polite"></div>
        <button class="hud-btn check" data-a="check" title="Duel the targeted deadline with questions from its course (Space). Tab changes the target; click a creature to pick it.">
          <span class="lbl">Duel</span><span class="dd-kbd">Space</span>
        </button>
        <button class="hud-btn hasten" data-a="hasten" title="Hasten time (F) when you are ready for what is coming">
          <span class="lbl">Hasten</span><span class="dd-kbd">F</span>
        </button>
        <button class="hud-icon" data-a="mute" aria-label="Toggle sound (M)"></button>
        <button class="hud-icon" data-a="pause" aria-label="Pause (P)">II</button>
      </div>
      <div class="captions" aria-live="polite"></div>
    `,
    );
    this.el.querySelector('[data-a="check"]')!.addEventListener('click', handlers.onCheck);
    this.el.querySelector('[data-a="hasten"]')!.addEventListener('click', handlers.onHasten);
    this.el.querySelector('[data-a="pause"]')!.addEventListener('click', handlers.onPause);
    this.el.querySelector('[data-a="mute"]')!.addEventListener('click', () => this.toggleMute());
    this.renderMute();
  }

  toggleMute(): void {
    setMuted(!isMuted());
    this.renderMute();
    this.caption(isMuted() ? 'Sound off' : 'Sound on');
  }

  private renderMute(): void {
    const b = this.el.querySelector<HTMLButtonElement>('[data-a="mute"]')!;
    b.innerHTML = isMuted()
      ? '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor"/><path d="M13 7l5 6M18 7l-5 6" stroke="currentColor" stroke-width="1.6"/></svg>'
      : '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor"/><path d="M13 7c1.5 1.5 1.5 4.5 0 6M15.5 5c3 3 3 7 0 10" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>';
    b.setAttribute('aria-pressed', String(isMuted()));
  }

  update(s: HudState): void {
    const key = `${s.waveLabel}|${s.waveSub}|${Math.round(s.progress * 200)}|${s.hasten}`;
    if (key !== this.last) {
      this.last = key;
      this.el.querySelector('.hud-wave .w')!.textContent = s.waveLabel;
      this.el.querySelector('.hud-wave .s')!.textContent = s.waveSub;
      this.el.querySelector<HTMLElement>('.wave-progress > i')!.style.width = `${s.progress * 100}%`;
      this.el.querySelector('[data-a="hasten"]')!.classList.toggle('on', s.hasten);
    }
    const gk = s.grades.map((g) => `${g.courseId}:${g.grade}`).join('|');
    if (gk === this.gradeKey) return;
    const box = this.el.querySelector<HTMLElement>('.hud-grades')!;
    if (!this.gradeKey) {
      box.innerHTML = s.grades
        .map(
          (g) =>
            `<div class="gchip" data-c="${esc(g.courseId)}" style="--c:${g.color}" title="${esc(g.title)}: projected grade"><span class="gid">${esc(g.short)}</span><b></b><i></i></div>`,
        )
        .join('');
    }
    this.gradeKey = gk;
    for (const g of s.grades) {
      const chip = box.querySelector<HTMLElement>(`.gchip[data-c="${g.courseId}"]`);
      if (!chip) continue;
      chip.querySelector('b')!.textContent = String(Math.round(g.grade));
      chip.querySelector('i')!.textContent = g.letter;
      chip.classList.toggle('warn', g.grade < 70);
      chip.classList.toggle('fail', g.grade < 50);
    }
  }

  /** A course grade just dropped: the chip flinches. */
  gradeHit(courseId: string): void {
    const chip = this.el.querySelector<HTMLElement>(`.gchip[data-c="${courseId}"]`);
    if (!chip) return;
    chip.classList.remove('hit');
    void chip.offsetWidth;
    chip.classList.add('hit');
  }

  /** Visual caption for sound cues and events (a11y R9.4). */
  caption(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
    const box = this.el.querySelector('.captions')!;
    const last = box.lastElementChild as HTMLDivElement | null;
    if (last && last.dataset.text === text) {
      const n = Number(last.dataset.n ?? '1') + 1;
      last.dataset.n = String(n);
      last.textContent = `${text}  ×${n}`;
      return;
    }
    const c = document.createElement('div');
    c.dataset.text = text;
    c.className = `cap ${tone}`;
    c.textContent = text;
    box.appendChild(c);
    while (box.children.length > 3) box.firstElementChild!.remove();
    setTimeout(() => {
      if (R()) c.remove();
      else gsap.to(c, { opacity: 0, y: -6, duration: 0.4, onComplete: () => c.remove() });
    }, 3200);
  }

  setTarget(text: string): void {
    this.el.querySelector('.hud-target')!.innerHTML = text;
  }

  destroy(): void {
    this.el.remove();
  }
}

/** A small non-blocking banner: "Week 3" as the calendar turns. */
export function weekBanner(title: string, sub: string): void {
  const el = mountLayer('week-banner', `<div class="wb"><b>${esc(title)}</b><span>${esc(sub)}</span></div>`);
  if (R()) {
    setTimeout(() => el.remove(), 1800);
    return;
  }
  gsap
    .timeline({ onComplete: () => el.remove() })
    .fromTo(el.querySelector('.wb'), { opacity: 0, letterSpacing: '0.5em' }, { opacity: 1, letterSpacing: '0.18em', duration: 0.8, ease: 'power2.out' })
    .to(el.querySelector('.wb'), { opacity: 0, duration: 0.6 }, '+=1.2');
}

/** Full-width wave title card ("WEEK 3 · The Midterm rises"). */
export function titleCard(eyebrow: string, title: string, sub: string, danger = false): Promise<void> {
  const el = mountLayer(
    `title-card${danger ? ' danger' : ''}`,
    `<div class="tc-band"><div class="tc-eyebrow">${esc(eyebrow)}</div><div class="tc-title">${esc(title)}</div><div class="tc-sub">${esc(sub)}</div></div>`,
  );
  return new Promise((resolve) => {
    if (R()) {
      setTimeout(() => {
        el.remove();
        resolve();
      }, 1600);
      return;
    }
    const band = el.querySelector('.tc-band')!;
    gsap
      .timeline({ onComplete: () => (el.remove(), resolve()) })
      .fromTo(band, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.35, ease: 'power3.out' })
      .from(el.querySelectorAll('.tc-band > div'), { opacity: 0, letterSpacing: '0.6em', duration: 0.7, stagger: 0.08, ease: 'power2.out' }, 0.1)
      .to(band, { opacity: 0, scaleY: 0.6, duration: 0.4, ease: 'power2.in' }, '+=1.3');
  });
}

export interface ScoutRow {
  itemId: string;
  courseId: string;
  name: string;
  courseTitle: string;
  color: string;
  days: number;
  weight: number; // % of the course grade
  seals: number;
  maxSeals: number;
  readiness: number;
}

/**
 * Scout report (R17 + R19): the next two weeks of the procession, each
 * deadline with its weight in the course grade, how many seals it carries
 * and your readiness. Train pre-weakens a course's deadlines.
 */
export function scoutReport(
  heading: string,
  rows: ScoutRow[],
  onTrain: (courseId: string) => void,
  onBegin: () => void,
  begin = 'Begin the battle',
): HTMLDivElement {
  const heaviest = [...rows].sort((a, b) => b.weight - a.weight)[0];
  const list = rows
    .map(
      (g) => `<li style="--c:${g.color}">
        <span class="seal sm">${esc(g.courseId.replace(/\d+$/, ''))}</span>
        <span class="sr-names"><b>${esc(g.name.replace(/Examination/, 'Exam'))}</b><small>${esc(g.courseTitle)} &middot; ${g.days < 1 ? 'due today' : g.days < 2 ? 'due tomorrow' : `in ${Math.floor(g.days)} days`} &middot; ${g.seals}/${g.maxSeals} seals</small></span>
        <span class="sr-weight ${g.weight >= 25 ? 'heavy' : ''}" title="Share of the course grade">${Math.round(g.weight)}%<small>of grade</small></span>
        <span class="sr-ready ${g.readiness < 40 ? 'low' : ''}">${g.readiness}% ready</span>
        <button class="dd-btn secondary sm" data-train="${esc(g.courseId)}">Train</button>
      </li>`,
    )
    .join('');
  const el = mountLayer(
    'overlay scout',
    `<div class="grimoire scout-page" role="dialog" aria-modal="true" aria-labelledby="scout-t">
      <div class="g-eyebrow">Scout report &middot; ${esc(heading)}</div>
      <h2 id="scout-t">The procession approaches</h2>
      <ul class="scout-list">${list || '<li class="empty">Nothing due in the next two weeks.</li>'}</ul>
      ${
        heaviest && heaviest.weight >= 20
          ? `<p class="explain"><b>${esc(heaviest.name.replace(/Examination/, 'Exam'))}</b> is ${Math.round(heaviest.weight)}% of ${esc(heaviest.courseTitle)}. Every seal still on it when it arrives costs grade. Small deadlines barely scratch; this one can fail the course.</p>`
          : `<p class="explain">Light weeks ahead. Break what you can, and hasten time when you are ready.</p>`
      }
      <div class="actions"><button class="dd-btn" data-begin>${esc(begin)}<span class="dd-kbd">Enter</span></button></div>
    </div>`,
  );
  el.querySelectorAll<HTMLButtonElement>('[data-train]').forEach((b) => b.addEventListener('click', () => onTrain(b.dataset.train!)));
  const btn = el.querySelector<HTMLButtonElement>('[data-begin]')!;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      btn.click();
    }
  };
  window.addEventListener('keydown', onKey);
  btn.addEventListener('click', () => {
    window.removeEventListener('keydown', onKey);
    onBegin();
  });
  el.querySelectorAll<HTMLButtonElement>('[data-train]').forEach((b) => b.addEventListener('click', () => window.removeEventListener('keydown', onKey)));
  setTimeout(() => btn.focus(), 30);
  if (!R()) gsap.from(el.querySelector('.grimoire'), { y: 30, opacity: 0, duration: 0.45, ease: 'power3.out' });
  return el;
}

export interface DebriefData {
  title: string;
  lines: string[];
  advice: string[];
  primary: string;
  secondary?: string;
  tone: 'win' | 'lose' | 'wave';
}

export function debrief(d: DebriefData, onPrimary: () => void, onSecondary?: () => void): HTMLDivElement {
  const el = mountLayer(
    `overlay debrief ${d.tone}`,
    `<div class="grimoire" role="dialog" aria-modal="true" aria-labelledby="deb-t">
      <div class="g-eyebrow">Debrief</div>
      <h2 id="deb-t">${esc(d.title)}</h2>
      <div class="result-lines">${d.lines.map((l) => `<div>${l}</div>`).join('')}</div>
      ${d.advice.length ? `<div class="advice"><div class="g-eyebrow">What this means for your real semester</div><ul>${d.advice.map((a) => `<li>${a}</li>`).join('')}</ul></div>` : ''}
      <div class="actions">
        <button class="dd-btn" data-p>${esc(d.primary)}<span class="dd-kbd">Enter</span></button>
        ${d.secondary ? `<button class="dd-btn secondary" data-s>${esc(d.secondary)}<span class="dd-kbd">Esc</span></button>` : ''}
      </div>
    </div>`,
  );
  const p = el.querySelector<HTMLButtonElement>('[data-p]')!;
  const onKey = (e: KeyboardEvent) => {
    if (!el.isConnected) return window.removeEventListener('keydown', onKey, true);
    if (e.key === 'Escape' && d.secondary) {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      onSecondary?.();
    } else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      onPrimary();
    }
  };
  const cleanup = () => window.removeEventListener('keydown', onKey, true);
  window.addEventListener('keydown', onKey, true);
  p.addEventListener('click', () => {
    cleanup();
    onPrimary();
  });
  el.querySelector('[data-s]')?.addEventListener('click', () => {
    cleanup();
    onSecondary?.();
  });
  setTimeout(() => p.focus(), 30);
  if (!R()) gsap.from(el.querySelector('.grimoire'), { y: 30, opacity: 0, duration: 0.5, ease: 'power3.out' });
  return el;
}

/**
 * Compact checkpoint card (in battle, game paused). Resolves with whether the
 * answer was correct, or null if dismissed.
 */
export function quickCheck(q: Question, courseTitle: string, color: string): Promise<boolean | null> {
  return questionCard({ q, courseTitle, color, mode: 'check' });
}

/** Quick-time exam event: countdown ring; resolves true/false (timeout = false). */
export function qteCard(q: Question, courseTitle: string, color: string, ms: number, extra: boolean): Promise<boolean> {
  return questionCard({ q, courseTitle, color, mode: 'qte', ms, extra }).then((r) => r === true);
}

function questionCard(o: {
  q: Question;
  courseTitle: string;
  color: string;
  mode: 'check' | 'qte';
  ms?: number;
  extra?: boolean;
}): Promise<boolean | null> {
  const { q, mode } = o;
  return new Promise((resolve) => {
    const el = mountLayer(
      `overlay qcard ${mode}`,
      `<div class="qc" role="dialog" aria-modal="true" aria-labelledby="qc-q" style="--c:${o.color}">
        ${
          mode === 'qte'
            ? `<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="track"/><circle cx="60" cy="60" r="54" class="burn"/></svg>
               <div class="qc-eyebrow danger">Quick-time exam &middot; ${esc(o.courseTitle)}${o.extra ? ' &middot; extra time' : ''}</div>
               <div class="qc-timer" aria-live="off"></div>`
            : `<div class="qc-eyebrow">Study checkpoint &middot; ${esc(o.courseTitle)}</div>`
        }
        <p class="qc-q" id="qc-q">${esc(q.question)}</p>
        <div class="qc-choices">${q.choices
          .map((c, i) => `<button class="choice" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(c)}</span></button>`)
          .join('')}</div>
        <p class="qc-explain" aria-live="polite"></p>
        ${mode === 'check' ? `<div class="qc-foot">1–4 to answer &middot; Esc to return${hintButtonHtml()}</div>` : `<div class="qc-foot">1–4 to answer &middot; correct = critical strike${hintButtonHtml()}</div>`}
      </div>`,
    );
    const card = el.querySelector<HTMLDivElement>('.qc')!;
    let done = false;
    let raf = 0;
    const start = performance.now();
    const cleanupHint = wireHint(card, q.correctIndex);

    const finish = (result: boolean | null, delay: number) => {
      if (done) return;
      done = true;
      cleanupHint();
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => {
        if (R()) {
          el.remove();
          resolve(result);
        } else gsap.to(el, { opacity: 0, duration: 0.2, onComplete: () => (el.remove(), resolve(result)) });
      }, delay);
    };

    const answer = (i: number) => {
      if (done) return;
      const ok = i === q.correctIndex;
      sfx(ok ? 'correct' : 'wrong');
      const btns = card.querySelectorAll<HTMLButtonElement>('.choice');
      btns.forEach((b) => (b.disabled = true));
      btns[q.correctIndex].classList.add('right');
      if (!ok && i >= 0) btns[i].classList.add('wrong');
      card.querySelector('.qc-explain')!.textContent =
        i < 0 ? `Time! The answer was “${q.choices[q.correctIndex]}”.` : ok ? (q.explain ?? 'Correct.') : `The answer is “${q.choices[q.correctIndex]}”. ${q.explain ?? ''}`;
      finish(ok, ok ? 900 : 1900);
    };

    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        answer(+e.key - 1);
      } else if (e.key === 'Escape' && mode === 'check') {
        e.preventDefault();
        e.stopPropagation();
        finish(null, 0);
      } else if (e.key !== 'Tab') {
        e.stopPropagation(); // keep game hotkeys out while the card is open
      }
    };
    window.addEventListener('keydown', onKey, true);
    card.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i!)));
    setTimeout(() => card.querySelector<HTMLButtonElement>('.choice')?.focus(), 30);

    if (mode === 'qte' && o.ms) {
      const burn = card.querySelector<SVGCircleElement>('.burn')!;
      const timer = card.querySelector<HTMLDivElement>('.qc-timer')!;
      const C = 2 * Math.PI * 54;
      burn.style.strokeDasharray = String(C);
      let lastBeat = 0;
      const loop = () => {
        const left = Math.max(0, o.ms! - (performance.now() - start));
        burn.style.strokeDashoffset = String(C * (1 - left / o.ms!));
        timer.textContent = (left / 1000).toFixed(1);
        card.classList.toggle('urgent', left < 3000);
        if (performance.now() - lastBeat > (left < 3000 ? 450 : 900)) {
          lastBeat = performance.now();
          sfx('heartbeat');
        }
        if (left <= 0) answer(-1);
        else raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    if (!R())
      gsap.from(card, mode === 'qte' ? { scale: 1.25, opacity: 0, duration: 0.35, ease: 'power4.out' } : { y: 24, opacity: 0, duration: 0.3, ease: 'power3.out' });
  });
}

export interface DuelInfo {
  name: string;
  courseTitle: string;
  color: string;
  seals: number;
  maxSeals: number;
  daysLeft: number;
  streak: number;
  weight?: number; // % of the course grade
}

/**
 * Duel card: one question from the creature's own course. Resolves with
 * true/false for an answer, or null if the student steps back (Esc).
 * The card stays on the side so the creature remains visible.
 */
export function duelCard(q: Question, d: DuelInfo): Promise<boolean | null> {
  return new Promise((resolve) => {
    const seals = Array.from({ length: d.maxSeals }, (_, i) => `<i class="${i < d.seals ? 'on' : ''}"></i>`).join('');
    const el = mountLayer(
      'overlay duel',
      `<div class="qc duel-card" role="dialog" aria-modal="true" aria-labelledby="duel-q" style="--c:${d.color}">
        <div class="duel-head">
          <div><div class="qc-eyebrow">Duel · ${esc(d.courseTitle)}</div><div class="duel-name">${esc(d.name)}</div>
          <div class="duel-when">${d.daysLeft < 1 ? 'due today' : d.daysLeft < 2 ? 'due tomorrow' : `due in ${Math.floor(d.daysLeft)} days`}${d.weight != null ? ` · ${Math.round(d.weight)}% of the grade` : ''}${d.streak >= 2 ? ` · <b class="streak">streak ${d.streak}</b>` : ''}</div></div>
          <div class="seals" aria-label="${d.seals} of ${d.maxSeals} seals left">${seals}</div>
        </div>
        <p class="qc-q" id="duel-q">${esc(q.question)}</p>
        <div class="qc-choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(c)}</span></button>`).join('')}</div>
        <p class="qc-explain" aria-live="polite"></p>
        <div class="qc-foot">1–4 to answer · a correct answer breaks a seal · a wrong one costs half a day · Esc to step back${hintButtonHtml()}</div>
      </div>`,
    );
    const card = el.querySelector<HTMLDivElement>('.qc')!;
    let done = false;
    const cleanupHint = wireHint(card, q.correctIndex);
    const finish = (r: boolean | null, delay: number) => {
      if (done) return;
      done = true;
      cleanupHint();
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => {
        if (R()) {
          el.remove();
          resolve(r);
        } else gsap.to(card, { opacity: 0, x: -20, duration: 0.18, onComplete: () => (el.remove(), resolve(r)) });
      }, delay);
    };
    const answer = (i: number) => {
      if (done) return;
      const ok = i === q.correctIndex;
      sfx(ok ? 'correct' : 'wrong');
      const btns = card.querySelectorAll<HTMLButtonElement>('.choice');
      btns.forEach((b) => (b.disabled = true));
      btns[q.correctIndex].classList.add('right');
      if (!ok) btns[i].classList.add('wrong');
      card.querySelector('.qc-explain')!.textContent = ok ? (q.explain ?? 'Correct.') : `The answer is “${q.choices[q.correctIndex]}”. ${q.explain ?? ''}`;
      if (ok) card.querySelector('.seals i.on:last-of-type')?.classList.add('breaking');
      finish(ok, ok ? 900 : 2300);
    };
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        answer(+e.key - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(null, 0);
      } else if (e.key !== 'Tab') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    card.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i!)));
    setTimeout(() => card.querySelector<HTMLButtonElement>('.choice')?.focus(), 30);
    if (!R()) gsap.from(card, { x: -40, opacity: 0, duration: 0.3, ease: "power3.out" });
  });
}

/** Pause menu. */
export function pauseMenu(onResume: () => void, onWarRoom: () => void, onReduced: () => void, reducedOn: boolean): HTMLDivElement {
  const el = mountLayer(
    'overlay pause',
    `<div class="grimoire small" role="dialog" aria-modal="true" aria-labelledby="pz">
      <div class="g-eyebrow">The vigil pauses</div><h2 id="pz">Paused</h2>
      <div class="actions col">
        <button class="dd-btn" data-r>Resume<span class="dd-kbd">P</span></button>
        <button class="dd-btn secondary" data-rm>${reducedOn ? 'Reduced motion: on' : 'Reduced motion: off'}</button>
        <button class="dd-btn secondary" data-w>Retreat to the War Room</button>
      </div></div>`,
  );
  el.querySelector('[data-r]')!.addEventListener('click', onResume);
  el.querySelector('[data-w]')!.addEventListener('click', onWarRoom);
  el.querySelector('[data-rm]')!.addEventListener('click', onReduced);
  setTimeout(() => el.querySelector<HTMLButtonElement>('[data-r]')?.focus(), 30);
  return el;
}

/** Coach mark for the played tutorial. */
export function coach(text: string, x: number, y: number, arrow: 'left' | 'right' | 'up' | 'down' | 'none' = 'none'): HTMLDivElement {
  const el = mountLayer('coach-layer', `<div class="coach arrow-${arrow}" style="left:${x}px;top:${y}px" role="status">${text}</div>`);
  if (!R()) gsap.from(el.querySelector('.coach'), { opacity: 0, y: 10, duration: 0.4, ease: 'power3.out' });
  return el;
}
