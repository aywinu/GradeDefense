import { describe, it, expect } from 'vitest';
import checkpoints from './checkpoints.json';

// Local type definition for schema validation
type CheckpointQuestion = {
  question: string;
  choices: string[];
  correctIndex: number;
  explain: string;
  topic: string;
};

type CheckpointData = {
  [courseId: string]: CheckpointQuestion[];
};

describe('checkpoints.json schema validation', () => {
  const data = checkpoints as CheckpointData;
  const expectedCourses = ['CV101', 'PHO101', 'MGT101', 'DSA101', 'MKT101', 'MATH101'];
  const questionsPerCourse = 10;

  it('should contain exactly 6 courses', () => {
    const courses = Object.keys(data);
    expect(courses).toHaveLength(6);
    expect(courses.sort()).toEqual(expectedCourses.sort());
  });

  it('should have exactly 10 questions per course', () => {
    expectedCourses.forEach(courseId => {
      expect(data[courseId]).toBeDefined();
      expect(data[courseId]).toHaveLength(questionsPerCourse);
    });
  });

  it('should validate question schema for all questions', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        // Check required fields exist
        expect(q.question, `${courseId}[${index}]: question field missing`).toBeDefined();
        expect(q.choices, `${courseId}[${index}]: choices field missing`).toBeDefined();
        expect(q.correctIndex, `${courseId}[${index}]: correctIndex field missing`).toBeDefined();
        expect(q.explain, `${courseId}[${index}]: explain field missing`).toBeDefined();

        // Check types
        expect(typeof q.question, `${courseId}[${index}]: question should be string`).toBe('string');
        expect(Array.isArray(q.choices), `${courseId}[${index}]: choices should be array`).toBe(true);
        expect(typeof q.correctIndex, `${courseId}[${index}]: correctIndex should be number`).toBe('number');
        expect(typeof q.explain, `${courseId}[${index}]: explain should be string`).toBe('string');
      });
    });
  });

  it('should enforce question length constraint (max 110 characters)', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        expect(
          q.question.length,
          `${courseId}[${index}]: "${q.question}" exceeds 110 characters (${q.question.length})`
        ).toBeLessThanOrEqual(110);
      });
    });
  });

  it('should have exactly 4 choices per question', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        expect(
          q.choices.length,
          `${courseId}[${index}]: should have exactly 4 choices`
        ).toBe(4);
      });
    });
  });

  it('should enforce choice length constraint (max 40 characters)', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        q.choices.forEach((choice, choiceIndex) => {
          expect(
            choice.length,
            `${courseId}[${index}], choice ${choiceIndex}: "${choice}" exceeds 40 characters (${choice.length})`
          ).toBeLessThanOrEqual(40);
        });
      });
    });
  });

  it('should have valid correctIndex (0-3)', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        expect(
          q.correctIndex,
          `${courseId}[${index}]: correctIndex ${q.correctIndex} out of range`
        ).toBeGreaterThanOrEqual(0);
        expect(
          q.correctIndex,
          `${courseId}[${index}]: correctIndex ${q.correctIndex} out of range`
        ).toBeLessThanOrEqual(3);
      });
    });
  });

  it('should have non-empty explain field', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        expect(
          q.explain.trim().length,
          `${courseId}[${index}]: explain field is empty`
        ).toBeGreaterThan(0);
      });
    });
  });

  it('should have non-empty topic field (max 24 characters)', () => {
    expectedCourses.forEach(courseId => {
      data[courseId].forEach((q, index) => {
        // Check field exists and is a string
        expect(q.topic, `${courseId}[${index}]: topic field missing`).toBeDefined();
        expect(typeof q.topic, `${courseId}[${index}]: topic should be string`).toBe('string');
        
        // Check non-empty
        expect(
          q.topic.trim().length,
          `${courseId}[${index}]: topic field is empty`
        ).toBeGreaterThan(0);
        
        // Check max length
        expect(
          q.topic.length,
          `${courseId}[${index}]: topic "${q.topic}" exceeds 24 characters (${q.topic.length})`
        ).toBeLessThanOrEqual(24);
      });
    });
  });

  it('should spread correct answers across all positions (0-3)', () => {
    expectedCourses.forEach(courseId => {
      const correctIndices = data[courseId].map(q => q.correctIndex);
      const distribution = [0, 1, 2, 3].map(i => correctIndices.filter(idx => idx === i).length);
      
      // Each position should be used at least once across 10 questions
      distribution.forEach((count, position) => {
        expect(
          count,
          `${courseId}: position ${position} is never used as correct answer`
        ).toBeGreaterThan(0);
      });
    });
  });

  it('should have 60 total questions', () => {
    const totalQuestions = expectedCourses.reduce(
      (sum, courseId) => sum + data[courseId].length,
      0
    );
    expect(totalQuestions).toBe(60);
  });
});
