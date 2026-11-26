-- Day One Germany — MVP schema (Supabase, EU region)
-- Run in Supabase → SQL Editor.
-- Model: the public app (anon key) may only INSERT. Nobody can read via the API;
-- you read the data in the dashboard / SQL editor (service role).
-- Note: call inserts without .select() in supabase-js (default "return=minimal"),
-- otherwise the insert fails because anon has no SELECT policy.

------------------------------------------------------------
-- 1. Anonymous product events
------------------------------------------------------------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  anon_id     uuid        not null,
  name        text        not null check (name ~ '^[a-z][a-z0-9_]{0,63}$'),
  props       jsonb       not null default '{}'::jsonb
                          check (pg_column_size(props) < 2000),
  created_at  timestamptz not null default now()
);
create index if not exists events_anon_idx on public.events (anon_id, created_at);
create index if not exists events_name_idx on public.events (name, created_at);

alter table public.events enable row level security;
drop policy if exists "anon insert events" on public.events;
create policy "anon insert events" on public.events
  for insert to anon with check (true);

------------------------------------------------------------
-- 2. Waitlist: meetups, early access (fake doors), interview sign-ups
------------------------------------------------------------
create table if not exists public.waitlist (
  id            bigint generated always as identity primary key,
  anon_id       uuid        not null,
  interest      text        not null
                check (interest in ('meetup', 'ai_letter', 'paid_plan', 'interview')),
  state         text        check (state ~ '^DE-[A-Z]{2}$'),      -- ISO 3166-2:DE
  city_id       text        check (char_length(city_id) <= 60),    -- id from places.de.json, null if not listed
  arrival_month text        check (arrival_month ~ '^\d{4}-\d{2}$'),
  email         text        check (email is null or
                                   (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  consent       boolean     not null default false,
  created_at    timestamptz not null default now(),
  -- an email may only be stored with explicit consent
  constraint email_needs_consent check (email is null or consent = true)
);

alter table public.waitlist enable row level security;
drop policy if exists "anon insert waitlist" on public.waitlist;
create policy "anon insert waitlist" on public.waitlist
  for insert to anon with check (true);

------------------------------------------------------------
-- 3. Feedback
------------------------------------------------------------
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  anon_id     uuid        not null,
  rating      smallint    check (rating between 1 and 5),
  message     text        check (char_length(message) <= 2000),
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;
drop policy if exists "anon insert feedback" on public.feedback;
create policy "anon insert feedback" on public.feedback
  for insert to anon with check (true);

------------------------------------------------------------
-- 4. Metrics for the hypothesis (run in SQL editor)
------------------------------------------------------------
-- Activation: users who completed onboarding and, within 7 days,
-- marked a task done or clicked an entitlement action.
create or replace view public.metric_activation_7d
with (security_invoker = true) as
with onboarded as (
  select anon_id, min(created_at) as t0
  from public.events
  where name = 'onboarding_completed'
  group by anon_id
),
activated as (
  select distinct o.anon_id
  from onboarded o
  join public.events e
    on e.anon_id = o.anon_id
   and e.name in ('task_done', 'entitlement_action')
   and e.created_at <= o.t0 + interval '7 days'
),
joined_meetup as (
  select distinct anon_id from public.events where name = 'meetup_joined'
)
select
  (select count(*) from onboarded)                                   as onboarded_users,
  (select count(*) from activated)                                   as activated_7d,
  round(100.0 * (select count(*) from activated)
        / nullif((select count(*) from onboarded), 0), 1)            as activation_7d_pct,
  (select count(*) from joined_meetup j join onboarded o using (anon_id)) as meetup_joined,
  round(100.0 * (select count(*) from joined_meetup j join onboarded o using (anon_id))
        / nullif((select count(*) from onboarded), 0), 1)            as meetup_pct;

-- The view inherits the caller's rights (security_invoker), so anon cannot read it.
revoke all on public.metric_activation_7d from anon, authenticated;

-- Fake-door demand:
-- select props->>'feature' as feature, count(distinct anon_id)
-- from public.events where name = 'fake_door_clicked' group by 1;

-- Funnel:
-- select name, count(distinct anon_id) from public.events
-- where name in ('onboarding_started','onboarding_completed','timeline_viewed',
--                'task_done','entitlement_action','meetup_joined')
-- group by 1 order by 2 desc;

------------------------------------------------------------
-- 5. Security hardening (OWASP A01/A08)
------------------------------------------------------------
-- The anon key is public by design. It may insert only the columns the app sends:
-- ids and timestamps are set by the database, never by the client.
revoke all on public.events, public.waitlist, public.feedback from anon, authenticated;
grant insert (anon_id, name, props) on public.events to anon;
grant insert (anon_id, interest, state, city_id, arrival_month, email, consent) on public.waitlist to anon;
grant insert (anon_id, rating, message) on public.feedback to anon;
-- Analysis views are for the dashboard only, never for the API.
revoke all on public.metric_activation_7d from anon, authenticated;
