/**
 * EnemyView: a ghostly creature carrying its coursework name on a torn scroll.
 * Shapes per type (art-direction.md): assignment = hooded ghost (shambler),
 * quiz = imp swarmer, exam = crowned wraith (boss), project/presentation =
 * stone golem (multi-phase). Minions are small, unlabeled versions.
 */
import Phaser from 'phaser';
import { getCourseColor } from '../palette';
import type { ItemType } from '../../core/types';

const SHAPE: Record<ItemType, { key: string; size: number; minion: number }> = {
  assignment: { key: 'ghost', size: 0.62, minion: 0.36 },
  quiz: { key: 'imp', size: 0.7, minion: 0.5 },
  exam: { key: 'wraith', size: 0.6, minion: 0.24 },
  project: { key: 'golem', size: 0.6, minion: 0.3 },
  presentation: { key: 'golem', size: 0.6, minion: 0.3 },
};

export class EnemyView extends Phaser.GameObjects.Container {
  readonly isBoss: boolean;
  readonly isMinion: boolean;
  private body_: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private hpBack: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpW: number;
  private phase = Math.random() * Math.PI * 2;
  private baseScale: number;
  private color: number;
  private flashUntil = 0;
  private enraged = false;
  private baseTint = 0xffffff;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    courseId: string,
    type: ItemType,
    label: string,
    daysLeft: number,
    isMinion: boolean,
  ) {
    super(scene, x, y);
    this.isMinion = isMinion;
    this.isBoss = !isMinion && type === 'exam';
    this.color = getCourseColor(courseId);
    const shape = SHAPE[type];
    this.baseScale = isMinion ? shape.minion : shape.size;

    this.aura = scene.add.image(0, 8, 'glow').setTint(this.color).setBlendMode(Phaser.BlendModes.ADD);
    this.aura.setScale(this.baseScale * (this.isBoss ? 3 : 1.7)).setAlpha(isMinion ? 0.12 : 0.22);
    this.body_ = scene.add.image(0, 0, shape.key).setScale(this.baseScale);
    // Pale core tinted toward the course colour, so silhouettes read on dark stone.
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xb9b4c9),
      Phaser.Display.Color.ValueToColor(this.color),
      100,
      isMinion ? 35 : 25,
    ).color;
    this.baseTint = tint;
    this.body_.setTint(tint).setAlpha(isMinion ? 0.7 : 0.88);
    this.add([this.aura, this.body_]);

    const h = this.body_.displayHeight;
    this.hpW = Math.max(26, Math.min(this.isBoss ? 140 : 70, this.body_.displayWidth * 0.9));
    this.hpBack = scene.add.rectangle(0, h / 2 + 6, this.hpW, 4, 0x07060b, 0.85).setStrokeStyle(1, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(-this.hpW / 2, h / 2 + 6, this.hpW, 4, 0xe9dcc0).setOrigin(0, 0.5);
    this.add([this.hpBack, this.hpFill]);
    if (isMinion) {
      this.hpBack.setVisible(false);
      this.hpFill.setVisible(false);
    }

    if (!isMinion) {
      const scrollY = -h / 2 - 22;
      const name = label.replace(/Examination/, 'Exam');
      const when = daysLeft <= 0 ? 'DUE TODAY' : daysLeft === 1 ? 'DUE TOMORROW' : `${daysLeft} DAYS LEFT`;
      const t1 = scene.add
        .text(0, scrollY - 6, name, {
          fontFamily: 'Spectral, Georgia, serif',
          fontStyle: '600',
          fontSize: this.isBoss ? '17px' : '14px',
          color: '#2a1f12',
        })
        .setOrigin(0.5);
      const t2 = scene.add
        .text(0, scrollY + 10, when, {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontStyle: '700',
          fontSize: '10px',
          color: daysLeft <= 7 ? '#8a2a22' : '#5a4630',
        })
        .setOrigin(0.5)
        .setLetterSpacing(1.5);
      const w = Math.max(t1.width, t2.width) + 34;
      const scroll = scene.add.image(0, scrollY + 2, 'scroll').setDisplaySize(w, this.isBoss ? 46 : 40);
      this.add([scroll, t1, t2]);
    }

    this.setSize(this.body_.displayWidth, h);
    scene.add.existing(this);
    this.setDepth(this.isBoss ? 22 : isMinion ? 18 : 20);
  }

  /** Called every frame by the scene (cheap bob + flicker). */
  tick(timeMs: number, reduced: boolean): void {
    if (!reduced) {
      const s = this.isBoss ? 0.6 : 1;
      this.body_.y = Math.sin(timeMs / 380 + this.phase) * 3 * s;
      this.body_.rotation = Math.sin(timeMs / 600 + this.phase) * 0.04 * s;
      if (this.isBoss) {
        const beat = Math.pow(Math.max(0, Math.sin(timeMs / 420)), 12);
        this.aura.setScale(this.baseScale * (3.2 + beat * 0.6));
      }
    }
    if (this.flashUntil && timeMs > this.flashUntil) {
      this.flashUntil = 0;
      this.body_.setTint(this.enraged ? 0xffb0b4 : this.baseTint);
    }
  }

  hitFlash(timeMs: number): void {
    this.body_.setTint(0xffffff);
    this.flashUntil = timeMs + 70;
  }

  updateHpBar(hp: number, maxHp: number): void {
    const f = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    if (this.isMinion && f < 1) {
      this.hpBack.setVisible(true);
      this.hpFill.setVisible(true);
    }
    this.hpFill.width = this.hpW * f;
    this.hpFill.fillColor = f > 0.5 ? 0xcfc3a8 : f > 0.25 ? 0xc9a060 : 0xc9636b;
  }

  applyOverdueEffect(): void {
    this.aura.setTint(0xb3202c).setAlpha(0.75);
  }

  setEnraged(on: boolean): void {
    this.enraged = on;
    this.aura.setTint(on ? 0xff3344 : this.color);
    this.body_.setTint(on ? 0xffb0b4 : this.baseTint);
  }

  setNeglected(): void {
    this.aura.setAlpha(0.8).setScale(this.aura.scaleX * 1.15);
  }
}
