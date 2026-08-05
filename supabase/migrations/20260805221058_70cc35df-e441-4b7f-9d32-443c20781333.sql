CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============ orgs ============
CREATE TABLE public.kova_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  slug text NOT NULL,
  name text NOT NULL,
  role text,
  status text NOT NULL DEFAULT 'active',
  color text NOT NULL DEFAULT '#2563EB',
  logo_url text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_orgs TO authenticated;
GRANT ALL ON public.kova_orgs TO service_role;
ALTER TABLE public.kova_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_orgs" ON public.kova_orgs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ board states ============
CREATE TABLE public.kova_board_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  wip_limit int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_board_states TO authenticated;
GRANT ALL ON public.kova_board_states TO service_role;
ALTER TABLE public.kova_board_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_board_states" ON public.kova_board_states FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ tasks ============
CREATE TABLE public.kova_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  org text NOT NULL DEFAULT '__any',
  project text,
  state text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assignee text,
  started_at timestamptz,
  due_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kova_tasks_closed_idx ON public.kova_tasks (user_id, state, closed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_tasks TO authenticated;
GRANT ALL ON public.kova_tasks TO service_role;
ALTER TABLE public.kova_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_tasks" ON public.kova_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ proposals ============
CREATE TABLE public.kova_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  agent text NOT NULL,
  org text NOT NULL DEFAULT '__any',
  ref text,
  proposal text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  signals text[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_proposals TO authenticated;
GRANT ALL ON public.kova_proposals TO service_role;
ALTER TABLE public.kova_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_proposals" ON public.kova_proposals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ agents ============
CREATE TABLE public.kova_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL,
  name text NOT NULL,
  icon text,
  description text NOT NULL DEFAULT '',
  call_line text,
  cadence text,
  enabled boolean NOT NULL DEFAULT true,
  org text NOT NULL DEFAULT '__any',
  autonomous text[] NOT NULL DEFAULT '{}',
  gated text[] NOT NULL DEFAULT '{}',
  last_call text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_agents TO authenticated;
GRANT ALL ON public.kova_agents TO service_role;
ALTER TABLE public.kova_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_agents" ON public.kova_agents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.kova_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  agent text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT true,
  runs int NOT NULL DEFAULT 1,
  at_risk int NOT NULL DEFAULT 0,
  right_calls int NOT NULL DEFAULT 0
);
CREATE INDEX kova_agent_runs_idx ON public.kova_agent_runs (user_id, agent, ran_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_agent_runs TO authenticated;
GRANT ALL ON public.kova_agent_runs TO service_role;
ALTER TABLE public.kova_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_agent_runs" ON public.kova_agent_runs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ connections + permissions ============
CREATE TABLE public.kova_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL,
  name text NOT NULL,
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'off',
  scope text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_connections TO authenticated;
GRANT ALL ON public.kova_connections TO service_role;
ALTER TABLE public.kova_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_connections" ON public.kova_connections FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.kova_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL,
  label text,
  detail text,
  allowed boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_permissions TO authenticated;
GRANT ALL ON public.kova_permissions TO service_role;
ALTER TABLE public.kova_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_permissions" ON public.kova_permissions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ knowledge ============
CREATE TABLE public.kova_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'note',
  org text NOT NULL DEFAULT '__any',
  source text,
  body text NOT NULL DEFAULT '',
  indexed boolean NOT NULL DEFAULT false,
  cited_count int NOT NULL DEFAULT 0,
  content_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_documents TO authenticated;
GRANT ALL ON public.kova_documents TO service_role;
ALTER TABLE public.kova_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_documents" ON public.kova_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.kova_doc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.kova_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ord int NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding extensions.vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kova_doc_chunks_doc_idx ON public.kova_doc_chunks (document_id, ord);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_doc_chunks TO authenticated;
GRANT ALL ON public.kova_doc_chunks TO service_role;
ALTER TABLE public.kova_doc_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_doc_chunks" ON public.kova_doc_chunks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ contacts ============
CREATE TABLE public.kova_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  role text,
  org text NOT NULL DEFAULT '__any',
  company text,
  card_used text,
  scanned_at timestamptz,
  loc_signal jsonb,
  cal_signal jsonb,
  overlap_signal jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_contacts TO authenticated;
GRANT ALL ON public.kova_contacts TO service_role;
ALTER TABLE public.kova_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_contacts" ON public.kova_contacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ chat ============
CREATE TABLE public.kova_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  channel text NOT NULL,
  author text NOT NULL,
  body text NOT NULL DEFAULT '',
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb,
  action_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kova_chat_messages_idx ON public.kova_chat_messages (user_id, channel, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_chat_messages TO authenticated;
GRANT ALL ON public.kova_chat_messages TO service_role;
ALTER TABLE public.kova_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_chat_messages" ON public.kova_chat_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.kova_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message_id uuid REFERENCES public.kova_chat_messages(id) ON DELETE CASCADE,
  tool text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  ms int NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kova_tool_calls TO authenticated;
GRANT ALL ON public.kova_tool_calls TO service_role;
ALTER TABLE public.kova_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kova_tool_calls" ON public.kova_tool_calls FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ token usage ============
CREATE TABLE public.ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid,
  provider text NOT NULL DEFAULT 'anthropic',
  model text NOT NULL,
  call_type text,
  streamed boolean NOT NULL DEFAULT false,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cache_read_tokens int NOT NULL DEFAULT 0,
  cache_write_tokens int NOT NULL DEFAULT 0,
  total_tokens int GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  latency_ms int,
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_token_usage_user_idx ON public.ai_token_usage (user_id, created_at DESC);
GRANT SELECT ON public.ai_token_usage TO authenticated;
GRANT ALL ON public.ai_token_usage TO service_role;
ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_token_usage read" ON public.ai_token_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

-- updated_at triggers
CREATE TRIGGER kova_orgs_updated BEFORE UPDATE ON public.kova_orgs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER kova_tasks_updated BEFORE UPDATE ON public.kova_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER kova_documents_updated BEFORE UPDATE ON public.kova_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER kova_contacts_updated BEFORE UPDATE ON public.kova_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- semantic search over chunks
CREATE OR REPLACE FUNCTION public.kova_match_chunks(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 8,
  org_filter text DEFAULT NULL
)
RETURNS TABLE (chunk_id uuid, document_id uuid, title text, category text, org text, content text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions
AS $$
  SELECT c.id, d.id, d.title, d.category, d.org, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.kova_doc_chunks c
  JOIN public.kova_documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND (org_filter IS NULL OR d.org = org_filter)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;