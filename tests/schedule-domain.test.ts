import { describe, expect, it } from 'vitest';
import rawSchedule from '../public/data/schedule.json';
import rawClients from '../public/data/seed-clients.json';
import {
  DAYS,
  getSessionsForDay,
  moveSession,
  validateWeeklySchedule,
  type CoachingSession,
} from '../src/domain/schedule';
import type { ClientRecord } from '../src/domain/client';

const sessions = rawSchedule as CoachingSession[];
const clients = rawClients as ClientRecord[];

describe('weekly coaching schedule data', () => {
  it('has five further example clients and leaves unscheduled clients off the calendar', () => {
    expect(clients).toHaveLength(25);
    const scheduledClientIds = new Set(sessions.map((session) => session.clientId));
    expect(scheduledClientIds.size).toBe(24);
    expect(scheduledClientIds.has('c25')).toBe(false);
    expect(clients.some((client) => client.id === 'c25')).toBe(true);
  });

  it('gives each client one to three sessions with at least one day between repeat sessions', () => {
    const result = validateWeeklySchedule(sessions);
    expect(result.errors).toEqual([]);
  });

  it('does not schedule Sundays or Saturday evenings', () => {
    expect(sessions.some((session) => String(session.day) === 'sunday')).toBe(false);
    expect(sessions.filter((session) => session.day === 'saturday').every((session) => session.start < '17:00')).toBe(true);
  });

  it('sorts sessions for a day by start time', () => {
    const monday = getSessionsForDay(sessions, 'monday');
    expect(monday.map((session) => session.start)).toEqual([...monday.map((session) => session.start)].sort());
  });

  it('covers the Monday to Saturday coaching week', () => {
    expect(DAYS.map((day) => day.id)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
  });
});

describe('moving sessions', () => {
  it('moves a session to a new weekly slot without changing duration or client', () => {
    const original = sessions[0];
    const moved = moveSession(sessions, original.id, { day: 'friday', start: '15:30' });
    const updated = moved.find((session) => session.id === original.id);
    expect(updated).toMatchObject({ clientId: original.clientId, day: 'friday', start: '15:30', durationMinutes: 60 });
  });
});
