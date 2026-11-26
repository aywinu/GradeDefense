/**
 * Property-based tests for QTE core rules.
 * Verifies invariants across random inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { startQTE, updateQTE, resolveQTE, shouldTriggerQTE } from './qte';
import type { EnemyStats, CheckpointQuestion, ItemType } from './types';

describe('QTE Property-Based Tests', () => {
  // Arbitrary generators
  const arbSettings = fc.record({
    extraTime: fc.boolean()
  });

  const arbQuestion: fc.Arbitrary<CheckpointQuestion> = fc.record({
    id: fc.string(),
    courseId: fc.string(),
    question: fc.string(),
    choices: fc.constant(['A', 'B', 'C', 'D']),
    correctIndex: fc.integer({ min: 0, max: 3 })
  });

  const arbEnemy: fc.Arbitrary<EnemyStats> = fc.record({
    id: fc.string(),
    courseId: fc.string(),
    itemId: fc.string(),
    type: fc.constantFrom<ItemType>('assignment', 'quiz', 'exam', 'project', 'presentation'),
    hp: fc.float({ min: Math.fround(0), max: Math.fround(1000) }),
    maxHp: fc.float({ min: Math.fround(1), max: Math.fround(1000) }),
    speed: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
    damage: fc.float({ min: Math.fround(0), max: Math.fround(100) }),
    lane: fc.integer({ min: 0, max: 5 }),
    progress: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
    x: fc.float({ min: Math.fround(0), max: Math.fround(1200) }),
    y: fc.float({ min: Math.fround(0), max: Math.fround(800) }),
    pathProgress: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
    spawnedAt: fc.integer({ min: 0, max: 1000000 }),
    spawnDelayMs: fc.integer({ min: 0, max: 10000 }),
    label: fc.string(),
    daysLeft: fc.integer({ min: -10, max: 30 }),
    lastDamagedAt: fc.option(fc.integer({ min: 0, max: 1000000 }), { nil: null }),
    neglected: fc.boolean(),
    isMinion: fc.boolean()
  });

  const arbGameTime = fc.integer({ min: 0, max: 10000000 });
  const arbDeltaTime = fc.integer({ min: 0, max: 5000 });
  const arbBaseDamage = fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true });
  const arbAnswerIndex = fc.option(fc.integer({ min: 0, max: 3 }), { nil: null });

  describe('startQTE properties', () => {
    it('maxTime is either 8000 or 16000', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, (enemy, question, settings, gameTime) => {
          const state = startQTE(enemy, question, settings, gameTime);
          return state.maxTime === 8000 || state.maxTime === 16000;
        })
      );
    });

    it('timeRemaining equals maxTime initially', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, (enemy, question, settings, gameTime) => {
          const state = startQTE(enemy, question, settings, gameTime);
          return state.timeRemaining === state.maxTime;
        })
      );
    });

    it('startedAt equals game clock time', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, (enemy, question, settings, gameTime) => {
          const state = startQTE(enemy, question, settings, gameTime);
          return state.startedAt === gameTime;
        })
      );
    });

    it('extraTime doubles timer duration', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, (enemy, question, settings, gameTime) => {
          const state = startQTE(enemy, question, settings, gameTime);
          const expectedTime = settings.extraTime ? 16000 : 8000;
          return state.maxTime === expectedTime;
        })
      );
    });
  });

  describe('updateQTE properties', () => {
    it('timeRemaining never negative', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbDeltaTime, 
          (enemy, question, settings, gameTime, deltaTime) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const updated = updateQTE(state, deltaTime);
            return updated.timeRemaining >= 0;
          }
        )
      );
    });

    it('timeRemaining never exceeds maxTime', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbDeltaTime,
          (enemy, question, settings, gameTime, deltaTime) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const updated = updateQTE(state, deltaTime);
            return updated.timeRemaining <= state.maxTime;
          }
        )
      );
    });

    it('timeRemaining never negative after multiple updates', () => {
      fc.assert(
        fc.property(
          arbEnemy,
          arbQuestion,
          arbSettings,
          arbGameTime,
          fc.array(arbDeltaTime, { minLength: 1, maxLength: 20 }),
          (enemy, question, settings, gameTime, deltas) => {
            let state = startQTE(enemy, question, settings, gameTime);
            for (const delta of deltas) {
              state = updateQTE(state, delta);
            }
            return state.timeRemaining >= 0;
          }
        )
      );
    });

    it('timeRemaining decreases or stays at 0', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbDeltaTime,
          (enemy, question, settings, gameTime, deltaTime) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const updated = updateQTE(state, deltaTime);
            return updated.timeRemaining <= state.timeRemaining;
          }
        )
      );
    });
  });

  describe('resolveQTE properties', () => {
    it('outcome is deterministic', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbAnswerIndex, arbBaseDamage,
          (enemy, question, settings, gameTime, answerIndex, baseDamage) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const outcome1 = resolveQTE(state, answerIndex, baseDamage);
            const outcome2 = resolveQTE(state, answerIndex, baseDamage);
            return JSON.stringify(outcome1) === JSON.stringify(outcome2);
          }
        )
      );
    });

    it('exactly one of damage or enrage is defined', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbAnswerIndex, arbBaseDamage,
          (enemy, question, settings, gameTime, answerIndex, baseDamage) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const outcome = resolveQTE(state, answerIndex, baseDamage);
            return (outcome.damage !== undefined) !== (outcome.enrage !== undefined);
          }
        )
      );
    });

    it('correct answer always gives critical damage', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbBaseDamage,
          (enemy, question, settings, gameTime, baseDamage) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const outcome = resolveQTE(state, question.correctIndex, baseDamage);
            return outcome.success === true && outcome.damage === baseDamage * 3;
          }
        )
      );
    });

    it('timeout always gives enrage', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbBaseDamage,
          (enemy, question, settings, gameTime, baseDamage) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const outcome = resolveQTE(state, null, baseDamage);
            return (
              outcome.success === false &&
              outcome.enrage !== undefined &&
              outcome.enrage.damageMult === 1.5 &&
              outcome.enrage.speedMult === 1.25 &&
              outcome.enrage.durationMs === 10000
            );
          }
        )
      );
    });

    it('wrong answer gives enrage', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbBaseDamage,
          (enemy, question, settings, gameTime, baseDamage) => {
            fc.pre(question.choices.length === 4);
            const state = startQTE(enemy, question, settings, gameTime);
            const wrongIndex = (question.correctIndex + 1) % 4;
            const outcome = resolveQTE(state, wrongIndex, baseDamage);
            return outcome.success === false && outcome.enrage !== undefined;
          }
        )
      );
    });

    it('critical damage scales linearly with base damage', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbBaseDamage,
          (enemy, question, settings, gameTime, baseDamage) => {
            const state = startQTE(enemy, question, settings, gameTime);
            const outcome = resolveQTE(state, question.correctIndex, baseDamage);
            return outcome.damage === baseDamage * 3;
          }
        )
      );
    });
  });

  describe('shouldTriggerQTE properties', () => {
    it('never triggers if alreadyTriggered is true', () => {
      fc.assert(
        fc.property(arbEnemy, fc.float({ min: Math.fround(0), max: Math.fround(1) }), fc.float({ min: Math.fround(0), max: Math.fround(1) }),
          (enemy, hpBefore, hpAfter) => {
            const shouldTrigger = shouldTriggerQTE(enemy, hpBefore, hpAfter, true);
            return shouldTrigger === false;
          }
        )
      );
    });

    it('never triggers for minions', () => {
      fc.assert(
        fc.property(arbEnemy, fc.float({ min: Math.fround(0), max: Math.fround(1) }), fc.float({ min: Math.fround(0), max: Math.fround(1) }),
          (enemy, hpBefore, hpAfter) => {
            const minion = { ...enemy, isMinion: true };
            const shouldTrigger = shouldTriggerQTE(minion, hpBefore, hpAfter, false);
            return shouldTrigger === false;
          }
        )
      );
    });

    it('assignment and quiz never trigger', () => {
      fc.assert(
        fc.property(arbEnemy, fc.float({ min: Math.fround(0), max: Math.fround(1) }), fc.float({ min: Math.fround(0), max: Math.fround(1) }),
          (enemy, hpBefore, hpAfter) => {
            const assignment = { ...enemy, type: 'assignment' as ItemType, isMinion: false };
            const quiz = { ...enemy, type: 'quiz' as ItemType, isMinion: false };
            
            const shouldTriggerA = shouldTriggerQTE(assignment, hpBefore, hpAfter, false);
            const shouldTriggerQ = shouldTriggerQTE(quiz, hpBefore, hpAfter, false);
            
            return shouldTriggerA === false && shouldTriggerQ === false;
          }
        )
      );
    });

    it('only triggers when crossing threshold (not when staying above or below)', () => {
      fc.assert(
        fc.property(arbEnemy, fc.float({ min: Math.fround(0), max: Math.fround(1) }), fc.float({ min: Math.fround(0), max: Math.fround(1) }),
          (enemy, hpBefore, hpAfter) => {
            fc.pre(hpBefore >= hpAfter);
            const examBoss = { ...enemy, type: 'exam' as ItemType, isMinion: false };
            const shouldTrigger = shouldTriggerQTE(examBoss, hpBefore, hpAfter, false);
            
            if (shouldTrigger) {
              return hpBefore > 0.5 && hpAfter <= 0.5;
            }
            return true;
          }
        )
      );
    });

    it('exam boss triggers exactly once at 50% HP', () => {
      fc.assert(
        fc.property(arbEnemy, (enemy) => {
          const examBoss = { ...enemy, type: 'exam' as ItemType, isMinion: false };
          
          const before = shouldTriggerQTE(examBoss, 0.6, 0.55, false);
          const crossing = shouldTriggerQTE(examBoss, 0.55, 0.45, false);
          const after = shouldTriggerQTE(examBoss, 0.45, 0.4, false);
          const already = shouldTriggerQTE(examBoss, 0.55, 0.45, true);
          
          return before === false && crossing === true && after === false && already === false;
        })
      );
    });

    it('project/presentation triggers at 66% and 33% HP', () => {
      fc.assert(
        fc.property(arbEnemy, (enemy) => {
          const project = { ...enemy, type: 'project' as ItemType, isMinion: false };
          
          const cross66 = shouldTriggerQTE(project, 0.7, 0.6, false);
          const cross33 = shouldTriggerQTE(project, 0.4, 0.3, false);
          const between = shouldTriggerQTE(project, 0.5, 0.45, false);
          
          return cross66 === true && cross33 === true && between === false;
        })
      );
    });
  });

  describe('no Date.now() dependency', () => {
    it('all functions are deterministic (same inputs → same outputs)', () => {
      fc.assert(
        fc.property(arbEnemy, arbQuestion, arbSettings, arbGameTime, arbAnswerIndex, arbBaseDamage,
          (enemy, question, settings, gameTime, answerIndex, baseDamage) => {
            const state1 = startQTE(enemy, question, settings, gameTime);
            const state2 = startQTE(enemy, question, settings, gameTime);
            
            const updated1 = updateQTE(state1, 1000);
            const updated2 = updateQTE(state2, 1000);
            
            const outcome1 = resolveQTE(state1, answerIndex, baseDamage);
            const outcome2 = resolveQTE(state2, answerIndex, baseDamage);
            
            return (
              JSON.stringify(state1) === JSON.stringify(state2) &&
              JSON.stringify(updated1) === JSON.stringify(updated2) &&
              JSON.stringify(outcome1) === JSON.stringify(outcome2)
            );
          }
        )
      );
    });
  });
});
