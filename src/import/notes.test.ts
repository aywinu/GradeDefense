/**
 * Tests for notes.ts question generation.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { notesToQuestions } from "./notes";
import { mulberry32 } from "../core/rng";

describe("notesToQuestions", () => {
  const sampleNotes = `
Photosynthesis is the process by which plants convert light energy into chemical energy. 
This process occurs in the chloroplasts of plant cells. 
Chloroplasts are organelles that contain chlorophyll, a green pigment. 
The light-dependent reactions take place in the thylakoid membranes. 
During the light-independent reactions, also known as the Calvin Cycle, carbon dioxide is fixed into glucose. 
The overall equation can be represented as 6CO2 + 6H2O → C6H12O6 + 6O2. 
Photosynthesis typically occurs at a rate of approximately 2 micromoles per square meter per second.
Plants use stomata to regulate gas exchange. 
The term "photosynthesis" comes from Greek words meaning "light" and "putting together".
`;

  it("generates valid questions from realistic sample", () => {
    const rng = mulberry32(42);
    const questions = notesToQuestions(sampleNotes, "BIO101", rng, 10);

    // Should generate at least some questions
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(10);

    // Check each question
    for (const q of questions) {
      // Has required fields
      expect(q.id).toMatch(/^BIO101-gen\d{2}$/);
      expect(q.courseId).toBe("BIO101");
      expect(q.question).toBeTruthy();
      expect(q.choices).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.explain).toBeTruthy();
      expect(q.topic).toBeTruthy();

      // Question contains blank
      expect(q.question).toContain("_____");

      // Question length ≤ 110
      expect(q.question.length).toBeLessThanOrEqual(110);

      // 4 distinct choices
      const uniqueChoices = new Set(q.choices);
      expect(uniqueChoices.size).toBe(4);

      // Correct answer is in choices
      const correctAnswer = q.choices[q.correctIndex];
      expect(q.choices).toContain(correctAnswer);

      // Correct answer appears exactly once
      const occurrences = q.choices.filter((c) => c === correctAnswer).length;
      expect(occurrences).toBe(1);

      // Explain length ≤ 200
      expect(q.explain.length).toBeLessThanOrEqual(200);

      // Topic length ≤ 24
      expect(q.topic.length).toBeLessThanOrEqual(24);
    }
  });

  it("is deterministic for same seed", () => {
    const questions1 = notesToQuestions(sampleNotes, "BIO101", mulberry32(123), 10);
    const questions2 = notesToQuestions(sampleNotes, "BIO101", mulberry32(123), 10);

    expect(questions1).toEqual(questions2);
  });

  it("produces different results for different seeds", () => {
    const questions1 = notesToQuestions(sampleNotes, "BIO101", mulberry32(1), 5);
    const questions2 = notesToQuestions(sampleNotes, "BIO101", mulberry32(999), 5);

    // Should have different correctIndex or choice order
    if (questions1.length > 0 && questions2.length > 0) {
      expect(questions1).not.toEqual(questions2);
    }
  });

  it("returns empty array for empty input", () => {
    const rng = mulberry32(42);
    expect(notesToQuestions("", "TEST", rng)).toEqual([]);
    expect(notesToQuestions("   ", "TEST", rng)).toEqual([]);
  });

  it("returns empty array for unusable text", () => {
    const rng = mulberry32(42);
    // Very short sentences or no key terms
    expect(notesToQuestions("Hi. No. Ok.", "TEST", rng)).toEqual([]);
  });

  it("handles text with abbreviations correctly", () => {
    const rng = mulberry32(42);
    const text = "Dr. Smith discovered e.g. several compounds, i.e. carbon dioxide and water. These substances are found at 25.5 degrees Celsius.";
    const questions = notesToQuestions(text, "CHEM", rng, 5);

    // Should not break on abbreviations
    for (const q of questions) {
      expect(q.question).toBeTruthy();
      expect(q.choices).toHaveLength(4);
    }
  });

  it("respects max parameter", () => {
    const rng = mulberry32(42);
    const longText = sampleNotes.repeat(10);
    
    const questions5 = notesToQuestions(longText, "TEST", rng, 5);
    expect(questions5.length).toBeLessThanOrEqual(5);

    const questions20 = notesToQuestions(longText, "TEST", rng, 20);
    expect(questions20.length).toBeLessThanOrEqual(20);
  });

  it("generates questions with different topics", () => {
    const rng = mulberry32(42);
    const questions = notesToQuestions(sampleNotes, "BIO101", rng, 10);

    if (questions.length >= 2) {
      const topics = questions.map((q) => q.topic);
      const uniqueTopics = new Set(topics);
      // Should have some variety
      expect(uniqueTopics.size).toBeGreaterThan(1);
    }
  });

  describe("property-based tests", () => {
    it("never throws on arbitrary strings", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 5000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          (text, courseId, seed) => {
            const rng = mulberry32(seed);
            expect(() => notesToQuestions(text, courseId, rng, 20)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("every question has 4 distinct choices", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 2000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          (text, courseId, seed) => {
            const rng = mulberry32(seed);
            const questions = notesToQuestions(text, courseId, rng, 20);

            for (const q of questions) {
              const uniqueChoices = new Set(q.choices);
              expect(uniqueChoices.size).toBe(4);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("correct answer appears exactly once in choices", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 2000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          (text, courseId, seed) => {
            const rng = mulberry32(seed);
            const questions = notesToQuestions(text, courseId, rng, 20);

            for (const q of questions) {
              const correctAnswer = q.choices[q.correctIndex];
              const occurrences = q.choices.filter((c) => c === correctAnswer).length;
              expect(occurrences).toBe(1);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("question length ≤ 110 characters", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 2000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          (text, courseId, seed) => {
            const rng = mulberry32(seed);
            const questions = notesToQuestions(text, courseId, rng, 20);

            for (const q of questions) {
              expect(q.question.length).toBeLessThanOrEqual(110);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("correctIndex is always in valid range [0, 3]", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 2000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          (text, courseId, seed) => {
            const rng = mulberry32(seed);
            const questions = notesToQuestions(text, courseId, rng, 20);

            for (const q of questions) {
              expect(q.correctIndex).toBeGreaterThanOrEqual(0);
              expect(q.correctIndex).toBeLessThan(4);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("returns empty or valid questions, never malformed", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 2000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          (text, courseId, seed) => {
            const rng = mulberry32(seed);
            const questions = notesToQuestions(text, courseId, rng, 20);

            expect(Array.isArray(questions)).toBe(true);

            for (const q of questions) {
              expect(typeof q.id).toBe("string");
              expect(typeof q.courseId).toBe("string");
              expect(typeof q.question).toBe("string");
              expect(Array.isArray(q.choices)).toBe(true);
              expect(q.choices.length).toBe(4);
              expect(typeof q.correctIndex).toBe("number");
              expect(typeof q.explain).toBe("string");
              expect(typeof q.topic).toBe("string");
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("is deterministic for same inputs", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 20 }),
          (text, courseId, seed, max) => {
            const rng1 = mulberry32(seed);
            const rng2 = mulberry32(seed);
            const questions1 = notesToQuestions(text, courseId, rng1, max);
            const questions2 = notesToQuestions(text, courseId, rng2, max);

            expect(questions1).toEqual(questions2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
