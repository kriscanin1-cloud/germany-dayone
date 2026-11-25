# Day One Germany — MVP architecture (PWA)

Working title. Goal of this version: an installable web app with a personal **"First 30 days in Germany"** timeline, ready for user tests and the Circle U. application (deadline 5 Dec 2026).

The MVP must answer one question (XYZ hypothesis):

> At least **30%** of newcomers who complete onboarding will **mark at least one task done or open an entitlement action** within **7 days**, and at least **20%** will **join a "same-month arrivals" meetup list**.

Everything that does not help measure this is out of scope.

---

## 1. Scope

### In scope (by 5 Dec)
| Module | What it does |
|---|---|
| **Onboarding** | 5–6 questions → profile stored on the device |
| **My timeline** | Tasks for the first 30 days, filtered by profile, sorted by deadline and dependencies, with "done" checkboxes |
| **Task detail** | Why it matters, steps, documents, official links, "last verified" date |
| **What you may be entitled to** | 5–8 cards (e.g. tax refund, language course, student discounts) with conditions and next step |
| **People** | "Coffee with people who arrived the same month in your city" → join list (email optional) + link to a moderated group chat |
| **Fake doors** | Buttons for "AI explains my letter" and "Personal plan (paid)" → "coming soon, want early access?" — measures demand |
| **Feedback** | 1–5 rating + free text, "can we interview you?" |
| **Language** | English only. UI strings live in `i18n/en.json` so more languages can be added later without code changes |
| **Install hint** | iPhone instruction "Share → Add to Home Screen" |

### Out of scope (later)
Accounts and sync across devices, email/push reminders, AI letter explainer, payments, partner marketplace, other languages, city-specific office details, the full list of German municipalities, later life stages (permit renewal → citizenship).

### Personas covered
Shared core for **international students** and **skilled workers (incl. Blue Card / Chancenkarte)** from non-EU countries, plus an "EU citizen" flag that hides permit tasks. This directly tests the claim that the first-30-day problems are mostly the same across groups.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React + Vite + TypeScript | Standard, every AI coding tool knows it |
| Styling | Tailwind CSS | Fast mobile-first UI |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest + service worker + offline cache |
| Routing | **HashRouter** (`/#/timeline`) | GitHub Pages cannot serve SPA routes; hash routes always work |
| Content | JSON files in the repo (`src/content/`) | No CMS needed; versioned; easy to review |
| Local state | `localStorage` (wrapped in try/catch) | No login → lowest friction |
| Backend (minimal) | **Supabase, EU region (Frankfurt)** | Anonymous analytics events, waitlist, feedback |
| Hosting | GitHub Pages via GitHub Actions | Free HTTPS; move to Vercel/Netlify/Cloudflare when commercial |

**No secrets in the frontend.** The Supabase *anon* key is public by design; protection comes from Row Level Security (insert-only tables, see `supabase_schema.sql`). Any future AI call goes through a Supabase Edge Function that holds the model key.

---

## 3. Folder structure

```
dayone/
├─ public/
│  ├─ icons/ (icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png)
├─ src/
│  ├─ content/
│  │  ├─ first30days.de.json      # tasks + entitlements (see sample file)
│  │  ├─ places.de.json           # 16 states + starter list of cities → state
│  │  └─ i18n/en.json             # UI strings (English only for now)
│  ├─ lib/
│  │  ├─ profile.ts               # load/save profile in localStorage
│  │  ├─ engine.ts                # filter + date + dependency sort
│  │  ├─ analytics.ts             # track(name, props) → Supabase "events"
│  │  └─ supabase.ts              # client (URL + anon key from env)
│  ├─ screens/
│  │  ├─ Onboarding.tsx
│  │  ├─ Timeline.tsx
│  │  ├─ TaskDetail.tsx
│  │  ├─ Entitlements.tsx
│  │  ├─ People.tsx
│  │  └─ Feedback.tsx
│  ├─ components/ (TaskCard, ProgressBar, InstallHint, FakeDoorModal, BottomNav)
│  ├─ App.tsx, main.tsx
├─ .github/workflows/deploy.yml
├─ vite.config.ts
└─ .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) — set as GitHub Actions secrets/vars
```

---

## 4. Screens and navigation

Bottom navigation with 4 tabs: **Timeline · Entitled · People · Me**.

1. **Welcome** → "Get your personal plan in 1 minute" → Onboarding.
2. **Onboarding** (one question per screen):
   - Why are you moving? `study | work | chancenkarte | other`
   - Are you an EU/EEA/Swiss citizen? `yes | no` (if `yes`, the `chancenkarte` purpose and all visa/permit tasks are hidden)
   - When did/will you arrive? (date)
   - Where will you live? City search with the state shown next to each result ("Frankfurt am Main · Hesse", "Frankfurt (Oder) · Brandenburg"); fallback "My town is not listed" → pick one of the 16 states
   - Already done? (multi-select: address registration, bank, health insurance) → pre-checks tasks
3. **Timeline**: progress bar ("4 of 11 done"), sections *Overdue / This week / Next / Later*, each task card shows due date and category chip (status · money · everyday · people).
4. **Task detail**: why it matters → steps → documents → official links → "last verified" → "Mark as done".
5. **Entitled**: cards with "Might apply to you" tag, conditions, estimated value (text), "How to get it" button (tracked).
6. **People**: one card "Coffee with people who arrived in {month} in {city or state}" → join (state + city + email optional + consent), plus link to group chat.
7. **Me**: profile edit, "Delete my data" (clears localStorage), feedback, privacy note.

**Not storing:** nationality, passport data, document scans, exact address.

---

## 5. Content model

Content is data, not code. The engine reads JSON and the profile; editors (you) only touch JSON.

```ts
type Purpose = 'study' | 'work' | 'chancenkarte' | 'other';
type StateCode =                                   // ISO 3166-2:DE
  'DE-BW' | 'DE-BY' | 'DE-BE' | 'DE-BB' | 'DE-HB' | 'DE-HH' | 'DE-HE' | 'DE-MV' |
  'DE-NI' | 'DE-NW' | 'DE-RP' | 'DE-SL' | 'DE-SN' | 'DE-ST' | 'DE-SH' | 'DE-TH';
type Lang = 'en';                                  // more languages later
type T = Partial<Record<Lang, string>>;            // translatable text, 'en' required

interface Task {
  id: string;
  category: 'status' | 'money' | 'everyday' | 'people';
  title: T; summary: T; why: T;
  steps: T[]; documents: T[];
  deadline: {
    offsetDays: number;      // days after arrival date
    hard: boolean;           // legal deadline vs. recommendation
    note?: T;
  };
  dependsOn: string[];       // task ids that should be done first
  appliesTo: {
    purposes: Purpose[] | 'all';
    euCitizen?: boolean;     // omit = everyone; false = non-EU only
    states?: StateCode[];    // omit = all of Germany
    cities?: string[];       // city ids from places.de.json; omit = everywhere
  };
  links: { label: T; url: string; official: boolean }[];
  lastVerified: string;      // ISO date, shown in UI
  status: 'draft' | 'verified';   // only 'verified' shown in production build
}

interface Entitlement {
  id: string;
  title: T; valueHint: T; conditions: T[]; howTo: T;
  appliesTo: Task['appliesTo'];
  links: Task['links'];
  lastVerified: string; status: 'draft' | 'verified';
}
```

### Engine (`engine.ts`)
1. `applies(item, profile)` — purpose, EU flag, state and (if set) city match. An item with `cities` also matches only if the profile has a city.
2. `dueDate = arrivalDate + offsetDays`.
3. Topological sort by `dependsOn`, then by `dueDate`.
4. Bucket: overdue / this week / next 7–14 days / later.
5. Hide items with `status: 'draft'` when `import.meta.env.PROD && !SHOW_DRAFTS`.

Keep it pure (no React inside) so it can be unit-tested with a few profiles.

### Location model
- The profile stores **`state`** (always) and **`cityId`** (when the city was found).
- Why both: residence and registration law are federal, but *how* things work (which office, how to book, forms) is decided by the city or district; the **state** decides schools, childcare, some family benefits, public holidays and naturalisation procedures.
- `places.de.json` holds the 16 states and a starter list of ~80 large and university cities, each with its state. Search shows the state next to every result because names repeat (Frankfurt am Main / Frankfurt (Oder)).
- Not in the list → "My town is not listed" → choose the state; `cityId` stays empty and only state-level and nationwide content is shown.
- Later: replace the starter list with the official municipality register (Destatis Gemeindeverzeichnis, ~11,000 municipalities) or a postcode/locality API, keeping the same `{ id, name, state }` shape.

---

## 6. Data and analytics

### On device (`localStorage`, key `dayone.v1`)
```json
{ "anonId": "uuid", "profile": { "purpose": "study", "eu": false, "arrival": "2026-10-01",
  "state": "DE-BE", "cityId": "berlin" }, "done": ["anmeldung"], "createdAt": "..." }
```
Wrap every read/write in try/catch; if storage fails, keep state in memory.

### In Supabase (insert-only, see `supabase_schema.sql`)
- `events` — anonymous product events
- `waitlist` — meetup / early-access sign-ups (email only with explicit consent)
- `feedback` — rating + text

### Events to track (map 1:1 to the hypothesis)
| Event | Props |
|---|---|
| `onboarding_started` / `onboarding_completed` | purpose, eu, state, city_listed (true/false), days_since_arrival |
| `timeline_viewed` | tasks_total, tasks_done |
| `task_opened` / `task_done` / `task_undone` | task_id |
| `link_clicked` | item_id, official |
| `entitlement_opened` / `entitlement_action` | entitlement_id |
| `people_viewed` / `meetup_joined` / `group_link_clicked` | state, city_id |
| `fake_door_clicked` | feature: `ai_letter` \| `paid_plan` |
| `app_opened` | is_standalone (installed?), days_since_first_open |
| `feedback_sent` | rating |

Never send emails or free text in `events`. Purpose, state, city and arrival month only — no nationality.

**Key numbers for the application:** onboarding completion rate; % with ≥1 `task_done` or `entitlement_action` within 7 days; % `meetup_joined`; fake-door click rates; % installed (`is_standalone`).

---

## 7. PWA and GitHub Pages config

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/dayone/',                         // = repo name
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Day One Germany',
        short_name: 'Day One',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1f4e79',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});
```
Also add `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">` and `<meta name="apple-mobile-web-app-capable" content="yes">` in `index.html`.

### `.github/workflows/deploy.yml`
```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.d.outputs.page_url }} }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```
Repo → Settings → Pages → Source: **GitHub Actions**.

### Must-test on real devices (day 1)
- Android Chrome: install prompt, offline open.
- **iPhone Safari in the EU**: "Add to Home Screen", opens standalone (no address bar), state survives restart.

---

## 8. Privacy and trust (minimum for user tests)

- Short privacy note in the app: what is stored on the device, what goes to Supabase (anonymous events), EU hosting, how to delete.
- Email only for the meetup/early-access list, with an unticked consent checkbox.
- Every task shows sources and "last verified"; footer: *"Practical guidance, not legal advice."*
- "Delete my data" clears the device; waitlist entries deletable on request (email address in the note).

---

## 9. Plan to 5 December

| Days | Work |
|---|---|
| 21–22 Nov | Repo, Vite + PWA + Tailwind, HashRouter, deploy pipeline live on Pages; test install on iPhone + Android |
| 23–25 Nov | Content: write and verify 10–12 tasks + 5–8 entitlements (start from `first30days.de.sample.json`) |
| 25–27 Nov | Onboarding, engine, timeline, task detail |
| 28–29 Nov | Entitled, People, fake doors, feedback; Supabase tables + analytics |
| 30 Nov – 1 Dec | Polish, privacy note; share with first 10–15 users |
| 2–4 Dec | Collect first numbers + interviews; write executive summary with real data |
| 5 Dec | Submit to Circle U. |

## 10. After the MVP (not now)
1. Magic-link accounts + sync (Supabase Auth) → email reminders (Edge Function + scheduled job).
2. Web push for installed users.
3. AI letter explainer via Edge Function (model key on server only).
4. Next life stages: permit renewal, settlement permit, naturalisation.
5. Move hosting off GitHub Pages before charging money; then Capacitor/Expo for the stores.
