# Questionnaire and data flow

Source of truth: `src/content/questionnaire.json` (version `2026-11-v2`).
Database: `supabase/migrations/` (run 001, then 002).

## What is asked now

Only the **Your plan** part is enabled (~1 minute):

| # | Question | Shown to | Notes |
|---|---|---|---|
| 1 | Why are you moving to Germany? | everyone | study · job · job search (Opportunity Card) · family · something else (free text) |
| 2 | EU / EEA / Swiss citizen? | everyone | "yes" hides visa and permit steps |
| 3 | Current residence status | **non-EU only** | not in Germany yet · visa-free/tourist · national (D) visa · waiting for permit (Fiktionsbescheinigung) · residence permit · Blue Card · Opportunity Card · permanent residence · asylum/protection · not sure · something else (free text) |
| 4 | Arrival date | everyone | exact date on the device, month only on the server |
| 5 | City (or state if not listed) | everyone | |
| 6 | Who is moving with you? | everyone | just me · partner · children · something else (free text) |
| 7 | German level | everyone | none · A1–A2 · B1–B2 · C1+ |
| 8 | Already done | everyone | pre-ticks tasks in the plan |

At the end: an **unticked** checkbox — *"Share my answers with Day One, without my name, to improve the app…"* (`consents.research_v1`).

The **Help us improve** part (worries, who helps, paid for help, preferred language, how you found us, interview email) is kept in the file with `"enabled": false` for a later version.

### How the status changes the plan
- Tasks can be limited with `appliesTo.statuses`. A profile without a status (EU citizens) is never filtered out by it.
- *Book your residence permit appointment* is shown for: not in Germany yet, visa-free, national visa, not sure, something else. It is hidden for people who already hold or have applied for a permit.
- *Asylum or protection status*: this version is built for study and work migration; the app should say so and point to free counselling (content to add).

## Three data streams

```
Device (localStorage)
  all answers, exact arrival date, free-text "something else", done tasks
  ──► builds the plan, never leaves the phone

Supabase  events     (anonymous usage)
  onboarding_completed {purpose, eu, state, city_listed}, task_done, …
  ──► funnel and the 7-day activation metric

Supabase  responses  (only if the person ticked the consent box)
  plan: purpose, eu, status, arrival month, state, city, household, German level, already done
  ──► insights and segmentation
```

Rules:
- Never sent to the server: exact arrival date, names, nationality, free text.
- Each question and option has a stable id. A changed meaning means a new id and a new questionnaire version; old rows keep their version.
- Each submit inserts a new `responses` row; the `responses_latest` view gives one row per person.

## What consented data can be used for

Covered by `research_v1`:
- improving the app (which tasks, statuses, cities and languages to cover);
- segmentation: who struggles with what (students vs workers, by status, state, German level);
- **combined statistics that cannot identify anyone**, e.g. a report for universities or employers.

Not covered (needs a new consent): sharing individual rows, contacting people with offers, linking to other datasets.

## Deletion and retention

- *Me → Delete my data* clears the device and shows the anonymous ID for a server deletion request (SQL in migration 002).
- Consented rows older than 24 months are deleted (SQL in migration 002; schedule it).

## Before going public

The consent text, the privacy note and the legal basis for anonymous usage events need a check by someone qualified in GDPR. This document describes the technical design, not legal advice.
