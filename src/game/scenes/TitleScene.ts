/**
 * TitleScene: Minimal title screen with haunting aesthetic
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.2
 * Ref: .kiro/steering/art-direction.md Typography
 */

import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title: "Deadline Defense" in Cinzel Decorative
    const title = this.add.text(width / 2, height * 0.35, 'Deadline Defense', {
      fontFamily: '"Cinzel Decorative", Cinzel, Georgia, serif',
      fontSize: '84px',
      color: '#e9dcc0', // Parchment
      align: 'center',
    });
    title.setOrigin(0.5);

    // Subtitle: "Your semester is under siege." in Spectral italic
    const subtitle = this.add.text(
      width / 2,
      height * 0.5,
      'Your semester is under siege.',
      {
        fontFamily: 'Spectral, Georgia, serif',
        fontSize: '28px',
        color: '#a89f8c', // Faded ink
        fontStyle: 'italic',
        align: 'center',
      }
    );
    subtitle.setOrigin(0.5);

    // "Begin the Vigil" start button
    const startButton = this.add.text(width / 2, height * 0.7, 'Begin the Vigil', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '24px',
      color: '#f2b45a', // Candle gold
      align: 'center',
      backgroundColor: '#1d1828', // Stone
      padding: { x: 32, y: 16 },
    });
    startButton.setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });

    // Hover effect
    startButton.on('pointerover', () => {
      startButton.setColor('#6ee7d0'); // Spectral teal on hover
    });

    startButton.on('pointerout', () => {
      startButton.setColor('#f2b45a'); // Back to candle gold
    });

    // Click handler
    startButton.on('pointerup', () => {
      this.scene.start('BattleScene');
    });

    // Keyboard: Enter/Space to start
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.scene.start('BattleScene');
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.scene.start('BattleScene');
    });
  }
}
