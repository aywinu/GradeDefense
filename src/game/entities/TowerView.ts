/**
 * TowerView: Phaser rendering for a tower
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.4
 * 
 * Keeps game state updates in plain TS objects.
 * This class only handles rendering.
 */

import Phaser from 'phaser';
import { getCourseColor } from '../palette';

/**
 * Visual representation of a tower
 */
export class TowerView extends Phaser.GameObjects.Container {
  private bodyGraphics: Phaser.GameObjects.Graphics;
  private rangeCircle: Phaser.GameObjects.Graphics;
  private courseColor: number;
  private baseRange: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    courseId: string,
    range: number
  ) {
    super(scene, x, y);
    
    this.courseColor = getCourseColor(courseId);
    this.baseRange = range;

    // Create graphics components
    this.bodyGraphics = new Phaser.GameObjects.Graphics(scene);
    this.rangeCircle = new Phaser.GameObjects.Graphics(scene);

    // Add to container
    this.add(this.rangeCircle);
    this.add(this.bodyGraphics);

    // Initial draw
    this.drawRangeCircle(false); // hidden by default
    this.drawBody();

    // Add to scene
    scene.add.existing(this);
  }

  /**
   * Draw tower body (simple turret shape)
   */
  private drawBody(): void {
    this.bodyGraphics.clear();
    
    // Base (larger circle)
    this.bodyGraphics.fillStyle(this.courseColor, 0.8);
    this.bodyGraphics.fillCircle(0, 0, 20);
    
    // Top (smaller circle, lighter)
    this.bodyGraphics.fillStyle(this.courseColor, 1.0);
    this.bodyGraphics.fillCircle(0, -5, 12);
    
    // Stroke outline
    this.bodyGraphics.lineStyle(2, 0xffffff, 0.3);
    this.bodyGraphics.strokeCircle(0, 0, 20);
  }

  /**
   * Draw range circle
   * @param visible - Whether to show the range indicator
   */
  private drawRangeCircle(visible: boolean): void {
    this.rangeCircle.clear();
    
    if (visible) {
      this.rangeCircle.lineStyle(2, this.courseColor, 0.4);
      this.rangeCircle.strokeCircle(0, 0, this.baseRange);
      this.rangeCircle.fillStyle(this.courseColor, 0.1);
      this.rangeCircle.fillCircle(0, 0, this.baseRange);
    }
  }

  /**
   * Update range display
   * @param range - New range in pixels
   */
  updateRange(range: number): void {
    this.baseRange = range;
    this.drawRangeCircle(this.rangeCircle.visible);
  }

  /**
   * Show/hide range indicator
   * @param visible - Whether to show range
   */
  setRangeVisible(visible: boolean): void {
    this.drawRangeCircle(visible);
  }

  /**
   * Update visual for upgrades (e.g., make brighter or larger)
   * @param level - Total upgrade level
   */
  updateUpgradeVisual(level: number): void {
    // Simple visual: increase brightness with upgrades
    this.bodyGraphics.clear();
    
    const alpha = Math.min(1.0, 0.8 + level * 0.05);
    this.bodyGraphics.fillStyle(this.courseColor, alpha);
    this.bodyGraphics.fillCircle(0, 0, 20);
    
    this.bodyGraphics.fillStyle(this.courseColor, 1.0);
    this.bodyGraphics.fillCircle(0, -5, 12);
    
    this.bodyGraphics.lineStyle(2, 0xffffff, 0.3 + level * 0.1);
    this.bodyGraphics.strokeCircle(0, 0, 20);
  }
}
