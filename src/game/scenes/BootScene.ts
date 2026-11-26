/**
 * BootScene: Font loading with timeout fallback
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.1
 * Ref: node_modules/phaser/skills/scenes/SKILL.md
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  async create() {
    // Wait for fonts with 2.5s timeout fallback
    // Fonts are loaded via <link> in index.html
    const fontTimeout = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 2500);
    });

    const fontReady = document.fonts.ready.then(() => {
      console.log('Fonts loaded successfully');
    });

    await Promise.race([fontReady, fontTimeout]);

    // Transition to TitleScene
    this.scene.start('TitleScene');
  }
}
