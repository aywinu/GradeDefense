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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const R = () => prefersReducedMotion();

export interface HudState {
  waveLabel: string;
  waveSub: string;
  hp: number;
  maxHp: number;
  gold: number;
  charge: number;
  progress: number; // 0..1 of the wave defeated
}

export class Hud {
  readonly el: HTMLDivElement;
  private last = '';
  constructor(handlers: { onCheck: () => void; onSpecial: () => void; onPause: () => void }) {
    this.el = mountLayer(
      'battle-hud',
      `
      <div class="hud-left">
        <div class="hud-wave"><span class="w"></span><span class="s"></span></div>
        <div class="hud-hp" aria-label="Fortress integrity">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h6v12H3zM11 4h6v12h-6z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
          <div class="bar hp"><i></i></div><b class="hpv"></b>
        </div>
      </div>
      <div class="hud-center" aria-hidden="true"><div class="wave-progress"><i></i></div></div>
      <div class="hud-right">
        <div class="hud-gold" title="Gold: raise sentinels on the glowing runes"><span class="coin"></span><b class="gv"></b></div>
        <button class="hud-btn check" data-a="check" title="Study checkpoint (C): correct answers charge the Lantern">
          <span class="lbl">Study</span><span class="dd-kbd">C</span>
        </button>
        <button class="hud-btn special" data-a="special" title="Lantern of Knowledge (Space)">
          <span class="charge"><i></i></span><span class="lbl">Lantern</span><span class="dd-kbd">Space</span>
        </button>
        <button class="hud-icon" data-a="mute" aria-label="Toggle sound (M)"></button>
        <button class="hud-icon" data-a="pause" aria-label="Pause (P)">II</button>
      </div>
      <div class="captions" aria-live="polite"></div>
    `,
    );
    this.el.querySelector('[data-a="check"]')!.addEventListener('click', handlers.onCheck);
    this.el.querySelector('[data-a="special"]')!.addEventListener('click', handlers.onSpecial);
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
    const key = `${s.waveLabel}|${s.waveSub}|${Math.ceil(s.hp)}|${s.gold}|${Math.floor(s.charge)}|${Math.round(s.progress * 100)}`;
    if (key === this.last) return;
    this.last = key;
    this.el.querySelector('.hud-wave .w')!.textContent = s.waveLabel;
    this.el.querySelector('.hud-wave .s')!.textContent = s.waveSub;
    const f = Math.max(0, s.hp / s.maxHp);
    const hp = this.el.querySelector<HTMLElement>('.bar.hp > i')!;
    hp.style.width = `${f * 100}%`;
    hp.parentElement!.classList.toggle('low', f < 0.35);
    this.el.querySelector('.hpv')!.textContent = `${Math.max(0, Math.ceil(s.hp))}`;
    this.el.querySelector('.gv')!.textContent = String(s.gold);
    this.el.querySelector<HTMLElement>('.charge > i')!.style.height = `${Math.min(100, s.charge)}%`;
    this.el.querySelector('.hud-btn.special')!.classList.toggle('ready', s.charge >= 100);
    this.el.querySelector<HTMLElement>('.wave-progress > i')!.style.width = `${s.progress * 100}%`;
  }

  /** Visual caption for sound cues and events (a11y R9.4). */
  caption(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
    const box = this.el.querySelector('.captions')!;
    const c = document.createElement('div');
    c.className = `cap ${tone}`;
    c.textContent = text;
    box.appendChild(c);
    while (box.children.length > 3) box.firstElementChild!.remove();
    setTimeout(() => {
      if (R()) c.remove();
      else gsap.to(c, { opacity: 0, y: -6, duration: 0.4, onComplete: () => c.remove() });
    }, 2600);
  }

  goldPulse(): void {
    if (R()) return;
    gsap.fromTo(this.el.querySelector('.hud-gold'), { scale: 1.15 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
  }

  destroy(): void {
    this.el.remove();
  }
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

export interface ScoutGroup {
  courseId: string;
  title: string;
  color: string;
  names: string[];
  readiness: number;
  count: number;
}

/** Pre-wave scout report: what is coming, how ready you are, train or fight. */
export function scoutReport(
  week: string,
  groups: ScoutGroup[],
  onTrain: (courseId: string) => void,
  onBegin: () => void,
): HTMLDivElement {
  const weakest = [...groups].sort((a, b) => a.readiness - b.readiness)[0];
  const rows = groups
    .map(
      (g) => `<li style="--c:${g.color}">
        <span class="seal sm">${esc(g.courseId.replace(/\d+$/, ''))}</span>
        <span class="sr-names"><b>${esc(g.names.join(', '))}</b><small>${esc(g.title)} &middot; ${g.count} creatures</small></span>
        <span class="sr-ready ${g.readiness < 40 ? 'low' : ''}">${g.readiness}% ready</span>
        <button class="dd-btn secondary sm" data-train="${esc(g.courseId)}">Train</button>
      </li>`,
    )
    .join('');
  const el = mountLayer(
    'overlay scout',
    `<div class="grimoire scout-page" role="dialog" aria-modal="true" aria-labelledby="scout-t">
      <div class="g-eyebrow">Scout report &middot; ${esc(week)}</div>
      <h2 id="scout-t">The horde gathers</h2>
      <ul class="scout-list">${rows}</ul>
      ${
        weakest && weakest.readiness < 60
          ? `<p class="explain">Your ${esc(weakest.title)} readiness is ${weakest.readiness}%. A short trial before the battle forges that lane's sentinels.</p>`
          : `<p class="explain">Your sentinels are sharp. Hold the line.</p>`
      }
      <div class="actions"><button class="dd-btn" data-begin>Begin the battle<span class="dd-kbd">Enter</span></button></div>
    </div>`,
  );
  el.querySelectorAll<HTMLButtonElement>('[data-train]').forEach((b) => b.addEventListener('click', () => onTrain(b.dataset.train!)));
  const begin = el.querySelector<HTMLButtonElement>('[data-begin]')!;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      begin.click();
    }
  };
  window.addEventListener('keydown', onKey);
  begin.addEventListener('click', () => {
    window.removeEventListener('keydown', onKey);
    onBegin();
  });
  el.querySelectorAll<HTMLButtonElement>('[data-train]').forEach((b) => b.addEventListener('click', () => window.removeEventListener('keydown', onKey)));
  setTimeout(() => begin.focus(), 30);
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
  p.addEventListener('click', onPrimary);
  el.querySelector('[data-s]')?.addEventListener('click', () => onSecondary?.());
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
        ${mode === 'check' ? '<div class="qc-foot">1–4 to answer &middot; Esc to return</div>' : '<div class="qc-foot">1–4 to answer &middot; correct = critical strike</div>'}
      </div>`,
    );
    const card = el.querySelector<HTMLDivElement>('.qc')!;
    let done = false;
    let raf = 0;
    const start = performance.now();

    const finish = (result: boolean | null, delay: number) => {
      if (done) return;
      done = true;
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
