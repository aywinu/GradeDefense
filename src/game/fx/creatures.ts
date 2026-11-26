/**
 * Animated creature sprite sheets, drawn procedurally with a tiny 2D rig
 * (bones as angles, limbs as tapered strokes) so every frame is original art
 * with no licensing questions. Each creature gets a walk / float cycle:
 *
 *   zombie  (assignments)   hunched, one arm reaching, dragging a leg
 *   skeleton (drafts/minions) brisk bony walk, jaw clatter
 *   wraith  (exams, boss)   crowned shroud, rippling hem, reaching claws
 *   golem   (projects)      lumbering stone body with ember cracks
 *   page    (quizzes)       a cursed folded page flapping its leaves
 *
 * Frames are white silhouettes tinted at runtime (course colour + mood).
 */
import Phaser from 'phaser';

export const CREATURE_FRAMES = { zombie: 8, skeleton: 8, wraith: 8, golem: 8, page: 6 } as const;
export type CreatureKind = keyof typeof CREATURE_FRAMES;

type Ctx = CanvasRenderingContext2D;

function sheet(scene: Phaser.Scene, kind: CreatureKind, w: number, h: number, draw: (ctx: Ctx, t: number, f: number) => void) {
  const n = CREATURE_FRAMES[kind];
  for (let f = 0; f < n; f++) {
    const key = `${kind}${f}`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx, (f / n) * Math.PI * 2, f);
    tex.refresh();
  }
}

/** A tapered limb from (x0,y0) through two bones. */
function limb(ctx: Ctx, x0: number, y0: number, a1: number, l1: number, a2: number, l2: number, w0: number, w1: number) {
  const x1 = x0 + Math.sin(a1) * l1;
  const y1 = y0 + Math.cos(a1) * l1;
  const x2 = x1 + Math.sin(a2) * l2;
  const y2 = y1 + Math.cos(a2) * l2;
  ctx.lineWidth = w0;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.lineWidth = w1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  return { x: x2, y: y2 };
}

function cut(ctx: Ctx, fn: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  fn();
  ctx.restore();
}

export function createCreatureTextures(scene: Phaser.Scene): void {
  // ── Zombie: hunched, reaching, dragging its left leg ──
  sheet(scene, 'zombie', 96, 128, (ctx, t) => {
    ctx.strokeStyle = ctx.fillStyle = '#ffffff';
    const step = Math.sin(t);
    const bob = Math.abs(Math.cos(t)) * 3;
    const lurch = Math.sin(t) * 0.06;
    const hip = { x: 50, y: 74 - bob };
    const neck = { x: 38 + lurch * 40, y: 34 - bob };
    // legs: right steps, left drags (smaller swing, foot scrapes)
    limb(ctx, hip.x, hip.y, step * 0.45, 24, step * 0.45 - Math.max(0, -Math.cos(t)) * 0.7, 26, 8, 6.5);
    limb(ctx, hip.x - 2, hip.y, -step * 0.18 + 0.12, 24, -step * 0.1 + 0.25, 25, 8, 6.5);
    // torso (ragged coat)
    ctx.beginPath();
    ctx.moveTo(neck.x - 9, neck.y);
    ctx.quadraticCurveTo(neck.x - 16, neck.y + 26, hip.x - 13, hip.y + 8);
    ctx.lineTo(hip.x - 6, hip.y + 16);
    ctx.lineTo(hip.x + 2, hip.y + 8);
    ctx.lineTo(hip.x + 9, hip.y + 18);
    ctx.lineTo(hip.x + 13, hip.y + 4);
    ctx.quadraticCurveTo(neck.x + 18, neck.y + 18, neck.x + 9, neck.y - 2);
    ctx.closePath();
    ctx.fill();
    // head, lolling forward
    ctx.beginPath();
    ctx.ellipse(neck.x - 6, neck.y - 10, 10, 11, -0.5 + lurch, 0, Math.PI * 2);
    ctx.fill();
    // arms: front one reaching out, back one dangling and swaying
    const reach = Math.sin(t * 2) * 0.08;
    limb(ctx, neck.x - 2, neck.y + 6, -1.35 + reach, 20, -1.55 + reach, 20, 6.5, 5);
    limb(ctx, neck.x + 6, neck.y + 8, 0.15 - step * 0.25, 20, -0.1 - step * 0.2, 18, 6, 4.5);
    // fingers on the reaching hand
    const hx = neck.x - 2 + Math.sin(-1.35 + reach) * 20 + Math.sin(-1.55 + reach) * 20;
    const hy = neck.y + 6 + Math.cos(-1.35 + reach) * 20 + Math.cos(-1.55 + reach) * 20;
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 7, hy + k * 3 + 1);
      ctx.stroke();
    }
    // hollow eye, open jaw
    cut(ctx, () => {
      ctx.beginPath();
      ctx.arc(neck.x - 11, neck.y - 12, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(neck.x - 12, neck.y - 3, 3.5, 2 + Math.abs(Math.sin(t * 2)) * 1.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // coat tears
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hip.x - 6, hip.y - 8);
      ctx.lineTo(hip.x - 2, hip.y + 2);
      ctx.stroke();
    });
  });

  // ── Skeleton: brisk walk, clattering jaw ──
  sheet(scene, 'skeleton', 64, 112, (ctx, t) => {
    ctx.strokeStyle = ctx.fillStyle = '#ffffff';
    const bob = Math.abs(Math.sin(t)) * 2.5;
    const hipY = 64 - bob;
    const sh = { x: 31, y: 34 - bob };
    const s = Math.sin(t) * 0.55;
    limb(ctx, 30, hipY, s, 20, s - Math.max(0, -Math.cos(t)) * 0.7, 21, 3, 2.6);
    limb(ctx, 30, hipY, -s, 20, -s - Math.max(0, Math.cos(t)) * 0.7, 21, 3, 2.6);
    // spine
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(sh.x, sh.y - 8);
    ctx.quadraticCurveTo(sh.x - 3, sh.y + 14, 30, hipY);
    ctx.stroke();
    // ribcage
    ctx.lineWidth = 1.6;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.ellipse(sh.x - 1, sh.y + 2 + r * 5, 8 - r * 1.2, 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(30, hipY, 7, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    limb(ctx, sh.x, sh.y, -s * 0.9 + 0.1, 15, -s * 0.6 + 0.4, 14, 2.4, 2);
    limb(ctx, sh.x, sh.y, s * 0.9 + 0.1, 15, s * 0.6 + 0.4, 14, 2.4, 2);
    // skull + jaw
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y - 16, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const jaw = 2 + Math.max(0, Math.sin(t * 3)) * 3;
    ctx.fillRect(sh.x - 5, sh.y - 9 + jaw, 10, 4);
    cut(ctx, () => {
      ctx.beginPath();
      ctx.arc(sh.x - 3.2, sh.y - 17, 2.3, 0, Math.PI * 2);
      ctx.arc(sh.x + 3.2, sh.y - 17, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y - 14);
      ctx.lineTo(sh.x - 1.5, sh.y - 11);
      ctx.lineTo(sh.x + 1.5, sh.y - 11);
      ctx.fill();
    });
  });

  // ── Wraith (exam boss): crown, shroud with rippling tattered hem, claws ──
  sheet(scene, 'wraith', 220, 260, (ctx, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.82)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#ffffff';
    const sway = Math.sin(t) * 6;
    // crown of thorns
    ctx.beginPath();
    ctx.moveTo(78, 52);
    [70, 82, 94, 108, 122, 134, 146].forEach((x, i) => {
      ctx.lineTo(x, i % 2 ? 26 : 8 + Math.abs(3 - i) * 4);
      ctx.lineTo(x + 6, 44);
    });
    ctx.lineTo(142, 52);
    ctx.closePath();
    ctx.fill();
    // hood and shroud; hem points ripple with t
    ctx.beginPath();
    ctx.moveTo(110, 34);
    ctx.bezierCurveTo(146, 36, 156, 64, 152, 90);
    ctx.bezierCurveTo(178, 106, 188 + sway * 0.3, 160, 184 + sway * 0.4, 208);
    const hem = 10;
    for (let k = 0; k <= hem; k++) {
      const x = 196 - (k / hem) * 172;
      const ph = t * 2 + k * 0.9;
      const y = k % 2 === 0 ? 250 + Math.sin(ph) * 8 : 222 + Math.sin(ph) * 5;
      ctx.lineTo(x + Math.sin(ph) * 4 + sway * (1 - k / hem), y);
    }
    ctx.bezierCurveTo(26, 160, 40, 110, 66, 92);
    ctx.bezierCurveTo(60, 64, 72, 36, 110, 34);
    ctx.fill();
    // claws reaching forward, flexing
    ctx.lineWidth = 3.2;
    const flex = Math.sin(t * 2) * 0.15;
    [[48, 138], [54, 158]].forEach(([hx, hy], i) => {
      ctx.beginPath();
      ctx.moveTo(70, hy - 8);
      ctx.lineTo(hx + Math.sin(t + i) * 3, hy);
      for (let f = -2; f <= 2; f++) {
        ctx.moveTo(hx + Math.sin(t + i) * 3, hy);
        ctx.lineTo(hx - 16 + Math.sin(t + i) * 3, hy + f * (4 + flex * 6) - 2);
      }
      ctx.stroke();
    });
    // face void, burning eye slits
    cut(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(106, 76, 22, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ffffff';
    const blink = Math.sin(t * 4) > 0.95 ? 0.3 : 1;
    ctx.beginPath();
    ctx.moveTo(92, 72);
    ctx.lineTo(104, 76 * 1);
    ctx.lineTo(93, 76 + 2 * blink);
    ctx.closePath();
    ctx.moveTo(120, 72);
    ctx.lineTo(108, 76);
    ctx.lineTo(119, 76 + 2 * blink);
    ctx.closePath();
    ctx.fill();
  });

  // ── Golem (projects): heavy stone body, lumbering, ember cracks ──
  sheet(scene, 'golem', 160, 170, (ctx, t) => {
    ctx.fillStyle = ctx.strokeStyle = '#ffffff';
    const lean = Math.sin(t) * 3;
    const bob = Math.abs(Math.sin(t)) * 4;
    // legs (stumps)
    const s = Math.sin(t) * 0.35;
    limb(ctx, 62, 118 - bob, s, 22, s * 0.6, 22, 20, 18);
    limb(ctx, 98, 118 - bob, -s, 22, -s * 0.6, 22, 20, 18);
    // body boulder
    ctx.beginPath();
    ctx.moveTo(40 + lean, 40 - bob);
    ctx.lineTo(112 + lean, 30 - bob);
    ctx.lineTo(140 + lean, 66 - bob);
    ctx.lineTo(136 + lean, 112 - bob);
    ctx.lineTo(108 + lean, 132 - bob);
    ctx.lineTo(50 + lean, 132 - bob);
    ctx.lineTo(20 + lean, 104 - bob);
    ctx.lineTo(24 + lean, 62 - bob);
    ctx.closePath();
    ctx.fill();
    // arms like hanging slabs
    limb(ctx, 30 + lean, 66 - bob, 0.25 - s * 0.6, 30, 0.1 - s * 0.4, 28, 16, 18);
    limb(ctx, 132 + lean, 66 - bob, -0.25 + s * 0.6, 30, -0.1 + s * 0.4, 28, 16, 18);
    // small head stone
    ctx.beginPath();
    ctx.ellipse(76 + lean, 26 - bob, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    cut(ctx, () => {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(70 + lean, 44 - bob);
      ctx.lineTo(82 + lean, 76 - bob);
      ctx.lineTo(66 + lean, 104 - bob);
      ctx.moveTo(116 + lean, 52 - bob);
      ctx.lineTo(102 + lean, 90 - bob);
      ctx.lineTo(122 + lean, 118 - bob);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(70 + lean, 26 - bob, 3.5, 0, Math.PI * 2);
      ctx.arc(83 + lean, 26 - bob, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // ── Page (quizzes): a folded cursed page flapping its leaves ──
  sheet(scene, 'page', 72, 60, (ctx, t) => {
    const flap = Math.sin(t);
    const lift = 14 + flap * 12;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(36, 22);
    ctx.lineTo(8, 22 - lift);
    ctx.lineTo(11, 30 - lift * 0.6);
    ctx.lineTo(5, 36 - lift * 0.3);
    ctx.lineTo(12, 42);
    ctx.lineTo(36, 46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(36, 22);
    ctx.lineTo(64, 22 - lift);
    ctx.lineTo(61, 30 - lift * 0.6);
    ctx.lineTo(67, 36 - lift * 0.3);
    ctx.lineTo(60, 42);
    ctx.lineTo(36, 46);
    ctx.closePath();
    ctx.fill();
    cut(ctx, () => {
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const y = 28 + k * 4;
        ctx.beginPath();
        ctx.moveTo(14, y - lift * (0.5 - k * 0.1));
        ctx.lineTo(32, y + 2);
        ctx.moveTo(40, y + 2);
        ctx.lineTo(58, y - lift * (0.5 - k * 0.1));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(36, 36, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(36, 36, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
}
