import './style.css';

// Minimal entry point - game initialization will happen here
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <div id="game-container">
      <!-- Game will be initialized here -->
    </div>
  `;
}

