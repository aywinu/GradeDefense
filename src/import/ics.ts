/**
 * ICS (iCalendar) parser for Moodle calendar exports.
 * RFC 5545 subset: VEVENT parsing with SUMMARY, DTSTART/DTEND/DUE, CATEGORIES, DESCRIPTION, UID.
 * No dependencies (ical.js NOT used per task constraints).
 */

import type { Semester, Course, CourseworkItem, ItemType } from "../core/types";

export interface ICSEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend?: Date;
  due?: Date;
  categories: string[];
  description: string;
}

/**
 * Unfold folded lines (CRLF + space/tab → continuation).
 * RFC 5545 §3.1: Lines are limited to 75 octets and can be folded.
 */
function unfoldLines(icsText: string): string {
  // Replace CRLF followed by space or tab with nothing (unfold)
  return icsText.replace(/\r?\n[ \t]/g, "");
}

/**
 * Unescape text values: \\n → newline, \\\\ → \, \; → semicolon, \, → comma
 * RFC 5545 §3.3.11
 */
function unescapeText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\"); // Must be last to avoid double-unescaping
}

/**
 * Parse a date/time value from ICS.
 * Supports:
 * - UTC: 20261130T235900Z
 * - Local: 20261130T235900 (treat as local)
 * - Date-only: VALUE=DATE:20261130
 * - TZID: DTSTART;TZID=America/New_York:20261130T235900 (treat as local, ignore TZID)
 */
function parseDateTime(value: string): Date {
  // Strip TZID parameter if present (we treat as local)
  const dateValue = value.split(":").pop() || value;

  // Date-only format: 20261130 (8 digits)
  if (/^\d{8}$/.test(dateValue)) {
    const year = parseInt(dateValue.substring(0, 4), 10);
    const month = parseInt(dateValue.substring(4, 6), 10) - 1; // 0-indexed
    const day = parseInt(dateValue.substring(6, 8), 10);
    return new Date(year, month, day, 23, 59, 0); // End of day for deadlines
  }

  // DateTime format: 20261130T235900 or 20261130T235900Z
  const isUTC = dateValue.endsWith("Z");
  const cleanValue = dateValue.replace("Z", "");

  if (/^\d{8}T\d{6}$/.test(cleanValue)) {
    const year = parseInt(cleanValue.substring(0, 4), 10);
    const month = parseInt(cleanValue.substring(4, 6), 10) - 1;
    const day = parseInt(cleanValue.substring(6, 8), 10);
    const hour = parseInt(cleanValue.substring(9, 11), 10);
    const minute = parseInt(cleanValue.substring(11, 13), 10);
    const second = parseInt(cleanValue.substring(13, 15), 10);

    if (isUTC) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      return new Date(year, month, day, hour, minute, second);
    }
  }

  // Fallback: try native Date parsing
  return new Date(dateValue);
}

/**
 * Parse ICS text into ICSEvent objects.
 * Extracts VEVENT blocks and reads SUMMARY, DTSTART, DTEND, DUE, CATEGORIES, DESCRIPTION, UID.
 */
export function parseICS(icsText: string): ICSEvent[] {
  try {
    const unfolded = unfoldLines(icsText);
    const lines = unfolded.split(/\r?\n/);

    const events: ICSEvent[] = [];
    let currentEvent: Partial<ICSEvent> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "BEGIN:VEVENT") {
        currentEvent = {
          uid: "",
          summary: "",
          categories: [],
          description: "",
        };
      } else if (trimmed === "END:VEVENT") {
        if (currentEvent && currentEvent.uid && currentEvent.summary && (currentEvent.dtstart || currentEvent.due)) {
          // If no dtstart but has due, use due as dtstart
          if (!currentEvent.dtstart && currentEvent.due) {
            currentEvent.dtstart = currentEvent.due;
          }
          events.push(currentEvent as ICSEvent);
        }
        currentEvent = null;
      } else if (currentEvent) {
        // Parse property:value pairs
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex === -1) continue;

        const propPart = trimmed.substring(0, colonIndex);
        const valuePart = trimmed.substring(colonIndex + 1);

        // Property name is before semicolon (parameters)
        const propName = propPart.split(";")[0];

        if (propName === "SUMMARY") {
          currentEvent.summary = unescapeText(valuePart);
        } else if (propName === "UID") {
          currentEvent.uid = valuePart;
        } else if (propName === "DESCRIPTION") {
          currentEvent.description = unescapeText(valuePart);
        } else if (propName === "DTSTART") {
          currentEvent.dtstart = parseDateTime(valuePart);
        } else if (propName === "DTEND") {
          currentEvent.dtend = parseDateTime(valuePart);
        } else if (propName === "DUE") {
          currentEvent.due = parseDateTime(valuePart);
        } else if (propName === "CATEGORIES") {
          // Categories can be comma-separated
          currentEvent.categories = valuePart.split(",").map((c) => c.trim());
        }
      }
    }

    return events;
  } catch (error) {
    // Never throw on arbitrary input (per task spec)
    console.error("ICS parsing error:", error);
    return [];
  }
}

/**
 * Infer item type from summary text.
 * exam/midterm/final → exam
 * quiz/test → quiz
 * project/proposal/presentation/pitch → project or presentation
 * everything else → assignment
 */
export function inferItemType(summary: string): ItemType {
  const lower = summary.toLowerCase();

  // Check presentation/pitch first (more specific)
  if (/\b(presentation|pitch)\b/.test(lower)) {
    return "presentation";
  }
  // Check project/proposal
  if (/\b(project|proposal)\b/.test(lower)) {
    return "project";
  }
  // Check exam/midterm/final (but not if it's a presentation/project final)
  if (/\b(exam|midterm)\b/.test(lower)) {
    return "exam";
  }
  if (/\bfinal\b/.test(lower) && !/\b(presentation|project|pitch)\b/.test(lower)) {
    return "exam";
  }
  // Check quiz/test
  if (/\b(quiz|test)\b/.test(lower)) {
    return "quiz";
  }

  return "assignment";
}

/**
 * Extract course ID from summary or categories.
 * Moodle puts course short name in CATEGORIES (e.g., "CV101").
 * If not in categories, try to extract from summary (e.g., "CV101: Assignment").
 */
export function extractCourseId(summary: string, categories: string[]): string {
  // Check categories first (Moodle standard)
  if (categories.length > 0) {
    const coursePattern = /^[A-Z]{2,5}\d{3}$/; // CV101, PHO101, etc.
    for (const cat of categories) {
      if (coursePattern.test(cat)) {
        return cat;
      }
    }
  }

  // Try to extract from summary (e.g., "CV101: Midterm")
  const match = summary.match(/\b([A-Z]{2,5}\d{3})\b/);
  if (match) {
    return match[1];
  }

  // Fallback: use first category or "UNKNOWN"
  return categories[0] || "UNKNOWN";
}

/**
 * Clean up Moodle summary text.
 * Strip trailing "is due", "closes", "opens", "should be completed".
 */
function cleanSummary(summary: string): string {
  return summary
    .replace(/\s+(is due|closes|opens|should be completed)$/i, "")
    .trim();
}

/**
 * Infer points (weight) from summary.
 * Look for patterns like "(30%)" → 30 points.
 * Otherwise, use default: exam/project/presentation = 100, quiz = 20, assignment = 20.
 */
function inferPoints(summary: string, type: ItemType): number {
  const percentMatch = summary.match(/\((\d+)%\)/);
  if (percentMatch) {
    return parseInt(percentMatch[1], 10);
  }

  // Defaults based on type
  if (type === "exam" || type === "project" || type === "presentation") {
    return 100;
  }
  if (type === "quiz") {
    return 20;
  }
  return 20; // assignment default
}

/**
 * Convert ICS events to a Semester.
 * - Filters out events older than 60 days.
 * - Ignores "opens" events if a matching close/due event exists.
 * - Groups by course ID (max 6 courses, most events first).
 * - Assigns colors from art-direction palette in order.
 * - Infers points from summary or type.
 * - Sets grade to null (future items).
 */
export function icsToSemester(
  events: ICSEvent[],
  now: Date,
  existingPalette?: Record<string, string>
): Semester {
  const cutoffDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

  // Filter out old events
  const recentEvents = events.filter((event) => {
    const eventDate = event.due || event.dtend || event.dtstart;
    return eventDate >= cutoffDate;
  });

  // Filter out "opens" events if a matching close/due exists
  const opensSummaries = new Map<string, string>(); // base summary → original summary
  const closesSummaries = new Set<string>(); // base summaries that have close/due

  for (const event of recentEvents) {
    if (/\bopens\b/i.test(event.summary)) {
      // Store the base summary (without "opens")
      const baseSummary = event.summary.replace(/\s+opens$/i, "").trim();
      opensSummaries.set(baseSummary, event.summary);
    } else if (/\b(closes|is due|due)\b/i.test(event.summary)) {
      // Store the base summary (without "closes", "is due", etc.)
      const baseSummary = event.summary
        .replace(/\s+(is due|closes|due|should be completed)$/i, "")
        .trim();
      closesSummaries.add(baseSummary);
    }
  }

  const filteredEvents = recentEvents.filter((event) => {
    // Ignore opens events if a matching close/due exists
    if (/\bopens\b/i.test(event.summary)) {
      const baseSummary = event.summary.replace(/\s+opens$/i, "").trim();
      return !closesSummaries.has(baseSummary);
    }
    return true;
  });

  // Group by course ID and count events
  const courseEventCounts = new Map<string, ICSEvent[]>();
  for (const event of filteredEvents) {
    const courseId = extractCourseId(event.summary, event.categories);
    if (!courseEventCounts.has(courseId)) {
      courseEventCounts.set(courseId, []);
    }
    courseEventCounts.get(courseId)!.push(event);
  }

  // Sort courses by event count (most events first), take top 6
  const sortedCourses = Array.from(courseEventCounts.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  // Art direction palette colors (CV, PHO, MGT, DSA, MKT, MATH)
  const paletteColors = ["#5b8def", "#a274f0", "#e0874a", "#d9b54a", "#d85a8e", "#4fc29a"];

  const courses: Course[] = sortedCourses.map(([courseId, courseEvents], index) => {
    const color = existingPalette?.[courseId] || paletteColors[index] || "#2b2440";

    const items: CourseworkItem[] = courseEvents.map((event) => {
      const cleanedSummary = cleanSummary(event.summary);
      const type = inferItemType(cleanedSummary);
      const dueDate = event.due || event.dtend || event.dtstart;
      const points = inferPoints(event.summary, type);

      return {
        id: event.uid,
        courseId,
        name: cleanedSummary,
        type,
        dueDate,
        points,
        grade: null, // future item
      };
    });

    return {
      id: courseId,
      title: courseId, // Use course ID as title (can be customized later)
      color,
      items,
    };
  });

  return {
    courses,
    startDate: now,
  };
}
