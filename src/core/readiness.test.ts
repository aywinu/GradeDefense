import { describe, it, expect } from 'vitest';
import {
  calculateReadiness,
  identifyWeakTopics,
  recommendTrialCount,
  threatLevel,
  courseGrade,
  nextBigEnemies,
  trialQuestionPick,
  type TrialResult,
  type TrialHistoryEntry,
} from './readiness';
import type { Course } from './types';

describe('readiness', () => {
  describe('calculateReadiness', () => {
    it('returns 0 for empty trial history', () => {
      expect(calculateReadiness([], Date.now())).toBe(0);
    });

    it('returns score for single trial', () => {
      const now = Date.now();
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: now - 1000,
          score: 80,
          questionsAnswered: [],
        },
      ];
      expect(calculateReadiness(trials, now)).toBe(80);
    });

    it('applies recency weighting (recent trials 2×, older 1×)', () => {
      const now = Date.now();
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: now - 2 * 86400000, // 2 days ago (recent, weight 2)
          score: 100,
          questionsAnswered: [],
        },
        {
          courseId: 'CV101',
          timestamp: now - 10 * 86400000, // 10 days ago (old, weight 1)
          score: 50,
          questionsAnswered: [],
        },
      ];
      // (100*2 + 50*1) / (2+1) = 250/3 = 83.33...
      expect(calculateReadiness(trials, now)).toBeCloseTo(83.33, 1);
    });

    it('clamps readiness to [0, 100]', () => {
      const now = Date.now();
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: now - 1000,
          score: 150, // hypothetical overflow
          questionsAnswered: [],
        },
      ];
      expect(calculateReadiness(trials, now)).toBe(100);
    });

    it('handles zero score trials', () => {
      const now = Date.now();
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: now - 1000,
          score: 0,
          questionsAnswered: [],
        },
      ];
      expect(calculateReadiness(trials, now)).toBe(0);
    });

    it('averages multiple recent trials', () => {
      const now = Date.now();
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: now - 1 * 86400000,
          score: 60,
          questionsAnswered: [],
        },
        {
          courseId: 'CV101',
          timestamp: now - 2 * 86400000,
          score: 80,
          questionsAnswered: [],
        },
        {
          courseId: 'CV101',
          timestamp: now - 3 * 86400000,
          score: 90,
          questionsAnswered: [],
        },
      ];
      // All recent (weight 2 each): (60*2 + 80*2 + 90*2) / 6 = 460/6 = 76.67
      expect(calculateReadiness(trials, now)).toBeCloseTo(76.67, 1);
    });
  });

  describe('identifyWeakTopics', () => {
    it('returns empty for no trials', () => {
      expect(identifyWeakTopics([])).toEqual([]);
    });

    it('returns empty when all topics have <3 questions', () => {
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 50,
          questionsAnswered: [
            { questionId: 'q1', correct: false, topic: 'Convolution' },
            { questionId: 'q2', correct: true, topic: 'Edge Detection' },
          ],
        },
      ];
      expect(identifyWeakTopics(trials)).toEqual([]);
    });

    it('identifies topic with <50% correct rate and ≥3 questions', () => {
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 40,
          questionsAnswered: [
            { questionId: 'q1', correct: false, topic: 'Matrices' },
            { questionId: 'q2', correct: false, topic: 'Matrices' },
            { questionId: 'q3', correct: true, topic: 'Matrices' },
            { questionId: 'q4', correct: false, topic: 'Matrices' },
          ],
        },
      ];
      // Matrices: 1 correct / 4 total = 25% < 50%
      expect(identifyWeakTopics(trials)).toEqual(['Matrices']);
    });

    it('does not identify topics with ≥50% correct rate', () => {
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 75,
          questionsAnswered: [
            { questionId: 'q1', correct: true, topic: 'Eigenvalues' },
            { questionId: 'q2', correct: true, topic: 'Eigenvalues' },
            { questionId: 'q3', correct: false, topic: 'Eigenvalues' },
            { questionId: 'q4', correct: true, topic: 'Eigenvalues' },
          ],
        },
      ];
      // Eigenvalues: 3 correct / 4 total = 75% >= 50%
      expect(identifyWeakTopics(trials)).toEqual([]);
    });

    it('sorts weak topics alphabetically', () => {
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 30,
          questionsAnswered: [
            { questionId: 'q1', correct: false, topic: 'Zebra' },
            { questionId: 'q2', correct: false, topic: 'Zebra' },
            { questionId: 'q3', correct: false, topic: 'Zebra' },
            { questionId: 'q4', correct: false, topic: 'Apple' },
            { questionId: 'q5', correct: false, topic: 'Apple' },
            { questionId: 'q6', correct: false, topic: 'Apple' },
          ],
        },
      ];
      expect(identifyWeakTopics(trials)).toEqual(['Apple', 'Zebra']);
    });

    it('handles multiple trials with the same topics', () => {
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 40,
          questionsAnswered: [
            { questionId: 'q1', correct: false, topic: 'Determinants' },
            { questionId: 'q2', correct: false, topic: 'Determinants' },
          ],
        },
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 40,
          questionsAnswered: [
            { questionId: 'q3', correct: false, topic: 'Determinants' },
            { questionId: 'q4', correct: true, topic: 'Determinants' },
          ],
        },
      ];
      // Determinants: 1 correct / 4 total = 25% < 50%
      expect(identifyWeakTopics(trials)).toEqual(['Determinants']);
    });

    it('ignores questions without topics', () => {
      const trials: TrialResult[] = [
        {
          courseId: 'CV101',
          timestamp: Date.now(),
          score: 50,
          questionsAnswered: [
            { questionId: 'q1', correct: false }, // no topic
            { questionId: 'q2', correct: false }, // no topic
            { questionId: 'q3', correct: false }, // no topic
          ],
        },
      ];
      expect(identifyWeakTopics(trials)).toEqual([]);
    });
  });

  describe('recommendTrialCount', () => {
    it('returns 0 for overdue items (daysUntilDue ≤ 0)', () => {
      expect(recommendTrialCount(0, 50)).toBe(0);
      expect(recommendTrialCount(-5, 50)).toBe(0);
    });

    it('returns 0 for 100% readiness', () => {
      expect(recommendTrialCount(10, 100)).toBe(0);
    });

    it('recommends trials based on gap and days', () => {
      // 7 days, 60% readiness: gap = 0.4, (7-1)*0.4 = 2.4 → ceil = 3
      expect(recommendTrialCount(7, 60)).toBe(3);
    });

    it('recommends more trials for low readiness', () => {
      // 7 days, 0% readiness: gap = 1.0, (7-1)*1.0 = 6
      expect(recommendTrialCount(7, 0)).toBe(6);
    });

    it('recommends fewer trials for high readiness', () => {
      // 7 days, 90% readiness: gap = 0.1, (7-1)*0.1 = 0.6 → ceil = 1
      expect(recommendTrialCount(7, 90)).toBe(1);
    });

    it('handles 1 day until due', () => {
      // 1 day, 50% readiness: (1-1)*0.5 = 0
      expect(recommendTrialCount(1, 50)).toBe(0);
    });

    it('returns non-negative values', () => {
      expect(recommendTrialCount(5, 50)).toBeGreaterThanOrEqual(0);
      expect(recommendTrialCount(10, 100)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('threatLevel', () => {
    it('returns Low for priority < 0.3', () => {
      expect(threatLevel(0.0)).toBe('Low');
      expect(threatLevel(0.2)).toBe('Low');
      expect(threatLevel(0.29)).toBe('Low');
    });

    it('returns Medium for priority 0.3-0.5', () => {
      expect(threatLevel(0.3)).toBe('Medium');
      expect(threatLevel(0.4)).toBe('Medium');
      expect(threatLevel(0.49)).toBe('Medium');
    });

    it('returns High for priority 0.5-0.7', () => {
      expect(threatLevel(0.5)).toBe('High');
      expect(threatLevel(0.6)).toBe('High');
      expect(threatLevel(0.69)).toBe('High');
    });

    it('returns Critical for priority ≥ 0.7', () => {
      expect(threatLevel(0.7)).toBe('Critical');
      expect(threatLevel(0.8)).toBe('Critical');
      expect(threatLevel(1.0)).toBe('Critical');
    });
  });

  describe('courseGrade', () => {
    it('returns null for course with no graded items', () => {
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Assignment 1',
            type: 'assignment',
            dueDate: new Date(),
            points: 50,
            grade: null,
          },
        ],
      };
      expect(courseGrade(course)).toBeNull();
    });

    it('calculates weighted average for graded items', () => {
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Assignment 1',
            type: 'assignment',
            dueDate: new Date(),
            points: 50,
            grade: 80,
          },
          {
            id: 'cv-2',
            courseId: 'CV101',
            name: 'Quiz 1',
            type: 'quiz',
            dueDate: new Date(),
            points: 20,
            grade: 90,
          },
        ],
      };
      // (80*50 + 90*20) / (50+20) = (4000 + 1800) / 70 = 5800 / 70 = 82.857
      expect(courseGrade(course)).toBeCloseTo(82.857, 2);
    });

    it('ignores items with null grades', () => {
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Assignment 1',
            type: 'assignment',
            dueDate: new Date(),
            points: 50,
            grade: 80,
          },
          {
            id: 'cv-2',
            courseId: 'CV101',
            name: 'Future Assignment',
            type: 'assignment',
            dueDate: new Date(),
            points: 50,
            grade: null,
          },
        ],
      };
      // Only first item counts: 80*50 / 50 = 80
      expect(courseGrade(course)).toBe(80);
    });

    it('handles single graded item', () => {
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Assignment 1',
            type: 'assignment',
            dueDate: new Date(),
            points: 100,
            grade: 95,
          },
        ],
      };
      expect(courseGrade(course)).toBe(95);
    });
  });

  describe('nextBigEnemies', () => {
    it('returns empty for course with no big items', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Small Quiz',
            type: 'quiz',
            dueDate: new Date(now.getTime() + 7 * 86400000),
            points: 10,
            grade: null,
          },
        ],
      };
      expect(nextBigEnemies(course, now)).toEqual([]);
    });

    it('returns exams, projects, presentations', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-exam',
            courseId: 'CV101',
            name: 'Midterm',
            type: 'exam',
            dueDate: new Date(now.getTime() + 7 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-project',
            courseId: 'CV101',
            name: 'Final Project',
            type: 'project',
            dueDate: new Date(now.getTime() + 14 * 86400000),
            points: 150,
            grade: null,
          },
          {
            id: 'cv-pres',
            courseId: 'CV101',
            name: 'Presentation',
            type: 'presentation',
            dueDate: new Date(now.getTime() + 21 * 86400000),
            points: 50,
            grade: null,
          },
        ],
      };
      const big = nextBigEnemies(course, now);
      expect(big).toHaveLength(3);
      expect(big[0].id).toBe('cv-exam');
      expect(big[1].id).toBe('cv-project');
      expect(big[2].id).toBe('cv-pres');
    });

    it('returns items with ≥50 points', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-big',
            courseId: 'CV101',
            name: 'Big Assignment',
            type: 'assignment',
            dueDate: new Date(now.getTime() + 7 * 86400000),
            points: 60,
            grade: null,
          },
          {
            id: 'cv-small',
            courseId: 'CV101',
            name: 'Small Assignment',
            type: 'assignment',
            dueDate: new Date(now.getTime() + 14 * 86400000),
            points: 20,
            grade: null,
          },
        ],
      };
      const big = nextBigEnemies(course, now);
      expect(big).toHaveLength(1);
      expect(big[0].id).toBe('cv-big');
    });

    it('sorts by due date (soonest first)', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-far',
            courseId: 'CV101',
            name: 'Far Exam',
            type: 'exam',
            dueDate: new Date(now.getTime() + 30 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-soon',
            courseId: 'CV101',
            name: 'Soon Exam',
            type: 'exam',
            dueDate: new Date(now.getTime() + 3 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-mid',
            courseId: 'CV101',
            name: 'Mid Exam',
            type: 'exam',
            dueDate: new Date(now.getTime() + 10 * 86400000),
            points: 100,
            grade: null,
          },
        ],
      };
      const big = nextBigEnemies(course, now);
      expect(big[0].id).toBe('cv-soon');
      expect(big[1].id).toBe('cv-mid');
      expect(big[2].id).toBe('cv-far');
    });

    it('respects n limit (default 3)', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Exam 1',
            type: 'exam',
            dueDate: new Date(now.getTime() + 1 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-2',
            courseId: 'CV101',
            name: 'Exam 2',
            type: 'exam',
            dueDate: new Date(now.getTime() + 2 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-3',
            courseId: 'CV101',
            name: 'Exam 3',
            type: 'exam',
            dueDate: new Date(now.getTime() + 3 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-4',
            courseId: 'CV101',
            name: 'Exam 4',
            type: 'exam',
            dueDate: new Date(now.getTime() + 4 * 86400000),
            points: 100,
            grade: null,
          },
        ],
      };
      const big = nextBigEnemies(course, now);
      expect(big).toHaveLength(3);
    });

    it('respects custom n parameter', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-1',
            courseId: 'CV101',
            name: 'Exam 1',
            type: 'exam',
            dueDate: new Date(now.getTime() + 1 * 86400000),
            points: 100,
            grade: null,
          },
          {
            id: 'cv-2',
            courseId: 'CV101',
            name: 'Exam 2',
            type: 'exam',
            dueDate: new Date(now.getTime() + 2 * 86400000),
            points: 100,
            grade: null,
          },
        ],
      };
      const big = nextBigEnemies(course, now, 1);
      expect(big).toHaveLength(1);
      expect(big[0].id).toBe('cv-1');
    });

    it('excludes past items', () => {
      const now = new Date();
      const course: Course = {
        id: 'CV101',
        title: 'Computer Vision',
        color: '#3a86ff',
        items: [
          {
            id: 'cv-past',
            courseId: 'CV101',
            name: 'Past Exam',
            type: 'exam',
            dueDate: new Date(now.getTime() - 7 * 86400000),
            points: 100,
            grade: 85,
          },
          {
            id: 'cv-future',
            courseId: 'CV101',
            name: 'Future Exam',
            type: 'exam',
            dueDate: new Date(now.getTime() + 7 * 86400000),
            points: 100,
            grade: null,
          },
        ],
      };
      const big = nextBigEnemies(course, now);
      expect(big).toHaveLength(1);
      expect(big[0].id).toBe('cv-future');
    });
  });

  describe('trialQuestionPick', () => {
    it('returns empty for empty questions pool', () => {
      expect(trialQuestionPick([], [], 5)).toEqual([]);
    });

    it('returns empty for n=0', () => {
      const questions = [{ id: 'q1', courseId: 'CV101' }];
      expect(trialQuestionPick(questions, [], 0)).toEqual([]);
    });

    it('picks n questions from never-seen pool', () => {
      const questions = [
        { id: 'q1', courseId: 'CV101' },
        { id: 'q2', courseId: 'CV101' },
        { id: 'q3', courseId: 'CV101' },
        { id: 'q4', courseId: 'CV101' },
        { id: 'q5', courseId: 'CV101' },
      ];
      const picked = trialQuestionPick(questions, [], 5);
      expect(picked).toHaveLength(5);
      // All questions should be picked (order doesn't matter)
      expect(new Set(picked).size).toBe(5);
    });

    it('prefers questions answered wrong over correct', () => {
      const questions = [
        { id: 'q1', courseId: 'CV101' },
        { id: 'q2', courseId: 'CV101' },
        { id: 'q3', courseId: 'CV101' },
      ];
      const history: TrialHistoryEntry[] = [
        { courseId: 'CV101', questionId: 'q1', correct: false, atMs: Date.now() },
        { courseId: 'CV101', questionId: 'q2', correct: true, atMs: Date.now() },
      ];
      const rng = (() => {
        let i = 0;
        return () => (i++ % 10) / 10; // Deterministic: 0.0, 0.1, 0.2, ...
      })();
      const picked = trialQuestionPick(questions, history, 2, rng);
      expect(picked).toHaveLength(2);
      // q3 (never seen) and q1 (wrong) should be preferred over q2 (correct)
      expect(picked).toContain('q3');
      expect(picked).toContain('q1');
    });

    it('handles fewer questions than n', () => {
      const questions = [
        { id: 'q1', courseId: 'CV101' },
        { id: 'q2', courseId: 'CV101' },
      ];
      const picked = trialQuestionPick(questions, [], 5);
      expect(picked).toHaveLength(2);
    });

    it('uses deterministic RNG', () => {
      const questions = [
        { id: 'q1', courseId: 'CV101' },
        { id: 'q2', courseId: 'CV101' },
        { id: 'q3', courseId: 'CV101' },
      ];
      const rng = () => 0.5; // Always return 0.5
      const picked1 = trialQuestionPick(questions, [], 3, rng);
      const picked2 = trialQuestionPick(questions, [], 3, rng);
      expect(picked1).toEqual(picked2);
    });

    it('prioritizes never-seen > wrong > correct', () => {
      const questions = [
        { id: 'q1', courseId: 'CV101' }, // never seen
        { id: 'q2', courseId: 'CV101' }, // wrong
        { id: 'q3', courseId: 'CV101' }, // correct
        { id: 'q4', courseId: 'CV101' }, // never seen
      ];
      const history: TrialHistoryEntry[] = [
        { courseId: 'CV101', questionId: 'q2', correct: false, atMs: Date.now() },
        { courseId: 'CV101', questionId: 'q3', correct: true, atMs: Date.now() },
      ];
      const rng = () => 0.5; // deterministic
      const picked = trialQuestionPick(questions, history, 3, rng);
      expect(picked).toHaveLength(3);
      // Should pick q1, q4 (never seen), then q2 (wrong), not q3 (correct)
      expect(picked).toContain('q1');
      expect(picked).toContain('q4');
      expect(picked).toContain('q2');
      expect(picked).not.toContain('q3');
    });

    it('handles mixed correct/incorrect history for same question', () => {
      const questions = [{ id: 'q1', courseId: 'CV101' }];
      const history: TrialHistoryEntry[] = [
        { courseId: 'CV101', questionId: 'q1', correct: true, atMs: Date.now() },
        { courseId: 'CV101', questionId: 'q1', correct: false, atMs: Date.now() },
      ];
      const picked = trialQuestionPick(questions, history, 1);
      expect(picked).toEqual(['q1']);
      // Question with at least one wrong answer should be in "wrong" category
    });
  });
});
