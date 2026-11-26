/**
 * Tests for postMessage integration.
 * Unit tests for validation logic and property tests for conversion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  isSemesterMessage,
  eventsToSemester,
  buildOriginAllowlist,
  listenForEmbeddedSemester,
  type IncomingEvent,
  type SemesterMessage,
} from './postmessage';
import type { ItemType } from '../core/types';

describe('isSemesterMessage', () => {
  it('accepts valid message', () => {
    const validMessage: SemesterMessage = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: 'CS101',
          courseTitle: 'Computer Science',
          name: 'Assignment 1',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'assignment',
          points: 100,
        },
      ],
    };

    expect(isSemesterMessage(validMessage)).toBe(true);
  });

  it('rejects null', () => {
    expect(isSemesterMessage(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isSemesterMessage(undefined)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isSemesterMessage('string')).toBe(false);
    expect(isSemesterMessage(123)).toBe(false);
    expect(isSemesterMessage(true)).toBe(false);
  });

  it('rejects wrong type field', () => {
    const msg = {
      type: 'wrong',
      version: 1,
      events: [],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects wrong version', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 2,
      events: [],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects non-array events', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: 'not an array',
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects too many events (>500)', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: Array(501).fill({
        id: 1,
        courseId: 'CS',
        courseTitle: 'CS',
        name: 'A',
        dueDate: '2026-12-03T23:59:00Z',
        type: 'assignment',
        points: 10,
      }),
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects events with missing fields', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          // missing courseId
          courseTitle: 'CS',
          name: 'A',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'assignment',
          points: 10,
        },
      ],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects events with invalid types', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: 'CS',
          courseTitle: 'CS',
          name: 'A',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'invalid',
          points: 10,
        },
      ],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects events with overly long strings (>200 chars)', () => {
    const longString = 'a'.repeat(201);
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: longString,
          courseTitle: 'CS',
          name: 'A',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'assignment',
          points: 10,
        },
      ],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('rejects events with invalid date format', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: 'CS',
          courseTitle: 'CS',
          name: 'A',
          dueDate: 'not a date',
          type: 'assignment',
          points: 10,
        },
      ],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('accepts events with points: null', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: 'CS',
          courseTitle: 'CS',
          name: 'A',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'assignment',
          points: null,
        },
      ],
    };
    expect(isSemesterMessage(msg)).toBe(true);
  });

  it('rejects events with points: string', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: 'CS',
          courseTitle: 'CS',
          name: 'A',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'assignment',
          points: '100',
        },
      ],
    };
    expect(isSemesterMessage(msg)).toBe(false);
  });

  it('accepts empty events array', () => {
    const msg = {
      type: 'gradedefense:semester',
      version: 1,
      events: [],
    };
    expect(isSemesterMessage(msg)).toBe(true);
  });

  it('accepts all valid ItemType values', () => {
    const types: ItemType[] = ['assignment', 'quiz', 'exam', 'project', 'presentation'];
    for (const type of types) {
      const msg = {
        type: 'gradedefense:semester',
        version: 1,
        events: [
          {
            id: 1,
            courseId: 'CS',
            courseTitle: 'CS',
            name: 'A',
            dueDate: '2026-12-03T23:59:00Z',
            type,
            points: 10,
          },
        ],
      };
      expect(isSemesterMessage(msg)).toBe(true);
    }
  });
});

describe('eventsToSemester', () => {
  it('converts empty events to empty semester', () => {
    const result = eventsToSemester([], new Date('2026-11-26T00:00:00Z'));
    expect(result.courses).toHaveLength(0);
  });

  it('converts single event to single course with one item', () => {
    const events: IncomingEvent[] = [
      {
        id: 123,
        courseId: 'CS101',
        courseTitle: 'Computer Science',
        name: 'Assignment 1',
        dueDate: '2026-12-03T23:59:00Z',
        type: 'assignment',
        points: 100,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].id).toBe('CS101');
    expect(result.courses[0].title).toBe('Computer Science');
    expect(result.courses[0].items).toHaveLength(1);
    expect(result.courses[0].items[0].name).toBe('Assignment 1');
    expect(result.courses[0].items[0].type).toBe('assignment');
    expect(result.courses[0].items[0].points).toBe(100);
    expect(result.courses[0].items[0].grade).toBeNull();
  });

  it('groups events by courseId', () => {
    const events: IncomingEvent[] = [
      {
        id: 1,
        courseId: 'CS101',
        courseTitle: 'CS',
        name: 'A1',
        dueDate: '2026-12-01T00:00:00Z',
        type: 'assignment',
        points: 10,
      },
      {
        id: 2,
        courseId: 'CS101',
        courseTitle: 'CS',
        name: 'A2',
        dueDate: '2026-12-02T00:00:00Z',
        type: 'assignment',
        points: 20,
      },
      {
        id: 3,
        courseId: 'MATH101',
        courseTitle: 'Math',
        name: 'Quiz',
        dueDate: '2026-12-03T00:00:00Z',
        type: 'quiz',
        points: 5,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses).toHaveLength(2);

    const cs = result.courses.find((c) => c.id === 'CS101');
    expect(cs).toBeDefined();
    expect(cs!.items).toHaveLength(2);

    const math = result.courses.find((c) => c.id === 'MATH101');
    expect(math).toBeDefined();
    expect(math!.items).toHaveLength(1);
  });

  it('limits to 6 courses (most events)', () => {
    const events: IncomingEvent[] = [];
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10 - i; j++) {
        // Course 0 has 10 events, course 1 has 9, ..., course 9 has 1
        events.push({
          id: i * 100 + j,
          courseId: `C${i}`,
          courseTitle: `Course ${i}`,
          name: `Item ${j}`,
          dueDate: '2026-12-01T00:00:00Z',
          type: 'assignment',
          points: 10,
        });
      }
    }

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses).toHaveLength(6);

    // Top 6 courses should be C0 (10), C1 (9), C2 (8), C3 (7), C4 (6), C5 (5)
    expect(result.courses[0].id).toBe('C0');
    expect(result.courses[1].id).toBe('C1');
    expect(result.courses[2].id).toBe('C2');
    expect(result.courses[3].id).toBe('C3');
    expect(result.courses[4].id).toBe('C4');
    expect(result.courses[5].id).toBe('C5');
  });

  it('assigns colors from palette in order', () => {
    const events: IncomingEvent[] = [
      {
        id: 1,
        courseId: 'C1',
        courseTitle: 'C1',
        name: 'A',
        dueDate: '2026-12-01T00:00:00Z',
        type: 'assignment',
        points: 10,
      },
      {
        id: 2,
        courseId: 'C2',
        courseTitle: 'C2',
        name: 'A',
        dueDate: '2026-12-01T00:00:00Z',
        type: 'assignment',
        points: 10,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses).toHaveLength(2);

    // Colors should be assigned in order from COURSE_COLORS
    expect(result.courses[0].color).toBe('#5b8def'); // CV
    expect(result.courses[1].color).toBe('#a274f0'); // PHO
  });

  it('defaults points to 20 for assignment with null points', () => {
    const events: IncomingEvent[] = [
      {
        id: 1,
        courseId: 'CS',
        courseTitle: 'CS',
        name: 'A',
        dueDate: '2026-12-01T00:00:00Z',
        type: 'assignment',
        points: null,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses[0].items[0].points).toBe(20);
  });

  it('defaults points to 100 for exam with null points', () => {
    const events: IncomingEvent[] = [
      {
        id: 1,
        courseId: 'CS',
        courseTitle: 'CS',
        name: 'Exam',
        dueDate: '2026-12-01T00:00:00Z',
        type: 'exam',
        points: null,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses[0].items[0].points).toBe(100);
  });

  it('sets startDate to provided now', () => {
    const now = new Date('2026-11-26T12:34:56Z');
    const result = eventsToSemester([], now);
    expect(result.startDate).toEqual(now);
  });

  it('parses ISO 8601 dates correctly', () => {
    const events: IncomingEvent[] = [
      {
        id: 1,
        courseId: 'CS',
        courseTitle: 'CS',
        name: 'A',
        dueDate: '2026-12-03T23:59:00+08:00', // With timezone
        type: 'assignment',
        points: 10,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses[0].items[0].dueDate).toBeInstanceOf(Date);
    expect(result.courses[0].items[0].dueDate.getTime()).toBeGreaterThan(0);
  });

  it('sets grade to null for all imported events', () => {
    const events: IncomingEvent[] = [
      {
        id: 1,
        courseId: 'CS',
        courseTitle: 'CS',
        name: 'A',
        dueDate: '2026-12-01T00:00:00Z',
        type: 'assignment',
        points: 10,
      },
    ];

    const result = eventsToSemester(events, new Date('2026-11-26T00:00:00Z'));
    expect(result.courses[0].items[0].grade).toBeNull();
  });
});

describe('buildOriginAllowlist', () => {
  it('extracts origin from referrer', () => {
    const result = buildOriginAllowlist('https://moodle.example.com/course/view.php?id=1', '');
    expect(result.has('https://moodle.example.com')).toBe(true);
  });

  it('handles referrer without path', () => {
    const result = buildOriginAllowlist('https://moodle.example.com', '');
    expect(result.has('https://moodle.example.com')).toBe(true);
  });

  it('handles empty referrer', () => {
    const result = buildOriginAllowlist('', 'https://example.com');
    expect(result.has('https://example.com')).toBe(true);
  });

  it('parses comma-separated env origins', () => {
    const result = buildOriginAllowlist('', 'https://a.com,https://b.com,https://c.com');
    expect(result.has('https://a.com')).toBe(true);
    expect(result.has('https://b.com')).toBe(true);
    expect(result.has('https://c.com')).toBe(true);
  });

  it('trims whitespace from env origins', () => {
    const result = buildOriginAllowlist('', '  https://a.com  ,  https://b.com  ');
    expect(result.has('https://a.com')).toBe(true);
    expect(result.has('https://b.com')).toBe(true);
  });

  it('combines referrer and env origins', () => {
    const result = buildOriginAllowlist('https://moodle.com', 'https://showcase.com');
    expect(result.has('https://moodle.com')).toBe(true);
    expect(result.has('https://showcase.com')).toBe(true);
  });

  it('handles invalid referrer URL gracefully', () => {
    const result = buildOriginAllowlist('not a url', 'https://example.com');
    expect(result.has('https://example.com')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('ignores empty strings in env origins', () => {
    const result = buildOriginAllowlist('', 'https://a.com,,https://b.com,');
    expect(result.has('https://a.com')).toBe(true);
    expect(result.has('https://b.com')).toBe(true);
    expect(result.size).toBe(2);
  });
});

describe('listenForEmbeddedSemester', () => {
  let mockWindow: Partial<Window>;
  let postMessageSpy: ReturnType<typeof vi.fn>;
  let addEventListenerSpy: ReturnType<typeof vi.fn>;
  let removeEventListenerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    addEventListenerSpy = vi.fn();
    removeEventListenerSpy = vi.fn();

    mockWindow = {
      location: {
        search: '?embed=moodle',
      } as Location,
      document: {
        referrer: 'https://moodle.example.com/course/view.php',
      } as Document,
      parent: {
        postMessage: postMessageSpy,
      } as unknown as Window,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    };
  });

  it('posts ready signal to parent on init', () => {
    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'gradedefense:ready' },
      '*' // Uses '*' for ready ping
    );
  });

  it('adds message event listener', () => {
    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('returns unsubscribe function that removes listener', () => {
    const onSemester = vi.fn();
    const unsubscribe = listenForEmbeddedSemester(mockWindow as Window, onSemester);

    unsubscribe();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('does not listen if not in embedded mode', () => {
    mockWindow.location = { search: '' } as Location;

    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('calls onSemester when valid message from allowed origin received', () => {
    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    // Get the handler that was registered
    const handler = addEventListenerSpy.mock.calls[0][1];

    // Simulate valid message from referrer origin
    const validMessage: SemesterMessage = {
      type: 'gradedefense:semester',
      version: 1,
      events: [
        {
          id: 123,
          courseId: 'CS101',
          courseTitle: 'Computer Science',
          name: 'Assignment 1',
          dueDate: '2026-12-03T23:59:00Z',
          type: 'assignment',
          points: 100,
        },
      ],
    };

    const mockEvent = {
      origin: 'https://moodle.example.com',
      data: validMessage,
    };

    handler(mockEvent);

    expect(onSemester).toHaveBeenCalledOnce();
    expect(onSemester).toHaveBeenCalledWith(
      expect.objectContaining({
        courses: expect.arrayContaining([
          expect.objectContaining({
            id: 'CS101',
            title: 'Computer Science',
          }),
        ]),
      })
    );
  });

  it('rejects message from untrusted origin', () => {
    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    const handler = addEventListenerSpy.mock.calls[0][1];

    const validMessage: SemesterMessage = {
      type: 'gradedefense:semester',
      version: 1,
      events: [],
    };

    const mockEvent = {
      origin: 'https://evil.com',
      data: validMessage,
    };

    handler(mockEvent);

    expect(onSemester).not.toHaveBeenCalled();
  });

  it('rejects invalid message schema', () => {
    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    const handler = addEventListenerSpy.mock.calls[0][1];

    const invalidMessage = {
      type: 'wrong',
      version: 1,
      events: [],
    };

    const mockEvent = {
      origin: 'https://moodle.example.com',
      data: invalidMessage,
    };

    handler(mockEvent);

    expect(onSemester).not.toHaveBeenCalled();
  });

  it('works with showcase embed mode', () => {
    mockWindow.location = { search: '?embed=showcase' } as Location;

    const onSemester = vi.fn();
    listenForEmbeddedSemester(mockWindow as Window, onSemester);

    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'gradedefense:ready' }, '*');
  });
});

// Property-based tests
describe('property tests', () => {
  it('isSemesterMessage never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => isSemesterMessage(input)).not.toThrow();
      })
    );
  });

  it('valid payloads always produce ≤6 courses', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            courseId: fc.stringMatching(/^[A-Z]{2,4}\d{3}$/), // e.g., CS101
            courseTitle: fc.string({ minLength: 1, maxLength: 100 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            dueDate: fc
              .integer({ min: Date.parse('2026-01-01'), max: Date.parse('2027-12-31') })
              .map((ts) => new Date(ts).toISOString()),
            type: fc.constantFrom('assignment', 'quiz', 'exam', 'project', 'presentation'),
            points: fc.oneof(fc.integer({ min: 1, max: 200 }), fc.constant(null)),
          }),
          { maxLength: 100 }
        ),
        (events) => {
          const semester = eventsToSemester(events, new Date());
          expect(semester.courses.length).toBeLessThanOrEqual(6);
        }
      )
    );
  });

  it('all items have non-null points (defaulted if null)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            courseId: fc.stringMatching(/^[A-Z]{2,4}\d{3}$/),
            courseTitle: fc.string({ minLength: 1, maxLength: 100 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            dueDate: fc
              .integer({ min: Date.parse('2026-01-01'), max: Date.parse('2027-12-31') })
              .map((ts) => new Date(ts).toISOString()),
            type: fc.constantFrom('assignment', 'quiz', 'exam', 'project', 'presentation'),
            points: fc.oneof(fc.integer({ min: 1, max: 200 }), fc.constant(null)),
          }),
          { maxLength: 100 }
        ),
        (events) => {
          const semester = eventsToSemester(events, new Date());
          for (const course of semester.courses) {
            for (const item of course.items) {
              expect(item.points).toBeGreaterThan(0);
            }
          }
        }
      )
    );
  });

  it('all items have grade: null', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            courseId: fc.stringMatching(/^[A-Z]{2,4}\d{3}$/),
            courseTitle: fc.string({ minLength: 1, maxLength: 100 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            dueDate: fc
              .integer({ min: Date.parse('2026-01-01'), max: Date.parse('2027-12-31') })
              .map((ts) => new Date(ts).toISOString()),
            type: fc.constantFrom('assignment', 'quiz', 'exam', 'project', 'presentation'),
            points: fc.oneof(fc.integer({ min: 1, max: 200 }), fc.constant(null)),
          }),
          { maxLength: 100 }
        ),
        (events) => {
          const semester = eventsToSemester(events, new Date());
          for (const course of semester.courses) {
            for (const item of course.items) {
              expect(item.grade).toBeNull();
            }
          }
        }
      )
    );
  });

  it('courses are ordered by event count (descending)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            courseId: fc.stringMatching(/^[A-Z]{2,4}\d{3}$/),
            courseTitle: fc.string({ minLength: 1, maxLength: 100 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            dueDate: fc
              .integer({ min: Date.parse('2026-01-01'), max: Date.parse('2027-12-31') })
              .map((ts) => new Date(ts).toISOString()),
            type: fc.constantFrom('assignment', 'quiz', 'exam', 'project', 'presentation'),
            points: fc.oneof(fc.integer({ min: 1, max: 200 }), fc.constant(null)),
          }),
          { maxLength: 100 }
        ),
        (events) => {
          const semester = eventsToSemester(events, new Date());
          for (let i = 1; i < semester.courses.length; i++) {
            expect(semester.courses[i - 1].items.length).toBeGreaterThanOrEqual(
              semester.courses[i].items.length
            );
          }
        }
      )
    );
  });
});
