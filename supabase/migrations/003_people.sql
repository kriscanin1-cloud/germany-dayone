-- People tab: meetups and RSVPs. DRAFT — not applied yet; the app runs as a fake door until this exists.
-- Reviewed against OWASP Top 10 (2025): exact place split out, RSVPs only to live meetups, profiles visible
-- only to people who share a meetup, column-level grants so clients cannot set ids, status or timestamps.
-- Principles: public places only, first names only, never the residence status; RLS on everything.
-- Requires Supabase Auth (email magic link) for anyone who creates or joins a meetup.

create table if not exists public.profiles_public (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 30),
  -- coarse matching fields; residence status is deliberately NOT stored here
  purpose text check (purpose in ('study','work','chancenkarte','family','other')),
  arrival_month text check (arrival_month ~ '^\d{4}-\d{2}$'),
  has_children boolean default false,
  languages text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  state text not null,                 -- ISO 3166-2:DE
  city_id text,                        -- places.de.json id
  type text not null check (type in ('coffee','walk','food','language','paperwork','family','jobs','holiday','other')),
  title text not null check (char_length(title) between 4 and 80),
  starts_at timestamptz not null,
  area text not null check (char_length(area) between 2 and 60),   -- public area, shown to everyone
  languages text[] not null default '{English}',
  audience text[] not null default '{everyone}',
  max_people int not null check (max_people between 3 and 15),
  women_only boolean not null default false,
  status text not null default 'pending' check (status in ('pending','live','cancelled','removed')),
  created_at timestamptz default now()
);
create index if not exists meetups_city_time on public.meetups (city_id, starts_at) where status = 'live';

-- The exact meeting point lives in its own table: a row-level policy cannot hide one column,
-- so keeping it on meetups would show it to every signed-in user (OWASP A01).
create table if not exists public.meetup_places (
  meetup_id uuid primary key references public.meetups(id) on delete cascade,
  exact_place text not null check (char_length(exact_place) <= 120)
);

create table if not exists public.rsvps (
  meetup_id uuid references public.meetups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('interested','going')),
  created_at timestamptz default now(),
  primary key (meetup_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  meetup_id uuid references public.meetups(id) on delete cascade,
  reported_user uuid references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) <= 500),
  created_at timestamptz default now()
);

-- Notify-me subscriptions per city (for "tell me when someone suggests a meetup")
create table if not exists public.meetup_alerts (
  user_id uuid references auth.users(id) on delete cascade,
  city_id text not null,
  primary key (user_id, city_id)
);

alter table public.profiles_public enable row level security;
alter table public.meetups enable row level security;
alter table public.rsvps enable row level security;
alter table public.reports enable row level security;
alter table public.meetup_alerts enable row level security;

alter table public.meetup_places enable row level security;

-- Helpers run with the owner's rights so policies can look at rsvps without recursion.
create or replace function public.is_going(m uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from rsvps where meetup_id = m and user_id = auth.uid() and kind = 'going')
$$;
create or replace function public.shares_meetup(other uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rsvps a join rsvps b on a.meetup_id = b.meetup_id
    where a.user_id = auth.uid() and b.user_id = other and a.kind = 'going' and b.kind = 'going'
  ) or exists (
    select 1 from meetups m join rsvps r on r.meetup_id = m.id
    where (m.host_id = auth.uid() and r.user_id = other and r.kind = 'going')
       or (m.host_id = other and r.user_id = auth.uid() and r.kind = 'going')
  )
$$;
revoke execute on function public.is_going(uuid), public.shares_meetup(uuid) from public, anon;
grant execute on function public.is_going(uuid), public.shares_meetup(uuid) to authenticated;

-- Signed-in users read live meetups; hosts manage their own (new ones start as 'pending' for moderation;
-- any edit sends a live meetup back to 'pending').
create policy meetups_read on public.meetups for select to authenticated using (status = 'live' or host_id = auth.uid());
create policy meetups_insert on public.meetups for insert to authenticated with check (host_id = auth.uid() and status = 'pending');
create policy meetups_update_own on public.meetups for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid() and status in ('pending','cancelled'));

-- Exact place: only the host and people who are going.
create policy places_read on public.meetup_places for select to authenticated
  using (public.is_going(meetup_id) or exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = auth.uid()));
create policy places_write on public.meetup_places for all to authenticated
  using (exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = auth.uid()))
  with check (exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = auth.uid()));

-- RSVPs: your own only, and only to live meetups.
create policy rsvps_read_own on public.rsvps for select to authenticated using (user_id = auth.uid());
create policy rsvps_write_own on public.rsvps for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.meetups m where m.id = meetup_id and m.status = 'live'));
create policy rsvps_update_own on public.rsvps for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rsvps_delete_own on public.rsvps for delete to authenticated using (user_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy alerts_own on public.meetup_alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Profiles: yourself, and people you share a meetup with (both going, or host and guest) — not every user.
create policy profiles_read on public.profiles_public for select to authenticated
  using (user_id = auth.uid() or public.shares_meetup(user_id));
create policy profiles_own on public.profiles_public for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nothing for anonymous users; ids, timestamps and status are never client-set.
revoke all on public.profiles_public, public.meetups, public.meetup_places, public.rsvps, public.reports, public.meetup_alerts from anon;
revoke insert on public.meetups from authenticated;
grant insert (host_id, state, city_id, type, title, starts_at, area, languages, audience, max_people, women_only) on public.meetups to authenticated;
revoke update on public.meetups from authenticated;
grant update (title, starts_at, area, languages, audience, max_people, women_only, status) on public.meetups to authenticated;

-- Counts without exposing who: a view the client reads instead of rsvps
-- Counts without exposing who: runs as owner (bypasses rsvps RLS) but only for live meetups.
create or replace view public.meetup_counts with (security_invoker = false) as
  select r.meetup_id,
         count(*) filter (where r.kind = 'interested') as interested,
         count(*) filter (where r.kind = 'going') as going
  from public.rsvps r join public.meetups m on m.id = r.meetup_id and m.status = 'live'
  group by r.meetup_id;
revoke all on public.meetup_counts from anon;
grant select on public.meetup_counts to authenticated;
-- Still open before launch: rate limits on meetups/rsvps/reports (edge function), moderation tooling,
-- women_only cannot be verified technically — moderation and reports cover it.
