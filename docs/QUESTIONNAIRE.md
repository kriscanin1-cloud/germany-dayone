# Questionnaire and data flow

Source of truth: `src/content/questionnaire.json` (version `2026-11-v1`).
Database: `supabase/migrations/001_schema.sql`, then `supabase/migrations/002_responses.sql`.

## Two parts, two purposes

| Part | Questions | Why we ask | Where it goes |
|---|---|---|---|
| **Your plan** (required, ~1 min) | purpose, EU citizen, arrival date, city/state, household, German level, already done | To build the personal plan | **Device only** (`localStorage`). Coarse version to the server **only with research consent** |
| **Help us improve** (optional, ~1 min) | worries (max 3), who helps, paid for help, preferred language, how you found us, interview email | To learn what newcomers need and who pays | Server, **only with research consent** (unticked by default) |

## Three data streams

```
Device (localStorage)
  full answers, exact arrival date, done tasks  ──► builds the plan, never leaves the phone

Supabase  events     (anonymous usage, always on if configured)
  onboarding_completed {purpose, eu, state, city_listed}, task_done, …   ──► funnel + activation metric

Supabase  responses  (research, consent only)
  plan: coarse answers (arrival → YYYY-MM), research answers, consent id   ──► insights, segmentation

Supabase  waitlist   (contact, explicit consent)
  email + interest ('interview' | 'meetup' | …)   ──► kept apart from answers
```

Rules:
- The exact arrival date, names, nationality and free text are never sent to the server.
- Emails live only in `waitlist`, never next to answers.
- Each question and option has a stable id. A changed meaning = new id + new questionnaire version; old rows keep their version.
- Each submit inserts a new `responses` row; `responses_latest` gives one row per person.

## What the collected data can be used for later

Covered by the research consent text (`consents.research_v1`):
- improving the app (which tasks, entitlements and languages to add);
- segmentation: who struggles with what (students vs workers, by state, German level);
- willingness-to-pay signals (`paid_for_help`, `helpers`);
- channel attribution (`heard_from`);
- **combined statistics that cannot identify anyone**, e.g. a report for universities or employers on what newcomers struggle with.

Not covered (would need a new consent): selling or sharing individual rows, contacting people about offers, linking to other datasets.

## Deletion and retention

- *Me → Delete my data* clears the device and shows the anonymous ID for a server deletion request (SQL in the migration file).
- Research rows older than 24 months are deleted (SQL in the migration file; schedule it).

## Before going public

The consent text, the privacy note and the legal basis for anonymous usage events need a check by someone qualified in GDPR. This document describes the technical design, not legal advice.
