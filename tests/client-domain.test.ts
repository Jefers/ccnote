import { describe, expect, it } from 'vitest';
import { createClient, deleteClient, getClientStats, normalizeMood, searchClients, updateClient, type ClientRecord } from '../src/domain/client';
import { DEFAULT_STORAGE_KEY, loadClientsFromStorage, saveClientsToStorage } from '../src/state/store';
import rawSeedClients from '../public/data/seed-clients.json';

const seedClients = rawSeedClients as ClientRecord[];

describe('client domain', () => {
  it('provides fifteen traditional British and Irish example clients in order', () => {
    expect(seedClients).toHaveLength(15);
    expect(seedClients.map((client) => client.name)).toEqual([
      'Alfred Beauchamp',
      'Maud Fitzwilliam',
      "Cormac O'Rourke",
      'Isobel MacLeod',
      'Edmund Cartwright',
      'Bridget Kavanagh',
      'Hamish Campbell',
      'Eleanor Pritchard',
      'Seamus Donnelly',
      'Agnes Sinclair',
      'Rupert Ashdown',
      'Fiona MacGregor',
      'Benedict Harcourt',
      'Nora Flaherty',
      'Duncan Abernethy',
    ]);
  });

  it('creates a new client at the top with normalized mood', () => {
    const clients = createClient(seedClients, { id: 'new-1', name: '  Ada Coach  ', notes: '  Goals: strength  ', mood: 7 });
    expect(clients[0]).toEqual({ id: 'new-1', name: 'Ada Coach', notes: 'Goals: strength', mood: 2 });
    expect(clients).toHaveLength(16);
  });

  it('updates an existing client without reordering the list', () => {
    const clients = updateClient(seedClients, 'c02', { name: 'Maud Fitzwilliam', notes: 'Updated note', mood: -1 });
    expect(clients.map((client) => client.id).slice(0, 3)).toEqual(['c01', 'c02', 'c03']);
    expect(clients[1]).toMatchObject({ notes: 'Updated note', mood: 0 });
  });

  it('deletes only the selected client', () => {
    expect(deleteClient(seedClients, 'c02').map((client) => client.name)).not.toContain('Maud Fitzwilliam');
    expect(deleteClient(seedClients, 'c02')).toHaveLength(14);
  });

  it('searches by client name and notes case-insensitively', () => {
    expect(searchClients(seedClients, 'knee').map((client) => client.name)).toEqual(['Hamish Campbell']);
    expect(searchClients(seedClients, 'MACLEOD').map((client) => client.name)).toEqual(['Isobel MacLeod']);
    expect(searchClients(seedClients, '   ')).toHaveLength(15);
  });

  it('calculates stats from non-empty notes', () => {
    expect(getClientStats([...seedClients, { id: 'extra', name: 'No Notes', notes: '   ', mood: 1 }])).toEqual({ totalClients: 16, clientsWithNotes: 15 });
  });

  it('normalizes mood values into the supported 0..2 range', () => {
    expect(normalizeMood(Number.NaN)).toBe(1);
    expect(normalizeMood(-50)).toBe(0);
    expect(normalizeMood(50)).toBe(2);
    expect(normalizeMood(1.9)).toBe(1);
  });
});

describe('client storage', () => {
  it('uses an app-specific storage key', () => {
    expect(DEFAULT_STORAGE_KEY).toBe('cnotes.clients.v2');
  });

  it('falls back to seed clients when storage is empty or corrupt', () => {
    const storage = new Map<string, string>();
    expect(loadClientsFromStorage(storage, seedClients)).toHaveLength(15);
    storage.set(DEFAULT_STORAGE_KEY, '{bad json');
    expect(loadClientsFromStorage(storage, seedClients).map((client) => client.name).slice(0, 3)).toEqual(['Alfred Beauchamp', 'Maud Fitzwilliam', "Cormac O'Rourke"]);
  });

  it('saves and reloads clients from a storage-like object', () => {
    const storage = new Map<string, string>();
    saveClientsToStorage(storage, seedClients);
    expect(loadClientsFromStorage(storage, [])).toEqual(seedClients);
  });
});
