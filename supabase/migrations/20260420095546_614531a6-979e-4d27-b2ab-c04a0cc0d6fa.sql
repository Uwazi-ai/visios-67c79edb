-- 1. Username on profiles
alter table public.profiles add column if not exists username text unique;
create index if not exists profiles_username_idx on public.profiles (username);

-- 2. Public read of active event_types (for /book pages)
drop policy if exists "EventTypes: public read active" on public.event_types;
create policy "EventTypes: public read active"
  on public.event_types for select
  to anon, authenticated
  using (active = true);

-- 3. Public read of minimal profile info (only when a username is set)
drop policy if exists "Profiles: public read by username" on public.profiles;
create policy "Profiles: public read by username"
  on public.profiles for select
  to anon, authenticated
  using (username is not null);

-- 4. Public read of orgs referenced by active event types (so we can show org name/color on public page)
drop policy if exists "Orgs: public read" on public.orgs;
create policy "Orgs: public read"
  on public.orgs for select
  to anon, authenticated
  using (true);

-- 5. Anonymous booking inserts on active event types
drop policy if exists "Bookings: public insert on active type" on public.bookings;
create policy "Bookings: public insert on active type"
  on public.bookings for insert
  to anon, authenticated
  with check (
    event_type_id is not null
    and exists (
      select 1 from public.event_types et
      where et.id = event_type_id and et.active = true
    )
  );

-- 6. Backfill empty slugs (defensive)
update public.event_types set slug = id::text where slug is null or slug = '';