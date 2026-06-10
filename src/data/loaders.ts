import type { ClientRecord } from '../domain/client';

export interface AppContent {
  name: string;
  subtitle: string;
  description: string;
  moodLabels: Record<string, string>;
}

const defaultAppContent: AppContent = {
  name: 'CNotes',
  subtitle: 'Fitness coach client cards',
  description: 'A private-by-device note dashboard for coaching check-ins.',
  moodLabels: {
    '0': 'Excellent / energized',
    '1': 'Good / positive',
    '2': 'Needs attention',
  },
};

export async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadAppContent(): Promise<AppContent> {
  try {
    return await loadJson<AppContent>('data/app.json');
  } catch {
    return defaultAppContent;
  }
}

export async function loadSeedClients(): Promise<ClientRecord[]> {
  try {
    return await loadJson<ClientRecord[]>('data/seed-clients.json');
  } catch {
    return [];
  }
}
