/**
 * Property-based tests for wave generation.
 * Uses fast-check to verify invariants across many random inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateWave, createEnemy, getWaveSize } from './wave';
import type { Semester } from './types';

/**
 * Arbitrary for CourseId
 */
const courseIdArb = fc.stringMatching(/^[A-Z]{2,4}\d{3}$/);

/**
 * Arbitrary for ItemType
 */
const itemTypeArb = fc.constantFrom(
  'assignment' as const,
  'quiz' as const,
  'exam' as const,
  'project' as const,
  'presentation' as const
);

/**
 * Arbitrary for CourseworkItem with relative due date
 */
const courseworkItemArb = (now: number, courseId: string) =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    courseId: fc.constant(courseId),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    type: itemTypeArb,
    dueDate: fc.integer({ min: -30, max: 30 }).map((days) => new Date(now + days * 86400000)),
    points: fc.integer({ min: 10, max: 200 }),
    grade: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  });

/**
 * Arbitrary for Course
 */
const courseArb = (now: number) =>
  courseIdArb.chain((courseId) =>
    fc.record({
      id: fc.constant(courseId),
      title: fc.string({ minLength: 1, maxLength: 50 }),
      color: fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`),
      items: fc.array(courseworkItemArb(now, courseId), { minLength: 0, maxLength: 10 }),
    })
  );

/**
 * Arbitrary for Semester
 */
const semesterArb = fc.nat().chain((now) =>
  fc.record({
    courses: fc.array(courseArb(now), { minLength: 1, maxLength: 6 }),
    startDate: fc.constant(new Date(now - 30 * 86400000)),
    _now: fc.constant(now), // include now for reference
  })
);

describe('wave generation properties', () => {
  it('enemy count is never negative', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);

        expect(wave.length).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('every enemy maps to a real item', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);
        const allItemIds = courses.flatMap((c) => c.items.map((i) => i.id));

        for (const enemy of wave) {
          expect(allItemIds).toContain(enemy.itemId);
        }
      })
    );
  });

  it('enemy HP is always positive', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);

        for (const enemy of wave) {
          expect(enemy.hp).toBeGreaterThan(0);
          expect(enemy.maxHp).toBeGreaterThan(0);
          expect(enemy.hp).toBe(enemy.maxHp);
        }
      })
    );
  });

  it('enemy speed is always positive', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);

        for (const enemy of wave) {
          expect(enemy.speed).toBeGreaterThan(0);
        }
      })
    );
  });

  it('enemy damage is never negative', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);

        for (const enemy of wave) {
          expect(enemy.damage).toBeGreaterThanOrEqual(0);
        }
      })
    );
  });

  it('wave 1 is small (max 3 enemies)', () => {
    fc.assert(
      fc.property(semesterArb, (semesterWithNow) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, 1, now);

        expect(wave.length).toBeLessThanOrEqual(3);
      })
    );
  });

  it('enemy spawns at right edge with zero progress', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);

        for (const enemy of wave) {
          expect(enemy.x).toBe(1200);
          expect(enemy.pathProgress).toBe(0);
        }
      })
    );
  });

  it('enemy is not neglected on spawn', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now);

        for (const enemy of wave) {
          expect(enemy.neglected).toBe(false);
          expect(enemy.lastDamagedAt).toBeNull();
        }
      })
    );
  });

  it('getWaveSize matches actual wave length', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const size = getWaveSize(semester, waveNumber, now);
        const wave = generateWave(semester, waveNumber, now);

        expect(size).toBe(wave.length);
      })
    );
  });

  it('only spawns items due within 7 days and not graded', () => {
    fc.assert(
      fc.property(semesterArb, (semesterWithNow) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, 5, now); // large wave

        for (const enemy of wave) {
          const item = courses
            .flatMap((c) => c.items)
            .find((i) => i.id === enemy.itemId);

          expect(item).toBeDefined();
          if (item) {
            const daysUntil = (item.dueDate.getTime() - now) / 86400000;
            expect(item.grade).toBeNull();
            expect(daysUntil).toBeGreaterThanOrEqual(0);
            expect(daysUntil).toBeLessThanOrEqual(7);
          }
        }
      })
    );
  });

  it('deterministic with same inputs', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        // Simple seeded RNG
        function createSeededRng(seed: number): () => number {
          let state = seed;
          return () => {
            state = (state * 1664525 + 1013904223) % 2 ** 32;
            return state / 2 ** 32;
          };
        }

        const rng1 = createSeededRng(12345);
        const rng2 = createSeededRng(12345);

        const wave1 = generateWave(semester, waveNumber, now, rng1);
        const wave2 = generateWave(semester, waveNumber, now, rng2);

        // Should produce identical results
        expect(wave1.length).toBe(wave2.length);

        for (let i = 0; i < wave1.length; i++) {
          expect(wave1[i].id).toBe(wave2[i].id);
          expect(wave1[i].hp).toBe(wave2[i].hp);
          expect(wave1[i].speed).toBe(wave2[i].speed);
        }
      })
    );
  });

  it('createEnemy produces valid enemy', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        courseworkItemArb(Date.now(), 'TEST'),
        fc.integer({ min: 0 }),
        (now, item, seed) => {
          function createSeededRng(s: number): () => number {
            let state = s;
            return () => {
              state = (state * 1664525 + 1013904223) % 2 ** 32;
              return state / 2 ** 32;
            };
          }

          const rng = createSeededRng(seed);
          const enemy = createEnemy(item, now, [{ id: item.courseId }], rng);

          expect(enemy.id.length).toBeGreaterThan(0);
          expect(enemy.courseId).toBe(item.courseId);
          expect(enemy.itemId).toBe(item.id);
          expect(enemy.type).toBe(item.type);
          expect(enemy.hp).toBeGreaterThan(0);
          expect(enemy.maxHp).toBeGreaterThan(0);
          expect(enemy.hp).toBe(enemy.maxHp);
          expect(enemy.speed).toBeGreaterThan(0);
          expect(enemy.damage).toBeGreaterThanOrEqual(0);
          expect(enemy.x).toBe(1200);
          expect(enemy.pathProgress).toBe(0);
          expect(enemy.spawnedAt).toBe(now);
          expect(enemy.lastDamagedAt).toBeNull();
          expect(enemy.neglected).toBe(false);
        }
      )
    );
  });

  it('later waves are bigger or equal to wave 1', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 2, max: 20 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const size1 = getWaveSize(semester, 1, now);
        const sizeN = getWaveSize(semester, waveNumber, now);

        // Wave N (N > 1) should allow more enemies (not less)
        // But limited by available items
        expect(sizeN).toBeGreaterThanOrEqual(size1);
      })
    );
  });
});
