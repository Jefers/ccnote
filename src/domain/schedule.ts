export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface DayDefinition {
  id: WeekDay;
  label: string;
  shortLabel: string;
}

export interface CoachingSession {
  id: string;
  clientId: string;
  day: WeekDay;
  start: string;
  durationMinutes: 60;
  focus: string;
}

export interface ScheduleValidationResult {
  errors: string[];
}

export const DAYS: DayDefinition[] = [
  { id: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { id: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { id: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { id: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { id: 'friday', label: 'Friday', shortLabel: 'Fri' },
  { id: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
];

const dayIndex = new Map<WeekDay, number>(DAYS.map((day, index) => [day.id, index]));

export function validateWeeklySchedule(sessions: readonly CoachingSession[]): ScheduleValidationResult {
  const errors: string[] = [];
  const byClient = new Map<string, CoachingSession[]>();
  const byDay = new Map<WeekDay, CoachingSession[]>();

  for (const session of sessions) {
    if (!dayIndex.has(session.day)) errors.push(`${session.id}: invalid day ${session.day}`);
    if (session.durationMinutes !== 60) errors.push(`${session.id}: sessions must be 60 minutes`);
    if (session.day === 'saturday' && toMinutes(session.start) >= toMinutes('17:00')) errors.push(`${session.id}: Saturday evenings are kept free`);
    byClient.set(session.clientId, [...(byClient.get(session.clientId) ?? []), session]);
    byDay.set(session.day, [...(byDay.get(session.day) ?? []), session]);
  }

  for (const [clientId, clientSessions] of byClient) {
    if (clientSessions.length < 1 || clientSessions.length > 3) errors.push(`${clientId}: clients need one to three sessions`);
    const sortedDayIndexes = clientSessions.map((session) => dayIndex.get(session.day) ?? -99).sort((a, b) => a - b);
    for (let index = 1; index < sortedDayIndexes.length; index += 1) {
      if (sortedDayIndexes[index] - sortedDayIndexes[index - 1] < 2) errors.push(`${clientId}: repeat sessions need at least one day between them`);
    }
  }

  for (const [day, daySessions] of byDay) {
    const sorted = getSessionsForDay(daySessions, day);
    for (let index = 1; index < sorted.length; index += 1) {
      const previousEnd = toMinutes(sorted[index - 1].start) + sorted[index - 1].durationMinutes;
      const currentStart = toMinutes(sorted[index].start);
      if (currentStart < previousEnd) errors.push(`${day}: ${sorted[index].id} overlaps the previous session`);
    }
    let streakMinutes = 0;
    let previousEnd: number | null = null;
    for (const session of sorted) {
      const start = toMinutes(session.start);
      const end = start + session.durationMinutes;
      const gap = previousEnd === null ? Number.POSITIVE_INFINITY : start - previousEnd;
      if (gap >= 30) streakMinutes = 0;
      streakMinutes += session.durationMinutes;
      if (streakMinutes > 180) errors.push(`${day}: more than three coaching hours without a 30-minute break`);
      previousEnd = end;
    }
  }

  return { errors };
}

export function getSessionsForDay(sessions: readonly CoachingSession[], day: WeekDay): CoachingSession[] {
  return sessions.filter((session) => session.day === day).sort((left, right) => toMinutes(left.start) - toMinutes(right.start));
}

export function moveSession(
  sessions: readonly CoachingSession[],
  sessionId: string,
  change: Pick<CoachingSession, 'day' | 'start'>,
): CoachingSession[] {
  return sessions.map((session) => (session.id === sessionId ? { ...session, day: change.day, start: change.start } : session));
}

export function toMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function formatTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }).format(date);
}
