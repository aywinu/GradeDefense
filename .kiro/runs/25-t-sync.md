Spec sync: reconcile `.kiro/specs/deadline-defense/tasks.md` (and where needed requirements.md / design.md) with the code as it exists now. Read the code; do not change any file outside .kiro/specs.
For every task: tick it `[x]` if implemented (check the files), or rewrite it in place as `- [x] ~~old wording~~ → superseded: <one line saying what was built instead and where>` when the design changed, or leave `[ ]` with `(deferred: reason)` if truly not done. Be honest; verify against the files.
Known design changes to reflect (verify each in the code):
- The battlefield is rendered in 3D with Three.js (src/game3d/Battlefield3D.ts, src/game3d/creatures.ts: procedural rigged zombie/skeleton/page/wraith/golem), not Phaser sprites; Phaser still runs the scenes (src/game/scenes) and the 2D title/War Room.
- Tutorial is played inside BattleScene (wave 0 via tutorialWave + coach marks in src/ui/BattleUI.ts), not a separate TutorialScene; plus first-visit guided tours (src/ui/Tour.ts).
- Tower "upgrades" are forge levels earned only from correct study answers (src/study/model.ts recordSession/forgeBonus, src/core/balance.ts), plus gold-bought sentinels on rune sockets.
- Checkpoint UI and QTE card are DOM overlays in src/ui/BattleUI.ts; trials in src/ui/TrialPanel.ts; War Room in src/game/scenes/WarRoomScene.ts (master/detail + counsel).
- Audio is synthesised with WebAudio in src/audio/sfx.ts (no Howler, no ZzFX).
- Persistence: src/save/save.ts (versioned, migrate + tests).
- Balance: src/core/balance.ts + headless campaign test src/core/balance.test.ts.
- Imports: src/import/ics.ts (+ War Room import button), src/import/postmessage.ts (+ src/main.ts wiring), src/import/notes.ts + pdf.ts (+ War Room notes upload), showcase/lms.html, moodle/block_gradedefense.
- E2E: tests/e2e/smoke.spec.ts (7 tests passing).
- Deployment: .github/workflows/deploy.yml (GitHub Pages, BASE_PATH=/GradeDefense/).
Add at the top of tasks.md a short "Status" summary (counts of done / superseded / deferred) and the date 2026-11-27.
