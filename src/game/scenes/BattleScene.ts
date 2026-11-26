/**
 * BattleScene: Minimal placeholder for now
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.2
 */

import Phaser from 'phaser';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Placeholder text showing wave title
    const waveTitle = this.add.text(width / 2, height / 2, 'Wave 1: The Vigil Begins', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '48px',
      color: '#e9dcc0', // Parchment
      align: 'center',
    });
    waveTitle.setOrigin(0.5);

    // Instructions
    const instructions = this.add.text(
      width / 2,
      height * 0.65,
      'Battle scene placeholder\n(Press ESC to return to title)',
      {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '18px',
        color: '#a89f8c', // Faded ink
        align: 'center',
      }
    );
    instructions.setOrigin(0.5);

    // ESC to return to title
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('TitleScene');
    });
  }
}
