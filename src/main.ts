/**
 * Main entry point
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.1
 */

import './styles/fonts.css';
import './style.css';
import './styles/tokens.css';
import Phaser from 'phaser';
import { gameConfig } from './game/config';

// Initialize game container
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <div id="game-container">
      <!-- Phaser canvas will be inserted here -->
    </div>
  `;

  // Boot Phaser game
  new Phaser.Game(gameConfig);
}

