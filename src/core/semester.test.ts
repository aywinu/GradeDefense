/**
 * Tests for semester resolution.
 * Verifies that demo data (relative offsets) correctly converts to runtime data (absolute dates).
 */

import { describe, it, expect } from 'vitest';
import { resolveSemester } from './semester';
import type { DemoSemester } from './types';
import demoData from '../data/demo.json';

const MS_PER_DAY = 86400000;

describe('resolveSemester', () => {
  describe('basic date resolution', () => {
    it('should convert positive offset to future date', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'TEST101',
          title: 'Test Course',
          color: '#ff0000',
          items: [{
            id: 'test-1',
            courseId: 'TEST101',
            name: 'Future Assignment',
            daysOffset: 7,
            points: 100,
            grade: null,
            type: 'assignment'
          }]
        }]
      };

      const semester = resolveSemester(demo, now);
      
      expect(semester.courses).toHaveLength(1);
      expect(semester.courses[0].items).toHaveLength(1);
      
      const item = semester.courses[0].items[0];
      const expectedDate = new Date(now.getTime() + 7 * MS_PER_DAY);
      
      expect(item.dueDate.getTime()).toBe(expectedDate.getTime());
      expect(item.name).toBe('Future Assignment');
      expect(item.type).toBe('assignment');
    });

    it('should convert negative offset to past date', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'TEST101',
          title: 'Test Course',
          color: '#ff0000',
          items: [{
            id: 'test-1',
            courseId: 'TEST101',
            name: 'Past Assignment',
            daysOffset: -14,
            points: 50,
            grade: 85,
            type: 'assignment'
          }]
        }]
      };

      const semester = resolveSemester(demo, now);
      
      const item = semester.courses[0].items[0];
      const expectedDate = new Date(now.getTime() - 14 * MS_PER_DAY);
      
      expect(item.dueDate.getTime()).toBe(expectedDate.getTime());
      expect(item.grade).toBe(85);
    });

    it('should convert zero offset to today', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'TEST101',
          title: 'Test Course',
          color: '#ff0000',
          items: [{
            id: 'test-1',
            courseId: 'TEST101',
            name: 'Today Assignment',
            daysOffset: 0,
            points: 20,
            grade: null,
            type: 'quiz'
          }]
        }]
      };

      const semester = resolveSemester(demo, now);
      
      const item = semester.courses[0].items[0];
      expect(item.dueDate.getTime()).toBe(now.getTime());
    });
  });

  describe('data preservation', () => {
    it('should preserve all item properties', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'CV101',
          title: 'Computer Vision',
          color: '#5b8def',
          items: [{
            id: 'cv-exam',
            courseId: 'CV101',
            name: 'Midterm Examination',
            daysOffset: 4,
            points: 100,
            grade: null,
            type: 'exam'
          }]
        }]
      };

      const semester = resolveSemester(demo, now);
      const item = semester.courses[0].items[0];
      
      expect(item.id).toBe('cv-exam');
      expect(item.courseId).toBe('CV101');
      expect(item.name).toBe('Midterm Examination');
      expect(item.points).toBe(100);
      expect(item.grade).toBeNull();
      expect(item.type).toBe('exam');
    });

    it('should preserve course properties', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'PHO101',
          title: 'Photonics',
          color: '#a274f0',
          items: []
        }]
      };

      const semester = resolveSemester(demo, now);
      const course = semester.courses[0];
      
      expect(course.id).toBe('PHO101');
      expect(course.title).toBe('Photonics');
      expect(course.color).toBe('#a274f0');
    });

    it('should snapshot the start date', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: []
      };

      const semester = resolveSemester(demo, now);
      
      expect(semester.startDate.getTime()).toBe(now.getTime());
      
      // Modifying the original now should not affect the semester's startDate
      now.setTime(now.getTime() + 1000);
      expect(semester.startDate.getTime()).not.toBe(now.getTime());
    });
  });

  describe('multiple courses and items', () => {
    it('should handle multiple courses with multiple items', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [
          {
            id: 'CV101',
            title: 'Computer Vision',
            color: '#5b8def',
            items: [
              {
                id: 'cv-1',
                courseId: 'CV101',
                name: 'Lab 1',
                daysOffset: -7,
                points: 10,
                grade: 90,
                type: 'assignment'
              },
              {
                id: 'cv-2',
                courseId: 'CV101',
                name: 'Lab 2',
                daysOffset: 7,
                points: 10,
                grade: null,
                type: 'assignment'
              }
            ]
          },
          {
            id: 'PHO101',
            title: 'Photonics',
            color: '#a274f0',
            items: [
              {
                id: 'pho-1',
                courseId: 'PHO101',
                name: 'Quiz',
                daysOffset: 3,
                points: 20,
                grade: null,
                type: 'quiz'
              }
            ]
          }
        ]
      };

      const semester = resolveSemester(demo, now);
      
      expect(semester.courses).toHaveLength(2);
      expect(semester.courses[0].items).toHaveLength(2);
      expect(semester.courses[1].items).toHaveLength(1);
      
      // Verify first course items
      expect(semester.courses[0].items[0].dueDate.getTime()).toBe(now.getTime() - 7 * MS_PER_DAY);
      expect(semester.courses[0].items[1].dueDate.getTime()).toBe(now.getTime() + 7 * MS_PER_DAY);
      
      // Verify second course item
      expect(semester.courses[1].items[0].dueDate.getTime()).toBe(now.getTime() + 3 * MS_PER_DAY);
    });
  });

  describe('demo.json validation', () => {
    it('should load demo.json successfully', () => {
      expect(demoData).toBeDefined();
      expect(demoData.courses).toBeDefined();
      expect(Array.isArray(demoData.courses)).toBe(true);
    });

    it('should have exactly 6 courses', () => {
      expect(demoData.courses).toHaveLength(6);
    });

    it('should have correct course IDs', () => {
      const courseIds = demoData.courses.map(c => c.id);
      expect(courseIds).toContain('CV101');
      expect(courseIds).toContain('PHO101');
      expect(courseIds).toContain('MGT101');
      expect(courseIds).toContain('DSA101');
      expect(courseIds).toContain('MKT101');
      expect(courseIds).toContain('MATH101');
    });

    it('should have at least 30 total items', () => {
      const totalItems = demoData.courses.reduce((sum, course) => sum + course.items.length, 0);
      expect(totalItems).toBeGreaterThanOrEqual(30);
    });

    it('should have correct course colors from art direction', () => {
      const colorMap: Record<string, string> = {
        'CV101': '#5b8def',
        'PHO101': '#a274f0',
        'MGT101': '#e0874a',
        'DSA101': '#d9b54a',
        'MKT101': '#d85a8e',
        'MATH101': '#4fc29a'
      };

      for (const course of demoData.courses) {
        expect(course.color).toBe(colorMap[course.id]);
      }
    });

    it('should have valid item types', () => {
      const validTypes = ['assignment', 'quiz', 'exam', 'project', 'presentation'];
      
      for (const course of demoData.courses) {
        for (const item of course.items) {
          expect(validTypes).toContain(item.type);
        }
      }
    });

    it('should have items with daysOffset (not dueDate)', () => {
      for (const course of demoData.courses) {
        for (const item of course.items) {
          expect(item).toHaveProperty('daysOffset');
          expect(typeof item.daysOffset).toBe('number');
          // Should NOT have dueDate (that's for runtime)
          expect(item).not.toHaveProperty('dueDate');
        }
      }
    });

    it('should have valid points and grades', () => {
      for (const course of demoData.courses) {
        for (const item of course.items) {
          expect(typeof item.points).toBe('number');
          expect(item.points).toBeGreaterThan(0);
          
          if (item.grade !== null) {
            expect(typeof item.grade).toBe('number');
            expect(item.grade).toBeGreaterThanOrEqual(0);
            expect(item.grade).toBeLessThanOrEqual(100);
          }
        }
      }
    });

    it('should resolve demo.json to valid semester', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const semester = resolveSemester(demoData as DemoSemester, now);
      
      expect(semester.courses).toHaveLength(6);
      expect(semester.startDate.getTime()).toBe(now.getTime());
      
      // All items should have valid Date objects
      for (const course of semester.courses) {
        for (const item of course.items) {
          expect(item.dueDate).toBeInstanceOf(Date);
          expect(!isNaN(item.dueDate.getTime())).toBe(true);
        }
      }
    });

    it('should have both past (graded) and future (ungraded) items', () => {
      const pastItems = demoData.courses.flatMap(c => 
        c.items.filter(i => i.daysOffset < 0 && i.grade !== null)
      );
      const futureItems = demoData.courses.flatMap(c => 
        c.items.filter(i => i.daysOffset >= 0 && i.grade === null)
      );
      
      expect(pastItems.length).toBeGreaterThan(0);
      expect(futureItems.length).toBeGreaterThan(0);
    });

    it('should have items spread across time range', () => {
      const allOffsets = demoData.courses.flatMap(c => c.items.map(i => i.daysOffset));
      
      const minOffset = Math.min(...allOffsets);
      const maxOffset = Math.max(...allOffsets);
      
      expect(minOffset).toBeLessThan(-5); // at least 5 days in the past
      expect(maxOffset).toBeGreaterThan(5); // at least 5 days in the future
    });

    it('should have unique item IDs', () => {
      const allIds = demoData.courses.flatMap(c => c.items.map(i => i.id));
      const uniqueIds = new Set(allIds);
      
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('should have items with matching courseId', () => {
      for (const course of demoData.courses) {
        for (const item of course.items) {
          expect(item.courseId).toBe(course.id);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty courses array', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: []
      };

      const semester = resolveSemester(demo, now);
      
      expect(semester.courses).toHaveLength(0);
      expect(semester.startDate.getTime()).toBe(now.getTime());
    });

    it('should handle course with no items', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'EMPTY101',
          title: 'Empty Course',
          color: '#000000',
          items: []
        }]
      };

      const semester = resolveSemester(demo, now);
      
      expect(semester.courses).toHaveLength(1);
      expect(semester.courses[0].items).toHaveLength(0);
    });

    it('should handle large positive offset', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'TEST101',
          title: 'Test Course',
          color: '#ff0000',
          items: [{
            id: 'test-1',
            courseId: 'TEST101',
            name: 'Far Future',
            daysOffset: 365,
            points: 100,
            grade: null,
            type: 'assignment'
          }]
        }]
      };

      const semester = resolveSemester(demo, now);
      const item = semester.courses[0].items[0];
      const expectedDate = new Date(now.getTime() + 365 * MS_PER_DAY);
      
      expect(item.dueDate.getTime()).toBe(expectedDate.getTime());
    });

    it('should handle large negative offset', () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      const demo: DemoSemester = {
        courses: [{
          id: 'TEST101',
          title: 'Test Course',
          color: '#ff0000',
          items: [{
            id: 'test-1',
            courseId: 'TEST101',
            name: 'Far Past',
            daysOffset: -365,
            points: 100,
            grade: 100,
            type: 'assignment'
          }]
        }]
      };

      const semester = resolveSemester(demo, now);
      const item = semester.courses[0].items[0];
      const expectedDate = new Date(now.getTime() - 365 * MS_PER_DAY);
      
      expect(item.dueDate.getTime()).toBe(expectedDate.getTime());
    });
  });
});
