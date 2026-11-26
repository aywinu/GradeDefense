/**
 * TowerView: a "sentinel", a stone lantern-obelisk with a course-coloured
 * soul crystal. Its forge level (earned by studying) adds rune rings.
 */
import Phaser from 'phaser';
import { getCourseColor } from '../palette';

export class TowerView extends Phaser.GameObjects.Container {
  readonly courseId: string;
  private crystal: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private rangeRing: Phaser.GameObjects.Graphics;
  private runes: Phaser.GameObjects.Graphics;
  private color: number;
  private phase = Math.random() * 6;
  private recoilUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, courseId: string, range: number, forge = 0) {
    super(scene, x, y);
    this.courseId = courseId;
    this.color = getCourseColor(courseId);

    this.rangeRing = scene.add.graphics();
    this.rangeRing.lineStyle(1, this.color, 0.25);
    this.rangeRing.strokeCircle(0, 0, range);
    this.rangeRing.setVisible(false);

    const base = scene.add.graphics();
    // Shadow
    base.fillStyle(0x000000, 0.45);
    base.fillEllipse(0, 30, 54, 14);
    // Plinth
    base.fillGradientStyle(0x3a3150, 0x3a3150, 0x1d1828, 0x1d1828, 1);
    base.fillRect(-20, 14, 40, 16);
    // Obelisk
    base.fillGradientStyle(0x4a4166, 0x2b2440, 0x2b2440, 0x1d1828, 1);
    base.beginPath();
    base.moveTo(-12, 14);
    base.lineTo(-8, -26);
    base.lineTo(0, -34);
    base.lineTo(8, -26);
    base.lineTo(12, 14);
    base.closePath();
    base.fillPath();
    base.lineStyle(1, this.color, 0.6);
    base.strokePath();
    // Carved slit
    base.lineStyle(2, this.color, 0.5);
    base.lineBetween(0, -18, 0, 8);

    this.runes = scene.add.graphics();
    this.glow = scene.add.image(0, -40, 'glow').setTint(this.color).setScale(1.3).setAlpha(0.7);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.crystal = scene.add.image(0, -40, 'wisp').setTint(0xffffff).setScale(0.32, 0.42).setAngle(90);
    this.crystal.setBlendMode(Phaser.BlendModes.ADD);

    this.add([this.rangeRing, base, this.runes, this.glow, this.crystal]);
    this.setForge(forge);
    this.setSize(60, 80);
    scene.add.existing(this);
    this.setDepth(15);
  }

  setForge(level: number): void {
    this.runes.clear();
    for (let i = 0; i < level; i++) {
      this.runes.lineStyle(1.5, 0xf2b45a, 0.55 - i * 0.06);
      this.runes.strokeEllipse(0, 28, 60 + i * 12, 16 + i * 3);
    }
  }

  showRange(on: boolean): void {
    this.rangeRing.setVisible(on);
  }

  /** Crystal position in world space (projectile origin). */
  muzzle(): { x: number; y: number } {
    return { x: this.x, y: this.y - 40 };
  }

  fire(timeMs: number): void {
    this.recoilUntil = timeMs + 120;
    this.glow.setAlpha(1).setScale(1.7);
  }

  tick(timeMs: number, reduced: boolean): void {
    const pulse = reduced ? 0 : Math.sin(timeMs / 500 + this.phase);
    if (timeMs > this.recoilUntil) {
      this.glow.setAlpha(0.6 + pulse * 0.1).setScale(1.3 + pulse * 0.08);
    }
    if (!reduced) this.crystal.y = -40 + pulse * 2;
  }
}
