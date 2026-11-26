/**
 * Schema validation tests for study-skills.json.
 */

import { describe, it, expect } from "vitest";
import studySkills from "./study-skills.json";

type StudyQuestion = {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explain: string;
  topic: string;
};

describe("study-skills.json schema validation", () => {
  const questions = studySkills as StudyQuestion[];

  it("should contain exactly 12 questions", () => {
    expect(questions).toHaveLength(12);
  });

  it("should have valid id format (STUDY-qNN)", () => {
    questions.forEach((q, index) => {
      expect(
        q.id,
        `Question ${index}: id should match STUDY-qNN format`
      ).toMatch(/^STUDY-q\d{2}$/);
    });
  });

  it("should have unique ids", () => {
    const ids = questions.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(questions.length);
  });

  it("should have sequential ids from 01 to 12", () => {
    const expectedIds = Array.from({ length: 12 }, (_, i) =>
      `STUDY-q${String(i + 1).padStart(2, "0")}`
    );
    const actualIds = questions.map((q) => q.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it("should validate question schema for all questions", () => {
    questions.forEach((q, index) => {
      // Check required fields exist
      expect(q.id, `Question ${index}: id field missing`).toBeDefined();
      expect(q.question, `Question ${index}: question field missing`).toBeDefined();
      expect(q.choices, `Question ${index}: choices field missing`).toBeDefined();
      expect(q.correctIndex, `Question ${index}: correctIndex field missing`).toBeDefined();
      expect(q.explain, `Question ${index}: explain field missing`).toBeDefined();
      expect(q.topic, `Question ${index}: topic field missing`).toBeDefined();

      // Check types
      expect(typeof q.id, `Question ${index}: id should be string`).toBe("string");
      expect(typeof q.question, `Question ${index}: question should be string`).toBe("string");
      expect(Array.isArray(q.choices), `Question ${index}: choices should be array`).toBe(true);
      expect(typeof q.correctIndex, `Question ${index}: correctIndex should be number`).toBe("number");
      expect(typeof q.explain, `Question ${index}: explain should be string`).toBe("string");
      expect(typeof q.topic, `Question ${index}: topic should be string`).toBe("string");
    });
  });

  it("should enforce question length constraint (max 110 characters)", () => {
    questions.forEach((q, index) => {
      expect(
        q.question.length,
        `${q.id}: "${q.question}" exceeds 110 characters (${q.question.length})`
      ).toBeLessThanOrEqual(110);
    });
  });

  it("should have exactly 4 choices per question", () => {
    questions.forEach((q, index) => {
      expect(
        q.choices.length,
        `${q.id}: should have exactly 4 choices`
      ).toBe(4);
    });
  });

  it("should enforce choice length constraint (max 40 characters)", () => {
    questions.forEach((q) => {
      q.choices.forEach((choice, choiceIndex) => {
        expect(
          choice.length,
          `${q.id} choice ${choiceIndex}: "${choice}" exceeds 40 characters (${choice.length})`
        ).toBeLessThanOrEqual(40);
      });
    });
  });

  it("should have correctIndex in valid range [0, 3]", () => {
    questions.forEach((q) => {
      expect(
        q.correctIndex,
        `${q.id}: correctIndex ${q.correctIndex} out of range`
      ).toBeGreaterThanOrEqual(0);
      expect(
        q.correctIndex,
        `${q.id}: correctIndex ${q.correctIndex} out of range`
      ).toBeLessThan(4);
    });
  });

  it("should have varied correctIndex distribution (not all the same)", () => {
    const indices = questions.map((q) => q.correctIndex);
    const uniqueIndices = new Set(indices);
    
    // Should have at least 2 different correct indices across 12 questions
    expect(
      uniqueIndices.size,
      "correctIndex should be varied across questions, not all the same"
    ).toBeGreaterThanOrEqual(2);
  });

  it("should spread correctIndex across all positions [0, 1, 2, 3]", () => {
    const indices = questions.map((q) => q.correctIndex);
    const counts = [0, 1, 2, 3].map((i) => indices.filter((idx) => idx === i).length);

    // Each position should appear at least once
    counts.forEach((count, position) => {
      expect(
        count,
        `correctIndex ${position} should appear at least once`
      ).toBeGreaterThan(0);
    });
  });

  it("should have non-empty explain field", () => {
    questions.forEach((q) => {
      expect(
        q.explain.trim().length,
        `${q.id}: explain should not be empty`
      ).toBeGreaterThan(0);
    });
  });

  it("should enforce explain length constraint (max 200 characters)", () => {
    questions.forEach((q) => {
      expect(
        q.explain.length,
        `${q.id}: explain exceeds 200 characters (${q.explain.length})`
      ).toBeLessThanOrEqual(200);
    });
  });

  it("should have non-empty topic field", () => {
    questions.forEach((q) => {
      expect(
        q.topic.trim().length,
        `${q.id}: topic should not be empty`
      ).toBeGreaterThan(0);
    });
  });

  it("should enforce topic length constraint (max 24 characters)", () => {
    questions.forEach((q) => {
      expect(
        q.topic.length,
        `${q.id}: topic "${q.topic}" exceeds 24 characters (${q.topic.length})`
      ).toBeLessThanOrEqual(24);
    });
  });

  it("should have varied topics (not all the same)", () => {
    const topics = questions.map((q) => q.topic);
    const uniqueTopics = new Set(topics);

    // Should have at least 8 unique topics for 12 questions
    expect(
      uniqueTopics.size,
      `Only ${uniqueTopics.size} unique topics found, expected at least 8`
    ).toBeGreaterThanOrEqual(8);
  });

  it("should have all 4 choices be non-empty strings", () => {
    questions.forEach((q) => {
      q.choices.forEach((choice, choiceIndex) => {
        expect(
          choice.trim().length,
          `${q.id} choice ${choiceIndex}: should not be empty`
        ).toBeGreaterThan(0);
      });
    });
  });

  it("should have all 4 choices be distinct (no duplicates)", () => {
    questions.forEach((q) => {
      const uniqueChoices = new Set(q.choices);
      expect(
        uniqueChoices.size,
        `${q.id}: has duplicate choices`
      ).toBe(4);
    });
  });

  it("should reference evidence-based study techniques", () => {
    // Check that topics cover common evidence-based techniques
    const topics = questions.map((q) => q.topic.toLowerCase());
    const expectedTopics = [
      "spaced repetition",
      "retrieval practice",
      "interleaving",
      "elaboration",
      "dual coding",
      "testing effect",
      "metacognition",
    ];

    const foundTopics = expectedTopics.filter((expected) =>
      topics.some((topic) => topic.includes(expected))
    );

    expect(
      foundTopics.length,
      `Should cover multiple evidence-based techniques, found: ${foundTopics.join(", ")}`
    ).toBeGreaterThanOrEqual(5);
  });
});
