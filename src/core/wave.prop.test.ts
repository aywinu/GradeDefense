/**
 * Property-based tests for wave generation (campaign system).
 * Uses fast-check to verify invariants across many random inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateWave, getWaveSize, campaignLength } from './wave';
import { mulberry32 } from './rng';
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
    dueDate: fc.integer({ min: -30, max: 60 }).map((days) => new Date(now + days * 86400000)),
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

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        expect(wave.length).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('every enemy maps to a real item', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));
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

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

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

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

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

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        for (const enemy of wave) {
          expect(enemy.damage).toBeGreaterThanOrEqual(0);
        }
      })
    );
  });

  it('wave sizes are ≤ 40', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        expect(wave.length).toBeLessThanOrEqual(40);
      })
    );
  });

  it('enemy spawns with correct initial state', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        for (const enemy of wave) {
          expect(enemy.x).toBe(1200);
          expect(enemy.progress).toBe(0);
          expect(enemy.pathProgress).toBe(0);
          expect(enemy.neglected).toBe(false);
          expect(enemy.lastDamagedAt).toBeNull();
        }
      })
    );
  });

  it('campaignLength is in [1, 10]', () => {
    fc.assert(
      fc.property(semesterArb, (semesterWithNow) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const length = campaignLength(semester, now);

        expect(length).toBeGreaterThanOrEqual(1);
        expect(length).toBeLessThanOrEqual(10);
      })
    );
  });

  it('deterministic with same seed', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave1 = generateWave(semester, waveNumber, now, mulberry32(12345));
        const wave2 = generateWave(semester, waveNumber, now, mulberry32(12345));

        // Should produce identical results
        expect(wave1.length).toBe(wave2.length);

        for (let i = 0; i < wave1.length; i++) {
          expect(wave1[i].id).toBe(wave2[i].id);
          expect(wave1[i].hp).toBe(wave2[i].hp);
          expect(wave1[i].speed).toBe(wave2[i].speed);
          expect(wave1[i].itemId).toBe(wave2[i].itemId);
        }
      })
    );
  });

  it('every enemy has required fields', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        for (const enemy of wave) {
          expect(enemy.id).toBeDefined();
          expect(enemy.id.length).toBeGreaterThan(0);
          expect(enemy.lane).toBeGreaterThanOrEqual(0);
          expect(enemy.lane).toBeLessThan(courses.length);
          expect(enemy.spawnDelayMs).toBeGreaterThanOrEqual(0);
          expect(enemy.label).toBeDefined();
          expect(enemy.label.length).toBeGreaterThan(0);
          expect(typeof enemy.daysLeft).toBe('number');
          expect(typeof enemy.isMinion).toBe('boolean');
        }
      })
    );
  });

  it('minions have parentItemId', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));
        const minions = wave.filter((e) => e.isMinion);

        for (const minion of minions) {
          expect(minion.parentItemId).toBeDefined();
          expect(minion.parentItemId!.length).toBeGreaterThan(0);
        }
      })
    );
  });

  it('only spawns ungraded items', () => {
    fc.assert(
      fc.property(semesterArb, fc.integer({ min: 1, max: 10 }), (semesterWithNow, waveNumber) => {
        const { courses, startDate, _now: now } = semesterWithNow;
        const semester: Semester = { courses, startDate };

        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        for (const enemy of wave) {
          const item = courses
            .flatMap((c) => c.items)
            .find((i) => i.id === enemy.itemId);

          expect(item).toBeDefined();
          if (item) {
            expect(item.grade).toBeNull();
          }
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
        const wave = generateWave(semester, waveNumber, now, mulberry32(42));

        expect(size).toBe(wave.length);
      })
    );
  });
});
