# Kiro Hooks

This directory contains IDE hooks that automate quality checks during development.

## Hooks

### core-tests-on-save.kiro.hook
Runs `npx vitest run src/core` automatically when any file in `src/core/` is saved. Ensures pure functions stay testable and correct.

### question-bank-check.kiro.hook
When `src/data/checkpoints.json` is edited, asks the agent to validate the schema and fact-check changed questions for accuracy.

### steering-guard.kiro.hook
Checks changes in `src/game/` and `src/ui/` against art direction guidelines (palette, fonts, reduced-motion support, contrast ratios).

## Custom Agent

The `.kiro/agents/deadline-dev.json` agent enforces project conventions:
- Pure src/core/ functions with no Phaser imports
- Small, focused tasks with tests before completion
- Adherence to steering files
- Post-write hook runs `npx tsc --noEmit` to catch type errors
- Spawn hook shows `git status --short` for context
