
-- Integrations table
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid,
  provider text not null,
  status text not null default 'connected',
  vision_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_kb_sync_at timestamptz,
  kb_doc_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integrations_user_provider_org_idx
  on public.integrations(user_id, provider, coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.integrations enable row level security;

create policy "Integrations: self read" on public.integrations
  for select to authenticated using (user_id = auth.uid());
create policy "Integrations: self insert" on public.integrations
  for insert to authenticated with check (user_id = auth.uid());
create policy "Integrations: self update" on public.integrations
  for update to authenticated using (user_id = auth.uid());
create policy "Integrations: self delete" on public.integrations
  for delete to authenticated using (user_id = auth.uid());

create trigger update_integrations_updated_at
  before update on public.integrations
  for each row execute function public.update_updated_at_column();

-- Per-user integration secrets (Slack/Jira/Confluence tokens)
create table public.user_integration_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  token text,
  refresh_token text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.user_integration_secrets enable row level security;

create policy "IntegrationSecrets: self read" on public.user_integration_secrets
  for select to authenticated using (user_id = auth.uid());
create policy "IntegrationSecrets: self insert" on public.user_integration_secrets
  for insert to authenticated with check (user_id = auth.uid());
create policy "IntegrationSecrets: self update" on public.user_integration_secrets
  for update to authenticated using (user_id = auth.uid());
create policy "IntegrationSecrets: self delete" on public.user_integration_secrets
  for delete to authenticated using (user_id = auth.uid());

create trigger update_user_integration_secrets_updated_at
  before update on public.user_integration_secrets
  for each row execute function public.update_updated_at_column();

-- Extend kb_documents
alter table public.kb_documents
  add column if not exists external_id text,
  add column if not exists full_text text,
  add column if not exists source_integration text;

create unique index if not exists kb_docs_external_id_idx
  on public.kb_documents(user_id, external_id) where external_id is not null;
