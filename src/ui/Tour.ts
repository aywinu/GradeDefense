/**
 * Guided tour: on first visit, a spotlight glides from control to control and
 * a small grimoire card explains each one with an animated illustration.
 * Closable at any time (Esc or ×); closing counts as seen. Keyboard:
 * → / Enter next, ← back, Esc close.
 */
import { gsap } from 'gsap';
import { mountLayer } from './stage';
import { load, save } from '../save/save';
import { prefersReducedMotion } from '../game/fx/Atmosphere';

export interface TourStep {
  /** CSS selector inside the stage, or a fixed rect in stage px, or null for a centred card. */
  target: string | { x: number; y: number; w: number; h: number } | null;
  title: string;
  body: string;
  art?: keyof typeof ART;
}

/** Small animated SVG illustrations (CSS-animated, paused with reduced motion). */
const ART = {
  deadline: `<svg viewBox="0 0 120 70" class="art"><g class="a-morph"><rect x="10" y="14" width="34" height="44" rx="3" fill="#e9dcc0"/><path d="M16 26h22M16 34h22M16 42h14" stroke="#5a4630" stroke-width="2"/></g>
    <path d="M52 36h16" stroke="#f2b45a" stroke-width="2" stroke-dasharray="3 3" class="a-dash"/><path d="M66 31l6 5-6 5" fill="none" stroke="#f2b45a" stroke-width="2"/>
    <g class="a-bob"><path d="M92 10c12 0 16 12 15 24l2 26-6-6-4 8-5-7-5 7-4-8-6 6 2-26c-1-12 3-24 11-24z" fill="#b9b4c9"/><circle cx="88" cy="26" r="2" fill="#07060b"/><circle cx="96" cy="26" r="2" fill="#07060b"/></g></svg>`,
  candles: `<svg viewBox="0 0 120 70" class="art">${[0, 1, 2, 3, 4, 5, 6]
    .map((i) => `<rect x="${12 + i * 14}" y="30" width="6" height="28" rx="1" fill="${i < 4 ? '#e9dcc0' : '#3a3150'}"/>${i < 4 ? `<ellipse class="a-flame" style="animation-delay:${i * 0.2}s" cx="${15 + i * 14}" cy="24" rx="3" ry="6" fill="#f2b45a"/>` : ''}`)
    .join('')}</svg>`,
  train: `<svg viewBox="0 0 120 70" class="art"><rect x="14" y="10" width="54" height="50" rx="3" fill="#e9dcc0"/><path d="M22 22h38M22 32h30" stroke="#5a4630" stroke-width="2"/>
    <circle cx="28" cy="46" r="5" fill="#1d7a5a" class="a-pop"/><path d="M25 46l2 2 4-4" stroke="#fff" stroke-width="1.6" fill="none" class="a-pop"/>
    <path d="M76 36h10" stroke="#f2b45a" stroke-width="2"/><g class="a-rise"><path d="M100 58l-8-6 4-30h8l4 30z" fill="#4a4166"/><path d="M100 12l5 8-5 6-5-6z" fill="#6ee7d0"/></g></svg>`,
  epitaph: `<svg viewBox="0 0 120 70" class="art"><path d="M38 64V30a22 22 0 0 1 44 0v34z" fill="#2a2336" stroke="#a89f8c" stroke-width="1"/><path d="M50 34h20M53 42h14" stroke="#cfc3a8" stroke-width="2"/><path class="a-crack" d="M60 14l-4 10 6 6-4 10" stroke="#07060b" stroke-width="2" fill="none"/></svg>`,
  timeline: `<svg viewBox="0 0 120 70" class="art"><path d="M8 56h104" stroke="#a89f8c" stroke-width="1"/>${[18, 34, 52, 74, 96]
    .map((x, i) => `<rect class="a-stone" style="animation-delay:${i * 0.15}s" x="${x}" y="${i % 2 ? 40 : 30}" width="10" height="${i % 2 ? 16 : 26}" rx="5" fill="#2e2740" stroke="#a89f8c" stroke-width=".6"/>`)
    .join('')}<path d="M12 22v34" stroke="#f2b45a" stroke-width="1.4" class="a-glow"/></svg>`,
  lantern: `<svg viewBox="0 0 120 70" class="art"><circle cx="60" cy="36" r="26" fill="#6ee7d0" opacity=".15" class="a-pulse"/><path d="M52 22h16l4 30H48z" fill="#2a2336" stroke="#6ee7d0"/><ellipse cx="60" cy="38" rx="5" ry="9" fill="#6ee7d0" class="a-flame"/></svg>`,
  study: `<svg viewBox="0 0 120 70" class="art"><rect x="20" y="12" width="80" height="46" rx="4" fill="#241d33" stroke="#6ee7d0"/><path d="M30 24h44" stroke="#e9dcc0" stroke-width="2"/>${[0, 1, 2, 3]
    .map((i) => `<rect x="${30 + (i % 2) * 34}" y="${32 + Math.floor(i / 2) * 12}" width="30" height="8" rx="2" fill="${i === 1 ? '#1d7a5a' : '#3b3050'}" class="${i === 1 ? 'a-pop' : ''}"/>`)
    .join('')}</svg>`,
  sentinel: `<svg viewBox="0 0 120 70" class="art"><ellipse cx="60" cy="58" rx="22" ry="6" fill="none" stroke="#f2b45a" stroke-dasharray="3 3" class="a-spin"/><g class="a-rise"><path d="M60 50l-8 0 3-30h10l3 30z" fill="#4a4166"/><path d="M60 8l6 8-6 6-6-6z" fill="#a274f0"/></g><circle cx="86" cy="22" r="6" fill="#f2b45a"/><text x="96" y="26" font-size="10" fill="#f2b45a" font-family="Inter">60</text></svg>`,
  qte: `<svg viewBox="0 0 120 70" class="art"><circle cx="60" cy="35" r="24" fill="none" stroke="rgba(233,220,192,.15)" stroke-width="5"/><circle cx="60" cy="35" r="24" fill="none" stroke="#ff6b74" stroke-width="5" stroke-dasharray="151" class="a-burn" transform="rotate(-90 60 35)"/><text x="60" y="40" text-anchor="middle" font-size="14" font-weight="700" fill="#ffd0d3" font-family="Inter">8.0</text></svg>`,
  keys: `<svg viewBox="0 0 120 70" class="art">${['C', '␣', 'P', 'M']
    .map((k, i) => `<g class="a-key" style="animation-delay:${i * 0.25}s"><rect x="${10 + i * 27}" y="22" width="22" height="24" rx="4" fill="#241d33" stroke="#a89f8c"/><text x="${21 + i * 27}" y="39" text-anchor="middle" font-size="12" fill="#e9dcc0" font-family="Inter" font-weight="700">${k}</text></g>`)
    .join('')}</svg>`,
  hp: `<svg viewBox="0 0 120 70" class="art"><rect x="14" y="30" width="92" height="10" rx="5" fill="#120f1a" stroke="#a89f8c" stroke-width=".6"/><rect x="14" y="30" width="62" height="10" rx="5" fill="#e9dcc0" class="a-drain"/><path d="M14 54h92" stroke="#b3202c" stroke-width="1" opacity=".5"/></svg>`,
} as const;

export function hasSeen(id: string): boolean {
  return !!load().tours[id];
}

export function runTour(id: string, steps: TourStep[], onDone?: () => void): void {
  if (!steps.length) return;
  const reduced = prefersReducedMotion();
  const layer = mountLayer(
    'tour',
    `<div class="tour-spot"></div>
     <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-t">
       <button class="close-x tour-x" aria-label="Close the tour">&times;</button>
       <div class="tour-art"></div>
       <div class="tour-step"></div>
       <h3 id="tour-t" class="tour-title"></h3>
       <p class="tour-body"></p>
       <div class="tour-foot">
         <div class="tour-dots">${steps.map(() => '<i></i>').join('')}</div>
         <div class="tour-btns"><button class="dd-btn secondary sm" data-back>Back</button><button class="dd-btn sm" data-next>Next<span class="dd-kbd">→</span></button></div>
       </div>
     </div>`,
  );
  layer.classList.toggle('reduced', reduced);
  const spot = layer.querySelector<HTMLDivElement>('.tour-spot')!;
  const card = layer.querySelector<HTMLDivElement>('.tour-card')!;
  let i = 0;

  const stageRect = (sel: TourStep['target']) => {
    if (!sel) return null;
    if (typeof sel !== 'string') return sel;
    const el = document.querySelector<HTMLElement>(`#ui-stage ${sel}`);
    if (!el) return null;
    const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')) || 1;
    const sr = document.getElementById('ui-stage')!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / scale, y: (r.top - sr.top) / scale, w: r.width / scale, h: r.height / scale };
  };

  const show = (n: number) => {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const st = steps[i];
    const r = stageRect(st.target);
    const pad = 10;
    const rect = r ? { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 } : { x: 800, y: 450, w: 0, h: 0 };
    const dur = reduced ? 0 : 0.55;
    gsap.to(spot, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, opacity: r ? 1 : 0.0001, duration: dur, ease: 'power3.inOut' });
    // Card placement: beside the target, kept on screen
    const cw = 400;
    const ch = 300;
    let cx = 800 - cw / 2;
    let cy = 450 - ch / 2;
    if (r) {
      const right = rect.x + rect.w + 24;
      const left = rect.x - cw - 24;
      cx = right + cw < 1580 ? right : left > 20 ? left : Math.min(1580 - cw, Math.max(20, rect.x));
      cy = Math.min(900 - ch - 20, Math.max(20, rect.y + rect.h / 2 - ch / 2));
      if (cx === rect.x) cy = rect.y + rect.h + 20 + ch < 900 ? rect.y + rect.h + 20 : Math.max(20, rect.y - ch - 20);
    }
    gsap.to(card, { left: cx, top: cy, duration: dur, ease: 'power3.inOut' });
    card.querySelector('.tour-art')!.innerHTML = st.art ? ART[st.art] : '';
    card.querySelector('.tour-step')!.textContent = `${i + 1} of ${steps.length}`;
    card.querySelector('.tour-title')!.textContent = st.title;
    card.querySelector('.tour-body')!.innerHTML = st.body;
    card.querySelectorAll('.tour-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const back = card.querySelector<HTMLButtonElement>('[data-back]')!;
    back.disabled = i === 0;
    card.querySelector<HTMLButtonElement>('[data-next]')!.innerHTML = i === steps.length - 1 ? 'Begin<span class="dd-kbd">Enter</span>' : 'Next<span class="dd-kbd">→</span>';
    if (!reduced) gsap.fromTo(card.querySelectorAll('.tour-art, .tour-title, .tour-body'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, delay: 0.15 });
    card.querySelector<HTMLButtonElement>('[data-next]')!.focus();
  };

  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    save((d) => (d.tours[id] = true));
    if (reduced) {
      layer.remove();
      onDone?.();
    } else gsap.to(layer, { opacity: 0, duration: 0.3, onComplete: () => (layer.remove(), onDone?.()) });
  };
  const next = () => (i >= steps.length - 1 ? close() : show(i + 1));
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      show(i - 1);
    }
  };
  window.addEventListener('keydown', onKey, true);
  card.querySelector('[data-next]')!.addEventListener('click', next);
  card.querySelector('[data-back]')!.addEventListener('click', () => show(i - 1));
  card.querySelector('.tour-x')!.addEventListener('click', close);
  if (!reduced) gsap.from(layer, { opacity: 0, duration: 0.4 });
  show(0);
}
