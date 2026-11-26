/**
 * TitleScene: the haunted study at midnight. Phaser draws the atmosphere
 * (fog, moonlit window, tombstones of real deadlines, drifting ghosts); the
 * DOM stage draws the accessible title and menu.
 * Ref: tasks.md 3.2 / 7.2, .kiro/steering/art-direction.md
 */

import Phaser from 'phaser';
import { gsap } from 'gsap';
import { Atmosphere, prefersReducedMotion } from '../fx/Atmosphere';
import { mountLayer, clearLayers } from '../../ui/stage';
import demo from '../../data/demo.json';
import { resolveSemester } from '../../core/semester';
import { getCourseColor } from '../palette';
import type { DemoSemester } from '../../core/types';

const ORNAMENT = `<svg class="ornament" viewBox="0 0 360 18" aria-hidden="true">
  <path d="M0 9 H150 M210 9 H360" stroke="#f2b45a" stroke-opacity=".5" stroke-width="1"/>
  <path d="M180 1 L188 9 L180 17 L172 9 Z" fill="none" stroke="#f2b45a" stroke-width="1.2"/>
  <circle cx="180" cy="9" r="2" fill="#f2b45a"/>
  <path d="M150 9 l8 -4 v8 z M210 9 l-8 -4 v8 z" fill="#f2b45a" fill-opacity=".7"/>
</svg>`;

export class TitleScene extends Phaser.Scene {
  private atmosphere?: Atmosphere;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private leaving = false;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width: W, height: H } = this.cameras.main;
    this.leaving = false;
    const reduced = prefersReducedMotion();

    // Moonlit gothic window behind the title.
    const moon = this.add.image(W / 2, 330, 'glow-soft').setScale(4.2).setAlpha(0.22).setTint(0xb8c4ff);
    moon.setBlendMode(Phaser.BlendModes.ADD).setDepth(-95);
    const win = this.add.graphics().setDepth(-94);
    win.lineStyle(3, 0x2b2440, 0.9);
    const wx = W / 2;
    win.beginPath();
    win.moveTo(wx - 260, 760);
    win.lineTo(wx - 260, 300);
    win.arc(wx, 300, 260, Math.PI, 0, false);
    win.lineTo(wx + 260, 760);
    win.strokePath();
    win.lineStyle(2, 0x2b2440, 0.6);
    win.lineBetween(wx, 40, wx, 760);
    win.lineBetween(wx - 260, 430, wx + 260, 430);

    this.atmosphere = new Atmosphere(this, { width: W, height: H, fog: 0.9 });

    // Tombstones: the real upcoming deadlines of the demo semester.
    const sem = resolveSemester(demo as unknown as DemoSemester, new Date());
    const upcoming = sem.courses
      .flatMap((c) => c.items.filter((i) => i.grade === null).map((i) => ({ ...i, color: getCourseColor(c.id) })))
      .sort((a, b) => b.points - a.points)
      .slice(0, 9);
    const ground = this.add.graphics().setDepth(-20);
    ground.fillGradientStyle(0x07060b, 0x07060b, 0x07060b, 0x07060b, 0, 0, 1, 1);
    ground.fillRect(0, H - 220, W, 220);
    upcoming.forEach((item, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const rank = Math.ceil(i / 2);
      const x = W / 2 + side * (260 + rank * 165);
      if (i === 0 || x < 70 || x > W - 70) return;
      const scale = 1 - rank * 0.08;
      this.drawTombstone(x, H - 40 - rank * 10, scale, item.name, item.dueDate, item.color);
    });

    // Drifting ghosts in the far fog.
    if (!reduced) {
      for (let i = 0; i < 5; i++) {
        const g = this.add
          .image(Phaser.Math.Between(0, W), Phaser.Math.Between(420, 720), 'ghost')
          .setAlpha(0.08 + Math.random() * 0.07)
          .setScale(0.5 + Math.random() * 0.5)
          .setTint(0xb8c4ff)
          .setDepth(-30)
          .setBlendMode(Phaser.BlendModes.ADD);
        g.setData('speed', 8 + Math.random() * 14);
        g.setData('phase', Math.random() * 10);
        this.ghosts.push(g);
      }
    }

    this.buildDom(sem.courses.length, sem.courses.reduce((n, c) => n + c.items.filter((i) => i.grade === null).length, 0));

    this.cameras.main.fadeIn(reduced ? 0 : 900, 7, 6, 11);
    this.events.once('shutdown', () => {
      clearLayers('.title-screen');
      this.ghosts = [];
    });
  }

  private drawTombstone(x: number, baseY: number, s: number, name: string, due: Date, color: number) {
    const w = 138 * s;
    const h = 176 * s;
    const g = this.add.graphics().setDepth(-15);
    g.fillGradientStyle(0x3a3150, 0x3a3150, 0x1d1828, 0x1d1828, 1);
    g.beginPath();
    g.moveTo(x - w / 2, baseY);
    g.lineTo(x - w / 2, baseY - h + w / 2);
    g.arc(x, baseY - h + w / 2, w / 2, Math.PI, 0, false);
    g.lineTo(x + w / 2, baseY);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, color, 0.8);
    g.strokePath();
    // Cracks deepen as the deadline nears
    const days = Math.max(0, (due.getTime() - Date.now()) / 86400000);
    if (days < 14) {
      g.lineStyle(1.5, 0x07060b, 0.9);
      g.beginPath();
      g.moveTo(x + w * 0.1, baseY - h + 10);
      g.lineTo(x - w * 0.05, baseY - h * 0.7);
      g.lineTo(x + w * 0.12, baseY - h * 0.5);
      if (days < 7) g.lineTo(x - w * 0.08, baseY - h * 0.25);
      g.strokePath();
    }
    const glow = this.add.image(x, baseY - h * 0.55, 'glow').setTint(color).setAlpha(0.28).setScale(2.6 * s).setDepth(-16);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    const date = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const short = name.replace(/Examination/, 'Exam').replace(/Presentation/, 'Pres.').replace(/ - .*/, '');
    this.add
      .text(x, baseY - h * 0.6, `${short}\n${date.toUpperCase()}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${Math.round(15 * s)}px`,
        color: '#e9dcc0',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: w - 16 },
      })
      .setOrigin(0.5)
      .setDepth(-14)
      .setAlpha(0.85);
  }

  private buildDom(courseCount: number, deadlineCount: number) {
    const layer = mountLayer(
      'title-screen',
      `
      <div class="eyebrow">${courseCount} courses &middot; ${deadlineCount} deadlines &middot; one semester</div>
      <h1>Deadline<span class="line2">Defense</span></h1>
      ${ORNAMENT}
      <p class="tagline">Your semester is <em>under siege</em>.</p>
      <div class="menu">
        <button class="dd-btn" data-action="start" autofocus>Enter the War Room<span class="dd-kbd">Enter</span></button>
        <button class="dd-btn secondary" data-action="battle">Skip to battle<span class="dd-kbd">B</span></button>
      </div>
      <div class="footer">Real deadlines become the horde. Studying forges your weapons.</div>
    `,
    );

    const go = (target: 'start' | 'battle') => {
      if (this.leaving) return;
      this.leaving = true;
      const next = target === 'start' && this.scene.get('WarRoomScene') ? 'WarRoomScene' : 'BattleScene';
      gsap.to(layer, { opacity: 0, duration: 0.45, ease: 'power2.in' });
      this.cameras.main.fadeOut(500, 7, 6, 11);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(next));
    };
    layer.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((b) =>
      b.addEventListener('click', () => go(b.dataset.action as 'start' | 'battle')),
    );
    this.input.keyboard?.on('keydown-ENTER', () => go('start'));
    this.input.keyboard?.on('keydown-B', () => go('battle'));

    if (!prefersReducedMotion()) {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(layer.querySelector('.eyebrow'), { opacity: 0, y: -10, duration: 0.8 }, 0.3)
        .from(layer.querySelector('h1'), { opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)', duration: 1.4 }, 0.4)
        .from(layer.querySelector('.ornament'), { opacity: 0, scaleX: 0, duration: 0.8 }, 1.1)
        .from(layer.querySelector('.tagline'), { opacity: 0, y: 10, duration: 0.9 }, 1.3)
        .from(layer.querySelectorAll('.menu .dd-btn'), { opacity: 0, y: 14, stagger: 0.12, duration: 0.7 }, 1.6)
        .from(layer.querySelector('.footer'), { opacity: 0, duration: 0.8 }, 2);
    }
    setTimeout(() => layer.querySelector<HTMLButtonElement>('[data-action="start"]')?.focus(), 50);
  }

  update(_time: number, delta: number) {
    this.atmosphere?.update(delta);
    const t = this.time.now / 1000;
    for (const g of this.ghosts) {
      g.x -= (g.getData('speed') as number) * (delta / 1000);
      g.y += Math.sin(t + (g.getData('phase') as number)) * 0.15;
      if (g.x < -80) g.x = this.cameras.main.width + 80;
    }
  }
}
