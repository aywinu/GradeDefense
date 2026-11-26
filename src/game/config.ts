/**
 * Phaser 4 game configuration
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.1
 * Ref: node_modules/phaser/skills/game-setup-and-config/SKILL.md
 */

import Phaser from 'phaser';
import { Palette } from './palette';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { BattleScene } from './scenes/BattleScene';
import { WarRoomScene } from './scenes/WarRoomScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  width: 1600,
  height: 900,
  backgroundColor: Palette.Void,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, WarRoomScene, BattleScene],
};
