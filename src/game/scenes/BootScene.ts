/**
 * BootScene: waits for the self-hosted fonts, then starts the title.
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.1
 */

import Phaser from 'phaser';
import { loadFonts } from '../fonts';
import { createTextures } from '../fx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  async create() {
    createTextures(this);
    await loadFonts(3000);
    this.scene.start('TitleScene');
  }
}
