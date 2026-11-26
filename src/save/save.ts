/**
 * Versioned localStorage save (tech.md: "localStorage behind a small
 * versioned save module with try/catch"). The game must work with storage
 * blocked: every read falls back to defaults and every write is best-effort.
 */
/** One practice trial (or the questions answered during one battle) for a course. */
export interface TrialSession {
  courseId: string;
  timestamp: number;
  score: number; // 0-100
  questionsAnswered: { questionId: string; correct: boolean; topic?: string }[];
  source: 'trial' | 'battle';
}

export interface SaveData {
  version: 1;
  tutorialDone: boolean;
  settings: { muted: boolean; reducedMotion: boolean; extraTime: boolean };
  sessions: TrialSession[];
  /** Forge levels per course (0..5), earned only from correct trial answers. */
  forge: Record<string, number>;
  /** Sparks: partial progress toward the next forge level per course. */
  sparks: Record<string, number>;
  /** Semester source: 'demo' or an imported semester (ics / Moodle block). */
  semester: { source: 'demo' } | { source: 'ics' | 'moodle'; json: string; importedAt: number };
  campaign: { wave: number; bestWave: number };
}

const KEY = 'deadline-defense.save';

export function defaultSave(): SaveData {
  return {
    version: 1,
    tutorialDone: false,
    settings: { muted: false, reducedMotion: false, extraTime: false },
    sessions: [],
    forge: {},
    sparks: {},
    semester: { source: 'demo' },
    campaign: { wave: 1, bestWave: 0 },
  };
}

/** Validate and migrate unknown JSON into a SaveData (never throws). */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData> & { version?: number };
  if (r.version !== 1) return d;
  return {
    version: 1,
    tutorialDone: r.tutorialDone === true,
    settings: {
      muted: r.settings?.muted === true,
      reducedMotion: r.settings?.reducedMotion === true,
      extraTime: r.settings?.extraTime === true,
    },
    sessions: Array.isArray(r.sessions)
      ? r.sessions
          .filter(
            (t): t is TrialSession =>
              !!t &&
              typeof t.courseId === 'string' &&
              typeof t.timestamp === 'number' &&
              typeof t.score === 'number' &&
              Array.isArray(t.questionsAnswered) &&
              (t.source === 'trial' || t.source === 'battle'),
          )
          .slice(-500)
      : [],
    forge: isNumRecord(r.forge) ? r.forge : {},
    sparks: isNumRecord(r.sparks) ? r.sparks : {},
    semester:
      r.semester && (r.semester.source === 'ics' || r.semester.source === 'moodle') && typeof (r.semester as { json?: unknown }).json === 'string'
        ? (r.semester as SaveData['semester'])
        : { source: 'demo' },
    campaign: {
      wave: Math.max(1, Number(r.campaign?.wave) || 1),
      bestWave: Math.max(0, Number(r.campaign?.bestWave) || 0),
    },
  };
}

function isNumRecord(v: unknown): v is Record<string, number> {
  return !!v && typeof v === 'object' && Object.values(v as object).every((x) => typeof x === 'number' && Number.isFinite(x));
}

let cache: SaveData | null = null;

export function load(): SaveData {
  if (cache) return cache;
  try {
    const s = localStorage.getItem(KEY);
    cache = migrate(s ? JSON.parse(s) : null);
  } catch {
    cache = defaultSave();
  }
  return cache;
}

export function save(update: (d: SaveData) => void): SaveData {
  const d = load();
  update(d);
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage blocked or full: keep the in-memory copy */
  }
  return d;
}

/** For tests. */
export function _resetCache(): void {
  cache = null;
}
