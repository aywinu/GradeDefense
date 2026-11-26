/**
 * Unit tests for QTE core rules.
 */

import { describe, it, expect } from 'vitest';
import { startQTE, updateQTE, resolveQTE, shouldTriggerQTE } from './qte';
import type { EnemyStats, CheckpointQuestion } from './types';

describe('QTE Core Rules', () => {
  const mockQuestion: CheckpointQuestion = {
    id: 'q1',
    courseId: 'CV101',
    question: 'What is convolution?',
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 2
  };

  const mockEnemy: EnemyStats = {
    id: 'exam-1',
    courseId: 'CV101',
    itemId: 'CV101-midterm',
    type: 'exam',
    hp: 100,
    maxHp: 200,
    speed: 20,
    damage: 50,
    lane: 0,
    progress: 0.5,
    x: 600,
    y: 100,
    pathProgress: 0.5,
    spawnedAt: 0,
    spawnDelayMs: 0,
    label: 'Midterm Exam',
    daysLeft: 3,
    lastDamagedAt: null,
    neglected: false,
    isMinion: false
  };

  describe('startQTE', () => {
    it('creates QTE state with 8000ms base time', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 10000);
      
      expect(state.enemyId).toBe('exam-1');
      expect(state.question).toBe(mockQuestion);
      expect(state.maxTime).toBe(8000);
      expect(state.timeRemaining).toBe(8000);
      expect(state.startedAt).toBe(10000);
    });

    it('creates QTE state with 16000ms extended time', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: true }, 10000);
      
      expect(state.maxTime).toBe(16000);
      expect(state.timeRemaining).toBe(16000);
    });

    it('uses game clock time, not Date.now()', () => {
      const state1 = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 5000);
      const state2 = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 10000);
      
      expect(state1.startedAt).toBe(5000);
      expect(state2.startedAt).toBe(10000);
    });
  });

  describe('updateQTE', () => {
    it('decrements timer by delta time', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const updated = updateQTE(state, 1000);
      
      expect(updated.timeRemaining).toBe(7000);
    });

    it('clamps timer to 0 (never negative)', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const updated = updateQTE(state, 10000);
      
      expect(updated.timeRemaining).toBe(0);
    });

    it('handles multiple updates', () => {
      let state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      state = updateQTE(state, 2000);
      state = updateQTE(state, 3000);
      state = updateQTE(state, 1500);
      
      expect(state.timeRemaining).toBe(1500);
    });

    it('time never goes negative after multiple large deltas', () => {
      let state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      state = updateQTE(state, 5000);
      state = updateQTE(state, 5000);
      state = updateQTE(state, 5000);
      
      expect(state.timeRemaining).toBe(0);
      expect(state.timeRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resolveQTE', () => {
    const baseDamage = 10;

    it('correct answer returns success with 3x critical damage', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const outcome = resolveQTE(state, 2, baseDamage);
      
      expect(outcome.success).toBe(true);
      expect(outcome.damage).toBe(30); // 3× base
      expect(outcome.enrage).toBeUndefined();
    });

    it('wrong answer returns failure with enrage', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const outcome = resolveQTE(state, 0, baseDamage);
      
      expect(outcome.success).toBe(false);
      expect(outcome.damage).toBeUndefined();
      expect(outcome.enrage).toEqual({
        damageMult: 1.5,
        speedMult: 1.25,
        durationMs: 10000
      });
    });

    it('timeout (null answer) returns failure with enrage', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const outcome = resolveQTE(state, null, baseDamage);
      
      expect(outcome.success).toBe(false);
      expect(outcome.enrage).toEqual({
        damageMult: 1.5,
        speedMult: 1.25,
        durationMs: 10000
      });
    });

    it('deterministic: same inputs produce same output', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      
      const outcome1 = resolveQTE(state, 2, baseDamage);
      const outcome2 = resolveQTE(state, 2, baseDamage);
      
      expect(outcome1).toEqual(outcome2);
    });

    it('critical damage scales with base damage', () => {
      const state = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      
      const outcome1 = resolveQTE(state, 2, 10);
      const outcome2 = resolveQTE(state, 2, 20);
      
      expect(outcome1.damage).toBe(30);
      expect(outcome2.damage).toBe(60);
    });
  });

  describe('shouldTriggerQTE', () => {
    describe('exam boss', () => {
      const examBoss: EnemyStats = {
        ...mockEnemy,
        type: 'exam',
        hp: 100,
        maxHp: 200,
        isMinion: false
      };

      it('triggers when crossing 50% HP threshold', () => {
        const hpBefore = 110 / 200; // 55%
        const hpAfter = 90 / 200; // 45%
        
        const shouldTrigger = shouldTriggerQTE(examBoss, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(true);
      });

      it('does not trigger when above 50% HP', () => {
        const hpBefore = 150 / 200; // 75%
        const hpAfter = 120 / 200; // 60%
        
        const shouldTrigger = shouldTriggerQTE(examBoss, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });

      it('does not trigger when already below 50% HP', () => {
        const hpBefore = 90 / 200; // 45%
        const hpAfter = 70 / 200; // 35%
        
        const shouldTrigger = shouldTriggerQTE(examBoss, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });

      it('does not trigger if already triggered', () => {
        const hpBefore = 110 / 200; // 55%
        const hpAfter = 90 / 200; // 45%
        
        const shouldTrigger = shouldTriggerQTE(examBoss, hpBefore, hpAfter, true);
        expect(shouldTrigger).toBe(false);
      });

      it('does not trigger for exam minions', () => {
        const examMinion: EnemyStats = {
          ...examBoss,
          isMinion: true
        };
        
        const hpBefore = 110 / 200;
        const hpAfter = 90 / 200;
        
        const shouldTrigger = shouldTriggerQTE(examMinion, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });
    });

    describe('multi-phase enemy (project/presentation)', () => {
      const project: EnemyStats = {
        ...mockEnemy,
        type: 'project',
        hp: 100,
        maxHp: 150,
        isMinion: false
      };

      it('triggers when crossing 66% HP threshold', () => {
        const hpBefore = 105 / 150; // 70%
        const hpAfter = 90 / 150; // 60%
        
        const shouldTrigger = shouldTriggerQTE(project, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(true);
      });

      it('triggers when crossing 33% HP threshold', () => {
        const hpBefore = 55 / 150; // 36.7%
        const hpAfter = 40 / 150; // 26.7%
        
        const shouldTrigger = shouldTriggerQTE(project, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(true);
      });

      it('does not trigger between thresholds', () => {
        const hpBefore = 80 / 150; // 53.3%
        const hpAfter = 70 / 150; // 46.7%
        
        const shouldTrigger = shouldTriggerQTE(project, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });

      it('works for presentation type', () => {
        const presentation: EnemyStats = {
          ...project,
          type: 'presentation'
        };
        
        const hpBefore = 105 / 150; // 70%
        const hpAfter = 90 / 150; // 60%
        
        const shouldTrigger = shouldTriggerQTE(presentation, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(true);
      });

      it('does not trigger for project minions', () => {
        const projectMinion: EnemyStats = {
          ...project,
          isMinion: true
        };
        
        const hpBefore = 105 / 150;
        const hpAfter = 90 / 150;
        
        const shouldTrigger = shouldTriggerQTE(projectMinion, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });
    });

    describe('other enemy types', () => {
      it('does not trigger for assignment', () => {
        const assignment: EnemyStats = {
          ...mockEnemy,
          type: 'assignment',
          isMinion: false
        };
        
        const hpBefore = 0.6;
        const hpAfter = 0.4;
        
        const shouldTrigger = shouldTriggerQTE(assignment, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });

      it('does not trigger for quiz', () => {
        const quiz: EnemyStats = {
          ...mockEnemy,
          type: 'quiz',
          isMinion: false
        };
        
        const hpBefore = 0.6;
        const hpAfter = 0.4;
        
        const shouldTrigger = shouldTriggerQTE(quiz, hpBefore, hpAfter, false);
        expect(shouldTrigger).toBe(false);
      });
    });
  });

  describe('extraTime accessibility setting', () => {
    it('doubles timer duration when enabled', () => {
      const stateNormal = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const stateExtra = startQTE(mockEnemy, mockQuestion, { extraTime: true }, 0);
      
      expect(stateExtra.maxTime).toBe(stateNormal.maxTime * 2);
      expect(stateExtra.timeRemaining).toBe(stateNormal.timeRemaining * 2);
    });

    it('does not affect outcome calculation', () => {
      const stateNormal = startQTE(mockEnemy, mockQuestion, { extraTime: false }, 0);
      const stateExtra = startQTE(mockEnemy, mockQuestion, { extraTime: true }, 0);
      
      const outcomeNormal = resolveQTE(stateNormal, 2, 10);
      const outcomeExtra = resolveQTE(stateExtra, 2, 10);
      
      expect(outcomeNormal).toEqual(outcomeExtra);
    });
  });
});
