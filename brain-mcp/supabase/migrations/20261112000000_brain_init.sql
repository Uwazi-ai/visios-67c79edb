-- Myke OS shared brain: initial schema
-- Access model: only the brain-mcp edge function (service role) touches these
-- tables. RLS is on with no policies, so anon and authenticated get nothing.
-- Agent identity and permissions are enforced in the edge function; the
-- triggers below are a second line of defense.

create schema if not exists brain;

-- shared vocab -------------------------------------------------------------
create or replace function brain.valid_agent(a text) returns boolean
language sql immutable as $$ select a in ('kova','grok','chatgpt','muse','stevie') $$;

create or replace function brain.valid_venture(v text) returns boolean
language sql immutable as $$
  select v in ('personal','uwazi','bic','culture-club','myke-labs','kova',
               'consulting','rps-office','all-in-favor','higher-ground',
               'household','system')
$$;

create or replace function brain.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- truth tables (kova writes) ----------------------------------------------
create table brain.sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  venture text not null default 'system' check (brain.valid_venture(venture)),
  body text not null,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  search tsvector generated always as
    (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))) stored
);
create or replace function brain.bump_section_version() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body then new.version := old.version + 1; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger sections_version before update on brain.sections
  for each row execute function brain.bump_section_version();

create table brain.decisions (
  id uuid primary key default gen_random_uuid(),
  decision text not null,
  reasoning text,
  venture text not null check (brain.valid_venture(venture)),
  decided_at timestamptz not null default now(),
  search tsvector generated always as
    (to_tsvector('english', coalesce(decision,'') || ' ' || coalesce(reasoning,''))) stored
);

create table brain.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  venture text not null check (brain.valid_venture(venture)),
  priority int not null default 2 check (priority between 1 and 3),
  status text not null default 'proposed'
    check (status in ('proposed','approved','done','rejected')),
  proposed_by text not null check (brain.valid_agent(proposed_by)),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as
    (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(details,''))) stored
);
create trigger tasks_touch before update on brain.tasks
  for each row execute function brain.touch_updated_at();

-- inbox tables (any agent writes) -----------------------------------------
create table brain.findings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  source_urls text[] not null default '{}',
  venture text not null check (brain.valid_venture(venture)),
  submitted_by text not null check (brain.valid_agent(submitted_by)),
  status text not null default 'new' check (status in ('new','accepted','dismissed')),
  created_at timestamptz not null default now(),
  search tsvector generated always as
    (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))) stored
);

create table brain.proposals (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null references brain.sections(slug) on update cascade,
  proposed_body text not null,
  reason text not null,
  proposed_by text not null check (brain.valid_agent(proposed_by)),
  status text not null default 'open' check (status in ('open','approved','rejected')),
  created_at timestamptz not null default now()
);

-- work tables ---------------------------------------------------------------
create table brain.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instructions text not null,
  venture text not null check (brain.valid_venture(venture)),
  domain text not null check (domain in ('content','social','research','agents',
    'startups','funding','clients','job-search','day-to-day','family')),
  assigned_to text not null check (brain.valid_agent(assigned_to)),
  status text not null default 'queued'
    check (status in ('queued','claimed','done','blocked','needs_approval')),
  priority int not null default 2 check (priority between 1 and 3),
  due_at timestamptz,
  claimed_at timestamptz,
  result text,
  result_links text[] not null default '{}',
  block_reason text,
  created_by text not null default 'kova' check (created_by = 'kova'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_queue on brain.jobs (assigned_to, status, priority, due_at);
create trigger jobs_touch before update on brain.jobs
  for each row execute function brain.touch_updated_at();

create table brain.approvals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references brain.jobs(id) on delete cascade,
  action_type text not null check (action_type in
    ('send','post_draft','reply_batch','book','buy','deploy','other')),
  details jsonb not null default '{}',
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  requested_by text not null check (brain.valid_agent(requested_by)),
  approver text check (approver in ('myke','family_approver')),
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index approvals_pending on brain.approvals (status, created_at);

-- The family approver can only decide family-domain approvals.
create or replace function brain.check_approver_scope() returns trigger
language plpgsql as $$
declare job_domain text;
begin
  if new.approver = 'family_approver' then
    select domain into job_domain from brain.jobs where id = new.job_id;
    if job_domain is distinct from 'family' then
      raise exception 'family_approver can only approve family-domain items';
    end if;
  end if;
  if new.status <> 'pending' and new.approver is null then
    raise exception 'a decided approval needs a human approver';
  end if;
  if new.status <> 'pending' and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end $$;
create trigger approvals_scope before insert or update on brain.approvals
  for each row execute function brain.check_approver_scope();

-- Jobs that need approval cannot be marked done without an approved row.
create or replace function brain.check_job_gate() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and old.status = 'needs_approval' then
    if not exists (select 1 from brain.approvals
                   where job_id = new.id and status = 'approved') then
      raise exception 'job % needs an approved request before it can complete', new.id;
    end if;
  end if;
  return new;
end $$;
create trigger jobs_gate before update on brain.jobs
  for each row execute function brain.check_job_gate();

create table brain.leads (
  id uuid primary key default gen_random_uuid(),
  track text not null check (track in ('consulting','uwazi')),
  org text not null,
  contact_name text,
  contact_role text,
  source_url text not null,
  signal text not null,
  fit_score int check (fit_score between 1 and 10),
  stage text not null default 'signal' check (stage in ('signal','qualified',
    'researched','outreach','follow-up','call','proposal','signed','nurture','lost')),
  next_step text,
  next_step_due date,
  last_touch_at timestamptz,
  owner_agent text not null check (brain.valid_agent(owner_agent)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as
    (to_tsvector('english', coalesce(org,'') || ' ' || coalesce(signal,'') || ' ' || coalesce(notes,''))) stored
);
create unique index leads_dedupe on brain.leads (track, lower(org), source_url);
create index leads_pipeline on brain.leads (track, stage, next_step_due);
create trigger leads_touch before update on brain.leads
  for each row execute function brain.touch_updated_at();

-- audit -------------------------------------------------------------------
create table brain.activity (
  id bigint generated always as identity primary key,
  agent text not null,
  tool text not null,
  args_summary text,
  result_status text not null check (result_status in ('ok','rejected','error')),
  created_at timestamptz not null default now()
);
create index activity_recent on brain.activity (created_at desc);
create index activity_rate on brain.activity (agent, created_at desc);

create or replace function brain.block_activity_changes() returns trigger
language plpgsql as $$ begin raise exception 'activity log is append-only'; end $$;
create trigger activity_append_only before update or delete on brain.activity
  for each row execute function brain.block_activity_changes();

-- search indexes ----------------------------------------------------------
create index sections_search on brain.sections using gin (search);
create index decisions_search on brain.decisions using gin (search);
create index tasks_search on brain.tasks using gin (search);
create index findings_search on brain.findings using gin (search);
create index leads_search on brain.leads using gin (search);

-- lock everything down ----------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'brain' loop
    execute format('alter table brain.%I enable row level security', t);
    execute format('alter table brain.%I force row level security', t);
  end loop;
end $$;
revoke all on schema brain from anon, authenticated;
revoke all on all tables in schema brain from anon, authenticated;
grant usage on schema brain to service_role;
grant all on all tables in schema brain to service_role;
grant all on all sequences in schema brain to service_role;
