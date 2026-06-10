import './styles.css';
import { createClient, deleteClient, getClientStats, moodLabels, searchClients, updateClient, updateClientMood, type ClientRecord, type Mood } from './domain/client';
import { loadAppContent, loadSeedClients, type AppContent } from './data/loaders';
import { loadClientsFromStorage, saveClientsToStorage } from './state/store';
import { getSmartCardTargetIndex, type CardDirection } from './domain/navigation';

interface AppState {
  clients: ClientRecord[];
  query: string;
  editingId: string | null;
  content: AppContent;
}

const appRootElement = document.querySelector<HTMLDivElement>('#app');
if (!appRootElement) throw new Error('Missing #app root');
const appRoot = appRootElement;

const state: AppState = {
  clients: [],
  query: '',
  editingId: null,
  content: {
    name: 'CNotes',
    subtitle: 'Fitness coach client cards',
    description: 'A local-first note dashboard for coaching check-ins.',
    moodLabels,
  },
};

async function bootstrap(): Promise<void> {
  const [content, seedClients] = await Promise.all([loadAppContent(), loadSeedClients()]);
  state.content = content;
  state.clients = loadClientsFromStorage(localStorage, seedClients);
  render();
  registerServiceWorker();
}

function render(): void {
  const filteredClients = searchClients(state.clients, state.query);
  const stats = getClientStats(state.clients);
  const editingClient = state.editingId ? state.clients.find((client) => client.id === state.editingId) : null;

  appRoot.innerHTML = `
    <main class="shell" aria-label="CNotes client dashboard">
      <section class="hero-card">
        <div class="brand-row">
          <div class="logo-mark" aria-hidden="true">CN</div>
          <button class="install-button hidden" type="button" data-action="install">Install</button>
        </div>
        <p class="eyebrow">Fitness coach dashboard</p>
        <h1>${escapeHtml(state.content.name)}</h1>
        <p class="hero-copy">${escapeHtml(state.content.description)}</p>
        <p class="compact-stats" aria-label="Client statistics">
          <strong data-stat="total">${stats.totalClients}</strong> clients · <strong data-stat="notes">${stats.clientsWithNotes}</strong> with notes · <strong data-stat="showing">${filteredClients.length}</strong> showing
        </p>
        <label class="search-label" for="search-input">Search clients or notes</label>
        <input id="search-input" class="search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search goals, injuries, names…" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" inputmode="search" />
      </section>

      <section class="toolbar" aria-label="Client actions">
        <div>
          <p class="section-kicker">Today’s check-ins</p>
          <h2>Client cards</h2>
        </div>
        <button class="primary-action toolbar-new" type="button" data-action="new">+ New client</button>
      </section>

      <section class="client-list" aria-live="polite">
        ${renderClientList(filteredClients)}
      </section>
    </main>
    <nav class="floating-actions" aria-label="Fast client navigation">
      <button type="button" class="fab fab-secondary" data-action="smart-up" aria-label="Previous client card">↑</button>
      <button type="button" class="fab fab-primary" data-action="new" aria-label="Add new client">+</button>
      <button type="button" class="fab fab-secondary" data-action="smart-down" aria-label="Next client card">↓</button>
    </nav>
    ${renderModal(editingClient)}
  `;

  bindEvents();
  updateInstallButton();
}

function renderClientList(clients: ClientRecord[]): string {
  if (clients.length === 0) {
    const isSearching = state.query.trim().length > 0;
    return `
      <article class="empty-card">
        <div aria-hidden="true">${isSearching ? '🔎' : '📝'}</div>
        <h3>${isSearching ? 'No matching clients' : 'No clients yet'}</h3>
        <p>${isSearching ? 'Try another name, goal, or note keyword.' : 'Add your first coaching client card to begin.'}</p>
      </article>
    `;
  }

  return clients
    .map(
      (client) => `
        <article class="client-card mood-${client.mood}" data-client-id="${escapeAttribute(client.id)}">
          <div class="card-topline">
            <div>
              <p class="mood-pill">${escapeHtml(state.content.moodLabels[String(client.mood)] ?? moodLabels[client.mood])}</p>
              <h3>${escapeHtml(client.name)}</h3>
            </div>
            <div class="card-actions">
              <button type="button" class="icon-button" data-action="edit" data-id="${escapeAttribute(client.id)}" aria-label="Edit ${escapeAttribute(client.name)}">Edit</button>
              <button type="button" class="icon-button danger" data-action="delete" data-id="${escapeAttribute(client.id)}" aria-label="Delete ${escapeAttribute(client.name)}">Delete</button>
            </div>
          </div>
          <p class="notes ${client.notes.trim() ? '' : 'muted'}">${client.notes.trim() ? escapeHtml(client.notes) : 'No notes yet. Add goals, preferences, medical cautions, and progress snapshots.'}</p>
          <label class="mood-control">
            <span>Mood / readiness</span>
            <input type="range" min="0" max="2" step="1" value="${client.mood}" data-action="mood" data-id="${escapeAttribute(client.id)}" aria-label="Mood for ${escapeAttribute(client.name)}" />
          </label>
        </article>
      `,
    )
    .join('');
}

function renderModal(client: ClientRecord | null | undefined): string {
  const isOpen = state.editingId !== null;
  const isEditing = Boolean(client);
  const name = client?.name ?? '';
  const notes = client?.notes ?? '';
  const mood = client?.mood ?? 1;

  return `
    <div class="modal-backdrop ${isOpen ? 'active' : ''}" ${isOpen ? '' : 'hidden'} data-action="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <div>
            <p class="section-kicker">${isEditing ? 'Update card' : 'Add card'}</p>
            <h2 id="modal-title">${isEditing ? 'Edit client' : 'New client'}</h2>
          </div>
          <button type="button" class="close-button" data-action="close" aria-label="Close">×</button>
        </div>
        <form id="client-form">
          <label class="field-label" for="client-name">Client name</label>
          <input id="client-name" name="name" class="field-input" value="${escapeAttribute(name)}" required />

          <label class="field-label" for="client-notes">Notes</label>
          <textarea id="client-notes" name="notes" class="field-textarea" placeholder="Goals, preferences, medical notes, progress…">${escapeHtml(notes)}</textarea>

          <label class="field-label" for="client-mood">Mood / readiness</label>
          <select id="client-mood" name="mood" class="field-input">
            ${([0, 1, 2] as Mood[])
              .map((value) => `<option value="${value}" ${value === mood ? 'selected' : ''}>${escapeHtml(state.content.moodLabels[String(value)] ?? moodLabels[value])}</option>`)
              .join('')}
          </select>

          <div class="modal-actions">
            <button type="button" class="secondary-action" data-action="close">Cancel</button>
            <button type="submit" class="primary-action">${isEditing ? 'Save changes' : 'Create client'}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-action="new"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingId = '__new__';
      render();
      document.querySelector<HTMLInputElement>('#client-name')?.focus();
    });
  });

  document.querySelector<HTMLInputElement>('#search-input')?.addEventListener('input', (event) => {
    state.query = (event.target as HTMLInputElement).value;
    syncClientList();
  });

  document.querySelector<HTMLButtonElement>('[data-action="smart-up"]')?.addEventListener('click', () => scrollToSmartCard('up'));
  document.querySelector<HTMLButtonElement>('[data-action="smart-down"]')?.addEventListener('click', () => scrollToSmartCard('down'));

  bindClientControls();

  document.querySelectorAll<HTMLElement>('[data-action="close"]').forEach((element) => {
    element.addEventListener('click', closeModal);
  });

  document.querySelector<HTMLElement>('[data-action="modal-backdrop"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });

  document.querySelector<HTMLFormElement>('#client-form')?.addEventListener('submit', handleFormSubmit);
}

function bindClientControls(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.editingId = button.dataset.id ?? null;
      render();
      document.querySelector<HTMLInputElement>('#client-name')?.focus();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;
      const client = state.clients.find((candidate) => candidate.id === id);
      if (!id || !client) return;
      if (confirm(`Delete ${client.name}? This cannot be undone.`)) {
        state.clients = deleteClient(state.clients, id);
        persistAndRender();
      }
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-action="mood"]').forEach((input) => {
    input.addEventListener('input', () => {
      if (!input.dataset.id) return;
      state.clients = updateClientMood(state.clients, input.dataset.id, Number(input.value));
      persistAndRender();
    });
  });
}

function syncClientList(): void {
  const filteredClients = searchClients(state.clients, state.query);
  const stats = getClientStats(state.clients);
  const clientList = document.querySelector<HTMLElement>('.client-list');
  if (clientList) clientList.innerHTML = renderClientList(filteredClients);
  document.querySelector<HTMLElement>('[data-stat="total"]')?.replaceChildren(String(stats.totalClients));
  document.querySelector<HTMLElement>('[data-stat="notes"]')?.replaceChildren(String(stats.clientsWithNotes));
  document.querySelector<HTMLElement>('[data-stat="showing"]')?.replaceChildren(String(filteredClients.length));
  bindClientControls();
}

function scrollToSmartCard(direction: CardDirection): void {
  const cards = [...document.querySelectorAll<HTMLElement>('.client-card')];
  const cardTops = cards.map((card) => window.scrollY + card.getBoundingClientRect().top);
  const targetIndex = getSmartCardTargetIndex(cardTops, window.scrollY, direction);
  if (targetIndex === null) return;
  cards[targetIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleFormSubmit(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const input = {
    name: String(data.get('name') ?? ''),
    notes: String(data.get('notes') ?? ''),
    mood: Number(data.get('mood') ?? 1),
  };

  if (state.editingId && state.editingId !== '__new__') {
    state.clients = updateClient(state.clients, state.editingId, input);
  } else {
    state.clients = createClient(state.clients, input);
  }

  state.editingId = null;
  persistAndRender();
}

function closeModal(): void {
  state.editingId = null;
  render();
}

function persistAndRender(): void {
  saveClientsToStorage(localStorage, state.clients);
  render();
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL }).catch((error: unknown) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

let deferredInstallPrompt: Event | null = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

function updateInstallButton(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-action="install"]');
  if (!button || !deferredInstallPrompt) return;
  button.classList.remove('hidden');
  button.onclick = async () => {
    const promptEvent = deferredInstallPrompt as Event & { prompt?: () => Promise<void> };
    await promptEvent.prompt?.();
    deferredInstallPrompt = null;
    updateInstallButton();
  };
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.editingId !== null) closeModal();
});

bootstrap().catch((error: unknown) => {
  console.error(error);
  appRoot.innerHTML = '<main class="shell"><article class="empty-card"><h1>CNotes could not load</h1><p>Please refresh and try again.</p></article></main>';
});
