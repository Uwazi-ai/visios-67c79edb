-- Secure token storage for all platform connections
create table if not exists public.social_platform_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','tiktok','linkedin','youtube')),
  account_id text,
  account_name text,
  account_username text,
  account_avatar_url text,
  account_type text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  brand text check (brand in ('uwazi','bin','myke')),
  is_active boolean default true,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, account_id)
);

grant select, insert, update, delete on public.social_platform_tokens to authenticated;
grant all on public.social_platform_tokens to service_role;

alter table public.social_platform_tokens enable row level security;

create policy "users_own_tokens" on public.social_platform_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Update social_integrations with richer connection data
alter table public.social_integrations
  add column if not exists display_name text,
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists follower_count integer,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scopes text[];