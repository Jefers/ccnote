import './styles.css';
import { createClient, deleteClient, getClientStats, moodLabels, searchClients, updateClient, updateClientMood, type ClientRecord, type Mood } from './domain/client';
import { loadAppContent, loadSeedClients, loadSeedSchedule, type AppContent } from './data/loaders';
import { loadClientsFromStorage, saveClientsToStorage } from './state/store';
import { loadScheduleFromStorage, saveScheduleToStorage } from './state/scheduleStore';
import {
  DAYS,
  formatTime,
  getClientColour,
  getNextSessionForClient,
  getSessionsForDay,
  moveSession,
  sortClientsByUpcomingSession,
  toMinutes,
  validateWeeklySchedule,
  type CoachingSession,
  type WeekDay,
} from './domain/schedule';
import { getSmartCardTargetIndex, type CardDirection } from './domain/navigation';

type AppPage = 'clients' | 'day' | 'week';

interface AppState {
  clients: ClientRecord[];
  schedule: CoachingSession[];
  query: string;
  editingId: string | null;
  content: AppContent;
  page: AppPage;
  selectedDay: WeekDay;
}

const appRootElement = document.querySelector<HTMLDivElement>('#app');
if (!appRootElement) throw new Error('Missing #app root');
const appRoot = appRootElement;
const weekStartMinute = 7 * 60;
const weekEndMinute = 18 * 60;

const state: AppState = {
  clients: [],
  schedule: [],
  query: '',
  editingId: null,
  content: {
    name: 'CNotes',
    subtitle: 'Fitness coach client cards',
    description: 'A local-first note dashboard for coaching check-ins.',
    moodLabels,
  },
  page: 'clients',
  selectedDay: 'monday',
};

async function bootstrap(): Promise<void> {
  const [content, seedClients, seedSchedule] = await Promise.all([loadAppContent(), loadSeedClients(), loadSeedSchedule()]);
  state.content = content;
  state.clients = loadClientsFromStorage(localStorage, seedClients);
  state.schedule = loadScheduleFromStorage(localStorage, seedSchedule);
  render();
  registerServiceWorker();
}

function getOrderedClients(): ClientRecord[] {
  return sortClientsByUpcomingSession(state.clients, state.schedule, new Date());
}

function getFilteredClients(): ClientRecord[] {
  return searchClients(getOrderedClients(), state.query);
}

function render(): void {
  const filteredClients = getFilteredClients();
  const stats = getClientStats(state.clients);
  const editingClient = state.editingId ? state.clients.find((client) => client.id === state.editingId) : null;
  const validation = validateWeeklySchedule(state.schedule);

  appRoot.innerHTML = `
    <main class="shell" aria-label="CNotes client dashboard">
      <section class="hero-card">
        <div class="brand-row">
          <div class="logo-mark" aria-hidden="true">CN</div>
          <button class="install-button hidden" type="button" data-action="install">Install</button>
        </div>
        <p class="eyebrow">Mobile schedule test</p>
        <h1>${escapeHtml(state.content.name)}</h1>
        <p class="hero-copy">${escapeHtml(state.content.description)} Includes a Google-style weekly rota and client-linked session editing.</p>
        <p class="compact-stats" aria-label="Client and schedule statistics">
          <strong data-stat="total">${stats.totalClients}</strong> clients · <strong data-stat="sessions">${state.schedule.length}</strong> weekly sessions · <strong data-stat="showing">${filteredClients.length}</strong> showing
        </p>
        ${renderPageNav()}
        ${state.page === 'clients' ? renderSearch() : ''}
      </section>

      ${state.page === 'clients' ? renderClientsPage(filteredClients) : ''}
      ${state.page === 'day' ? renderDayPage(validation.errors) : ''}
      ${state.page === 'week' ? renderWeekPage(validation.errors) : ''}
    </main>
    ${state.page === 'clients' ? renderFloatingActions() : ''}
    ${renderModal(editingClient)}
  `;

  bindEvents();
  updateInstallButton();
}

function renderPageNav(): string {
  return `
    <nav class="view-tabs" aria-label="CNotes views">
      ${renderViewButton('clients', 'Client cards')}
      ${renderViewButton('day', 'Day view')}
      ${renderViewButton('week', 'Week view')}
    </nav>
  `;
}

function renderViewButton(page: AppPage, label: string): string {
  return `<button type="button" class="view-tab ${state.page === page ? 'active' : ''}" data-view="${page}" aria-pressed="${state.page === page}">${label}</button>`;
}

function renderSearch(): string {
  return `
    <label class="search-label" for="search-input">Search clients or notes</label>
    <input id="search-input" class="search-input" type="search" value="${escapeAttribute(state.query)}" placeholder="Search goals, injuries, names…" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" inputmode="search" />
  `;
}

function renderClientsPage(filteredClients: ClientRecord[]): string {
  return `
    <section class="toolbar" aria-label="Client actions">
      <div>
        <p class="section-kicker">Next sessions first</p>
        <h2>Client cards</h2>
      </div>
      <div class="toolbar-actions">
        <button class="secondary-action" type="button" data-action="refresh-order">Refresh order</button>
        <button class="primary-action toolbar-new" type="button" data-action="new">+ New client</button>
      </div>
    </section>

    <section class="client-list" aria-live="polite">
      ${renderClientList(filteredClients)}
    </section>
  `;
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

  return clients.map(renderClientCard).join('');
}

function renderClientCard(client: ClientRecord): string {
  const sessions = state.schedule.filter((session) => session.clientId === client.id);
  const next = getNextSessionForClient(client.id, state.schedule, new Date());
  return `
    <article class="client-card mood-${client.mood}" id="client-${escapeAttribute(client.id)}" data-client-id="${escapeAttribute(client.id)}" style="--client-colour: ${getClientColour(client.id)}">
      <div class="card-topline">
        <div>
          <p class="mood-pill">${escapeHtml(state.content.moodLabels[String(client.mood)] ?? moodLabels[client.mood])}</p>
          <h3>${escapeHtml(client.name)}</h3>
          <p class="next-session">${next ? `Next: ${escapeHtml(DAYS.find((day) => day.id === next.session.day)?.shortLabel ?? next.session.day)} ${escapeHtml(formatTime(next.session.start))}` : 'No sessions scheduled'}</p>
        </div>
        <div class="card-actions">
          <button type="button" class="icon-button" data-action="edit" data-id="${escapeAttribute(client.id)}" aria-label="Edit ${escapeAttribute(client.name)}">Edit</button>
          <button type="button" class="icon-button danger" data-action="delete" data-id="${escapeAttribute(client.id)}" aria-label="Delete ${escapeAttribute(client.name)}">Delete</button>
        </div>
      </div>
      <p class="notes ${client.notes.trim() ? '' : 'muted'}">${client.notes.trim() ? escapeHtml(client.notes) : 'No notes yet. Add goals, preferences, medical cautions, and progress snapshots.'}</p>
      <div class="client-session-strip" aria-label="Weekly sessions for ${escapeAttribute(client.name)}">
        ${sessions.length ? sessions.map((session) => `<span class="mini-session" style="--client-colour: ${getClientColour(client.id)}">${escapeHtml(DAYS.find((day) => day.id === session.day)?.shortLabel ?? session.day)} ${escapeHtml(formatTime(session.start))}</span>`).join('') : '<span class="mini-session unscheduled">Unscheduled</span>'}
      </div>
      <label class="mood-control">
        <span>Mood / readiness</span>
        <input type="range" min="0" max="2" step="1" value="${client.mood}" data-action="mood" data-id="${escapeAttribute(client.id)}" aria-label="Mood for ${escapeAttribute(client.name)}" />
      </label>
    </article>
  `;
}

function renderDayPage(errors: string[]): string {
  const sessions = getSessionsForDay(state.schedule, state.selectedDay);
  const dayLabel = DAYS.find((day) => day.id === state.selectedDay)?.label ?? 'Day';
  return `
    <section class="calendar-page" aria-label="Day calendar">
      <div class="toolbar calendar-toolbar">
        <div>
          <p class="section-kicker">Tap a session to open its client</p>
          <h2>${escapeHtml(dayLabel)} day view</h2>
        </div>
        <label class="compact-field">Day
          <select class="field-input compact-select" data-action="select-day">
            ${DAYS.map((day) => `<option value="${day.id}" ${day.id === state.selectedDay ? 'selected' : ''}>${day.label}</option>`).join('')}
          </select>
        </label>
      </div>
      ${renderScheduleWarnings(errors)}
      <div class="day-schedule">
        ${sessions.map(renderSessionCard).join('') || '<article class="empty-card"><h3>No sessions</h3><p>This day is currently free.</p></article>'}
      </div>
    </section>
  `;
}

function renderWeekPage(errors: string[]): string {
  const hours = Array.from({ length: weekEndMinute / 60 - weekStartMinute / 60 + 1 }, (_, index) => weekStartMinute / 60 + index);
  return `
    <section class="calendar-page" aria-label="Week calendar">
      <div class="toolbar calendar-toolbar">
        <div>
          <p class="section-kicker">Google-style week view</p>
          <h2>Week view</h2>
        </div>
        <p class="calendar-note">Tap a coloured block to jump to the client card. Gaps show free coaching space.</p>
      </div>
      ${renderScheduleWarnings(errors)}
      <div class="week-calendar" style="--day-count: ${DAYS.length}; --hour-count: ${hours.length - 1}">
        <div class="time-axis week-header-spacer" aria-hidden="true"></div>
        ${DAYS.map((day) => `<div class="week-column-header">${escapeHtml(day.shortLabel)}</div>`).join('')}
        <div class="time-axis">
          ${hours.slice(0, -1).map((hour) => `<div class="time-label">${String(hour).padStart(2, '0')}:00</div>`).join('')}
        </div>
        ${DAYS.map(renderWeekColumn).join('')}
      </div>
    </section>
  `;
}

function renderWeekColumn(day: { id: WeekDay; label: string }): string {
  return `
    <section class="week-column" aria-label="${escapeAttribute(day.label)} sessions">
      ${getSessionsForDay(state.schedule, day.id).map(renderWeekBlock).join('')}
    </section>
  `;
}

function renderWeekBlock(session: CoachingSession): string {
  const client = state.clients.find((candidate) => candidate.id === session.clientId);
  const top = Math.max(0, toMinutes(session.start) - weekStartMinute);
  const height = session.durationMinutes;
  return `
    <button type="button" class="week-session-block" style="--client-colour: ${getClientColour(session.clientId)}; --top: ${top}; --height: ${height}" data-action="open-client" data-client-id="${escapeAttribute(session.clientId)}" aria-label="Open ${escapeAttribute(client?.name ?? 'client')} session at ${escapeAttribute(formatTime(session.start))}">
      <strong>${escapeHtml(formatTime(session.start))}</strong>
      <span>${escapeHtml(client?.name ?? 'Unknown client')}</span>
    </button>
  `;
}

function renderScheduleWarnings(errors: string[]): string {
  if (errors.length === 0) return '<p class="schedule-ok">Schedule rules satisfied: one-hour sessions, protected breaks, no Sundays, and no Saturday evenings.</p>';
  return `<div class="schedule-warning"><strong>Schedule warnings</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></div>`;
}

function renderSessionCard(session: CoachingSession): string {
  const client = state.clients.find((candidate) => candidate.id === session.clientId);
  return `
    <article class="session-card" data-action="open-client" data-client-id="${escapeAttribute(session.clientId)}" data-session-id="${escapeAttribute(session.id)}" style="--client-colour: ${getClientColour(session.clientId)}">
      <div class="session-time">${escapeHtml(formatTime(session.start))}</div>
      <div class="session-body">
        <h3>${escapeHtml(client?.name ?? 'Unknown client')}</h3>
        <p>${escapeHtml(session.focus)}</p>
        <p class="session-meta">60 minutes · ${escapeHtml(DAYS.find((day) => day.id === session.day)?.label ?? session.day)}</p>
        <div class="move-controls" aria-label="Move ${escapeAttribute(client?.name ?? 'session')}">
          <label>Day
            <select data-action="move-day" data-id="${escapeAttribute(session.id)}">
              ${DAYS.map((day) => `<option value="${day.id}" ${day.id === session.day ? 'selected' : ''}>${day.shortLabel}</option>`).join('')}
            </select>
          </label>
          <label>Start
            <input type="time" step="1800" value="${escapeAttribute(session.start)}" data-action="move-time" data-id="${escapeAttribute(session.id)}" />
          </label>
        </div>
      </div>
    </article>
  `;
}

function renderFloatingActions(): string {
  return `
    <nav class="floating-actions" aria-label="Fast client navigation">
      <button type="button" class="fab fab-secondary" data-action="smart-up" aria-label="Previous client card">↑</button>
      <button type="button" class="fab fab-primary" data-action="new" aria-label="Add new client">+</button>
      <button type="button" class="fab fab-secondary" data-action="smart-down" aria-label="Next client card">↓</button>
    </nav>
  `;
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
            <p class="section-kicker">${isEditing ? 'Update card and sessions' : 'Add card'}</p>
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
            ${([0, 1, 2] as Mood[]).map((value) => `<option value="${value}" ${value === mood ? 'selected' : ''}>${escapeHtml(state.content.moodLabels[String(value)] ?? moodLabels[value])}</option>`).join('')}
          </select>

          ${isEditing && client ? renderSessionEditor(client) : '<p class="modal-note">Create the client first, then edit the card to add weekly sessions.</p>'}

          <div class="modal-actions">
            <button type="button" class="secondary-action" data-action="close">Cancel</button>
            <button type="submit" class="primary-action">${isEditing ? 'Save changes' : 'Create client'}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderSessionEditor(client: ClientRecord): string {
  const sessions = state.schedule.filter((session) => session.clientId === client.id).sort((a, b) => (DAYS.findIndex((day) => day.id === a.day) - DAYS.findIndex((day) => day.id === b.day)) || toMinutes(a.start) - toMinutes(b.start));
  return `
    <section class="session-editor" aria-label="Weekly sessions for ${escapeAttribute(client.name)}">
      <div class="session-editor-heading">
        <div>
          <p class="section-kicker">Weekly sessions</p>
          <h3>Session slots</h3>
        </div>
        <button type="button" class="secondary-action small-action" data-action="add-session" data-client-id="${escapeAttribute(client.id)}">+ Add session</button>
      </div>
      ${sessions.length ? sessions.map(renderSessionEditorRow).join('') : '<p class="modal-note">No sessions yet. This client will stay at the bottom of the card list until scheduled.</p>'}
    </section>
  `;
}

function renderSessionEditorRow(session: CoachingSession): string {
  return `
    <div class="session-editor-row" style="--client-colour: ${getClientColour(session.clientId)}">
      <input type="hidden" name="session-id" value="${escapeAttribute(session.id)}" />
      <label>Day
        <select name="session-day">
          ${DAYS.map((day) => `<option value="${day.id}" ${day.id === session.day ? 'selected' : ''}>${day.shortLabel}</option>`).join('')}
        </select>
      </label>
      <label>Start
        <input name="session-start" type="time" step="1800" value="${escapeAttribute(session.start)}" />
      </label>
      <label class="session-focus-field">Focus
        <input name="session-focus" value="${escapeAttribute(session.focus)}" />
      </label>
      <button type="button" class="icon-button danger" data-action="delete-session" data-id="${escapeAttribute(session.id)}">Delete</button>
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

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.page = button.dataset.view as AppPage;
      render();
    });
  });

  document.querySelector<HTMLInputElement>('#search-input')?.addEventListener('input', (event) => {
    state.query = (event.target as HTMLInputElement).value;
    syncClientList();
  });

  document.querySelector<HTMLButtonElement>('[data-action="refresh-order"]')?.addEventListener('click', () => render());
  document.querySelector<HTMLButtonElement>('[data-action="smart-up"]')?.addEventListener('click', () => scrollToSmartCard('up'));
  document.querySelector<HTMLButtonElement>('[data-action="smart-down"]')?.addEventListener('click', () => scrollToSmartCard('down'));

  document.querySelector<HTMLSelectElement>('[data-action="select-day"]')?.addEventListener('change', (event) => {
    state.selectedDay = (event.target as HTMLSelectElement).value as WeekDay;
    render();
  });

  document.querySelectorAll<HTMLSelectElement>('[data-action="move-day"]').forEach((select) => {
    select.addEventListener('change', () => updateSessionSlot(select.dataset.id, { day: select.value as WeekDay }));
  });

  document.querySelectorAll<HTMLInputElement>('[data-action="move-time"]').forEach((input) => {
    input.addEventListener('change', () => updateSessionSlot(input.dataset.id, { start: input.value }));
  });

  document.querySelectorAll<HTMLElement>('[data-action="open-client"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('select,input,button.icon-button')) return;
      openClientCard(element.dataset.clientId);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="add-session"]').forEach((button) => {
    button.addEventListener('click', () => addSessionForClient(button.dataset.clientId));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="delete-session"]').forEach((button) => {
    button.addEventListener('click', () => deleteSession(button.dataset.id));
  });

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
        state.schedule = state.schedule.filter((session) => session.clientId !== id);
        saveScheduleToStorage(localStorage, state.schedule);
        persistClientsAndRender();
      }
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-action="mood"]').forEach((input) => {
    input.addEventListener('input', () => {
      if (!input.dataset.id) return;
      state.clients = updateClientMood(state.clients, input.dataset.id, Number(input.value));
      persistClientsAndRender();
    });
  });
}

function updateSessionSlot(sessionId: string | undefined, change: Partial<Pick<CoachingSession, 'day' | 'start'>>): void {
  if (!sessionId) return;
  const current = state.schedule.find((session) => session.id === sessionId);
  if (!current) return;
  state.schedule = moveSession(state.schedule, sessionId, {
    day: change.day ?? current.day,
    start: change.start ?? current.start,
  });
  saveScheduleToStorage(localStorage, state.schedule);
  render();
}

function addSessionForClient(clientId: string | undefined): void {
  if (!clientId) return;
  const existing = state.schedule.filter((session) => session.clientId === clientId);
  const nextIdNumber = Math.max(0, ...state.schedule.map((session) => Number(session.id.replace(/\D/g, '')) || 0)) + 1;
  state.schedule = [
    ...state.schedule,
    {
      id: `s${String(nextIdNumber).padStart(3, '0')}`,
      clientId,
      day: existing.length === 0 ? 'monday' : 'wednesday',
      start: '14:00',
      durationMinutes: 60,
      focus: 'New coaching session',
    },
  ];
  saveScheduleToStorage(localStorage, state.schedule);
  render();
}

function deleteSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  state.schedule = state.schedule.filter((session) => session.id !== sessionId);
  saveScheduleToStorage(localStorage, state.schedule);
  render();
}

function syncClientList(): void {
  const filteredClients = getFilteredClients();
  const stats = getClientStats(state.clients);
  const clientList = document.querySelector<HTMLElement>('.client-list');
  if (clientList) clientList.innerHTML = renderClientList(filteredClients);
  document.querySelector<HTMLElement>('[data-stat="total"]')?.replaceChildren(String(stats.totalClients));
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

function openClientCard(clientId: string | undefined): void {
  if (!clientId) return;
  state.page = 'clients';
  state.query = '';
  render();
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`#client-${CSS.escape(clientId)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
    state.schedule = collectEditedSessions(form, state.editingId);
    saveScheduleToStorage(localStorage, state.schedule);
  } else {
    state.clients = createClient(state.clients, input);
  }

  state.editingId = null;
  persistClientsAndRender();
}

function collectEditedSessions(form: HTMLFormElement, clientId: string): CoachingSession[] {
  const rows = [...form.querySelectorAll<HTMLElement>('.session-editor-row')];
  const edited = rows.map((row) => ({
    id: row.querySelector<HTMLInputElement>('[name="session-id"]')?.value ?? crypto.randomUUID(),
    clientId,
    day: (row.querySelector<HTMLSelectElement>('[name="session-day"]')?.value ?? 'monday') as WeekDay,
    start: row.querySelector<HTMLInputElement>('[name="session-start"]')?.value || '09:00',
    durationMinutes: 60 as const,
    focus: row.querySelector<HTMLInputElement>('[name="session-focus"]')?.value || 'Coaching session',
  }));
  return [...state.schedule.filter((session) => session.clientId !== clientId), ...edited];
}

function closeModal(): void {
  state.editingId = null;
  render();
}

function persistClientsAndRender(): void {
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

  const register = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL }).catch((error: unknown) => {
      console.warn('Service worker registration failed', error);
    });
  };

  if (document.readyState === 'loading') {
    window.addEventListener('load', register, { once: true });
  } else {
    register();
  }
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
