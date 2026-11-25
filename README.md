# Day One Germany

A personal plan for your first 30 days in Germany — what to do, by when, and what you may be entitled to.
Installable web app (PWA), hosted on GitHub Pages.

> Practical guidance, not legal advice. All content is a **draft** until verified against official sources.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/germany-dayone/
npm test         # engine + content checks
npm run build    # production build into dist/
npm run preview  # serve the build locally (service worker active)
```

In `npm run dev` draft content is always shown (yellow banner).

## Deploy

Every push to `main` builds, tests and deploys via GitHub Actions.

One-time setup on GitHub:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Optional, **Settings → Secrets and variables → Actions → Variables**:
   - `VITE_SHOW_DRAFTS` — unverified content is shown on the live site by default (with a yellow banner); set to `false` once the content is verified
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — turn on anonymous analytics (see `supabase/schema.sql`)

Live URL: `https://kriscanin1-cloud.github.io/germany-dayone/`

## Structure

```
src/
  content/            first30days.de.json (tasks, entitlements), places.de.json, i18n/en.json
  lib/                engine.ts (+ tests), storage.ts, analytics.ts, content.ts, i18n.ts, types.ts
  screens/            Welcome, Timeline, Me, placeholders for the rest
  components/         Layout (bottom navigation)
docs/ARCHITECTURE.md  scope, data model, plan
supabase/schema.sql   insert-only tables + metrics view
```

## Editing content

- Tasks and entitlements live in `src/content/first30days.de.json`.
- Set `"status": "verified"` and `"lastVerified": "YYYY-MM-DD"` only after checking official sources.
- `npm test` checks that dependencies exist, have no cycles and are never due after the task that needs them.

## Privacy

No accounts. The profile stays on the device (`localStorage`). Only anonymous events (purpose, state, city, arrival month — never nationality, email or free text) go to Supabase in the EU, and only if it is configured.
