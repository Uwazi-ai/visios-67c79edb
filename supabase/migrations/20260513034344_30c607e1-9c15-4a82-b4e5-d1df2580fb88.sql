
CREATE TABLE IF NOT EXISTS public.mcp_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  tool text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_approvals_org_status_idx ON public.mcp_approvals(org_id, status, created_at DESC);

ALTER TABLE public.mcp_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approvals: org read" ON public.mcp_approvals
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Approvals: org write" ON public.mcp_approvals
  FOR INSERT TO authenticated
  WITH CHECK (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Approvals: org update" ON public.mcp_approvals
  FOR UPDATE TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));
