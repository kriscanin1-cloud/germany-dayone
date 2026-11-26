-- Metrics views matching the event names the app sends today (Nov 2026).
-- Run once in SQL Editor after 001–002. Dashboard only: no API role can read these.

-- The column names changed, so the old view is dropped first (it holds no data, only a query).
drop view if exists public.metric_activation_7d;

-- Activation: completed onboarding and, within 7 days, did something useful:
-- ticked a task, opened a task, opened an entitlement or clicked a provider.
create or replace view public.metric_activation_7d
with (security_invoker = true) as
with onboarded as (
  select anon_id, min(created_at) as t0
  from public.events where name = 'onboarding_completed' group by anon_id
),
activated as (
  select distinct o.anon_id
  from onboarded o
  join public.events e on e.anon_id = o.anon_id
   and e.name in ('task_done', 'task_opened', 'entitlement_opened', 'choice_clicked')
   and e.created_at between o.t0 and o.t0 + interval '7 days'
),
meetup_intent as (
  select distinct anon_id from public.events
  where name = 'meetup_created' or (name = 'meetup_rsvp' and props->>'kind' = 'going')
)
select
  (select count(*) from onboarded)                                             as onboarded_users,
  (select count(*) from activated)                                             as activated_7d,
  round(100.0 * (select count(*) from activated) / nullif((select count(*) from onboarded), 0), 1) as activation_7d_pct,
  (select count(*) from meetup_intent m join onboarded o using (anon_id))      as meetup_intent_users,
  round(100.0 * (select count(*) from meetup_intent m join onboarded o using (anon_id))
        / nullif((select count(*) from onboarded), 0), 1)                      as meetup_intent_pct;

-- Return in week 2: of users onboarded at least 14 days ago, how many came back on day 7–14.
create or replace view public.metric_week2_return
with (security_invoker = true) as
with onboarded as (
  select anon_id, min(created_at) as t0
  from public.events where name = 'onboarding_completed' group by anon_id
  having min(created_at) <= now() - interval '14 days'
),
returned as (
  select distinct o.anon_id from onboarded o
  join public.events e on e.anon_id = o.anon_id
   and e.created_at between o.t0 + interval '7 days' and o.t0 + interval '14 days'
)
select (select count(*) from onboarded) as cohort,
       (select count(*) from returned)  as returned_week2,
       round(100.0 * (select count(*) from returned) / nullif((select count(*) from onboarded), 0), 1) as week2_return_pct;

revoke all on public.metric_activation_7d, public.metric_week2_return from anon, authenticated;
