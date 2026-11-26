# Credits and licences

Every visual, sound and question in Deadline Defense is original work made for this project, or comes from an openly licensed library listed below.

## Art and sound
- **3D battlefield, creatures, sentinels, graveyard**: built procedurally in code with Three.js primitives and canvas textures (src/game3d). No external models or textures.
- **2D scenes (title, War Room)**: procedural canvas textures and Phaser 4 simplex-noise fog (src/game/fx).
- **Sound**: synthesised at runtime with the Web Audio API (src/audio/sfx.ts). No recorded or copyrighted music.
- **Illustrations in the guided tour**: inline SVG drawn for this project.

## Fonts (SIL Open Font License 1.1, self-hosted through Fontsource)
- Cinzel and Cinzel Decorative by Natanael Gama
- Spectral by Production Type
- Inter by Rasmus Andersson

## Libraries
| Library | Licence |
|---|---|
| Phaser 4 | MIT |
| Three.js | MIT |
| GSAP | Standard "no charge" GSAP licence |
| Vite, Vitest | MIT |
| fast-check | MIT |
| Playwright | Apache-2.0 |
| Fontsource packages | MIT (packaging), OFL-1.1 (fonts) |

## Content
- **Checkpoint questions** (src/data/checkpoints.json): 60 original multiple-choice questions written by Kiro for this project, then fact-checked by Claude Code.
- **Demo semester**: synthetic courses and dates from the author's earlier project CoursePilot (disclosed in reference/coursepilot/README.md). They contain no real student data.

## Trademarks
The LMS showcase page (showcase/lms.html) is a generic "My Learning Portal" mock-up. It uses no Moodle logo or branding. Moodle is a trademark of Moodle Pty Ltd. The plugin in moodle/ is an independent, unofficial integration.
