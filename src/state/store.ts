import type { ClientRecord } from '../domain/client';

export const DEFAULT_STORAGE_KEY = 'cnotes.clients.v2';

export interface StorageLike {
  get(key: string): string | undefined;
  set(key: string, value: string): unknown;
}

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
}

type AnyStorage = StorageLike | BrowserStorageLike;

export function loadClientsFromStorage(storage: AnyStorage, seedClients: readonly ClientRecord[], key = DEFAULT_STORAGE_KEY): ClientRecord[] {
  try {
    const raw = readStorage(storage, key);
    if (!raw) return cloneClients(seedClients);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return cloneClients(seedClients);
    return parsed.map(normalizeStoredClient).filter(Boolean) as ClientRecord[];
  } catch {
    return cloneClients(seedClients);
  }
}

export function saveClientsToStorage(storage: AnyStorage, clients: readonly ClientRecord[], key = DEFAULT_STORAGE_KEY): void {
  writeStorage(storage, key, JSON.stringify(clients));
}

function readStorage(storage: AnyStorage, key: string): string | undefined | null {
  if ('getItem' in storage) return storage.getItem(key);
  return storage.get(key);
}

function writeStorage(storage: AnyStorage, key: string, value: string): void {
  if ('setItem' in storage) {
    storage.setItem(key, value);
    return;
  }
  storage.set(key, value);
}

function cloneClients(clients: readonly ClientRecord[]): ClientRecord[] {
  return clients.map((client) => ({ ...client }));
}

function normalizeStoredClient(value: unknown): ClientRecord | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return null;
  return {
    id: candidate.id,
    name: candidate.name,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    mood: candidate.mood === 0 || candidate.mood === 2 ? candidate.mood : 1,
  };
}
