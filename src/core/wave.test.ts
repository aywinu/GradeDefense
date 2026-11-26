/**
 * Unit tests for wave generation.
 */

import { describe, it, expect } from 'vitest';
import { generateWave, createEnemy, getWaveSize } from './wave';
import type { Semester, CourseworkItem, Course } from './types';

/**
 * Create a test semester with predictable data.
 */
function createTestSemester(now: number): Semester {
  const courses: Course[] = [
    {
      id: 'CV101',
      title: 'Computer Vision',
      color: '#3a86ff',
      items: [
        {
          id: 'CV101-assignment1',
          courseId: 'CV101',
          name: 'Assignment 1',
          type: 'assignment',
          dueDate: new Date(now + 2 * 86400000), // 2 days out
          points: 50,
          grade: null,
        },
        {
          id: 'CV101-quiz1',
          courseId: 'CV101',
          name: 'Quiz 1',
          type: 'quiz',
          dueDate: new Date(now + 5 * 86400000), // 5 days out
          points: 20,
          grade: null,
        },
        {
          id: 'CV101-exam1',
          courseId: 'CV101',
          name: 'Midterm Exam',
          type: 'exam',
          dueDate: new Date(now + 1 * 86400000), // 1 day out (urgent!)
          points: 100,
          grade: null,
        },
      ],
    },
    {
      id: 'PHO101',
      title: 'Photonics',
      color: '#8338ec',
      items: [
        {
          id: 'PHO101-assignment1',
          courseId: 'PHO101',
          name: 'Assignment 1',
          type: 'assignment',
          dueDate: new Date(now + 3 * 86400000), // 3 days out
          points: 50,
          grade: null,
        },
        {
          id: 'PHO101-past',
          courseId: 'PHO101',
          name: 'Past Assignment',
          type: 'assignment',
          dueDate: new Date(now - 10 * 86400000), // 10 days ago
          points: 50,
          grade: 85, // graded, should not spawn
        },
      ],
    },
    {
      id: 'MGT101',
      title: 'Management',
      color: '#fb5607',
      items: [
        {
          id: 'MGT101-project1',
          courseId: 'MGT101',
          name: 'Project 1',
          type: 'project',
          dueDate: new Date(now + 14 * 86400000), // 14 days out (too far)
          points: 100,
          grade: null,
        },
      ],
    },
  ];

  return {
    courses,
    startDate: new Date(now - 30 * 86400000), // started 30 days ago
  };
}

describe('wave generation', () => {
  it('wave 1 is small and gentle (max 3 enemies)', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    expect(wave.length).toBeGreaterThan(0);
    expect(wave.length).toBeLessThanOrEqual(3);
  });

  it('later waves are bigger', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    
    const wave1 = generateWave(semester, 1, now);
    const wave2 = generateWave(semester, 2, now);

    // Wave 2 should allow more enemies (5 + 1 = 6)
    // But limited by available items (4 upcoming in test semester)
    expect(wave2.length).toBeGreaterThanOrEqual(wave1.length);
  });

  it('only spawns items due within 7 days', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    // Should NOT include MGT101-project1 (14 days out)
    expect(wave.find((e) => e.itemId === 'MGT101-project1')).toBeUndefined();

    // Should include CV101 and PHO101 items (all within 7 days)
    expect(wave.some((e) => e.courseId === 'CV101' || e.courseId === 'PHO101')).toBe(true);
  });

  it('does not spawn past graded items', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    // Should NOT include PHO101-past (graded)
    expect(wave.find((e) => e.itemId === 'PHO101-past')).toBeUndefined();
  });

  it('sorts by priority (highest first)', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 5, now); // large wave to get all items

    // CV101-exam1 (1 day out, 100 points) should be highest priority
    // Should appear first or early in the wave
    const examIndex = wave.findIndex((e) => e.itemId === 'CV101-exam1');
    expect(examIndex).toBeGreaterThanOrEqual(0);
    expect(examIndex).toBeLessThan(wave.length / 2); // in top half
  });

  it('enemy HP scales with urgency and points', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 5, now);

    const exam = wave.find((e) => e.type === 'exam');
    const quiz = wave.find((e) => e.type === 'quiz');

    // Exam should have significantly more HP than quiz
    expect(exam).toBeDefined();
    expect(quiz).toBeDefined();
    if (exam && quiz) {
      expect(exam.maxHp).toBeGreaterThan(quiz.maxHp);
    }
  });

  it('enemy type determines base stats', () => {
    const now = Date.now();
    const item: CourseworkItem = {
      id: 'TEST-1',
      courseId: 'TEST',
      name: 'Test Quiz',
      type: 'quiz',
      dueDate: new Date(now + 86400000),
      points: 20,
      grade: null,
    };

    const enemy = createEnemy(item, now, [{ id: 'TEST' }]);

    // Quiz should be fast
    expect(enemy.speed).toBeGreaterThan(30); // faster than assignment base of 30
  });

  it('enemy count is never negative', () => {
    const now = Date.now();
    
    // Empty semester
    const emptySemester: Semester = {
      courses: [],
      startDate: new Date(now),
    };

    const wave = generateWave(emptySemester, 1, now);
    expect(wave.length).toBe(0);
    expect(wave.length).toBeGreaterThanOrEqual(0);
  });

  it('every enemy maps to a real item', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 5, now);

    // Collect all item IDs
    const allItemIds = semester.courses.flatMap((c) => c.items.map((i) => i.id));

    // Every enemy should reference a valid item
    for (const enemy of wave) {
      expect(allItemIds).toContain(enemy.itemId);
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.maxHp).toBeGreaterThan(0);
      expect(enemy.speed).toBeGreaterThan(0);
      expect(enemy.damage).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic with seeded RNG', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    // Simple seeded RNG (Linear Congruential Generator)
    function createSeededRng(seed: number): () => number {
      let state = seed;
      return () => {
        state = (state * 1664525 + 1013904223) % 2 ** 32;
        return state / 2 ** 32;
      };
    }

    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);

    const wave1 = generateWave(semester, 1, now, rng1);
    const wave2 = generateWave(semester, 1, now, rng2);

    expect(wave1.length).toBe(wave2.length);
    // IDs should match (since they use RNG)
    for (let i = 0; i < wave1.length; i++) {
      expect(wave1[i].id).toBe(wave2[i].id);
      expect(wave1[i].hp).toBe(wave2[i].hp);
      expect(wave1[i].speed).toBe(wave2[i].speed);
    }
  });

  it('getWaveSize returns correct count', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const size1 = getWaveSize(semester, 1, now);
    const size2 = getWaveSize(semester, 2, now);

    expect(size1).toBeGreaterThanOrEqual(0);
    expect(size1).toBeLessThanOrEqual(3); // wave 1 max

    expect(size2).toBeGreaterThanOrEqual(size1);
  });

  it('enemy fortress damage scales with points', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 5, now);

    const exam = wave.find((e) => e.type === 'exam' && e.itemId === 'CV101-exam1');
    const quiz = wave.find((e) => e.type === 'quiz');

    expect(exam).toBeDefined();
    expect(quiz).toBeDefined();

    if (exam && quiz) {
      // Exam (100 points) should deal more damage than quiz (20 points)
      expect(exam.damage).toBeGreaterThan(quiz.damage);
    }
  });

  it('enemy spawns at right edge', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    for (const enemy of wave) {
      expect(enemy.x).toBe(1200); // right edge spawn position
      expect(enemy.pathProgress).toBe(0);
    }
  });

  it('enemy is not neglected on spawn', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    for (const enemy of wave) {
      expect(enemy.neglected).toBe(false);
      expect(enemy.lastDamagedAt).toBeNull();
      expect(enemy.spawnedAt).toBe(now);
    }
  });
});
