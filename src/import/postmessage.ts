/**
 * postMessage integration for embedded mode (Moodle block, LMS showcase).
 * Handles secure cross-origin communication with origin validation.
 */

import type { Semester, Course, CourseworkItem, ItemType } from '../core/types';

/**
 * Incoming event from postMessage (Moodle or showcase).
 */
export interface IncomingEvent {
  id: number | string;
  courseId: string;
  courseTitle: string;
  name: string;
  dueDate: string; // ISO 8601
  type: ItemType;
  points: number | null;
}

/**
 * Semester data message from parent (Moodle block or showcase).
 */
export interface SemesterMessage {
  type: 'gradedefense:semester';
  version: 1;
  events: IncomingEvent[];
}

/**
 * Ready signal sent by game to parent.
 */
export interface ReadyMessage {
  type: 'gradedefense:ready';
}

/**
 * Type guard for SemesterMessage.
 * Validates structure and rejects malformed or malicious payloads.
 */
export function isSemesterMessage(data: unknown): data is SemesterMessage {
  if (!data || typeof data !== 'object') return false;

  const msg = data as Record<string, unknown>;

  // Check type and version
  if (msg.type !== 'gradedefense:semester') return false;
  if (msg.version !== 1) return false;

  // Check events array
  if (!Array.isArray(msg.events)) return false;
  if (msg.events.length > 500) return false; // reject excessively large payloads

  // Validate each event
  for (const event of msg.events) {
    if (!event || typeof event !== 'object') return false;
    const e = event as Record<string, unknown>;

    // Required fields
    if (!(typeof e.id === 'number' || (typeof e.id === 'string' && e.id.length <= 100))) return false;
    if (typeof e.courseId !== 'string' || e.courseId.length > 200) return false;
    if (typeof e.courseTitle !== 'string' || e.courseTitle.length > 200) return false;
    if (typeof e.name !== 'string' || e.name.length > 200) return false;
    if (typeof e.dueDate !== 'string' || e.dueDate.length > 200) return false;
    if (typeof e.type !== 'string') return false;

    // Validate type enum
    const validTypes: ItemType[] = ['assignment', 'quiz', 'exam', 'project', 'presentation'];
    if (!validTypes.includes(e.type as ItemType)) return false;

    // Validate points (number or null)
    if (e.points !== null && typeof e.points !== 'number') return false;

    // Validate date format (ISO 8601)
    const date = new Date(e.dueDate as string);
    if (isNaN(date.getTime())) return false;
  }

  return true;
}

/**
 * Course color palette (from art-direction.md).
 * Colors are assigned in order: CV, PHO, MGT, DSA, MKT, MATH.
 */
const COURSE_COLORS = [
  '#5b8def', // CV
  '#a274f0', // PHO
  '#e0874a', // MGT
  '#d9b54a', // DSA
  '#d85a8e', // MKT
  '#4fc29a', // MATH
];

/**
 * Default points for items without grade book entries.
 */
const DEFAULT_POINTS: Record<ItemType, number> = {
  exam: 100,
  project: 100,
  presentation: 100,
  quiz: 20,
  assignment: 20,
};

/**
 * Convert incoming events to a Semester object.
 * Pure function: no side effects, deterministic output.
 *
 * @param events - Validated incoming events
 * @param now - Current time (for computing relative dates)
 * @returns Semester with max 6 courses (most events), colors assigned, points defaulted
 */
export function eventsToSemester(events: IncomingEvent[], now: Date): Semester {
  // Group events by courseId
  const courseMap = new Map<string, { title: string; events: IncomingEvent[] }>();

  for (const event of events) {
    if (!courseMap.has(event.courseId)) {
      courseMap.set(event.courseId, { title: event.courseTitle, events: [] });
    }
    courseMap.get(event.courseId)!.events.push(event);
  }

  // Sort courses by event count (descending), take top 6
  const sortedCourses = Array.from(courseMap.entries())
    .sort((a, b) => b[1].events.length - a[1].events.length)
    .slice(0, 6);

  // Convert to Course objects
  const courses: Course[] = sortedCourses.map(([courseId, data], index) => {
    const color = COURSE_COLORS[index % COURSE_COLORS.length];

    const items: CourseworkItem[] = data.events.map((event) => {
      const dueDate = new Date(event.dueDate);
      const points = event.points ?? DEFAULT_POINTS[event.type];

      return {
        id: `${courseId}-${event.id}`,
        courseId,
        name: event.name,
        type: event.type,
        dueDate,
        points,
        grade: null, // All imported events are future items (no grades yet)
      };
    });

    return {
      id: courseId,
      title: data.title,
      color,
      items,
    };
  });

  return {
    courses,
    startDate: now,
  };
}

/**
 * Build origin allowlist from referrer and env variable.
 *
 * @param referrer - document.referrer (parent origin)
 * @param envOrigins - Comma-separated origins from VITE_EMBED_ORIGINS
 * @returns Set of allowed origins
 */
export function buildOriginAllowlist(referrer: string, envOrigins?: string): Set<string> {
  const allowlist = new Set<string>();

  // Add referrer origin if available
  if (referrer) {
    try {
      const url = new URL(referrer);
      allowlist.add(url.origin);
    } catch {
      // Invalid URL, skip
    }
  }

  // Add configured origins from env
  if (envOrigins) {
    const origins = envOrigins.split(',').map((s) => s.trim());
    for (const origin of origins) {
      if (origin) {
        allowlist.add(origin);
      }
    }
  }

  return allowlist;
}

/**
 * Listen for embedded semester data via postMessage.
 * Validates origin and schema, calls onSemester on success.
 *
 * @param win - Window object (for testing)
 * @param onSemester - Callback when valid semester data received
 * @returns Unsubscribe function
 */
export function listenForEmbeddedSemester(
  win: Window,
  onSemester: (semester: Semester) => void
): () => void {
  // Check if embedded mode is enabled
  const params = new URLSearchParams(win.location.search);
  const embedMode = params.get('embed');
  if (embedMode !== 'moodle' && embedMode !== 'showcase') {
    // Not in embedded mode, don't listen
    return () => {};
  }

  // Build origin allowlist
  const envOrigins = import.meta.env.VITE_EMBED_ORIGINS as string | undefined;
  const allowlist = buildOriginAllowlist(win.document.referrer, envOrigins);

  // Post ready signal to parent (use '*' for ready ping since we don't know parent origin yet)
  const readyMessage: ReadyMessage = { type: 'gradedefense:ready' };
  win.parent.postMessage(readyMessage, '*');

  // Listen for semester data
  const handler = (event: MessageEvent) => {
    // Validate origin (unless allowlist is empty, which shouldn't happen but handle gracefully)
    // An empty allowlist means we cannot verify the sender: reject everything.
    if (!allowlist.has(event.origin)) {
      console.warn('[postmessage] Rejected message from untrusted origin:', event.origin);
      return;
    }

    // Validate message schema
    if (!isSemesterMessage(event.data)) {
      console.warn('[postmessage] Invalid semester message:', event.data);
      return;
    }

    // Convert and deliver
    try {
      const semester = eventsToSemester(event.data.events, new Date());
      console.log('[postmessage] Received valid semester data:', {
        courses: semester.courses.length,
        events: semester.courses.reduce((sum, c) => sum + c.items.length, 0),
      });
      onSemester(semester);
    } catch (error) {
      console.error('[postmessage] Failed to convert semester data:', error);
    }
  };

  win.addEventListener('message', handler);

  // Return unsubscribe function
  return () => {
    win.removeEventListener('message', handler);
  };
}
