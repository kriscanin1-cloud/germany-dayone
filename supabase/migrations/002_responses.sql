-- Day One Germany — questionnaire answers (research data, consent only)
-- Run after 001_schema.sql in Supabase → SQL Editor.
--
-- What lands here:
--   * a row ONLY when the person ticked the research consent;
--   * plan answers in coarse form (arrival as month, never the exact date);
--   * research answers;
--   * never names, emails, nationality or free text (emails go to `waitlist`).
-- Each submit inserts a new row; analysis uses the latest row per anon_id.

create table if not exists public.responses (
  id                     bigint generated always as identity primary key,
  anon_id                uuid        not null,
  questionnaire_version  text        not null check (char_length(questionnaire_version) <= 32),
  -- plan answers, coarse: purpose, eu, arrival_month, state, city_id, household, german_level, done_already
  plan                   jsonb       not null default '{}'::jsonb check (pg_column_size(plan) < 2000),
  -- research answers: worries, helpers, paid_for_help, read_language, heard_from
  research               jsonb       not null default '{}'::jsonb check (pg_column_size(research) < 2000),
  consent                text        not null check (consent = 'research_v1'),  -- which consent text was shown
  created_at             timestamptz not null default now()
);
create index if not exists responses_anon_idx on public.responses (anon_id, created_at desc);

alter table public.responses enable row level security;
drop policy if exists "anon insert responses" on public.responses;
create policy "anon insert responses" on public.responses
  for insert to anon with check (true);

-- Latest answers per person, flattened for analysis (read in SQL editor / export as CSV)
create or replace view public.responses_latest
with (security_invoker = true) as
select distinct on (anon_id)
  anon_id,
  questionnaire_version,
  created_at,
  plan->>'purpose'        as purpose,
  (plan->>'eu')::boolean  as eu,
  plan->>'arrival_month'  as arrival_month,
  plan->>'state'          as state,
  plan->>'city_id'        as city_id,
  plan->>'household'      as household,
  plan->>'german_level'   as german_level,
  plan->'done_already'    as done_already,
  research->'worries'     as worries,
  research->'helpers'     as helpers,
  research->>'paid_for_help' as paid_for_help,
  research->>'read_language' as read_language,
  research->>'heard_from' as heard_from
from public.responses
order by anon_id, created_at desc;
revoke all on public.responses_latest from anon, authenticated;

-- Example: top worries by purpose
-- select purpose, w as worry, count(*) from public.responses_latest,
--   jsonb_array_elements_text(worries) w group by 1,2 order by 1,3 desc;

-- Retention: delete research rows older than 24 months (run monthly, or schedule with pg_cron)
-- delete from public.responses where created_at < now() - interval '24 months';

-- Deletion request: the app shows the person's anon_id under Me
-- delete from public.responses where anon_id = '<id>';
-- delete from public.events    where anon_id = '<id>';
-- delete from public.waitlist  where anon_id = '<id>';
-- delete from public.feedback  where anon_id = '<id>';
