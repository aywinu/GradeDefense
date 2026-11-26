/**
 * Tests for ICS parser.
 * Includes inline sample Moodle export with folded lines, escapes, various date formats.
 * Plus property test: parseICS never throws on arbitrary strings.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseICS,
  inferItemType,
  extractCourseId,
  icsToSemester,
  type ICSEvent,
} from "./ics";

// Sample Moodle ICS export with various date formats and folded lines
const SAMPLE_MOODLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Moodle//NONSGML Moodle Version 4.5//EN
BEGIN:VEVENT
UID:12345@moodle.example.com
SUMMARY:CV101: Midterm Examination is due
DESCRIPTION:This is a midterm exam for Computer Vision. Good luck!\\nRemem
 ber to review chapters 1-5.
DTSTART:20261203T140000Z
DTEND:20261203T160000Z
CATEGORIES:CV101
END:VEVENT
BEGIN:VEVENT
UID:12346@moodle.example.com
SUMMARY:PHO101: Quiz 1 closes
DESCRIPTION:Quiz on interference and diffraction.
DTSTART;VALUE=DATE:20261128
CATEGORIES:PHO101
END:VEVENT
BEGIN:VEVENT
UID:12347@moodle.example.com
SUMMARY:MGT101: Assignment 2 should be completed
DESCRIPTION:Submit your team analysis report.
DTSTART:20261205T235900
CATEGORIES:MGT101
END:VEVENT
BEGIN:VEVENT
UID:12348@moodle.example.com
SUMMARY:DSA101: Project Proposal opens
DESCRIPTION:Upload your project proposal.
DTSTART:20261201T000000
CATEGORIES:DSA101
END:VEVENT
BEGIN:VEVENT
UID:12349@moodle.example.com
SUMMARY:DSA101: Project Proposal closes
DESCRIPTION:Final deadline for project proposal.
DUE:20261210T235900Z
CATEGORIES:DSA101
END:VEVENT
BEGIN:VEVENT
UID:12350@moodle.example.com
SUMMARY:MKT101: Presentation (30%) is due
DESCRIPTION:Present your marketing campaign.
DTSTART;TZID=America/New_York:20261215T140000
CATEGORIES:MKT101
END:VEVENT
BEGIN:VEVENT
UID:12351@moodle.example.com
SUMMARY:MATH101: Final Examination
DESCRIPTION:Comprehensive final exam\\; covers all topics\\, including eig
 envalues\\\\and matrices.
DTSTART:20261220T090000Z
DTEND:20261220T120000Z
CATEGORIES:MATH101
END:VEVENT
END:VCALENDAR`;

describe("ICS Parser", () => {
  describe("parseICS", () => {
    it("should parse sample Moodle ICS with folded lines", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);

      expect(events.length).toBeGreaterThanOrEqual(6); // At least 6 events (opens event will be filtered by icsToSemester)
      
      // Check first event (Midterm)
      const midterm = events.find((e) => e.uid === "12345@moodle.example.com");
      expect(midterm).toBeDefined();
      expect(midterm!.summary).toBe("CV101: Midterm Examination is due");
      expect(midterm!.categories).toEqual(["CV101"]);
      expect(midterm!.dtstart).toBeInstanceOf(Date);
      
      // Check unfolded description (line continuation)
      expect(midterm!.description).toContain("Remember to review chapters 1-5");
      expect(midterm!.description).toContain("\n"); // \\n should be unescaped
    });

    it("should parse UTC date format (Z suffix)", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const midterm = events.find((e) => e.uid === "12345@moodle.example.com");
      
      expect(midterm!.dtstart.getUTCFullYear()).toBe(2026);
      expect(midterm!.dtstart.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(midterm!.dtstart.getUTCDate()).toBe(3);
      expect(midterm!.dtstart.getUTCHours()).toBe(14);
    });

    it("should parse VALUE=DATE format (date-only)", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const quiz = events.find((e) => e.uid === "12346@moodle.example.com");
      
      expect(quiz!.dtstart.getFullYear()).toBe(2026);
      expect(quiz!.dtstart.getMonth()).toBe(10); // November (0-indexed)
      expect(quiz!.dtstart.getDate()).toBe(28);
      // Date-only should default to end of day
      expect(quiz!.dtstart.getHours()).toBe(23);
      expect(quiz!.dtstart.getMinutes()).toBe(59);
    });

    it("should parse local datetime format (no Z)", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const assignment = events.find((e) => e.uid === "12347@moodle.example.com");
      
      expect(assignment!.dtstart.getFullYear()).toBe(2026);
      expect(assignment!.dtstart.getMonth()).toBe(11); // December
      expect(assignment!.dtstart.getDate()).toBe(5);
      expect(assignment!.dtstart.getHours()).toBe(23);
      expect(assignment!.dtstart.getMinutes()).toBe(59);
    });

    it("should parse TZID parameter (treat as local)", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const presentation = events.find((e) => e.uid === "12350@moodle.example.com");
      
      expect(presentation!.dtstart.getFullYear()).toBe(2026);
      expect(presentation!.dtstart.getMonth()).toBe(11); // December
      expect(presentation!.dtstart.getDate()).toBe(15);
      expect(presentation!.dtstart.getHours()).toBe(14);
    });

    it("should parse DUE field", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const project = events.find((e) => e.uid === "12349@moodle.example.com");
      
      expect(project!.due).toBeInstanceOf(Date);
      expect(project!.due!.getUTCFullYear()).toBe(2026);
      expect(project!.due!.getUTCMonth()).toBe(11); // December
      expect(project!.due!.getUTCDate()).toBe(10);
    });

    it("should unescape text values", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const finalExam = events.find((e) => e.uid === "12351@moodle.example.com");
      
      // \\n → newline, \\, → comma, \\; → semicolon, \\\\ → backslash
      expect(finalExam!.description).toContain("exam; covers all topics, including eigenvalues\\and");
    });

    it("should handle malformed ICS gracefully (no throw)", () => {
      const malformed = "BEGIN:VCALENDAR\nGARBAGE DATA\nEND:VCALENDAR";
      const events = parseICS(malformed);
      
      expect(events).toEqual([]);
    });

    it("should handle empty string", () => {
      const events = parseICS("");
      expect(events).toEqual([]);
    });
  });

  describe("inferItemType", () => {
    it("should infer exam from keywords", () => {
      expect(inferItemType("Midterm Examination")).toBe("exam");
      expect(inferItemType("Final Exam")).toBe("exam");
      expect(inferItemType("midterm is due")).toBe("exam");
    });

    it("should infer quiz from keywords", () => {
      expect(inferItemType("Quiz 1")).toBe("quiz");
      expect(inferItemType("Test 2")).toBe("quiz");
      expect(inferItemType("Weekly quiz")).toBe("quiz");
    });

    it("should infer presentation from keywords", () => {
      expect(inferItemType("Project Presentation")).toBe("presentation");
      expect(inferItemType("Final Pitch")).toBe("presentation");
    });

    it("should infer project from keywords", () => {
      expect(inferItemType("Project Proposal")).toBe("project");
      expect(inferItemType("Course Project")).toBe("project");
    });

    it("should default to assignment", () => {
      expect(inferItemType("Assignment 1")).toBe("assignment");
      expect(inferItemType("Homework 2")).toBe("assignment");
      expect(inferItemType("Random Task")).toBe("assignment");
    });
  });

  describe("extractCourseId", () => {
    it("should extract from categories first", () => {
      const courseId = extractCourseId("Random summary", ["CV101", "Other"]);
      expect(courseId).toBe("CV101");
    });

    it("should extract from summary if not in categories", () => {
      const courseId = extractCourseId("CV101: Midterm Exam", []);
      expect(courseId).toBe("CV101");
    });

    it("should handle mixed case patterns", () => {
      const courseId = extractCourseId("PHO101: Quiz", ["Misc"]);
      expect(courseId).toBe("PHO101");
    });

    it("should fallback to first category if no match", () => {
      const courseId = extractCourseId("Random", ["MISC", "Other"]);
      expect(courseId).toBe("MISC");
    });

    it("should fallback to UNKNOWN if no categories or match", () => {
      const courseId = extractCourseId("Random", []);
      expect(courseId).toBe("UNKNOWN");
    });
  });

  describe("icsToSemester", () => {
    it("should convert ICS events to Semester", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      expect(semester.courses.length).toBeGreaterThan(0);
      expect(semester.courses.length).toBeLessThanOrEqual(6); // Max 6 courses
      expect(semester.startDate).toEqual(now);
    });

    it("should clean summary text (strip 'is due', 'closes', etc.)", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      const cv101 = semester.courses.find((c) => c.id === "CV101");
      const midterm = cv101?.items.find((i) => i.name.includes("Midterm"));
      
      expect(midterm?.name).toBe("CV101: Midterm Examination");
      expect(midterm?.name).not.toContain("is due");
    });

    it("should ignore 'opens' events when matching 'closes' exists", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      const dsa101 = semester.courses.find((c) => c.id === "DSA101");
      
      // Should only have the "closes" event, not the "opens" event
      expect(dsa101?.items.length).toBe(1);
      // The cleaned name should be "DSA101: Project Proposal" (without "closes")
      expect(dsa101?.items[0].name).toBe("DSA101: Project Proposal");
    });

    it("should drop events older than 60 days", () => {
      const oldEvent: ICSEvent = {
        uid: "old@test.com",
        summary: "Old Assignment",
        dtstart: new Date("2026-09-01T00:00:00Z"), // >60 days before 2026-11-26
        categories: ["TEST101"],
        description: "",
      };

      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester([oldEvent], now);

      expect(semester.courses.length).toBe(0);
    });

    it("should include events within 60 days", () => {
      const recentEvent: ICSEvent = {
        uid: "recent@test.com",
        summary: "Recent Assignment",
        dtstart: new Date("2026-11-20T00:00:00Z"), // Within 60 days
        categories: ["TEST101"],
        description: "",
      };

      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester([recentEvent], now);

      expect(semester.courses.length).toBe(1);
      expect(semester.courses[0].items.length).toBe(1);
    });

    it("should limit to max 6 courses (most events first)", () => {
      // Create 8 courses with varying event counts
      const events: ICSEvent[] = [];
      for (let i = 0; i < 8; i++) {
        const courseId = `COURSE${i}`;
        // Course 0 has 10 events, course 1 has 9, etc.
        const eventCount = 10 - i;
        for (let j = 0; j < eventCount; j++) {
          events.push({
            uid: `${courseId}-${j}@test.com`,
            summary: `${courseId}: Assignment ${j}`,
            dtstart: new Date("2026-12-01T00:00:00Z"),
            categories: [courseId],
            description: "",
          });
        }
      }

      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      expect(semester.courses.length).toBe(6);
      // Should be courses 0-5 (most events)
      expect(semester.courses[0].id).toBe("COURSE0");
      expect(semester.courses[5].id).toBe("COURSE5");
    });

    it("should assign palette colors in order", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      // Art direction palette colors
      const paletteColors = ["#5b8def", "#a274f0", "#e0874a", "#d9b54a", "#d85a8e", "#4fc29a"];

      for (let i = 0; i < semester.courses.length; i++) {
        expect(paletteColors).toContain(semester.courses[i].color);
      }
    });

    it("should use existing palette if provided", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const now = new Date("2026-11-26T00:00:00Z");
      const existingPalette = {
        CV101: "#ff0000",
        PHO101: "#00ff00",
      };
      const semester = icsToSemester(events, now, existingPalette);

      const cv101 = semester.courses.find((c) => c.id === "CV101");
      expect(cv101?.color).toBe("#ff0000");
    });

    it("should infer points from summary (percentage)", () => {
      const events: ICSEvent[] = [
        {
          uid: "test@test.com",
          summary: "Presentation (30%) is due",
          dtstart: new Date("2026-12-01T00:00:00Z"),
          categories: ["TEST101"],
          description: "",
        },
      ];

      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      expect(semester.courses[0].items[0].points).toBe(30);
    });

    it("should infer default points by type", () => {
      const events: ICSEvent[] = [
        {
          uid: "exam@test.com",
          summary: "Final Exam",
          dtstart: new Date("2026-12-01T00:00:00Z"),
          categories: ["TEST101"],
          description: "",
        },
        {
          uid: "quiz@test.com",
          summary: "Quiz 1",
          dtstart: new Date("2026-12-02T00:00:00Z"),
          categories: ["TEST101"],
          description: "",
        },
        {
          uid: "assignment@test.com",
          summary: "Assignment 1",
          dtstart: new Date("2026-12-03T00:00:00Z"),
          categories: ["TEST101"],
          description: "",
        },
      ];

      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      const items = semester.courses[0].items;
      const exam = items.find((i) => i.type === "exam");
      const quiz = items.find((i) => i.type === "quiz");
      const assignment = items.find((i) => i.type === "assignment");

      expect(exam?.points).toBe(100);
      expect(quiz?.points).toBe(20);
      expect(assignment?.points).toBe(20);
    });

    it("should set all grades to null (future items)", () => {
      const events = parseICS(SAMPLE_MOODLE_ICS);
      const now = new Date("2026-11-26T00:00:00Z");
      const semester = icsToSemester(events, now);

      for (const course of semester.courses) {
        for (const item of course.items) {
          expect(item.grade).toBeNull();
        }
      }
    });
  });

  describe("Property tests", () => {
    it("parseICS never throws on arbitrary strings", () => {
      fc.assert(
        fc.property(fc.string(), (arbitraryString) => {
          // Should not throw
          const events = parseICS(arbitraryString);
          expect(Array.isArray(events)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("parseICS always returns valid ICSEvent arrays", () => {
      fc.assert(
        fc.property(fc.string(), (arbitraryString) => {
          const events = parseICS(arbitraryString);
          
          for (const event of events) {
            expect(typeof event.uid).toBe("string");
            expect(typeof event.summary).toBe("string");
            expect(event.dtstart).toBeInstanceOf(Date);
            expect(Array.isArray(event.categories)).toBe(true);
            expect(typeof event.description).toBe("string");
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
