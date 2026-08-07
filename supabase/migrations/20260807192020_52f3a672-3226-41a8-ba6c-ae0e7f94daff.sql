-- ENUMS
CREATE TYPE public.notification_event_type AS ENUM (
  'dm_received','mention','proposal_pending','proposal_expiring','task_assigned',
  'task_due','meeting_soon','meeting_brief_ready','connection_failed',
  'connection_expired','member_joined','quota_warning');
CREATE TYPE public.delivery_mode AS ENUM ('off','immediate','digest');
CREATE TYPE public.delivery_status AS ENUM ('pending','sent','failed','suppressed');

-- NOTIFICATION EVENTS
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type public.notification_event_type NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  deep_link text NOT NULL DEFAULT '/os',
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_events_recipient ON public.notification_events (recipient_id, created_at DESC);
CREATE INDEX idx_notif_events_unread ON public.notification_events (recipient_id) WHERE read_at IS NULL AND dismissed_at IS NULL;
GRANT SELECT, UPDATE ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_events_own_read ON public.notification_events FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY notif_events_own_update ON public.notification_events FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- PREFERENCES
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  event_type public.notification_event_type NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email public.delivery_mode NOT NULL DEFAULT 'off',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notif_prefs_scope_uq ON public.notification_preferences (user_id, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), event_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_own ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER notif_prefs_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DELIVERIES
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  status public.delivery_status NOT NULL DEFAULT 'pending',
  provider_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_deliveries_pending ON public.notification_deliveries (status, created_at) WHERE status = 'pending';
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_deliveries_own_read ON public.notification_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notification_events e WHERE e.id = event_id AND e.recipient_id = auth.uid()));
GRANT SELECT ON public.notification_deliveries TO authenticated;

-- PROPOSAL EXPIRY POLICIES
CREATE TABLE public.proposal_expiry_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ttl_hours integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX proposal_expiry_scope_uq ON public.proposal_expiry_policies (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_expiry_policies TO authenticated;
GRANT ALL ON public.proposal_expiry_policies TO service_role;
ALTER TABLE public.proposal_expiry_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY expiry_policies_read ON public.proposal_expiry_policies FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));
CREATE POLICY expiry_policies_write ON public.proposal_expiry_policies FOR INSERT TO authenticated
  WITH CHECK (org_id IS NOT NULL AND (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin')));
CREATE POLICY expiry_policies_update ON public.proposal_expiry_policies FOR UPDATE TO authenticated
  USING (org_id IS NOT NULL AND (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin')))
  WITH CHECK (org_id IS NOT NULL AND (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin')));
CREATE POLICY expiry_policies_delete ON public.proposal_expiry_policies FOR DELETE TO authenticated
  USING (org_id IS NOT NULL AND (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin')));
CREATE TRIGGER expiry_policies_updated_at BEFORE UPDATE ON public.proposal_expiry_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.proposal_expiry_policies (org_id, kind, ttl_hours) VALUES
  (NULL,'email_reply',72),(NULL,'task',336),(NULL,'post',168),(NULL,'summary',168),(NULL,'calendar_hold',NULL);

-- PROPOSAL EXPIRY BOOKKEEPING
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiring_notified_at timestamptz;

-- INVITATIONS
CREATE TABLE public.org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX org_invitations_open_uq ON public.org_invitations (org_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_org_invitations_token ON public.org_invitations (token_hash);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invitations TO authenticated;
GRANT ALL ON public.org_invitations TO service_role;
ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_invitations_admin_read ON public.org_invitations FOR SELECT TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin')
         OR lower(email::text) = lower(auth.jwt() ->> 'email'));
CREATE POLICY org_invitations_admin_insert ON public.org_invitations FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid() AND (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin')));
CREATE POLICY org_invitations_admin_update ON public.org_invitations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin'));
CREATE POLICY org_invitations_admin_delete ON public.org_invitations FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin'));

-- CONNECTION AUTHORSHIP
ALTER TABLE public.connections ADD COLUMN IF NOT EXISTS connected_by uuid;

-- STORAGE ACCOUNTING
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS storage_bytes_used bigint NOT NULL DEFAULT 0;
ALTER TABLE public.task_attachments ADD COLUMN IF NOT EXISTS size_bytes bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.attachment_storage_delta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.org_id IS NOT NULL THEN
      UPDATE public.orgs SET storage_bytes_used = GREATEST(0, storage_bytes_used + COALESCE(NEW.size_bytes,0)) WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.org_id IS NOT NULL THEN
      UPDATE public.orgs SET storage_bytes_used = GREATEST(0, storage_bytes_used - COALESCE(OLD.size_bytes,0)) WHERE id = OLD.org_id;
    END IF;
    RETURN OLD;
  ELSE
    IF OLD.org_id IS NOT NULL THEN
      UPDATE public.orgs SET storage_bytes_used = GREATEST(0, storage_bytes_used - COALESCE(OLD.size_bytes,0)) WHERE id = OLD.org_id;
    END IF;
    IF NEW.org_id IS NOT NULL THEN
      UPDATE public.orgs SET storage_bytes_used = GREATEST(0, storage_bytes_used + COALESCE(NEW.size_bytes,0)) WHERE id = NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER task_attachments_storage
AFTER INSERT OR UPDATE OR DELETE ON public.task_attachments
FOR EACH ROW EXECUTE FUNCTION public.attachment_storage_delta();

CREATE OR REPLACE FUNCTION public.recompute_org_storage()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.orgs o SET storage_bytes_used = COALESCE(s.total, 0)
  FROM (SELECT org_id, SUM(COALESCE(size_bytes,0)) AS total FROM public.task_attachments GROUP BY org_id) s
  WHERE s.org_id = o.id;
$$;

-- LAST OWNER PROTECTION
CREATE OR REPLACE FUNCTION public.enforce_last_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owners integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'owner' THEN RETURN OLD; END IF;
    SELECT count(*) INTO owners FROM public.org_memberships WHERE org_id = OLD.org_id AND role = 'owner';
    IF owners <= 1 THEN RAISE EXCEPTION 'An organization must keep at least one owner'; END IF;
    RETURN OLD;
  ELSE
    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
      SELECT count(*) INTO owners FROM public.org_memberships WHERE org_id = OLD.org_id AND role = 'owner';
      IF owners <= 1 THEN RAISE EXCEPTION 'An organization must keep at least one owner'; END IF;
    END IF;
    RETURN NEW;
  END IF;
END; $$;

CREATE TRIGGER org_memberships_last_owner
BEFORE UPDATE OR DELETE ON public.org_memberships
FOR EACH ROW EXECUTE FUNCTION public.enforce_last_owner();

-- USAGE SUMMARY
CREATE OR REPLACE FUNCTION public.get_usage_summary(p_org_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER STABLE SET search_path = public AS $$
DECLARE
  period_start timestamptz := date_trunc('month', now());
  v_orgs integer;
  v_connections integer;
  v_vision integer;
  v_briefs integer;
  v_storage bigint;
  v_tier text;
BEGIN
  SELECT count(*) INTO v_orgs
  FROM public.orgs o
  WHERE o.is_demo = false AND o.is_active = true AND public.is_org_member(auth.uid(), o.id);

  SELECT count(*) INTO v_connections FROM public.connections c
  WHERE c.status = 'connected' AND (p_org_id IS NULL OR c.org_id = p_org_id);

  SELECT count(*) INTO v_vision FROM public.chat_messages m
  JOIN public.conversations cv ON cv.id = m.conversation_id
  WHERE m.role = 'assistant' AND m.created_at >= period_start
    AND (p_org_id IS NULL OR cv.org_id = p_org_id);

  SELECT count(*) INTO v_briefs FROM public.meeting_briefs b
  WHERE b.generated_at >= period_start AND (p_org_id IS NULL OR b.org_id = p_org_id);

  SELECT COALESCE(SUM(o.storage_bytes_used),0) INTO v_storage FROM public.orgs o
  WHERE (p_org_id IS NULL OR o.id = p_org_id) AND public.is_org_member(auth.uid(), o.id);

  SELECT o.subscription_tier INTO v_tier FROM public.orgs o WHERE o.id = p_org_id;

  RETURN jsonb_build_object(
    'period_start', period_start,
    'tier', COALESCE(v_tier, 'solo'),
    'orgs', v_orgs,
    'connections', v_connections,
    'vision_messages', v_vision,
    'briefs', v_briefs,
    'storage_bytes', v_storage
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_usage_summary(uuid) TO authenticated;