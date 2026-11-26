/**
 * EnemyView: Phaser rendering for an enemy
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.5
 * Ref: .kiro/steering/art-direction.md (enemy design)
 * 
 * Keeps game state updates in plain TS objects.
 * This class only handles rendering.
 */

import Phaser from 'phaser';
import { getCourseColor } from '../palette';
import { Palette } from '../palette';
import type { ItemType } from '../../core/types';

/**
 * Visual representation of an enemy
 */
export class EnemyView extends Phaser.GameObjects.Container {
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private courseColor: number;
  private enemyType: ItemType;
  private isMinion: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    courseId: string,
    enemyType: ItemType,
    name: string,
    daysLeft: number,
    isMinion: boolean = false
  ) {
    super(scene, x, y);
    
    this.courseColor = getCourseColor(courseId);
    this.enemyType = enemyType;
    this.isMinion = isMinion;

    // Create graphics components
    this.bodyGraphics = new Phaser.GameObjects.Graphics(scene);
    this.hpBar = new Phaser.GameObjects.Graphics(scene);
    
    // Create label (floating scroll with name + days left)
    const labelText = isMinion 
      ? `${name.substring(0, 15)}...` // truncate for minions
      : `${name}\nDue in ${daysLeft}d`;
    
    this.label = new Phaser.GameObjects.Text(scene, 0, -40, labelText, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: isMinion ? '10px' : '12px',
      color: '#e9dcc0', // Parchment
      align: 'center',
      backgroundColor: '#120f1a99', // Semi-transparent Ink
      padding: { x: 4, y: 2 },
    });
    this.label.setOrigin(0.5);

    // Add to container
    this.add(this.bodyGraphics);
    this.add(this.hpBar);
    this.add(this.label);

    // Initial draw
    this.drawBody();

    // Add to scene
    scene.add.existing(this);
  }

  /**
   * Draw enemy body shape based on type
   */
  private drawBody(): void {
    this.bodyGraphics.clear();
    
    const size = this.isMinion ? 10 : 15;
    const alpha = this.isMinion ? 0.7 : 0.9;

    // Different shapes per type (as per art direction and R3.1)
    switch (this.enemyType) {
      case 'assignment':
        // Shambler: rectangle (slow, medium HP)
        this.bodyGraphics.fillStyle(this.courseColor, alpha);
        this.bodyGraphics.fillRect(-size, -size, size * 2, size * 2);
        this.bodyGraphics.lineStyle(2, 0xffffff, 0.3);
        this.bodyGraphics.strokeRect(-size, -size, size * 2, size * 2);
        break;

      case 'quiz':
        // Swarmer: diamond (fast, low HP)
        this.bodyGraphics.fillStyle(this.courseColor, alpha);
        this.bodyGraphics.beginPath();
        this.bodyGraphics.moveTo(0, -size);
        this.bodyGraphics.lineTo(size, 0);
        this.bodyGraphics.lineTo(0, size);
        this.bodyGraphics.lineTo(-size, 0);
        this.bodyGraphics.closePath();
        this.bodyGraphics.fillPath();
        this.bodyGraphics.lineStyle(2, 0xffffff, 0.3);
        this.bodyGraphics.strokePath();
        break;

      case 'exam':
        // Boss: large composite (skull-like)
        const bossSize = this.isMinion ? size : size * 1.5;
        this.bodyGraphics.fillStyle(this.courseColor, alpha);
        this.bodyGraphics.fillCircle(0, 0, bossSize);
        this.bodyGraphics.fillCircle(-bossSize * 0.5, -bossSize * 0.3, bossSize * 0.4);
        this.bodyGraphics.fillCircle(bossSize * 0.5, -bossSize * 0.3, bossSize * 0.4);
        this.bodyGraphics.lineStyle(2, Palette.Crimson, 0.6);
        this.bodyGraphics.strokeCircle(0, 0, bossSize);
        break;

      case 'project':
      case 'presentation':
        // Multi-phase: hexagon
        this.bodyGraphics.fillStyle(this.courseColor, alpha);
        this.bodyGraphics.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const px = Math.cos(angle) * size;
          const py = Math.sin(angle) * size;
          if (i === 0) {
            this.bodyGraphics.moveTo(px, py);
          } else {
            this.bodyGraphics.lineTo(px, py);
          }
        }
        this.bodyGraphics.closePath();
        this.bodyGraphics.fillPath();
        this.bodyGraphics.lineStyle(2, 0xffffff, 0.3);
        this.bodyGraphics.strokePath();
        break;
    }

    // Add glow effect for main enemies
    if (!this.isMinion) {
      this.bodyGraphics.lineStyle(1, this.courseColor, 0.5);
      this.bodyGraphics.strokeCircle(0, 0, size + 3);
    }
  }

  /**
   * Update HP bar
   * @param currentHp - Current HP
   * @param maxHp - Maximum HP
   */
  updateHpBar(currentHp: number, maxHp: number): void {
    this.hpBar.clear();
    
    if (currentHp <= 0 || currentHp >= maxHp) {
      return; // Don't show bar if full or dead
    }

    const barWidth = this.isMinion ? 20 : 30;
    const barHeight = 4;
    const barY = this.isMinion ? -20 : -30;
    
    // Background
    this.hpBar.fillStyle(0x000000, 0.5);
    this.hpBar.fillRect(-barWidth / 2, barY, barWidth, barHeight);
    
    // HP fill
    const hpPercent = currentHp / maxHp;
    const fillWidth = barWidth * hpPercent;
    const color = hpPercent > 0.5 ? 0x4fc29a : (hpPercent > 0.25 ? 0xf2b45a : 0xb3202c);
    
    this.hpBar.fillStyle(color, 0.9);
    this.hpBar.fillRect(-barWidth / 2, barY, fillWidth, barHeight);
  }

  /**
   * Apply neglected visual effect (glow/pulse)
   */
  applyNeglectedEffect(): void {
    this.bodyGraphics.clear();
    this.drawBody();
    
    // Add extra glow for neglected enemies
    const size = this.isMinion ? 10 : 15;
    this.bodyGraphics.lineStyle(2, Palette.Crimson, 0.7);
    this.bodyGraphics.strokeCircle(0, 0, size + 5);
    
    // TODO: Add tween pulse animation
  }

  /**
   * Apply overdue visual effect (red tint)
   */
  applyOverdueEffect(): void {
    // Add red tint to label
    this.label.setBackgroundColor('#b3202c99');
  }

  /**
   * Update label text (for days left changes)
   */
  updateLabel(name: string, daysLeft: number): void {
    const labelText = this.isMinion 
      ? `${name.substring(0, 15)}...`
      : `${name}\nDue in ${daysLeft}d`;
    this.label.setText(labelText);
  }
}
