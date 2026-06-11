import { describe, expect, it } from 'vitest';
import mainSource from '../src/main.ts?raw';
import serviceWorkerSource from '../public/service-worker.js?raw';

describe('week calendar markup and report access', () => {
  it('does not combine the week header spacer with the time axis class', () => {
    expect(mainSource).not.toContain('time-axis week-header-spacer');
    expect(mainSource).toContain('week-calendar-header');
    expect(mainSource).toContain('week-calendar-body');
  });

  it('renders calendar names with a forced surname line break', () => {
    expect(mainSource).toContain('week-given-names');
    expect(mainSource).toContain('week-surname');
    expect(mainSource).toContain('<br class="week-name-break"');
  });

  it('links the title panel to the research report and precaches the report page', () => {
    expect(mainSource).toContain('research-report.html');
    expect(serviceWorkerSource).toContain('research-report.html');
  });
});
