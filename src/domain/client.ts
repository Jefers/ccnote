export type Mood = 0 | 1 | 2;

export interface ClientRecord {
  id: string;
  name: string;
  notes: string;
  mood: Mood;
}

export interface ClientInput {
  id?: string;
  name: string;
  notes: string;
  mood: number;
}

export interface ClientStats {
  totalClients: number;
  clientsWithNotes: number;
}

export const moodLabels: Record<Mood, string> = {
  0: 'Excellent / energized',
  1: 'Good / positive',
  2: 'Needs attention',
};

export function normalizeMood(value: number): Mood {
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 2) return 2;
  return Math.trunc(value) as Mood;
}

export function createClient(clients: readonly ClientRecord[], input: ClientInput): ClientRecord[] {
  const client: ClientRecord = {
    id: input.id ?? generateClientId(),
    name: input.name.trim(),
    notes: input.notes.trim(),
    mood: normalizeMood(input.mood),
  };

  return [client, ...clients];
}

export function updateClient(
  clients: readonly ClientRecord[],
  id: string,
  input: Omit<ClientInput, 'id'>,
): ClientRecord[] {
  return clients.map((client) =>
    client.id === id
      ? {
          ...client,
          name: input.name.trim(),
          notes: input.notes.trim(),
          mood: normalizeMood(input.mood),
        }
      : client,
  );
}

export function updateClientMood(clients: readonly ClientRecord[], id: string, mood: number): ClientRecord[] {
  return clients.map((client) => (client.id === id ? { ...client, mood: normalizeMood(mood) } : client));
}

export function deleteClient(clients: readonly ClientRecord[], id: string): ClientRecord[] {
  return clients.filter((client) => client.id !== id);
}

export function searchClients(clients: readonly ClientRecord[], query: string): ClientRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [...clients];

  return clients.filter((client) => {
    const haystack = `${client.name}\n${client.notes}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function getClientStats(clients: readonly ClientRecord[]): ClientStats {
  return {
    totalClients: clients.length,
    clientsWithNotes: clients.filter((client) => client.notes.trim().length > 0).length,
  };
}

export function generateClientId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `client-${Date.now().toString(36)}-${random}`;
}
