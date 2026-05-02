alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.orgs add column if not exists description text;
alter table public.orgs add column if not exists priorities jsonb not null default '[]'::jsonb;
alter table public.orgs add column if not exists success_definition text;
alter table public.orgs add column if not exists stage_labels jsonb not null default '[]'::jsonb;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Push: self read" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "Push: self insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "Push: self update" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid());
create policy "Push: self delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());