-- Day One — numbers for the Circle U application and weekly check-ins.
-- Paste one block at a time into Supabase → SQL Editor → Run. Read-only.

-- 1. Headline numbers (activation, meetup intent)
select * from public.metric_activation_7d;

-- 2. Return in week 2 (only users onboarded 14+ days ago count)
select * from public.metric_week2_return;

-- 3. Funnel: visitors → onboarding → useful action
select
  count(distinct anon_id) filter (where name = 'app_opened')           as visitors,
  count(distinct anon_id) filter (where name = 'onboarding_started')   as started_onboarding,
  count(distinct anon_id) filter (where name = 'onboarding_completed') as completed_onboarding,
  count(distinct anon_id) filter (where name in ('task_opened','task_done')) as used_tasks,
  count(distinct anon_id) filter (where name = 'entitlement_opened')   as opened_entitlements,
  count(distinct anon_id) filter (where name = 'discover_category')    as browsed_discover
from public.events;

-- 4. Where people drop out of onboarding (step = question number)
select props->>'question' as question, (props->>'step')::int as step, count(distinct anon_id) as users
from public.events where name = 'onboarding_step'
group by 1, 2 order by 2;

-- 5. Tasks done per user in the first 30 days
with o as (select anon_id, min(created_at) t0 from public.events where name = 'onboarding_completed' group by 1)
select round(avg(n), 1) as avg_tasks_done, percentile_cont(0.5) within group (order by n) as median
from (
  select o.anon_id, count(e.*) filter (where e.name = 'task_done' and e.created_at <= o.t0 + interval '30 days') as n
  from o left join public.events e using (anon_id) group by o.anon_id
) t;

-- 6. Which tasks people open and tick
select props->>'task' as task,
       count(*) filter (where name = 'task_opened') as opened,
       count(*) filter (where name = 'task_done')   as done
from public.events where name in ('task_opened','task_done')
group by 1 order by opened desc;

-- 7. Provider clicks (affiliate potential) and entitlements opened
select 'provider' as kind, props->>'name' as item, count(distinct anon_id) as users
from public.events where name = 'choice_clicked' group by 2
union all
select 'entitlement', props->>'id', count(distinct anon_id)
from public.events where name = 'entitlement_opened' group by 2
order by kind, users desc;

-- 8. People tab (fake door): who wants meetups
select name, props->>'kind' as kind, count(distinct anon_id) as users
from public.events where name in ('meetup_create_opened','meetup_created','meetup_rsvp','meetup_notify','people_filter')
group by 1, 2 order by users desc;

-- 9. Segments — only users who gave research consent send these fields
select props->>'purpose' as purpose, props->>'citizenship' as passport, props->>'status' as status,
       count(*) as users
from public.events where name = 'onboarding_completed' and (props->>'consent')::boolean
group by 1, 2, 3 order by users desc;

-- 10. Consent rate and research answers
select count(*) filter (where (props->>'consent')::boolean) as consented,
       count(*) as completed,
       round(100.0 * count(*) filter (where (props->>'consent')::boolean) / nullif(count(*), 0), 1) as consent_pct
from public.events where name = 'onboarding_completed';

-- 11. Errors in the app (type only, never the message)
select props->>'kind' as kind, count(*) as times, max(created_at) as last_seen
from public.events where name = 'app_error' group by 1 order by times desc;

-- 12. Daily activity (last 30 days)
select date_trunc('day', created_at)::date as day, count(distinct anon_id) as active_users, count(*) as events
from public.events where created_at > now() - interval '30 days'
group by 1 order by 1;
