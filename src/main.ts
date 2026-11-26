/**
 * Main entry point
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.1
 */

import './styles/fonts.css';
import './style.css';
import './styles/tokens.css';
import './styles/ui.css';
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
  const game = new Phaser.Game(gameConfig);
  // Exposed for the Playwright smoke test and demo recording.
  (window as unknown as { __dd: Phaser.Game }).__dd = game;
}

