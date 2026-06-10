import { describe, expect, it } from 'vitest';
import { createClient, deleteClient, getClientStats, normalizeMood, searchClients, updateClient, type ClientRecord } from '../src/domain/client';
import { DEFAULT_STORAGE_KEY, loadClientsFromStorage, saveClientsToStorage } from '../src/state/store';
import rawSeedClients from '../public/data/seed-clients.json';

const seedClients = rawSeedClients as ClientRecord[];

describe('client domain', () => {
  it('preserves the legacy seed clients in order', () => {
    expect(seedClients.map((client) => client.name)).toEqual(['Sarah Johnson', 'Mike Smith', 'Emma Wilson']);
  });

  it('creates a new client at the top with normalized mood', () => {
    const clients = createClient(seedClients, { id: 'new-1', name: '  Ada Coach  ', notes: '  Goals: strength  ', mood: 7 });
    expect(clients[0]).toEqual({ id: 'new-1', name: 'Ada Coach', notes: 'Goals: strength', mood: 2 });
    expect(clients).toHaveLength(4);
  });

  it('updates an existing client without reordering the list', () => {
    const clients = updateClient(seedClients, '2', { name: 'Mike Smith', notes: 'Updated note', mood: -1 });
    expect(clients.map((client) => client.id)).toEqual(['1', '2', '3']);
    expect(clients[1]).toMatchObject({ notes: 'Updated note', mood: 0 });
  });

  it('deletes only the selected client', () => {
    expect(deleteClient(seedClients, '2').map((client) => client.name)).toEqual(['Sarah Johnson', 'Emma Wilson']);
  });

  it('searches by client name and notes case-insensitively', () => {
    expect(searchClients(seedClients, 'knee').map((client) => client.name)).toEqual(['Mike Smith']);
    expect(searchClients(seedClients, 'EMMA').map((client) => client.name)).toEqual(['Emma Wilson']);
    expect(searchClients(seedClients, '   ')).toHaveLength(3);
  });

  it('calculates stats from non-empty notes', () => {
    expect(getClientStats([...seedClients, { id: '4', name: 'No Notes', notes: '   ', mood: 1 }])).toEqual({ totalClients: 4, clientsWithNotes: 3 });
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
    expect(DEFAULT_STORAGE_KEY).toBe('cnotes.clients.v1');
  });

  it('falls back to seed clients when storage is empty or corrupt', () => {
    const storage = new Map<string, string>();
    expect(loadClientsFromStorage(storage, seedClients)).toHaveLength(3);
    storage.set(DEFAULT_STORAGE_KEY, '{bad json');
    expect(loadClientsFromStorage(storage, seedClients).map((client) => client.name)).toEqual(['Sarah Johnson', 'Mike Smith', 'Emma Wilson']);
  });

  it('saves and reloads clients from a storage-like object', () => {
    const storage = new Map<string, string>();
    saveClientsToStorage(storage, seedClients);
    expect(loadClientsFromStorage(storage, [])).toEqual(seedClients);
  });
});
