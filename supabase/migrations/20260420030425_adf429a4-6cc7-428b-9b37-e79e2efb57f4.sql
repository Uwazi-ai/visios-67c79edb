-- ====== ENUMS ======
create type public.app_role as enum ('owner','admin','member');

-- ====== HELPER: timestamp updater ======
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ====== ORGS ======
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  color text not null,
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security;

-- ====== PROFILES (mirrors auth.users) ======
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ====== ORG MEMBERSHIPS ======
create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(user_id, org_id)
);
alter table public.org_memberships enable row level security;

-- ====== SECURITY DEFINER HELPERS ======
create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_memberships
    where user_id = _user_id and org_id = _org_id)
$$;

create or replace function public.has_org_role(_user_id uuid, _org_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_memberships
    where user_id = _user_id and org_id = _org_id and role = _role)
$$;

create or replace function public.is_owner_anywhere(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_memberships
    where user_id = _user_id and role = 'owner')
$$;

-- ====== PROFILE AUTO-CREATE TRIGGER ======
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, google_access_token, google_refresh_token)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'provider_token',
    new.raw_user_meta_data->>'provider_refresh_token'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ====== ITEMS ======
create table public.items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  type text check (type in ('email','task','decision','note','event','notification')),
  title text not null,
  body text,
  status text default 'open',
  priority text check (priority in ('urgent','high','normal','low')) default 'normal',
  source text,
  due_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.items enable row level security;

-- ====== PROJECTS ======
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  name text not null,
  description text,
  status text default 'active',
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;

-- ====== TASKS ======
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text check (status in ('todo','in_progress','done','blocked')) default 'todo',
  priority text check (priority in ('urgent','high','normal','low')) default 'normal',
  due_at timestamptz,
  estimate_mins int,
  parent_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.tasks enable row level security;

-- ====== EVENTS ======
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  attendees jsonb not null default '[]',
  google_event_id text,
  meet_link text,
  prep_notes text,
  summary text,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

-- ====== CHANNELS / MESSAGES ======
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  name text,
  type text check (type in ('channel','dm','system')) default 'channel',
  participants jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.channels enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  thread_id uuid references public.messages(id) on delete set null,
  reactions jsonb not null default '{}',
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- ====== NOTIFICATIONS ======
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  app text not null,
  severity text check (severity in ('critical','warn','info')) default 'info',
  title text not null,
  body text,
  metadata jsonb not null default '{}',
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- ====== EVENT TYPES / BOOKINGS ======
create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text not null,
  duration_mins int default 30,
  description text,
  intake_fields jsonb not null default '[]',
  buffer_before int default 0,
  buffer_after int default 5,
  active boolean default true,
  created_at timestamptz not null default now()
);
alter table public.event_types enable row level security;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  event_type_id uuid references public.event_types(id) on delete set null,
  invitee_name text not null,
  invitee_email text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  intake_data jsonb not null default '{}',
  google_event_id text,
  prep_brief text,
  status text check (status in ('confirmed','cancelled','rescheduled')) default 'confirmed',
  created_at timestamptz not null default now()
);
alter table public.bookings enable row level security;

-- ====== CONTACTS / DEALS ======
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  name text not null,
  email text,
  company text,
  role text,
  last_touched_at timestamptz,
  notes text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.contacts enable row level security;

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  stage text not null,
  value numeric,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.deals enable row level security;

-- ====== INDEXES ======
create index on public.org_memberships(user_id);
create index on public.org_memberships(org_id);
create index on public.items(org_id, created_at desc);
create index on public.tasks(org_id, status);
create index on public.tasks(assignee_id);
create index on public.events(org_id, start_at);
create index on public.messages(channel_id, created_at desc);
create index on public.notifications(org_id, created_at desc);
create index on public.bookings(org_id, start_at);
create index on public.contacts(org_id);
create index on public.deals(org_id, stage);

-- ====== RLS POLICIES ======

-- profiles: user sees self; everyone authenticated can view basic org-mate profiles
create policy "Profiles: self read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Profiles: self update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Profiles: self insert" on public.profiles for insert to authenticated with check (id = auth.uid());

-- orgs: members of an org can read it; owners (anywhere) can read all
create policy "Orgs: members read" on public.orgs for select to authenticated
  using (public.is_org_member(auth.uid(), id) or public.is_owner_anywhere(auth.uid()));

-- org_memberships: user reads own memberships; owners read memberships of orgs they own
create policy "Memberships: self read" on public.org_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_org_role(auth.uid(), org_id, 'owner'));

-- generic helper macro: org-scoped CRUD for members
-- items
create policy "Items: org read"   on public.items   for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Items: org write"  on public.items   for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Items: org update" on public.items   for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Items: org delete" on public.items   for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- projects
create policy "Projects: org read"   on public.projects for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Projects: org write"  on public.projects for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Projects: org update" on public.projects for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Projects: org delete" on public.projects for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- tasks
create policy "Tasks: org read"   on public.tasks for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Tasks: org write"  on public.tasks for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Tasks: org update" on public.tasks for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Tasks: org delete" on public.tasks for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- events
create policy "Events: org read"   on public.events for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Events: org write"  on public.events for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Events: org update" on public.events for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Events: org delete" on public.events for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- channels
create policy "Channels: org read"   on public.channels for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Channels: org write"  on public.channels for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Channels: org update" on public.channels for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Channels: org delete" on public.channels for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- messages
create policy "Messages: org read"   on public.messages for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Messages: org write"  on public.messages for insert to authenticated with check (public.is_org_member(auth.uid(), org_id) and user_id = auth.uid());
create policy "Messages: self update" on public.messages for update to authenticated using (user_id = auth.uid());
create policy "Messages: self delete" on public.messages for delete to authenticated using (user_id = auth.uid());

-- notifications
create policy "Notifications: org read"   on public.notifications for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Notifications: org write"  on public.notifications for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Notifications: org update" on public.notifications for update to authenticated using (public.is_org_member(auth.uid(), org_id));

-- event_types
create policy "EventTypes: org read"   on public.event_types for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "EventTypes: org write"  on public.event_types for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "EventTypes: org update" on public.event_types for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "EventTypes: org delete" on public.event_types for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- bookings
create policy "Bookings: org read"   on public.bookings for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Bookings: org write"  on public.bookings for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Bookings: org update" on public.bookings for update to authenticated using (public.is_org_member(auth.uid(), org_id));

-- contacts
create policy "Contacts: org read"   on public.contacts for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Contacts: org write"  on public.contacts for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Contacts: org update" on public.contacts for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Contacts: org delete" on public.contacts for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- deals
create policy "Deals: org read"   on public.deals for select to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Deals: org write"  on public.deals for insert to authenticated with check (public.is_org_member(auth.uid(), org_id));
create policy "Deals: org update" on public.deals for update to authenticated using (public.is_org_member(auth.uid(), org_id));
create policy "Deals: org delete" on public.deals for delete to authenticated using (public.is_org_member(auth.uid(), org_id));

-- ====== SEED ORGS ======
insert into public.orgs (name, slug, color) values
  ('UWAZI.AI', 'uwazi', '#2563EB'),
  ('Black Innovators Network', 'bin', '#EF4444'),
  ('Culture Club', 'cc', '#22C55E')
on conflict (slug) do nothing;