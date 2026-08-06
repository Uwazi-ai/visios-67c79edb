-- enums
DO $$ BEGIN CREATE TYPE public.connection_status AS ENUM ('connected','disconnected','error','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.proposal_status AS ENUM ('pending','committed','dismissed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles: persisted workspace scope
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;

-- orgs: demo boundary + owner
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_id uuid;

-- membership helper (single arg, no recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = p_org_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.org_memberships WHERE org_id = p_org_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.org_member_can_write(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
     WHERE org_id = p_org_id AND user_id = auth.uid() AND permission IN ('write','admin')
  ) OR EXISTS (
    SELECT 1 FROM public.org_memberships
     WHERE org_id = p_org_id AND user_id = auth.uid() AND role IN ('owner','admin','member')
  );
$$;

CREATE OR REPLACE FUNCTION public.my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  UNION
  SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid();
$$;

-- connections
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status public.connection_status NOT NULL DEFAULT 'disconnected',
  scopes text[] NOT NULL DEFAULT '{}',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connections_member_read" ON public.connections FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "connections_member_write" ON public.connections FOR INSERT TO authenticated WITH CHECK (public.org_member_can_write(org_id));
CREATE POLICY "connections_member_update" ON public.connections FOR UPDATE TO authenticated USING (public.org_member_can_write(org_id)) WITH CHECK (public.org_member_can_write(org_id));
CREATE POLICY "connections_member_delete" ON public.connections FOR DELETE TO authenticated USING (public.org_member_can_write(org_id));

-- proposals
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  rationale text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.proposal_status NOT NULL DEFAULT 'pending',
  source_ref text,
  confidence numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_member_read" ON public.proposals FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "proposals_member_insert" ON public.proposals FOR INSERT TO authenticated WITH CHECK (public.org_member_can_write(org_id));
CREATE POLICY "proposals_member_update" ON public.proposals FOR UPDATE TO authenticated USING (public.org_member_can_write(org_id)) WITH CHECK (public.org_member_can_write(org_id));
CREATE POLICY "proposals_member_delete" ON public.proposals FOR DELETE TO authenticated USING (public.org_member_can_write(org_id));

-- indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.org_members (org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org_status ON public.proposals (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_pending ON public.proposals (org_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_connections_org ON public.connections (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_dedupe ON public.proposals (org_id, kind, source_ref) WHERE source_ref IS NOT NULL;

-- dashboard summary
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_org_count int;
BEGIN
  SELECT count(*) INTO v_org_count
    FROM public.orgs o
   WHERE (p_org_id IS NULL OR o.id = p_org_id);

  SELECT jsonb_build_object(
    'scope', jsonb_build_object('org_id', p_org_id, 'org_count', v_org_count),
    'pending_proposals', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
        SELECT jsonb_build_object(
          'id', p.id, 'org_id', p.org_id, 'org_name', o.name,
          'identity_color', o.color, 'agent_key', p.agent_key, 'kind', p.kind,
          'title', p.title, 'rationale', p.rationale, 'payload', p.payload,
          'confidence', p.confidence, 'created_at', p.created_at
        ) AS x
        FROM public.proposals p
        JOIN public.orgs o ON o.id = p.org_id
        WHERE p.status = 'pending' AND (p_org_id IS NULL OR p.org_id = p_org_id)
        ORDER BY p.created_at DESC
        LIMIT 25
      ) s
    ), '[]'::jsonb),
    'pending_count', (
      SELECT count(*) FROM public.proposals p
       WHERE p.status = 'pending' AND (p_org_id IS NULL OR p.org_id = p_org_id)
    ),
    'connections', jsonb_build_object(
      'connected', (SELECT count(*) FROM public.connections c WHERE c.status = 'connected' AND (p_org_id IS NULL OR c.org_id = p_org_id)),
      'error', (SELECT count(*) FROM public.connections c WHERE c.status IN ('error','expired') AND (p_org_id IS NULL OR c.org_id = p_org_id)),
      'total', (SELECT count(*) FROM public.connections c WHERE (p_org_id IS NULL OR c.org_id = p_org_id)),
      'rows', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'org_id', c.org_id, 'org_name', o.name, 'identity_color', o.color,
          'provider', c.provider, 'status', c.status,
          'last_sync_at', c.last_sync_at, 'last_error', c.last_error))
        FROM public.connections c JOIN public.orgs o ON o.id = c.org_id
        WHERE (p_org_id IS NULL OR c.org_id = p_org_id)
      ), '[]'::jsonb)
    ),
    'today', jsonb_build_object(
      'calendar_connected', EXISTS (
        SELECT 1 FROM public.connections c
         WHERE c.status = 'connected' AND c.provider IN ('google_calendar','calendar')
           AND (p_org_id IS NULL OR c.org_id = p_org_id)),
      'events', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', e.id, 'title', e.title, 'start_at', e.start_at,
          'org_id', e.org_id, 'identity_color', o.color) ORDER BY e.start_at)
        FROM public.events e LEFT JOIN public.orgs o ON o.id = e.org_id
        WHERE e.start_at >= date_trunc('day', now())
          AND e.start_at < date_trunc('day', now()) + interval '1 day'
          AND (p_org_id IS NULL OR e.org_id = p_org_id)
      ), '[]'::jsonb),
      'event_count', (
        SELECT count(*) FROM public.events e
         WHERE e.start_at >= date_trunc('day', now())
           AND e.start_at < date_trunc('day', now()) + interval '1 day'
           AND (p_org_id IS NULL OR e.org_id = p_org_id))
    ),
    'inbox', jsonb_build_object(
      'gmail_connected', EXISTS (
        SELECT 1 FROM public.connections c
         WHERE c.status = 'connected' AND c.provider IN ('gmail','mail')
           AND (p_org_id IS NULL OR c.org_id = p_org_id)),
      'needs_reply', (
        SELECT count(*) FROM public.proposals p
         WHERE p.status = 'pending' AND p.kind = 'email_reply'
           AND (p_org_id IS NULL OR p.org_id = p_org_id))
    ),
    'tasks', jsonb_build_object(
      'due_today', (
        SELECT count(*) FROM public.tasks t
         WHERE t.status <> 'done' AND t.due_at >= date_trunc('day', now())
           AND t.due_at < date_trunc('day', now()) + interval '1 day'
           AND (p_org_id IS NULL OR t.org_id = p_org_id)),
      'overdue', (
        SELECT count(*) FROM public.tasks t
         WHERE t.status <> 'done' AND t.due_at < date_trunc('day', now())
           AND (p_org_id IS NULL OR t.org_id = p_org_id))
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid) TO authenticated;