-- mcp_tokens: per-user API tokens for the VisiOS MCP server
CREATE TABLE public.mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  label text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mcp_tokens_user ON public.mcp_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_mcp_tokens_hash ON public.mcp_tokens(token_hash) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_tokens TO authenticated;
GRANT ALL ON public.mcp_tokens TO service_role;

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mcp tokens"
  ON public.mcp_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own mcp tokens"
  ON public.mcp_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users revoke own mcp tokens"
  ON public.mcp_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own mcp tokens"
  ON public.mcp_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Lookup function used by the MCP edge function (service role)
CREATE OR REPLACE FUNCTION public.mcp_token_lookup(_hash text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.mcp_tokens
  WHERE token_hash = _hash AND revoked_at IS NULL
  LIMIT 1
$$;