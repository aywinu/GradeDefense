---
inclusion: always
---
# Tech conventions

- Stack: Vite 8 + TypeScript (strict), Phaser 4 for the battlefield, GSAP for UI/menu animation, Howler for audio, pdf.js for PDF text extraction.
- Static site: must build to `dist/` and run on free static hosting. No backend required for the demo.
- Keep game rules (damage, wave scaling, urgency, rewards) as pure functions in `src/core/` with no Phaser imports so they can be unit- and property-tested.
- Tests: Vitest for unit tests, fast-check for property-based tests on `src/core/`, Playwright for smoke tests (game boots, wave starts, no console errors).
- Persistence: localStorage behind a small versioned save module with try/catch.
- Assets: only original or explicitly licensed (CC0/CC-BY with attribution in `CREDITS.md`). No copyrighted music.
- Never put secrets, tokens, or Moodle session data in URLs or the repo.
- Run `npm run build` and `npx vitest run` before declaring a task complete.
