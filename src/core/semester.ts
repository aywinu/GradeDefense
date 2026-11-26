/**
 * Semester resolution: convert demo data (relative offsets) to runtime semester (absolute dates).
 * Pure function with NO side effects.
 */

import type { DemoSemester, Semester, DemoCourse, Course, DemoCourseworkItem, CourseworkItem } from './types';

const MS_PER_DAY = 86400000;

/**
 * Convert a demo coursework item (with daysOffset) to a runtime item (with absolute dueDate).
 * @param item Demo item with daysOffset
 * @param now Current date/time
 * @returns Runtime item with absolute dueDate
 */
function resolveDemoItem(item: DemoCourseworkItem, now: Date): CourseworkItem {
  const dueDate = new Date(now.getTime() + item.daysOffset * MS_PER_DAY);
  
  return {
    id: item.id,
    courseId: item.courseId,
    name: item.name,
    type: item.type,
    dueDate,
    points: item.points,
    grade: item.grade
  };
}

/**
 * Convert a demo course to a runtime course.
 * @param demoCourse Demo course with items using daysOffset
 * @param now Current date/time
 * @returns Runtime course with items using absolute due dates
 */
function resolveDemoCourse(demoCourse: DemoCourse, now: Date): Course {
  return {
    id: demoCourse.id,
    title: demoCourse.title,
    color: demoCourse.color,
    items: demoCourse.items.map(item => resolveDemoItem(item, now))
  };
}

/**
 * Convert a demo semester (with relative day offsets) to a runtime semester (with absolute dates).
 * This is the main entry point called at game boot.
 * 
 * @param demo Demo semester data loaded from JSON
 * @param now Current date/time (typically Date.now())
 * @returns Semester with absolute due dates computed from offsets
 */
export function resolveSemester(demo: DemoSemester, now: Date): Semester {
  return {
    courses: demo.courses.map(course => resolveDemoCourse(course, now)),
    startDate: new Date(now) // snapshot the start date
  };
}
