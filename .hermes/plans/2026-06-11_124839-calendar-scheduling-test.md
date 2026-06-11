# Calendar Scheduling Test Branch Implementation Plan

> **For Hermes:** Implement directly on a feature branch using TDD, keep `main` as the rollback point, and do not merge until the user approves.

**Goal:** Add a test version of CNotes with weekly one-hour coaching session schedules, five additional example clients, movable time slots, day view, and week view.

**Architecture:** Keep the stable app on `main`. Create a feature branch for the scheduling experiment. Add schedule data as `public/data/schedule.json`, schedule domain validation/move helpers under `src/domain/schedule.ts`, load schedule data through existing data loaders, and add calendar UI tabs/views in the SPA. Store schedule moves in localStorage so reschedules are local and reversible.

**Tech Stack:** Vite, TypeScript, vanilla DOM, Vitest, Git feature branch workflow.

---

## Git safety approach

- Current local `main` includes the latest client/FAB work at `835161c` but remote may not yet have it.
- Create branch: `feat/calendar-scheduling-test` from current local `main`.
- Commit all scheduling work on that branch.
- Push the branch, not `main`, so the current public CNotes deployment remains unchanged.
- If the user dislikes it later: `git checkout main && git branch -D feat/calendar-scheduling-test` locally and delete remote branch.

## Data model

Create `public/data/schedule.json`:

```ts
interface CoachingSession {
  id: string;
  clientId: string;
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  start: string; // HH:MM, no dates
  durationMinutes: 60;
  focus: string;
}
```

Constraints to validate:
- No Sunday sessions.
- No Saturday evening sessions; use Saturday morning/early afternoon only.
- Each session is exactly 60 minutes.
- Maximum three sessions in a row.
- At least a 30-minute break after any three hours of coaching.
- Each client has one, two, or three weekly sessions.
- Clients with multiple sessions have at least one full day between session days.

## Planned work

1. Create branch `feat/calendar-scheduling-test`.
2. Add failing tests for schedule constraints and moving sessions.
3. Add `src/domain/schedule.ts` with validation, grouping, move helpers, and time utilities.
4. Add five new example clients to `public/data/seed-clients.json`.
5. Add `public/data/schedule.json` with 20 clients and weekly sessions satisfying constraints.
6. Add schedule loader to `src/data/loaders.ts`.
7. Add schedule localStorage helpers to `src/state/store.ts` or a new `src/state/scheduleStore.ts`.
8. Update `src/main.ts` to support tabs/pages: Clients, Day, Week.
9. Implement day view with day selector and movable session time controls.
10. Implement week view grouped by weekday.
11. Add CSS for calendar/day/week layouts and mobile usability.
12. Run `npm run check`.
13. Preview locally through `/cnotes/` and verify: 20 client cards, calendar tabs, day view, week view, moving a session persists locally.
14. Commit branch and push feature branch only.

## Verification

- `npm run check` passes.
- Browser preview verifies cards and calendar views.
- Schedule validation tests pass.
- Git branch contains changes; `main` remains unmodified after branch creation.
- Public active CNotes remains the current deployed `main` until the user chooses to merge/deploy.
