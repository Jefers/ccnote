import { describe, expect, it } from 'vitest';
import { getClientColour, getNextSessionForClient, sortClientsByUpcomingSession, type CoachingSession } from '../src/domain/schedule';
import type { ClientRecord } from '../src/domain/client';

const clients: ClientRecord[] = [
  { id: 'late', name: 'Late Client', notes: '', mood: 1 },
  { id: 'soon', name: 'Soon Client', notes: '', mood: 1 },
  { id: 'none', name: 'No Slot Client', notes: '', mood: 1 },
  { id: 'tomorrow', name: 'Tomorrow Client', notes: '', mood: 1 },
];

const sessions: CoachingSession[] = [
  { id: 's1', clientId: 'late', day: 'monday', start: '08:00', durationMinutes: 60, focus: 'Past today' },
  { id: 's2', clientId: 'soon', day: 'monday', start: '15:00', durationMinutes: 60, focus: 'Later today' },
  { id: 's3', clientId: 'tomorrow', day: 'tuesday', start: '09:00', durationMinutes: 60, focus: 'Tomorrow' },
];

describe('upcoming client ordering', () => {
  it('sorts clients by the closest upcoming weekly session and keeps unscheduled clients at the bottom', () => {
    const monday1400 = new Date('2026-06-08T14:00:00');
    const ordered = sortClientsByUpcomingSession(clients, sessions, monday1400);
    expect(ordered.map((client) => client.id)).toEqual(['soon', 'tomorrow', 'late', 'none']);
  });

  it('wraps past sessions into the following week', () => {
    const monday1400 = new Date('2026-06-08T14:00:00');
    const nextLate = getNextSessionForClient('late', sessions, monday1400);
    expect(nextLate?.session.id).toBe('s1');
    expect(nextLate?.minutesUntil).toBe(6 * 24 * 60 + 18 * 60);
  });

  it('assigns stable distinct colours to different clients', () => {
    expect(getClientColour('c01')).not.toBe(getClientColour('c02'));
    expect(getClientColour('c01')).toBe(getClientColour('c01'));
  });
});
