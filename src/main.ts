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
import { listenForEmbeddedSemester } from './import/postmessage';
import { save } from './save/save';
import { invalidateSemester } from './study/model';

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

  // Embedded in the Moodle block (or the LMS showcase): the parent page sends the
  // student's real upcoming deadlines once we signal we are ready.
  listenForEmbeddedSemester(window, (semester) => {
    save((d) => (d.semester = { source: 'moodle', json: JSON.stringify(semester), importedAt: Date.now() }));
    invalidateSemester();
    if (new URLSearchParams(location.search).has('intro')) return; // full-screen intro keeps its title screen
    const active = game.scene.getScenes(true)[0]?.scene.key;
    if (active === 'TitleScene' || active === 'WarRoomScene') game.scene.getScene(active).scene.start('WarRoomScene');
  });
}

