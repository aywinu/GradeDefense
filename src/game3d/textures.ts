/**
 * Procedural canvas textures for the 3D battlefield (no external assets).
 */
import * as THREE from 'three';

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Seeded RNG so textures are identical every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Worn flagstones with dark mortar, moss and grime. Returns colour + bump. */
export function flagstones(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const W = 1024;
  const r = rng(11);
  const stones: Array<[number, number, number, number, number]> = [];
  let y = 0;
  while (y < W) {
    const h = 90 + r() * 70;
    let x = -r() * 80;
    while (x < W) {
      const w = 110 + r() * 120;
      stones.push([x, y, w, h, r()]);
      x += w;
    }
    y += h;
  }
  const map = canvas(W, W, (ctx) => {
    ctx.fillStyle = '#0d0a12';
    ctx.fillRect(0, 0, W, W);
    for (const [x, y, w, h, v] of stones) {
      const l = 22 + v * 14;
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, `hsl(260, 10%, ${l}%)`);
      g.addColorStop(1, `hsl(255, 12%, ${l - 7}%)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 10);
      ctx.fill();
      // speckle and grime
      for (let k = 0; k < 120; k++) {
        ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,220'},${r() * 0.07})`;
        ctx.fillRect(x + r() * w, y + r() * h, 2 + r() * 4, 2 + r() * 4);
      }
      // cracks
      if (v > 0.6) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let cx = x + r() * w;
        let cy = y + 6;
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 6; k++) {
          cx += (r() - 0.5) * 40;
          cy += h / 6;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }
    // moss in the mortar
    for (let k = 0; k < 500; k++) {
      ctx.fillStyle = `rgba(70,90,60,${r() * 0.12})`;
      ctx.beginPath();
      ctx.arc(r() * W, r() * W, 2 + r() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const bump = canvas(W, W, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, W);
    for (const [x, y, w, h, v] of stones) {
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, `rgb(${200 + v * 40},${200 + v * 40},${200 + v * 40})`);
      g.addColorStop(1, 'rgb(120,120,120)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 12);
      ctx.fill();
    }
  });
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  bump.colorSpace = THREE.NoColorSpace;
  return { map, bump };
}

/** Rough stone for walls, tombs and obelisks. */
export function stone(seed = 3): THREE.CanvasTexture {
  const r = rng(seed);
  const t = canvas(256, 256, (ctx) => {
    ctx.fillStyle = '#3a3546';
    ctx.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2500; k++) {
      const v = Math.floor(r() * 50);
      ctx.fillStyle = `rgba(${v},${v},${v + 10},${r() * 0.35})`;
      ctx.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Parchment with ink lines (quiz pages, the grimoire). */
export function parchment(lines = true): THREE.CanvasTexture {
  const r = rng(5);
  return canvas(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 180);
    g.addColorStop(0, '#efe2c4');
    g.addColorStop(1, '#b8a27a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 300; k++) {
      ctx.fillStyle = `rgba(110,70,20,${r() * 0.08})`;
      ctx.beginPath();
      ctx.arc(r() * 256, r() * 256, r() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (lines) {
      ctx.strokeStyle = 'rgba(40,25,10,0.55)';
      ctx.lineWidth = 2;
      for (let y = 30; y < 240; y += 16) {
        ctx.beginPath();
        ctx.moveTo(24, y);
        for (let x = 24; x < 232; x += 8) ctx.lineTo(x, y + (r() - 0.5) * 2);
        ctx.stroke();
      }
    }
  });
}

/** Soft round glow sprite (additive). */
export function glow(): THREE.CanvasTexture {
  return canvas(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Candle flame sprite. */
export function flame(): THREE.CanvasTexture {
  return canvas(64, 128, (ctx) => {
    const g = ctx.createRadialGradient(32, 92, 2, 32, 80, 46);
    g.addColorStop(0, 'rgba(255,252,235,1)');
    g.addColorStop(0.3, 'rgba(255,214,130,0.95)');
    g.addColorStop(0.7, 'rgba(242,140,50,0.45)');
    g.addColorStop(1, 'rgba(242,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.bezierCurveTo(56, 52, 56, 118, 32, 122);
    ctx.bezierCurveTo(8, 118, 8, 52, 32, 4);
    ctx.fill();
  });
}

/** Night sky with a hazy moon for the backdrop. */
export function sky(): THREE.CanvasTexture {
  const r = rng(9);
  return canvas(1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#05040a');
    g.addColorStop(0.6, '#15111f');
    g.addColorStop(1, '#231c30');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    const m = ctx.createRadialGradient(760, 150, 10, 760, 150, 220);
    m.addColorStop(0, 'rgba(220,225,255,0.55)');
    m.addColorStop(0.15, 'rgba(180,190,240,0.25)');
    m.addColorStop(1, 'rgba(120,120,200,0)');
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = 'rgba(235,238,255,0.85)';
    ctx.beginPath();
    ctx.arc(760, 150, 34, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 200; k++) {
      ctx.fillStyle = `rgba(255,255,255,${r() * 0.6})`;
      ctx.fillRect(r() * 1024, r() * 300, 1, 1);
    }
  });
}
