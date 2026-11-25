# Questionnaire and data flow

Source of truth: `src/content/questionnaire.json` (version `2026-11-v3`).
Database: `supabase/migrations/` (run 001, then 002).
Research behind v3: the "Steps by status" table (20 steps × 8 statuses, with sources).

## What is asked now

Only the **Your plan** part is enabled (~1–2 minutes). Answers are picked, then confirmed with **Next** (no auto-advance).

| # | Question | Shown to | Notes |
|---|---|---|---|
| 1 | Why are you moving to Germany? | everyone | study · job · job search (Opportunity Card) · family · something else (free text) |
| 2 | Which passport do you hold? | everyone | `eu` EU/EEA/Swiss · `best_friend` § 41 AufenthV countries (AU, CA, IL, JP, NZ, KR, UK, US) · `other`. Replaces v2 `eu: yes/no` (old answers migrated) |
| 3 | Current residence status | non-EU | as in v2 |
| 4 | When does your visa or permit end? | status = D visa, Opportunity Card, residence permit, Blue Card | optional; **device only**; permit deadline = end − 42 days |
| 5 | Arrival date | everyone | exact on device, month on server |
| 6 | Do you have a place to live? | everyone | moved in · not yet moved in · still looking |
| 7 | Move-in date | has a place | **device only**; Anmeldung, tax ID, broadcasting fee and licence count from it |
| 8 | City (or state) | everyone | |
| 9 | Who is moving with you? | everyone | children → Kindergeld |
| 10 | Will you drive in Germany? | non-EU | yes/maybe → licence swap task (6-month limit) |
| 11 | German level | everyone | |
| 12 | Already done | everyone | pre-ticks tasks |

`showIf` takes a list (`{question, in: [...]}`) and chains: a follow-up of a hidden question is hidden too.

### How answers change the plan
- `appliesTo` can filter by `purposes`, `euCitizen`, `statuses`, `citizenship`, `match` (household / housing / drives / germanLevel; a missing answer does not match) and `anyOf` (OR of alternatives).
- `deadline.from` = `arrival` | `moveIn` | `visaEnd`; if that date is unknown, the deadline counts from arrival with `fallbackOffsetDays`.
- Permit tasks: D visa / Opportunity Card / not sure → *Apply before your visa ends*; § 41 nationals visa-free → *Apply within 90 days* (no work until issued); other nationals on a tourist stay → *Check what your tourist stay allows*.
- Long-term **milestones** (job-search permit, settlement permits, EU permanent right, citizenship) appear under *Further ahead*.
- Asylum/protection: still to add — point to free counselling.

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
