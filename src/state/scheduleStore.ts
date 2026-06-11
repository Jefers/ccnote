import type { CoachingSession } from '../domain/schedule';

export const DEFAULT_SCHEDULE_STORAGE_KEY = 'ccnote.schedule.v2';

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
}

export function loadScheduleFromStorage(
  storage: BrowserStorageLike,
  seedSchedule: readonly CoachingSession[],
  key = DEFAULT_SCHEDULE_STORAGE_KEY,
): CoachingSession[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return cloneSchedule(seedSchedule);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return cloneSchedule(seedSchedule);
    return parsed.map(normalizeStoredSession).filter(Boolean) as CoachingSession[];
  } catch {
    return cloneSchedule(seedSchedule);
  }
}

export function saveScheduleToStorage(
  storage: BrowserStorageLike,
  schedule: readonly CoachingSession[],
  key = DEFAULT_SCHEDULE_STORAGE_KEY,
): void {
  storage.setItem(key, JSON.stringify(schedule));
}

function cloneSchedule(schedule: readonly CoachingSession[]): CoachingSession[] {
  return schedule.map((session) => ({ ...session }));
}

function normalizeStoredSession(value: unknown): CoachingSession | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.clientId !== 'string' ||
    typeof candidate.day !== 'string' ||
    typeof candidate.start !== 'string' ||
    typeof candidate.focus !== 'string'
  ) {
    return null;
  }

  if (!['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(candidate.day)) return null;

  return {
    id: candidate.id,
    clientId: candidate.clientId,
    day: candidate.day as CoachingSession['day'],
    start: candidate.start,
    durationMinutes: 60,
    focus: candidate.focus,
  };
}
