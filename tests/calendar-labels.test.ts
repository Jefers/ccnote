import { describe, expect, it } from 'vitest';
import { splitNameForCalendar } from '../src/domain/schedule';

describe('calendar labels', () => {
  it('puts surnames on their own line to keep week blocks narrow', () => {
    expect(splitNameForCalendar('Alfred Beauchamp')).toEqual({ givenNames: 'Alfred', surname: 'Beauchamp' });
    expect(splitNameForCalendar("Maeve O'Sullivan")).toEqual({ givenNames: 'Maeve', surname: "O'Sullivan" });
  });

  it('handles single-word names without creating an empty surname line', () => {
    expect(splitNameForCalendar('Madonna')).toEqual({ givenNames: 'Madonna', surname: '' });
  });
});
