-- Myke OS shared brain: agent identities and lead stage history.

-- One Supabase Auth account per agent. brain-mcp resolves the signed-in user
-- to an agent name here. An account that is not listed gets no access.
create table brain.identities (
  auth_user_id uuid primary key,
  agent text not null unique check (brain.valid_agent(agent)),
  created_at timestamptz not null default now()
);

-- Stage history, so the digest and weekly stats can report real movement.
create table brain.lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references brain.leads(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  created_at timestamptz not null default now()
);
create index lead_events_recent on brain.lead_events (created_at desc);

create or replace function brain.record_lead_stage() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into brain.lead_events (lead_id, from_stage, to_stage)
      values (new.id, null, new.stage);
  elsif new.stage is distinct from old.stage then
    insert into brain.lead_events (lead_id, from_stage, to_stage)
      values (new.id, old.stage, new.stage);
  end if;
  return new;
end $$;
create trigger leads_stage_history after insert or update on brain.leads
  for each row execute function brain.record_lead_stage();

-- Reading order for the ontology table of contents. The seed sets it.
alter table brain.sections add column position int not null default 1000;

-- Same lockdown as the rest of the schema.
alter table brain.identities enable row level security;
alter table brain.identities force row level security;
alter table brain.lead_events enable row level security;
alter table brain.lead_events force row level security;
revoke all on brain.identities, brain.lead_events from anon, authenticated;
grant all on brain.identities, brain.lead_events to service_role;
grant all on all sequences in schema brain to service_role;
