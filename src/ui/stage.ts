/**
 * DOM UI stage: a 1600x900 logical layer kept exactly on top of the Phaser
 * canvas, so DOM overlays (accessible text, buttons, panels) share the game's
 * coordinate system and scale with it.
 */
export const STAGE_W = 1600;
export const STAGE_H = 900;

let stageEl: HTMLDivElement | null = null;

export function getStage(): HTMLDivElement {
  if (stageEl) return stageEl;
  const el = document.createElement('div');
  el.id = 'ui-stage';
  el.setAttribute('role', 'application');
  el.setAttribute('aria-label', 'Deadline Defense');
  document.body.appendChild(el);
  stageEl = el;

  const fit = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-container canvas');
    const r = canvas?.getBoundingClientRect();
    const w = r?.width || window.innerWidth;
    const h = r?.height || window.innerHeight;
    const scale = Math.min(w / STAGE_W, h / STAGE_H);
    const left = r ? r.left : (window.innerWidth - STAGE_W * scale) / 2;
    const top = r ? r.top : (window.innerHeight - STAGE_H * scale) / 2;
    el.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
    document.documentElement.style.setProperty('--stage-scale', String(scale));
  };
  fit();
  window.addEventListener('resize', () => requestAnimationFrame(fit));
  new ResizeObserver(() => fit()).observe(document.body);
  // The canvas appears after Phaser boots; refit a few times early on.
  [50, 200, 600, 1500].forEach((ms) => setTimeout(fit, ms));
  return el;
}

/** Mount a screen layer into the stage; returns it with a remover. */
export function mountLayer(className: string, html = ''): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = `ui-layer ${className}`;
  layer.innerHTML = html;
  getStage().appendChild(layer);
  return layer;
}

export function clearLayers(selector = '.ui-layer'): void {
  getStage()
    .querySelectorAll(selector)
    .forEach((n) => n.remove());
}
