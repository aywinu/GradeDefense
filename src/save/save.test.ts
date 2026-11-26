import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { migrate, defaultSave } from './save';

describe('save migrate', () => {
  it('returns defaults for garbage', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('x')).toEqual(defaultSave());
    expect(migrate({ version: 99 })).toEqual(defaultSave());
  });
  it('round-trips a valid save', () => {
    const d = defaultSave();
    d.sessions.push({ courseId: 'CV101', timestamp: 5, score: 100, questionsAnswered: [{ questionId: 'CV101-q01', correct: true }], source: 'trial' });
    d.forge.CV101 = 2;
    expect(migrate(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('never throws and always yields version 1 (property)', () => {
    fc.assert(
      fc.property(fc.anything(), (x) => {
        const m = migrate(x);
        expect(m.version).toBe(1);
        expect(Array.isArray(m.sessions)).toBe(true);
      }),
    );
  });
});
