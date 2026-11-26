/**
 * A distant graveyard behind the War Room: a moonlit hill, crooked stones,
 * a dead tree, an iron fence, and skeletons shuffling through the fog.
 * Everything is a dark silhouette so it sets mood without competing with
 * the ledger in front of it. Procedural; respects reduced motion.
 */
import Phaser from 'phaser';
import { prefersReducedMotion } from './Atmosphere';

const FRAMES = 6;

/** Draw a skeleton walk cycle into canvas textures skel0..skel{FRAMES-1}. */
export function createSkeletonTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('skel0')) return;
  for (let f = 0; f < FRAMES; f++) {
    const t = (f / FRAMES) * Math.PI * 2;
    const tex = scene.textures.createCanvas(`skel${f}`, 48, 96);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineCap = 'round';
    const bob = Math.abs(Math.sin(t)) * 2;
    const hipY = 56 - bob;
    const shoulderY = 30 - bob;
    // skull
    ctx.beginPath();
    ctx.ellipse(25, 14 - bob, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(21, 19 - bob, 8, 5);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(22.5, 13 - bob, 1.8, 0, Math.PI * 2);
    ctx.arc(28, 13 - bob, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // spine + ribs (hunched forward)
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(24, 22 - bob);
    ctx.quadraticCurveTo(21, 40 - bob, 23, hipY);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    for (let r = 0; r < 4; r++) {
      const y = 30 + r * 5 - bob;
      ctx.beginPath();
      ctx.ellipse(23, y, 7 - r, 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // pelvis
    ctx.beginPath();
    ctx.ellipse(23, hipY, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // limbs: legs swing opposite, arms counter-swing
    const limb = (x0: number, y0: number, a1: number, l1: number, a2: number, l2: number, w: number) => {
      const x1 = x0 + Math.sin(a1) * l1;
      const y1 = y0 + Math.cos(a1) * l1;
      const x2 = x1 + Math.sin(a2) * l2;
      const y2 = y1 + Math.cos(a2) * l2;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const s = Math.sin(t) * 0.5;
    limb(23, hipY, s, 18, s - Math.max(0, -Math.cos(t)) * 0.6, 18, 2.4);
    limb(23, hipY, -s, 18, -s - Math.max(0, Math.cos(t)) * 0.6, 18, 2.4);
    limb(24, shoulderY, -s * 0.8 + 0.15, 14, -s * 0.6 + 0.35, 13, 1.8);
    limb(24, shoulderY, s * 0.8 + 0.15, 14, s * 0.6 + 0.35, 13, 1.8);
    tex.refresh();
  }
}

interface Walker {
  img: Phaser.GameObjects.Image;
  speed: number;
  dir: 1 | -1;
  frameT: number;
  baseY: number;
}

export class Graveyard {
  private walkers: Walker[] = [];
  private readonly reduced = prefersReducedMotion();
  private readonly W: number;

  constructor(scene: Phaser.Scene, W: number, H: number) {
    this.W = W;
    createSkeletonTextures(scene);
    const rnd = new Phaser.Math.RandomDataGenerator(['grave']);

    // Moon behind thin cloud, high and to the right
    const moon = scene.add.image(W * 0.78, 150, 'glow-soft').setScale(2.6).setTint(0xb8c4ff).setAlpha(0.16).setDepth(-97);
    moon.setBlendMode(Phaser.BlendModes.ADD);
    scene.add.circle(W * 0.78, 150, 34, 0xd9dcef, 0.08).setDepth(-96);

    // Far hill
    const hill = scene.add.graphics().setDepth(-92);
    hill.fillStyle(0x100d18, 1);
    hill.beginPath();
    hill.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) hill.lineTo(x, H - 170 - Math.sin(x / 260) * 26 - Math.sin(x / 90) * 6);
    hill.lineTo(W, H);
    hill.closePath();
    hill.fillPath();

    // Dead tree on the hill
    const tree = scene.add.graphics().setDepth(-91);
    tree.lineStyle(7, 0x0b0911, 1);
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      if (depth === 0 || len < 6) return;
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      tree.lineStyle(w, 0x0b0911, 1);
      tree.lineBetween(x, y, x2, y2);
      branch(x2, y2, a - 0.45 + rnd.frac() * 0.2, len * 0.72, w * 0.66, depth - 1);
      branch(x2, y2, a + 0.4 + rnd.frac() * 0.2, len * 0.68, w * 0.66, depth - 1);
    };
    branch(W * 0.16, H - 186, -Math.PI / 2 - 0.08, 70, 8, 6);

    // Iron fence along the ridge
    const fence = scene.add.graphics().setDepth(-90);
    fence.lineStyle(2, 0x0e0b16, 1);
    const fy = (x: number) => H - 150 - Math.sin(x / 260) * 20;
    fence.lineBetween(W * 0.36, fy(W * 0.36) - 10, W * 0.62, fy(W * 0.62) - 10);
    for (let x = W * 0.36; x <= W * 0.62; x += 14) {
      fence.lineBetween(x, fy(x) + 6, x, fy(x) - 26);
      fence.fillStyle(0x0e0b16, 1);
      fence.fillTriangle(x - 3, fy(x) - 25, x + 3, fy(x) - 25, x, fy(x) - 32);
    }

    // Crooked tombstones, two rows of depth
    const stones = scene.add.graphics().setDepth(-89);
    for (let i = 0; i < 26; i++) {
      const x = rnd.between(20, W - 20);
      const near = i % 3 === 0;
      const base = near ? H - 40 - rnd.between(0, 20) : H - 120 - Math.sin(x / 260) * 20;
      const w = near ? rnd.between(22, 34) : rnd.between(12, 20);
      const h = w * (1.2 + rnd.frac() * 0.5);
      const lean = (rnd.frac() - 0.5) * 0.2;
      stones.fillStyle(near ? 0x1a1524 : 0x14101c, 1);
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * (w / 2) + lean * h, base - h + w / 2 + Math.sin(a) * (w / 2)));
      }
      pts.push(new Phaser.Math.Vector2(x + w / 2, base), new Phaser.Math.Vector2(x - w / 2, base));
      stones.fillPoints(pts, true);
      if (rnd.frac() < 0.3) {
        // a cross instead
        stones.fillRect(x - 2 + lean * h, base - h - 8, 4, h + 8);
        stones.fillRect(x - 9 + lean * h, base - h + 2, 18, 4);
      }
    }

    // Skeletons shuffling between the graves (far ones small and slow)
    if (!this.reduced) {
      for (let i = 0; i < 5; i++) {
        const far = i < 3;
        const dir: 1 | -1 = rnd.frac() < 0.5 ? 1 : -1;
        const baseY = far ? H - 128 - rnd.between(0, 14) : H - 46 - rnd.between(0, 18);
        const img = scene.add
          .image(rnd.between(0, W), baseY, 'skel0')
          .setOrigin(0.5, 1)
          .setScale(far ? 0.42 : 0.62)
          .setTint(far ? 0x6a6284 : 0x958bb0)
          .setAlpha(far ? 0.55 : 0.75)
          .setFlipX(dir < 0)
          .setDepth(far ? -88 : -86);
        this.walkers.push({ img, speed: far ? 6 + rnd.frac() * 4 : 11 + rnd.frac() * 5, dir, frameT: rnd.frac() * FRAMES, baseY });
      }
    }
  }

  update(dtMs: number): void {
    if (this.reduced) return;
    const dt = dtMs / 1000;
    for (const w of this.walkers) {
      w.img.x += w.speed * w.dir * dt;
      w.frameT = (w.frameT + dt * w.speed * 0.22) % FRAMES;
      w.img.setTexture(`skel${Math.floor(w.frameT)}`);
      if (w.dir > 0 && w.img.x > this.W + 40) w.img.x = -40;
      if (w.dir < 0 && w.img.x < -40) w.img.x = this.W + 40;
    }
  }
}
