
-- =========================================
-- AI Conversations + Messages
-- =========================================
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid,
  persona text not null default 'chief_of_staff',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create policy "AIConv: self read" on public.ai_conversations
  for select to authenticated using (user_id = auth.uid());
create policy "AIConv: self insert" on public.ai_conversations
  for insert to authenticated with check (user_id = auth.uid());
create policy "AIConv: self update" on public.ai_conversations
  for update to authenticated using (user_id = auth.uid());
create policy "AIConv: self delete" on public.ai_conversations
  for delete to authenticated using (user_id = auth.uid());

create trigger ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.update_updated_at_column();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  persona text,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_messages enable row level security;

create policy "AIMsg: self read" on public.ai_messages
  for select to authenticated using (user_id = auth.uid());
create policy "AIMsg: self insert" on public.ai_messages
  for insert to authenticated with check (user_id = auth.uid());
create policy "AIMsg: self delete" on public.ai_messages
  for delete to authenticated using (user_id = auth.uid());

create index ai_messages_conv_idx on public.ai_messages(conversation_id, created_at);

-- =========================================
-- AI Training
-- =========================================
create table public.ai_training (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  writing_style text not null default 'semi-formal',
  signature_style text not null default 'first_name',
  response_length text not null default 'standard',
  never_say text,
  sample_emails jsonb not null default '[]'::jsonb,
  org_context jsonb not null default '{}'::jsonb,
  workflow_notes jsonb not null default '{}'::jsonb,
  canned_responses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_training enable row level security;

create policy "AITraining: self read" on public.ai_training
  for select to authenticated using (user_id = auth.uid());
create policy "AITraining: self insert" on public.ai_training
  for insert to authenticated with check (user_id = auth.uid());
create policy "AITraining: self update" on public.ai_training
  for update to authenticated using (user_id = auth.uid());

create trigger ai_training_updated_at
  before update on public.ai_training
  for each row execute function public.update_updated_at_column();

-- =========================================
-- Knowledge Base: documents + chunks
-- =========================================
create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid,
  title text not null,
  description text,
  category text not null default 'General',
  source_type text not null default 'upload' check (source_type in ('upload','url','manual')),
  source_url text,
  file_path text,
  file_type text,
  word_count integer,
  status text not null default 'processing' check (status in ('processing','ready','error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_documents enable row level security;

create policy "KBDocs: org or self read" on public.kb_documents
  for select to authenticated
  using (user_id = auth.uid() or (org_id is not null and is_org_member(auth.uid(), org_id)));
create policy "KBDocs: self insert" on public.kb_documents
  for insert to authenticated
  with check (user_id = auth.uid());
create policy "KBDocs: self update" on public.kb_documents
  for update to authenticated
  using (user_id = auth.uid());
create policy "KBDocs: self delete" on public.kb_documents
  for delete to authenticated
  using (user_id = auth.uid());

create trigger kb_documents_updated_at
  before update on public.kb_documents
  for each row execute function public.update_updated_at_column();

create table public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  user_id uuid not null,
  org_id uuid,
  content text not null,
  chunk_index integer not null default 0,
  tsv tsvector,
  created_at timestamptz not null default now()
);

alter table public.kb_chunks enable row level security;

create policy "KBChunks: org or self read" on public.kb_chunks
  for select to authenticated
  using (user_id = auth.uid() or (org_id is not null and is_org_member(auth.uid(), org_id)));
create policy "KBChunks: self insert" on public.kb_chunks
  for insert to authenticated with check (user_id = auth.uid());
create policy "KBChunks: self delete" on public.kb_chunks
  for delete to authenticated using (user_id = auth.uid());

create index kb_chunks_doc_idx on public.kb_chunks(document_id);
create index kb_chunks_tsv_idx on public.kb_chunks using gin(tsv);

create or replace function public.kb_chunks_tsv_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  new.tsv := to_tsvector('english', coalesce(new.content, ''));
  return new;
end $$;

create trigger kb_chunks_tsv_update
  before insert or update of content on public.kb_chunks
  for each row execute function public.kb_chunks_tsv_trigger();

-- Full-text search RPC for RAG (keyword-based)
create or replace function public.search_kb_text(
  query_text text,
  org_filter uuid default null,
  user_filter uuid default null,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  document_title text,
  rank real
)
language sql stable security definer set search_path = public as $$
  select
    kc.id,
    kc.document_id,
    kc.content,
    kd.title as document_title,
    ts_rank(kc.tsv, websearch_to_tsquery('english', query_text)) as rank
  from public.kb_chunks kc
  join public.kb_documents kd on kd.id = kc.document_id
  where kd.status = 'ready'
    and (
      (user_filter is not null and kc.user_id = user_filter)
      or (org_filter is not null and kc.org_id = org_filter)
    )
    and kc.tsv @@ websearch_to_tsquery('english', query_text)
  order by rank desc
  limit match_count;
$$;

-- =========================================
-- Storage bucket: knowledge-base (private)
-- =========================================
insert into storage.buckets (id, name, public)
values ('knowledge-base', 'knowledge-base', false)
on conflict (id) do nothing;

create policy "KB: users read own files"
  on storage.objects for select to authenticated
  using (bucket_id = 'knowledge-base' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "KB: users upload own files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge-base' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "KB: users delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge-base' and auth.uid()::text = (storage.foldername(name))[1]);
