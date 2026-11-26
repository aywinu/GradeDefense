import { describe, it, expect } from 'vitest';
import {
  sealsFor,
  applyAnswer,
  creepSpeed,
  isDefeated,
  reachedAltar,
  type DuelState,
} from './duel';

describe('sealsFor', () => {
  it('minions always have 1 seal', () => {
    expect(sealsFor({ type: 'assignment', isMinion: true }, 100)).toBe(1);
    expect(sealsFor({ type: 'exam', isMinion: true }, 200)).toBe(1);
  });

  it('quiz has 2 seals', () => {
    expect(sealsFor({ type: 'quiz', isMinion: false }, 10)).toBe(2);
    expect(sealsFor({ type: 'quiz', isMinion: false }, 100)).toBe(2);
  });

  it('assignment has 3 seals, 4 if points ≥ 50', () => {
    expect(sealsFor({ type: 'assignment', isMinion: false }, 10)).toBe(3);
    expect(sealsFor({ type: 'assignment', isMinion: false }, 49)).toBe(3);
    expect(sealsFor({ type: 'assignment', isMinion: false }, 50)).toBe(4);
    expect(sealsFor({ type: 'assignment', isMinion: false }, 100)).toBe(4);
  });

  it('project/presentation has 5 seals', () => {
    expect(sealsFor({ type: 'project', isMinion: false }, 50)).toBe(5);
    expect(sealsFor({ type: 'presentation', isMinion: false }, 100)).toBe(5);
  });

  it('exam has 8 seals, 10 if points ≥ 100', () => {
    expect(sealsFor({ type: 'exam', isMinion: false }, 50)).toBe(8);
    expect(sealsFor({ type: 'exam', isMinion: false }, 99)).toBe(8);
    expect(sealsFor({ type: 'exam', isMinion: false }, 100)).toBe(10);
    expect(sealsFor({ type: 'exam', isMinion: false }, 200)).toBe(10);
  });

  it('always returns an integer ≥ 1', () => {
    const types: Array<'assignment' | 'quiz' | 'exam' | 'project' | 'presentation'> = [
      'assignment',
      'quiz',
      'exam',
      'project',
      'presentation',
    ];
    for (const type of types) {
      for (const points of [0, 10, 50, 100, 200]) {
        const result = sealsFor({ type, isMinion: false }, points);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });
});

describe('applyAnswer', () => {
  const baseState: DuelState = {
    seals: 5,
    maxSeals: 5,
    progress: 0.5,
  };

  describe('correct answer', () => {
    it('deals 1 damage with no streak', () => {
      const result = applyAnswer(baseState, true, 0);
      expect(result.damage).toBe(1);
      expect(result.state.seals).toBe(4);
      expect(result.lurch).toBe(0);
      expect(result.state.progress).toBe(0.5); // unchanged
    });

    it('deals 1 damage with streak < 3', () => {
      const result = applyAnswer(baseState, true, 2);
      expect(result.damage).toBe(1);
      expect(result.state.seals).toBe(4);
    });

    it('deals 2 damage with streak ≥ 3', () => {
      const result = applyAnswer(baseState, true, 3);
      expect(result.damage).toBe(2);
      expect(result.state.seals).toBe(3);
    });

    it('caps damage at remaining seals', () => {
      const lowState: DuelState = { seals: 1, maxSeals: 5, progress: 0.8 };
      const result = applyAnswer(lowState, true, 5);
      expect(result.damage).toBe(1); // capped, not 2
      expect(result.state.seals).toBe(0);
    });

    it('never increases progress', () => {
      const result = applyAnswer(baseState, true, 0);
      expect(result.state.progress).toBe(0.5);
    });
  });

  describe('wrong answer', () => {
    it('deals no damage', () => {
      const result = applyAnswer(baseState, false, 0);
      expect(result.damage).toBe(0);
      expect(result.state.seals).toBe(5); // unchanged
    });

    it('lurches forward by 0.06', () => {
      const result = applyAnswer(baseState, false, 0);
      expect(result.lurch).toBe(0.06);
      expect(result.state.progress).toBeCloseTo(0.56, 5);
    });

    it('caps progress at 1', () => {
      const nearEndState: DuelState = { seals: 5, maxSeals: 5, progress: 0.98 };
      const result = applyAnswer(nearEndState, false, 0);
      expect(result.state.progress).toBe(1);
      expect(result.lurch).toBe(0.06); // lurch amount is still 0.06
    });
  });

  it('seals never go negative', () => {
    const zeroState: DuelState = { seals: 0, maxSeals: 5, progress: 0.9 };
    const result = applyAnswer(zeroState, true, 0);
    expect(result.state.seals).toBe(0);
    expect(result.damage).toBe(0);
  });

  it('progress stays in [0, 1]', () => {
    const states: DuelState[] = [
      { seals: 3, maxSeals: 5, progress: 0 },
      { seals: 3, maxSeals: 5, progress: 0.5 },
      { seals: 3, maxSeals: 5, progress: 1 },
    ];
    for (const state of states) {
      const correctResult = applyAnswer(state, true, 0);
      expect(correctResult.state.progress).toBeGreaterThanOrEqual(0);
      expect(correctResult.state.progress).toBeLessThanOrEqual(1);

      const wrongResult = applyAnswer(state, false, 0);
      expect(wrongResult.state.progress).toBeGreaterThanOrEqual(0);
      expect(wrongResult.state.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('creepSpeed', () => {
  it('minions are fast (~120s to cross)', () => {
    const speed = creepSpeed('assignment', true, 7);
    expect(speed).toBeGreaterThan(0);
    // Should cross in roughly 120s: 1 / 120 ≈ 0.0083
    expect(speed).toBeCloseTo(1 / 120, 4);
  });

  it('exams are slow (~360s to cross)', () => {
    const speed = creepSpeed('exam', false, 7);
    expect(speed).toBeCloseTo(1 / 360, 5);
  });

  it('quizzes are fast (~180s to cross)', () => {
    const speed = creepSpeed('quiz', false, 7);
    expect(speed).toBeCloseTo(1 / 180, 5);
  });

  it('projects are slow (~300s to cross)', () => {
    const speedProject = creepSpeed('project', false, 7);
    const speedPresentation = creepSpeed('presentation', false, 7);
    expect(speedProject).toBeCloseTo(1 / 300, 5);
    expect(speedPresentation).toBeCloseTo(1 / 300, 5);
  });

  it('assignments are medium (~240s to cross)', () => {
    const speed = creepSpeed('assignment', false, 7);
    expect(speed).toBeCloseTo(1 / 240, 5);
  });

  it('overdue items are 25% faster', () => {
    const normalSpeed = creepSpeed('assignment', false, 1);
    const overdueSpeed = creepSpeed('assignment', false, -1);
    expect(overdueSpeed).toBeCloseTo(normalSpeed * 1.25, 5);
  });

  it('always returns positive and finite', () => {
    const types: Array<'assignment' | 'quiz' | 'exam' | 'project' | 'presentation'> = [
      'assignment',
      'quiz',
      'exam',
      'project',
      'presentation',
    ];
    for (const type of types) {
      for (const daysLeft of [-10, 0, 1, 7, 21]) {
        const speed = creepSpeed(type, false, daysLeft);
        expect(speed).toBeGreaterThan(0);
        expect(Number.isFinite(speed)).toBe(true);
      }
    }
  });
});

describe('isDefeated', () => {
  it('returns true when seals = 0', () => {
    expect(isDefeated({ seals: 0, maxSeals: 5, progress: 0.5 })).toBe(true);
  });

  it('returns false when seals > 0', () => {
    expect(isDefeated({ seals: 1, maxSeals: 5, progress: 0.5 })).toBe(false);
    expect(isDefeated({ seals: 5, maxSeals: 5, progress: 0.5 })).toBe(false);
  });
});

describe('reachedAltar', () => {
  it('returns true when progress ≥ 1', () => {
    expect(reachedAltar({ seals: 5, maxSeals: 5, progress: 1 })).toBe(true);
    expect(reachedAltar({ seals: 5, maxSeals: 5, progress: 1.1 })).toBe(true);
  });

  it('returns false when progress < 1', () => {
    expect(reachedAltar({ seals: 5, maxSeals: 5, progress: 0.99 })).toBe(false);
    expect(reachedAltar({ seals: 5, maxSeals: 5, progress: 0 })).toBe(false);
  });
});

describe('integration: defeating a creature', () => {
  it('requires exactly N correct answers when streak = 0', () => {
    const maxSeals = 5;
    let state: DuelState = { seals: maxSeals, maxSeals, progress: 0 };
    
    let answersNeeded = 0;
    while (!isDefeated(state)) {
      const result = applyAnswer(state, true, 0); // no streak
      state = result.state;
      answersNeeded++;
      
      // Safety: prevent infinite loop
      if (answersNeeded > maxSeals * 2) {
        throw new Error('Infinite loop detected');
      }
    }
    
    expect(answersNeeded).toBe(maxSeals);
  });

  it('requires fewer answers with streak ≥ 3', () => {
    const maxSeals = 5;
    let state: DuelState = { seals: maxSeals, maxSeals, progress: 0 };
    
    let answersNeeded = 0;
    while (!isDefeated(state)) {
      const result = applyAnswer(state, true, 5); // always with streak
      state = result.state;
      answersNeeded++;
      
      if (answersNeeded > maxSeals) {
        throw new Error('Should require fewer answers with streak');
      }
    }
    
    expect(answersNeeded).toBeLessThan(maxSeals);
    expect(answersNeeded).toBe(Math.ceil(maxSeals / 2));
  });

  it('wrong answers make creature reach altar if too many', () => {
    let state: DuelState = { seals: 5, maxSeals: 5, progress: 0 };
    
    // 17 wrong answers should reach the altar (17 * 0.06 = 1.02)
    for (let i = 0; i < 17; i++) {
      if (reachedAltar(state)) break;
      const result = applyAnswer(state, false, 0);
      state = result.state;
    }
    
    expect(reachedAltar(state)).toBe(true);
    expect(state.seals).toBe(5); // seals unchanged
  });
});
