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

export interface NamedClient {
  id: string;
  name: string;
}

export interface UpcomingSession {
  session: CoachingSession;
  minutesUntil: number;
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

const clientColours = [
  '#2f80ed', '#eb5757', '#27ae60', '#f2994a', '#9b51e0',
  '#00a8a8', '#d96c06', '#6f7c12', '#b83280', '#0f766e',
  '#7c3aed', '#dc2626', '#2563eb', '#16a34a', '#ca8a04',
  '#0891b2', '#be185d', '#4f46e5', '#65a30d', '#c2410c',
  '#0d9488', '#9333ea', '#e11d48', '#0284c7', '#a16207',
];

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

export function getNextSessionForClient(clientId: string, sessions: readonly CoachingSession[], now = new Date()): UpcomingSession | null {
  const clientSessions = sessions.filter((session) => session.clientId === clientId);
  if (clientSessions.length === 0) return null;

  const nowWeekMinutes = getWeeklyMinute(now);
  return clientSessions
    .map((session) => {
      const sessionWeekMinutes = (dayIndex.get(session.day) ?? 0) * 24 * 60 + toMinutes(session.start);
      let minutesUntil = sessionWeekMinutes - nowWeekMinutes;
      if (minutesUntil < 0) minutesUntil += 7 * 24 * 60;
      return { session, minutesUntil };
    })
    .sort((left, right) => left.minutesUntil - right.minutesUntil || toMinutes(left.session.start) - toMinutes(right.session.start))[0];
}

export function sortClientsByUpcomingSession<T extends NamedClient>(clients: readonly T[], sessions: readonly CoachingSession[], now = new Date()): T[] {
  return [...clients].sort((left, right) => {
    const leftNext = getNextSessionForClient(left.id, sessions, now);
    const rightNext = getNextSessionForClient(right.id, sessions, now);
    if (leftNext && rightNext) return leftNext.minutesUntil - rightNext.minutesUntil || left.name.localeCompare(right.name);
    if (leftNext) return -1;
    if (rightNext) return 1;
    return left.name.localeCompare(right.name);
  });
}

export function getClientColour(clientId: string): string {
  const match = clientId.match(/\d+/);
  const numeric = match ? Number(match[0]) : hashString(clientId);
  return clientColours[Math.abs(numeric - 1) % clientColours.length];
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

export function splitNameForCalendar(name: string): { givenNames: string; surname: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { givenNames: parts[0] ?? '', surname: '' };
  return {
    givenNames: parts.slice(0, -1).join(' '),
    surname: parts.at(-1) ?? '',
  };
}

function getWeeklyMinute(date: Date): number {
  const jsDay = date.getDay();
  const mondayBasedDay = jsDay === 0 ? 6 : jsDay - 1;
  return mondayBasedDay * 24 * 60 + date.getHours() * 60 + date.getMinutes();
}

function hashString(value: string): number {
  return [...value].reduce((hash, character) => hash + character.charCodeAt(0), 0);
}
