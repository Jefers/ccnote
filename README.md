# CNotes

CNotes is a small, installable Progressive Web App for fitness coaches who want fast client-note cards on a phone.

Live app: <https://jefers.github.io/cnotes/>

## What it does

- Keeps client cards for goals, preferences, medical cautions, and progress notes.
- Stores edits locally in the browser with `localStorage`; no backend or runtime secrets are used.
- Ships with demo seed clients in `public/data/seed-clients.json`.
- Supports quick mobile search and one-handed floating controls:
  - `+` creates a new client.
  - `↑` jumps to the previous visible client card.
  - `↓` jumps to the next visible client card.
- Installs as a PWA on supported mobile and desktop browsers.

## Project structure

```text
public/
  data/
    app.json              # app copy and mood labels
    seed-clients.json     # default demo clients
  icons/                  # PWA icon source and generated PNGs
  manifest.webmanifest
  service-worker.js
src/
  data/loaders.ts         # static JSON loading
  domain/client.ts        # client CRUD/search/stats logic
  domain/navigation.ts    # smart card navigation logic
  state/store.ts          # localStorage persistence
  main.ts                 # DOM app shell
  styles.css              # responsive UI and PWA styling
tests/
  card-navigation.test.ts
  client-domain.test.ts
```

## Local development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Run tests and production build:

```bash
npm run check
```

Preview the production build with the same project-page base path used on GitHub Pages:

```bash
npm run preview -- --host 127.0.0.1
```

Open the `/cnotes/` path shown by Vite preview.

## Deployment

GitHub Actions builds and deploys the app to GitHub Pages from `main` using `.github/workflows/ci.yml`.

The Vite base path is configured as `/cnotes/` in `vite.config.ts`, and PWA scope/start URLs are configured for the same GitHub Pages project path.

## Privacy note

CNotes is a static app. Client changes live in the user's browser storage. Do not put real private client information into `public/data/seed-clients.json`, because anything committed there is public on GitHub Pages.
