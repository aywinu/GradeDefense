/**
 * Unit tests for wave generation (campaign system).
 */

import { describe, it, expect } from 'vitest';
import { generateWave, getWaveItemIds, campaignLength, campaignWeeks, tutorialWave } from './wave';
import { mulberry32 } from './rng';
import type { Semester, Course } from './types';

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
          dueDate: new Date(now + 2 * 86400000), // 2 days out (wave 1)
          points: 50,
          grade: null,
        },
        {
          id: 'CV101-quiz1',
          courseId: 'CV101',
          name: 'Quiz 1',
          type: 'quiz',
          dueDate: new Date(now + 5 * 86400000), // 5 days out (wave 1)
          points: 20,
          grade: null,
        },
        {
          id: 'CV101-exam1',
          courseId: 'CV101',
          name: 'Midterm Exam',
          type: 'exam',
          dueDate: new Date(now + 1 * 86400000), // 1 day out (wave 1, urgent!)
          points: 100,
          grade: null,
        },
        {
          id: 'CV101-assignment2',
          courseId: 'CV101',
          name: 'Assignment 2',
          type: 'assignment',
          dueDate: new Date(now + 10 * 86400000), // 10 days out (wave 2)
          points: 50,
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
          dueDate: new Date(now + 3 * 86400000), // 3 days out (wave 1)
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
        {
          id: 'PHO101-overdue',
          courseId: 'PHO101',
          name: 'Overdue Assignment',
          type: 'assignment',
          dueDate: new Date(now - 2 * 86400000), // 2 days ago (overdue, wave 1)
          points: 30,
          grade: null, // not graded yet!
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
          dueDate: new Date(now + 20 * 86400000), // 20 days out (wave 3)
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

describe('campaign system', () => {
  it('campaignLength returns weeks until last item', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const length = campaignLength(semester, now);

    // Last item is at 20 days = 3 weeks
    expect(length).toBe(3);
  });

  it('campaignWeeks skips empty weeks', () => {
    const now = Date.now();
    
    // Create semester with items in week 1 and week 3 (week 2 empty)
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-week1',
              courseId: 'TEST',
              name: 'Week 1 Assignment',
              type: 'assignment',
              dueDate: new Date(now + 2 * 86400000), // 2 days (week 1)
              points: 50,
              grade: null,
            },
            {
              id: 'TEST-week3',
              courseId: 'TEST',
              name: 'Week 3 Assignment',
              type: 'assignment',
              dueDate: new Date(now + 16 * 86400000), // 16 days (week 3)
              points: 50,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const weeks = campaignWeeks(semester, now);

    // Should have 2 waves (week 2 is empty and skipped)
    expect(weeks.length).toBe(2);
    expect(weeks[0].waveIndex).toBe(1);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[1].waveIndex).toBe(2);
    expect(weeks[1].weekNumber).toBe(3); // week 2 was skipped
  });

  it('campaignLength counts only non-empty weeks', () => {
    const now = Date.now();
    
    // Create semester with gaps
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-1',
              courseId: 'TEST',
              name: 'Item 1',
              type: 'assignment',
              dueDate: new Date(now + 1 * 86400000), // week 1
              points: 50,
              grade: null,
            },
            {
              id: 'TEST-2',
              courseId: 'TEST',
              name: 'Item 2',
              type: 'assignment',
              dueDate: new Date(now + 20 * 86400000), // week 3
              points: 50,
              grade: null,
            },
            {
              id: 'TEST-3',
              courseId: 'TEST',
              name: 'Item 3',
              type: 'assignment',
              dueDate: new Date(now + 50 * 86400000), // week 8
              points: 50,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const length = campaignLength(semester, now);

    // Should have 3 waves (not 8)
    expect(length).toBe(3);
  });

  it('campaignLength is clamped to [1, 10] weeks', () => {
    const now = Date.now();

    // Empty semester
    const emptySemester: Semester = {
      courses: [],
      startDate: new Date(now),
    };
    expect(campaignLength(emptySemester, now)).toBe(1);

    // Very long semester (100 days = 15 weeks, but only some have items)
    // Create items in weeks 1, 3, 5, 7, 9, 10 (6 non-empty weeks)
    const longSemester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-1',
              courseId: 'TEST',
              name: 'Item Week 1',
              type: 'assignment',
              dueDate: new Date(now + 1 * 86400000), // week 1
              points: 10,
              grade: null,
            },
            {
              id: 'TEST-2',
              courseId: 'TEST',
              name: 'Item Week 3',
              type: 'assignment',
              dueDate: new Date(now + 15 * 86400000), // week 3
              points: 10,
              grade: null,
            },
            {
              id: 'TEST-3',
              courseId: 'TEST',
              name: 'Item Week 5',
              type: 'assignment',
              dueDate: new Date(now + 29 * 86400000), // week 5
              points: 10,
              grade: null,
            },
            {
              id: 'TEST-4',
              courseId: 'TEST',
              name: 'Item Week 7',
              type: 'assignment',
              dueDate: new Date(now + 43 * 86400000), // week 7
              points: 10,
              grade: null,
            },
            {
              id: 'TEST-5',
              courseId: 'TEST',
              name: 'Item Week 9',
              type: 'assignment',
              dueDate: new Date(now + 57 * 86400000), // week 9
              points: 10,
              grade: null,
            },
            {
              id: 'TEST-6',
              courseId: 'TEST',
              name: 'Item Week 10',
              type: 'assignment',
              dueDate: new Date(now + 69 * 86400000), // week 10 (capped)
              points: 10,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };
    expect(campaignLength(longSemester, now)).toBe(6); // 6 non-empty weeks
  });

  it('wave 1 covers items due in [0, 7) days', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const itemIds = getWaveItemIds(semester, 1, now);

    // Should include items in the [0,7) day range
    expect(itemIds.length).toBeGreaterThan(0);

    // Should NOT include CV101-assignment2 (10 days, wave 2)
    expect(itemIds).not.toContain('CV101-assignment2');

    // Should NOT include MGT101-project1 (20 days, wave 3)
    expect(itemIds).not.toContain('MGT101-project1');
  });

  it('wave 1 includes overdue ungraded items', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const itemIds = getWaveItemIds(semester, 1, now);

    // Should include PHO101-overdue (2 days overdue, ungraded)
    expect(itemIds).toContain('PHO101-overdue');
  });

  it('wave 2 covers items due in [7, 14) days', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const itemIds = getWaveItemIds(semester, 2, now);

    // Should include CV101-assignment2 (10 days)
    expect(itemIds).toContain('CV101-assignment2');

    // Should NOT include wave 1 items
    expect(itemIds).not.toContain('CV101-exam1');
  });

  it('wave 3 covers items due in [14, 21) days', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const itemIds = getWaveItemIds(semester, 3, now);

    // Should include MGT101-project1 (20 days)
    expect(itemIds).toContain('MGT101-project1');
  });

  it('does not spawn past graded items', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const wave = generateWave(semester, 1, now);

    // Should NOT include PHO101-past (graded)
    expect(wave.find((e) => e.itemId === 'PHO101-past')).toBeUndefined();
  });

  it('every ungraded item appears in exactly one wave', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const length = campaignLength(semester, now);

    // Collect all items across all waves
    const allWaveItemIds = new Set<string>();
    for (let wave = 1; wave <= length; wave++) {
      const itemIds = getWaveItemIds(semester, wave, now);
      for (const id of itemIds) {
        allWaveItemIds.add(id);
      }
    }

    // Check all ungraded items are covered
    const ungradedItemIds = semester.courses
      .flatMap((c) => c.items)
      .filter((item) => item.grade === null)
      .map((item) => item.id);

    for (const id of ungradedItemIds) {
      expect(allWaveItemIds.has(id)).toBe(true);
    }
  });
});

describe('spawn groups', () => {
  it('assignment spawns 1 shambler + 2 minions', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-assignment',
              courseId: 'TEST',
              name: 'Test Assignment',
              type: 'assignment',
              dueDate: new Date(now + 86400000),
              points: 50,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    // Should have 3 enemies: 1 main + 2 minions
    expect(wave.length).toBe(3);

    const mainEnemies = wave.filter((e) => !e.isMinion);
    const minions = wave.filter((e) => e.isMinion);

    expect(mainEnemies.length).toBe(1);
    expect(minions.length).toBe(2);
  });

  it('quiz spawns 4-6 swarmers (no main enemy)', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-quiz',
              courseId: 'TEST',
              name: 'Test Quiz',
              type: 'quiz',
              dueDate: new Date(now + 86400000),
              points: 20,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    // Quiz has no main enemy, only swarmers
    expect(wave.length).toBeGreaterThanOrEqual(4);
    expect(wave.length).toBeLessThanOrEqual(6);

    const mainEnemies = wave.filter((e) => !e.isMinion);
    expect(mainEnemies.length).toBe(0); // no main enemy for quiz
  });

  it('exam spawns 1 boss + 6 minions', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-exam',
              courseId: 'TEST',
              name: 'Test Exam',
              type: 'exam',
              dueDate: new Date(now + 86400000),
              points: 100,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    // Should have 7 enemies: 1 boss + 6 minions
    expect(wave.length).toBe(7);

    const mainEnemies = wave.filter((e) => !e.isMinion);
    const minions = wave.filter((e) => e.isMinion);

    expect(mainEnemies.length).toBe(1);
    expect(minions.length).toBe(6);
  });

  it('project spawns 1 multi-phase + 3 minions', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-project',
              courseId: 'TEST',
              name: 'Test Project',
              type: 'project',
              dueDate: new Date(now + 86400000),
              points: 100,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    // Should have 4 enemies: 1 main + 3 minions
    expect(wave.length).toBe(4);

    const mainEnemies = wave.filter((e) => !e.isMinion);
    const minions = wave.filter((e) => e.isMinion);

    expect(mainEnemies.length).toBe(1);
    expect(minions.length).toBe(3);
  });

  it('every spawned creature references a real item', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    // Collect all item IDs
    const allItemIds = semester.courses.flatMap((c) => c.items.map((i) => i.id));

    // Every enemy should reference a valid item
    for (const enemy of wave) {
      expect(allItemIds).toContain(enemy.itemId);
      expect(enemy.hp).toBeGreaterThan(0);
      expect(enemy.maxHp).toBeGreaterThan(0);
      expect(enemy.speed).toBeGreaterThan(0);
      expect(enemy.damage).toBeGreaterThanOrEqual(0);
      expect(enemy.label.length).toBeGreaterThan(0);
      expect(enemy.lane).toBeGreaterThanOrEqual(0);
      expect(enemy.lane).toBeLessThan(semester.courses.length);
    }
  });

  it('wave sizes are ≤ 40', () => {
    const now = Date.now();

    // Create a huge semester with many items
    const hugeSemester: Semester = {
      courses: Array.from({ length: 6 }, (_, i) => ({
        id: `COURSE${i}`,
        title: `Course ${i}`,
        color: '#fff',
        items: Array.from({ length: 10 }, (_, j) => ({
          id: `COURSE${i}-item${j}`,
          courseId: `COURSE${i}`,
          name: `Item ${j}`,
          type: 'assignment' as const,
          dueDate: new Date(now + (j + 1) * 86400000),
          points: 50,
          grade: null,
        })),
      })),
      startDate: new Date(now),
    };

    const wave = generateWave(hugeSemester, 1, now);

    expect(wave.length).toBeLessThanOrEqual(40);
  });

  it('overdue items have +25% speed', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-overdue',
              courseId: 'TEST',
              name: 'Overdue Assignment',
              type: 'assignment',
              dueDate: new Date(now - 2 * 86400000), // overdue
              points: 50,
              grade: null,
            },
            {
              id: 'TEST-normal',
              courseId: 'TEST',
              name: 'Normal Assignment',
              type: 'assignment',
              dueDate: new Date(now + 2 * 86400000), // not overdue
              points: 50,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    const overdueMain = wave.find((e) => e.itemId === 'TEST-overdue' && !e.isMinion);
    const normalMain = wave.find((e) => e.itemId === 'TEST-normal' && !e.isMinion);

    expect(overdueMain).toBeDefined();
    expect(normalMain).toBeDefined();

    if (overdueMain && normalMain) {
      // Overdue should be faster
      expect(overdueMain.speed).toBeGreaterThan(normalMain.speed);
      expect(overdueMain.isOverdue).toBe(true);
      expect(normalMain.isOverdue).toBe(false);
    }
  });
});

describe('determinism', () => {
  it('is deterministic with seeded RNG', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const wave1 = generateWave(semester, 1, now, mulberry32(42));
    const wave2 = generateWave(semester, 1, now, mulberry32(42));

    expect(wave1.length).toBe(wave2.length);

    // IDs should match (since they use RNG)
    for (let i = 0; i < wave1.length; i++) {
      expect(wave1[i].id).toBe(wave2[i].id);
      expect(wave1[i].hp).toBe(wave2[i].hp);
      expect(wave1[i].speed).toBe(wave2[i].speed);
      expect(wave1[i].itemId).toBe(wave2[i].itemId);
    }
  });
});

describe('enemy properties', () => {
  it('enemies have correct lane index', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    for (const enemy of wave) {
      // Lane should correspond to course index
      const courseIndex = semester.courses.findIndex((c) => c.id === enemy.courseId);
      expect(enemy.lane).toBe(courseIndex);
    }
  });

  it('enemies have spawn delay for staggered waves', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    // Not all enemies should spawn at once
    const delays = wave.map((e) => e.spawnDelayMs);
    const uniqueDelays = new Set(delays);

    expect(uniqueDelays.size).toBeGreaterThan(1); // multiple different delays
  });

  it('spawn delays are non-decreasing within a group', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-assignment',
              courseId: 'TEST',
              name: 'Test Assignment',
              type: 'assignment',
              dueDate: new Date(now + 86400000),
              points: 50,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    // Main enemy should spawn first (delay 0)
    const mainEnemy = wave.find((e) => !e.isMinion);
    expect(mainEnemy?.spawnDelayMs).toBe(0);

    // Minions should spawn after the main enemy
    const minions = wave.filter((e) => e.isMinion);
    for (const minion of minions) {
      expect(minion.spawnDelayMs).toBeGreaterThan(0);
      expect(minion.spawnDelayMs).toBeGreaterThanOrEqual(400); // min trail delay
      expect(minion.spawnDelayMs).toBeLessThanOrEqual(2000); // reasonable max
    }
  });

  it('spawns spread over time for larger waves', () => {
    const now = Date.now();
    
    // Create a wave with multiple items spread over days
    const semester: Semester = {
      courses: Array.from({ length: 6 }, (_, i) => ({
        id: `COURSE${i}`,
        title: `Course ${i}`,
        color: '#fff',
        items: Array.from({ length: 4 }, (_, j) => ({
          id: `COURSE${i}-item${j}`,
          courseId: `COURSE${i}`,
          name: `Item ${j}`,
          type: 'assignment' as const,
          dueDate: new Date(now + (j + 1) * 86400000),
          points: 50,
          grade: null,
        })),
      })),
      startDate: new Date(now),
    };

    const wave = generateWave(semester, 1, now, mulberry32(42));

    // Check that spawns span a reasonable time window
    const delays = wave.map((e) => e.spawnDelayMs);
    const maxDelay = Math.max(...delays);
    const minDelay = Math.min(...delays);

    // With many items, spawns should be spread over at least 10 seconds
    expect(maxDelay - minDelay).toBeGreaterThan(10000);
    
    // And should not exceed 50 seconds (40s base + some minion trail)
    expect(maxDelay).toBeLessThan(50000);
  });

  it('enemies have label and daysLeft', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    for (const enemy of wave) {
      expect(enemy.label).toBeDefined();
      expect(enemy.label.length).toBeGreaterThan(0);
      expect(typeof enemy.daysLeft).toBe('number');
    }
  });

  it('minions carry parent item name', () => {
    const now = Date.now();
    const semester = createTestSemester(now);
    const wave = generateWave(semester, 1, now);

    const minions = wave.filter((e) => e.isMinion);

    for (const minion of minions) {
      expect(minion.parentItemId).toBeDefined();
      expect(minion.label.length).toBeGreaterThan(0);

      // Find the parent item
      const parentItem = semester.courses
        .flatMap((c) => c.items)
        .find((item) => item.id === minion.parentItemId);

      expect(parentItem).toBeDefined();
      if (parentItem) {
        expect(minion.label).toBe(parentItem.name);
      }
    }
  });
});

describe('tutorialWave', () => {
  it('spawns exactly 3 creatures (1 shambler + 2 minions)', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const wave = tutorialWave(semester, now, mulberry32(42));

    expect(wave.length).toBe(3);

    const mainEnemies = wave.filter((e) => !e.isMinion);
    const minions = wave.filter((e) => e.isMinion);

    expect(mainEnemies.length).toBe(1);
    expect(minions.length).toBe(2);
  });

  it('uses the lowest-points assignment', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-high',
              courseId: 'TEST',
              name: 'High Points Assignment',
              type: 'assignment',
              dueDate: new Date(now + 5 * 86400000),
              points: 100,
              grade: null,
            },
            {
              id: 'TEST-low',
              courseId: 'TEST',
              name: 'Low Points Assignment',
              type: 'assignment',
              dueDate: new Date(now + 5 * 86400000),
              points: 20,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = tutorialWave(semester, now, mulberry32(42));

    const mainEnemy = wave.find((e) => !e.isMinion);
    expect(mainEnemy?.itemId).toBe('TEST-low');
  });

  it('tutorial enemies have reduced HP and speed', () => {
    const now = Date.now();
    const semester = createTestSemester(now);

    const tutWave = tutorialWave(semester, now, mulberry32(42));
    const normalWave = generateWave(semester, 1, now, mulberry32(42));

    // Find comparable enemies (same item type)
    const tutMain = tutWave.find((e) => !e.isMinion && e.type === 'assignment');
    const normalMain = normalWave.find((e) => !e.isMinion && e.type === 'assignment');

    if (tutMain && normalMain) {
      // Tutorial enemy should have less HP and speed
      expect(tutMain.hp).toBeLessThan(normalMain.hp);
      expect(tutMain.speed).toBeLessThan(normalMain.speed);
    }
  });

  it('creates synthetic assignment if no assignments exist', () => {
    const now = Date.now();
    const semester: Semester = {
      courses: [
        {
          id: 'TEST',
          title: 'Test',
          color: '#fff',
          items: [
            {
              id: 'TEST-quiz',
              courseId: 'TEST',
              name: 'Quiz',
              type: 'quiz',
              dueDate: new Date(now + 5 * 86400000),
              points: 20,
              grade: null,
            },
          ],
        },
      ],
      startDate: new Date(now),
    };

    const wave = tutorialWave(semester, now, mulberry32(42));

    // Should still create 3 enemies
    expect(wave.length).toBe(3);
    expect(wave.filter((e) => !e.isMinion).length).toBe(1);
    expect(wave.filter((e) => e.isMinion).length).toBe(2);
  });
});
