# Moodle Integration

This document describes the postMessage-based communication contract between the Moodle block plugin and the Grade Defense game.

## Overview

The Grade Defense Moodle block (`block_gradedefense`) embeds the game as an iframe and synchronizes upcoming calendar events (assignments, quizzes, exams, projects) from the user's Moodle courses. Communication uses the HTML5 postMessage API for secure cross-origin messaging.

## Communication Flow

```
┌─────────────┐                              ┌──────────────┐
│   Moodle    │                              │     Game     │
│   Block     │                              │   (iframe)   │
└──────┬──────┘                              └──────┬───────┘
       │                                            │
       │  1. Embed iframe with ?embed=moodle       │
       │───────────────────────────────────────────>│
       │                                            │
       │  2. { type: 'gradedefense:ready' }        │
       │<───────────────────────────────────────────│
       │                                            │
       │  3. { type: 'gradedefense:semester', ... }│
       │───────────────────────────────────────────>│
       │                                            │
       │  Game replaces demo data with Moodle data │
       │                                            │
```

### Step 1: Embed the Game

The Moodle block embeds the game with an `embed=moodle` query parameter:

```html
<iframe src="https://example.com/GradeDefense/?embed=moodle"></iframe>
```

### Step 2: Ready Signal

After the game loads, it signals readiness by posting a message to `window.parent`:

```javascript
window.parent.postMessage(
  {
    type: 'gradedefense:ready'
  },
  '*' // The game doesn't know the parent origin yet
);
```

### Step 3: Semester Data

The Moodle block listens for the ready signal. When received, it validates the message origin and responds with semester data:

```javascript
iframe.contentWindow.postMessage(
  {
    type: 'gradedefense:semester',
    version: 1,
    events: [ /* ... */ ]
  },
  'https://example.com' // Game origin from configured URL
);
```

## Message Schemas

### Game → Moodle: Ready Signal

**Message:**
```json
{
  "type": "gradedefense:ready"
}
```

**Fields:**
- `type` (string, required): Always `"gradedefense:ready"`

**Purpose:** Signals that the game iframe has loaded and is ready to receive semester data.

---

### Moodle → Game: Semester Data

**Message:**
```json
{
  "type": "gradedefense:semester",
  "version": 1,
  "events": [
    {
      "id": 12345,
      "courseId": "CS101",
      "courseTitle": "Introduction to Computer Science",
      "name": "Assignment 1: Hello World",
      "dueDate": "2026-12-03T23:59:00+00:00",
      "type": "assignment",
      "points": 100
    },
    {
      "id": 12346,
      "courseId": "CS101",
      "courseTitle": "Introduction to Computer Science",
      "name": "Midterm Examination",
      "dueDate": "2026-12-10T14:00:00+00:00",
      "type": "exam",
      "points": 200
    },
    {
      "id": 12347,
      "courseId": "MATH101",
      "courseTitle": "Linear Algebra",
      "name": "Quiz 3",
      "dueDate": "2026-12-01T10:00:00+00:00",
      "type": "quiz",
      "points": 50
    }
  ]
}
```

**Fields:**

- `type` (string, required): Always `"gradedefense:semester"`
- `version` (number, required): Protocol version, currently `1`
- `events` (array, required): Array of event objects

**Event Object:**

- `id` (number, required): Moodle calendar event ID
- `courseId` (string, required): Course short name (e.g., `"CS101"`, `"MATH101"`)
- `courseTitle` (string, required): Course full name (e.g., `"Introduction to Computer Science"`)
- `name` (string, required): Event name (cleaned with `format_string`, no HTML)
- `dueDate` (string, required): Due date in ISO 8601 format with timezone (e.g., `"2026-12-03T23:59:00+00:00"`)
- `type` (string, required): Event type, one of:
  - `"assignment"`: Regular assignment or activity
  - `"quiz"`: Quiz or test
  - `"exam"`: Exam (detected from name: "exam", "midterm", "final")
  - `"project"`: Project or proposal
  - `"presentation"`: Presentation
- `points` (number | null, required): Maximum grade/points for the event, or `null` if not available

**Purpose:** Provides the game with upcoming coursework from Moodle. The game will replace its demo data with this real data.

---

## Type Inference

The Moodle block infers the `type` field using the following rules:

1. If `modulename` is `"quiz"`, type is `"quiz"`
2. If event name contains "exam", "midterm", or "final" (case-insensitive), type is `"exam"`
3. If event name contains "project" or "proposal", type is `"project"`
4. If event name contains "presentation" or "present", type is `"presentation"`
5. Otherwise, type is `"assignment"` (default)

## Grade/Points Extraction

The block attempts to fetch the maximum grade for each event from Moodle's grade book:

```php
$gradeitem = grade_item::fetch(array(
    'itemtype' => 'mod',
    'itemmodule' => $modulename,
    'iteminstance' => $instanceid,
    'courseid' => $courseid
));

$points = $gradeitem ? $gradeitem->grademax : null;
```

If the grade is unavailable (e.g., no grade book entry), `points` is set to `null`.

## Security Considerations

### Origin Validation

**Moodle Block (sender):**
- Extracts the origin (protocol + host + port) from the configured Game URL
- Only sends messages to that specific origin (never `'*'`)
- Example: If Game URL is `https://example.com/GradeDefense/`, the target origin is `https://example.com`

**Game (receiver):**
- Validates the origin of incoming messages
- Maintains an allowlist of trusted Moodle domains (configurable, defaults to common patterns)
- Rejects messages from untrusted origins
- Example validation:
  ```javascript
  window.addEventListener('message', (event) => {
    const trustedOrigins = [
      'https://moodle.example.edu',
      'https://learn.university.com'
      // ... configurable list
    ];
    
    if (!trustedOrigins.includes(event.origin)) {
      console.warn('Rejected message from untrusted origin:', event.origin);
      return;
    }
    
    // Process message
  });
  ```

### Data Privacy

**What is transmitted:**
- Event metadata: names, due dates, points
- Course names (short and full names)
- Event IDs (internal Moodle IDs, not sensitive)

**What is NOT transmitted:**
- User passwords or session tokens
- Email addresses
- Student IDs or personal identifiable information (PII)
- Actual grades or scores (only maximum possible grades for weighting)
- User profile data

**Server-side collection:**
- All Moodle API calls are server-side (PHP)
- No client-side JavaScript accesses Moodle APIs
- No CORS requests from the game to Moodle servers

### Content Sanitization

All event data is sanitized before transmission:

- Event names and course titles use Moodle's `format_string()` to remove HTML and scripts
- Dates are formatted as ISO 8601 strings (no raw timestamps)
- All data is JSON-encoded (automatic escaping)

### No Authentication Tokens

The postMessage payload contains only coursework metadata. The game operates independently and does not need (and must not receive) Moodle session tokens, cookies, or authentication credentials.

## Error Handling

### Game (Receiver)

If the game receives a malformed or invalid message:

1. Log the error to the browser console (developer mode only)
2. Fall back to demo data
3. Display a user-friendly message: "Could not sync with Moodle. Using demo data."
4. Continue gameplay without crashing

**Example validation:**

```typescript
interface SemesterMessage {
  type: 'gradedefense:semester';
  version: number;
  events: Array<{
    id: number;
    courseId: string;
    courseTitle: string;
    name: string;
    dueDate: string;
    type: 'assignment' | 'quiz' | 'exam' | 'project' | 'presentation';
    points: number | null;
  }>;
}

function isSemesterMessage(data: any): data is SemesterMessage {
  return (
    data &&
    data.type === 'gradedefense:semester' &&
    typeof data.version === 'number' &&
    Array.isArray(data.events)
  );
}

window.addEventListener('message', (event) => {
  if (!trustedOrigins.includes(event.origin)) return;
  
  if (!isSemesterMessage(event.data)) {
    console.error('Invalid semester message:', event.data);
    // Fall back to demo data
    return;
  }
  
  // Process valid message
  loadSemesterData(event.data.events);
});
```

### Moodle Block (Sender)

If the Moodle block fails to fetch calendar events:

1. Log the error to Moodle's debugging system (if developer mode is enabled)
2. Send an empty `events` array
3. The game will detect the empty array and fall back to demo data

**Example:**

```php
try {
    $events = \core_calendar\local\api::get_action_events_by_timesort($USER->id, $now, $endtime);
} catch (Exception $e) {
    debugging('Grade Defense block: Failed to fetch calendar events - ' . $e->getMessage(), DEBUG_DEVELOPER);
    $events = array(); // Empty array
}
```

## Testing

### Manual Testing

1. **Install the block** in a Moodle 4.5 instance
2. **Create test events** in the calendar (assignments, quizzes, exams with various due dates)
3. **Add the block** to your Dashboard
4. **Open browser DevTools** (F12) → Console
5. **Verify message exchange**:
   - Look for `postMessage` calls
   - Check that the game receives data (log in game code)
6. **Verify origin checks**:
   - Try spoofing a message from a different origin (should be rejected)

### Automated Testing (Future)

Potential tests:
- Unit tests for type inference logic (PHP)
- Unit tests for grade extraction (PHP)
- Integration tests: mock Moodle API, verify correct JSON output
- E2E tests: Playwright navigates to Moodle Dashboard, verifies iframe loads and data syncs

## Troubleshooting

### Events not syncing

**Symptom:** Game loads with demo data instead of Moodle data.

**Diagnosis:**
1. Open browser DevTools → Console
2. Check for postMessage errors or origin rejections
3. Verify the game origin matches the configured Game URL in Moodle settings

**Solution:**
- Ensure Game URL setting ends with a trailing slash
- Verify the game URL is accessible
- Check CORS/iframe policies

### Invalid event types

**Symptom:** All events appear as "assignment" type.

**Diagnosis:**
- Review event names in Moodle calendar
- Check type inference regex in `block_gradedefense.php`

**Solution:**
- Update event names to include keywords ("Midterm Exam", "Project Proposal")
- Or customize the `infer_event_type()` method

### Missing points/grades

**Symptom:** Events have `points: null`.

**Diagnosis:**
- Check if activities have grade book entries
- Verify grade items are configured in Moodle course settings

**Solution:**
- Configure grade book for activities: **Course → Grades → Setup → Gradebook setup**
- Ensure maximum grade is set for each activity

## Implementation Notes

### Why postMessage?

- **Cross-origin safety:** Game can be hosted on a different domain than Moodle
- **No backend required:** Static game build (no server)
- **Standard API:** Supported by all modern browsers
- **Origin validation:** Built-in security model

### Why server-side data collection?

- **Security:** Avoids exposing Moodle API tokens or session cookies to client-side JavaScript
- **Simplicity:** No CORS configuration needed
- **Privacy:** User credentials never leave the Moodle server

### Fallback Strategy

If postMessage fails (e.g., older browser, misconfigured origin), the game seamlessly falls back to demo data. The user can still play and learn the mechanics, even without real Moodle integration.

## Future Enhancements

Potential improvements:
- Bidirectional sync: Send study trial scores back to Moodle gradebook
- Support for Moodle course module completion tracking
- WebSocket for real-time updates (new events appear in game without refresh)
- Support for other LMS platforms (Canvas, Blackboard) with similar postMessage contracts

## References

- [MDN: Window.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [Moodle Calendar API](https://docs.moodle.org/dev/Calendar_API)
- [Moodle Block Plugin Development](https://docs.moodle.org/dev/Blocks)

## License

This integration follows Moodle's GPL v3 license and is compatible with the game's MIT license.
