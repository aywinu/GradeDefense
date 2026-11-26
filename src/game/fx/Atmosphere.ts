/**
 * "The Haunted Study" atmosphere: stone floor, lane candles, drifting simplex
 * fog, dust motes and a vignette. Purely decorative; respects reduced motion.
 */
import Phaser from 'phaser';

export function prefersReducedMotion(): boolean {
  try {
    if (localStorage.getItem('dd.reducedMotion') === '1') return true;
  } catch {
    /* storage may be blocked */
  }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface AtmosphereOptions {
  width: number;
  height: number;
  lanes?: Array<{ y: number; color: number; height: number }>;
  candleX?: number;
  /** Extra fog density 0..1 (title screen wants more). */
  fog?: number;
  /** Foreground fog strength 0..1 (drawn over creatures; keep low in battle). */
  frontFog?: number;
  /** Vignette strength 0..1. */
  vignette?: number;
}

export class Atmosphere {
  private fogs: Phaser.GameObjects.NoiseSimplex2D[] = [];
  private candles: Array<{ glow: Phaser.GameObjects.Image; flame: Phaser.GameObjects.Image; base: number }> = [];
  private t = 0;
  private lantern?: Phaser.GameObjects.Image;
  private holes: Phaser.GameObjects.Image[] = [];
  private push = { x: 0, y: 0 };
  private lastPointer = { x: -1, y: -1 };
  private readonly reduced: boolean;
  private readonly scene: Phaser.Scene;
  private readonly opts: AtmosphereOptions;

  constructor(scene: Phaser.Scene, opts: AtmosphereOptions) {
    this.scene = scene;
    this.opts = opts;
    this.reduced = prefersReducedMotion();
    this.build();
  }

  private build(): void {
    const { scene } = this;
    const { width: W, height: H } = this.opts;

    // Floor: deep ink gradient with a cold top and warmer bottom.
    const floor = scene.add.graphics().setDepth(-100);
    floor.fillGradientStyle(0x0b0912, 0x0b0912, 0x15101d, 0x15101d, 1);
    floor.fillRect(0, 0, W, H);

    // Lanes: faint worn-stone bands with ink rules and a course-tinted wash near the desk.
    for (const lane of this.opts.lanes ?? []) {
      const g = scene.add.graphics().setDepth(-90);
      const top = lane.y - lane.height / 2;
      g.fillStyle(0x1d1828, 0.35);
      g.fillRect(0, top + 4, W, lane.height - 8);
      g.lineStyle(1, 0x2b2440, 0.8);
      g.lineBetween(0, top + 4, W, top + 4);
      g.lineBetween(0, top + lane.height - 4, W, top + lane.height - 4);
      // Flagstone seams
      g.lineStyle(1, 0x07060b, 0.5);
      for (let x = 160 + ((lane.y * 13) % 90); x < W; x += 140 + ((x * 7) % 60)) {
        g.lineBetween(x, top + 6, x + 10, top + lane.height - 6);
      }
      // Course wash
      const wash = scene.add.image(240, lane.y, 'glow-soft').setDepth(-85);
      wash.setTint(lane.color).setAlpha(0.18).setScale(3.2, lane.height / 256 * 1.4);
      wash.setBlendMode(Phaser.BlendModes.ADD);

      if (this.opts.candleX !== undefined) this.addCandle(this.opts.candleX, top + 18, lane.color);
    }

    // Fog: two layers of animated simplex noise, screen-blended.
    const density = this.opts.fog ?? 0.5;
    const shade = (hex: number, k: number) => {
      const c = Phaser.Display.Color.IntegerToColor(hex);
      return Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k));
    };
    const fogCfg = (seed: number, cells: number, start: number, end: number) => ({
      noiseCells: [cells, Math.round(cells * (H / W))],
      noiseIterations: 4,
      noiseWarpAmount: 0.6,
      noiseWarpIterations: 2,
      noiseSeed: [seed, seed * 2 + 1],
      noiseColorStart: start,
      noiseColorEnd: end,
      noiseValuePower: 1.6,
    });
    try {
      const back = scene.add.noisesimplex2d(fogCfg(3, 6, 0x000000, shade(0x3a3150, 0.45 + density * 0.4)), W / 2, H / 2, W, H);
      back.setDepth(-80).setBlendMode(Phaser.BlendModes.SCREEN);
      const front = scene.add.noisesimplex2d(fogCfg(11, 4, 0x000000, shade(0x4a4466, this.opts.frontFog ?? 0.18 + density * 0.3)), W / 2, H / 2, W, H);
      front.setDepth(50).setBlendMode(Phaser.BlendModes.SCREEN);
      this.fogs.push(back, front);
    } catch {
      // Canvas renderer or missing shader support: skip fog.
    }

    // The cursor is a lantern: warm light that parts the fog around it.
    this.lantern = scene.add.image(-500, -500, 'glow-soft').setTint(0xf2c27a).setScale(1.5).setAlpha(0.55).setDepth(55);
    this.lantern.setBlendMode(Phaser.BlendModes.ADD);
    for (const f of this.fogs) {
      try {
        const hole = new Phaser.GameObjects.Image(scene, -500, -500, 'glow-soft').setScale(2.6);
        f.enableFilters();
        f.filters?.internal.addMask(hole, true);
        this.holes.push(hole);
      } catch {
        /* masks unavailable: the lantern glow alone still reads */
      }
    }

    // Dust motes drifting through candlelight.
    if (!this.reduced) {
      scene.add
        .particles(0, 0, 'mote', {
          x: { min: 0, max: W },
          y: { min: 0, max: H },
          lifespan: { min: 5000, max: 9000 },
          speedX: { min: -12, max: -4 },
          speedY: { min: -6, max: 6 },
          scale: { min: 0.15, max: 0.45 },
          alpha: { start: 0, end: 0, ease: 'Sine.easeInOut' },
          tint: [0xf2b45a, 0xe9dcc0, 0x6ee7d0],
          frequency: 140,
          blendMode: Phaser.BlendModes.ADD,
          emitCallback: (p: Phaser.GameObjects.Particles.Particle) => {
            p.alpha = 0.6;
          },
        })
        .setDepth(40);
    }

    // Vignette on the camera.
    try {
      scene.cameras.main.filters.external.addVignette(0.5, 0.5, 0.95, this.opts.vignette ?? 0.6);
    } catch {
      /* filters unavailable */
    }
  }

  private addCandle(x: number, y: number, color: number): void {
    const { scene } = this;
    const glow = scene.add.image(x, y, 'glow').setDepth(-70).setScale(2.4).setAlpha(0.45);
    glow.setTint(Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xf2b45a),
      Phaser.Display.Color.ValueToColor(color),
      100,
      35,
    ).color);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    // Wax stub
    const wax = scene.add.graphics().setDepth(-60);
    wax.fillStyle(0xe9dcc0, 0.9);
    wax.fillRoundedRect(x - 5, y + 2, 10, 22, 3);
    wax.fillStyle(0xcbb88f, 1);
    wax.fillEllipse(x, y + 3, 10, 4);
    const flame = scene.add.image(x, y - 8, 'flame').setDepth(-59).setScale(0.45).setOrigin(0.5, 0.9);
    flame.setBlendMode(Phaser.BlendModes.ADD);
    this.candles.push({ glow, flame, base: Math.random() * 10 });
  }

  update(dtMs: number): void {
    this.t += dtMs / 1000;
    const drift = this.reduced ? 0.02 : 1;
    // Pointer: move the lantern and let fast movement stir the fog.
    const p = this.scene.input.activePointer;
    if (p && (p.x !== this.lastPointer.x || p.y !== this.lastPointer.y)) {
      if (this.lastPointer.x >= 0 && !this.reduced) {
        this.push.x += (p.x - this.lastPointer.x) * 0.00004;
        this.push.y += (p.y - this.lastPointer.y) * 0.00004;
      }
      this.lastPointer = { x: p.x, y: p.y };
    }
    const k = Math.pow(0.5, dtMs / 900);
    this.push.x *= k;
    this.push.y *= k;
    if (this.lantern && this.lastPointer.x >= 0) {
      const ease = this.reduced ? 1 : 0.18;
      this.lantern.x += (this.lastPointer.x - this.lantern.x) * ease;
      this.lantern.y += (this.lastPointer.y - this.lantern.y) * ease;
      this.lantern.setAlpha(0.5 + (this.reduced ? 0 : Math.sin(this.t * 6) * 0.04 + Math.sin(this.t * 13.7) * 0.02));
      for (const h of this.holes) h.setPosition(this.lantern.x, this.lantern.y);
    }
    this.fogs.forEach((f, i) => {
      const speed = (i === 0 ? 0.012 : 0.02) * drift;
      const base = [this.t * speed * (i === 0 ? 1 : 1.6), Math.sin(this.t * 0.05) * 0.05];
      // The cursor only quickens the fog's own evolution a little (no sliding layer).
      const stir = Math.min(0.15, Math.hypot(this.push.x, this.push.y) * 6);
      f.setData('flow', ((f.getData('flow') as number) ?? 0) + stir * (dtMs / 1000));
      f.noiseOffset = base;
      f.noiseFlow = this.t * 0.04 * drift + (f.getData('flow') as number);
    });
    if (this.reduced) return;
    for (const c of this.candles) {
      const n =
        Math.sin(this.t * 7.3 + c.base) * 0.5 +
        Math.sin(this.t * 13.1 + c.base * 2) * 0.3 +
        Math.sin(this.t * 2.1 + c.base) * 0.2;
      c.glow.setAlpha(0.4 + n * 0.08);
      c.glow.setScale(2.4 + n * 0.12);
      c.flame.setScale(0.45 + n * 0.03, 0.45 + n * 0.06);
      c.flame.rotation = n * 0.06;
    }
  }
}
