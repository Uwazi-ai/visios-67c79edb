
-- 1) Table
CREATE TABLE IF NOT EXISTS public.org_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL UNIQUE,
  month TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  vision_messages_used INTEGER NOT NULL DEFAULT 0,
  knowledge_docs_count INTEGER NOT NULL DEFAULT 0,
  contacts_count INTEGER NOT NULL DEFAULT 0,
  active_agents_count INTEGER NOT NULL DEFAULT 0,
  social_posts_this_month INTEGER NOT NULL DEFAULT 0,
  seats_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.org_usage TO authenticated;
GRANT ALL ON public.org_usage TO service_role;

ALTER TABLE public.org_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members see usage" ON public.org_usage;
CREATE POLICY "Org members see usage"
  ON public.org_usage FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members update usage" ON public.org_usage;
CREATE POLICY "Org members update usage"
  ON public.org_usage FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members insert usage" ON public.org_usage;
CREATE POLICY "Org members insert usage"
  ON public.org_usage FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER org_usage_updated_at
  BEFORE UPDATE ON public.org_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Helper: ensure row exists
CREATE OR REPLACE FUNCTION public.ensure_org_usage(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.org_usage (org_id) VALUES (_org_id)
  ON CONFLICT (org_id) DO NOTHING;
END;
$$;

-- 3) Recount helpers
CREATE OR REPLACE FUNCTION public.recount_org_usage(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_org_usage(_org_id);
  UPDATE public.org_usage SET
    contacts_count = COALESCE((SELECT count(*) FROM public.contacts WHERE org_id = _org_id), 0),
    knowledge_docs_count = COALESCE((SELECT count(*) FROM public.kb_documents WHERE org_id = _org_id), 0),
    active_agents_count = COALESCE((SELECT count(*) FROM public.visi_agents WHERE org_id = _org_id AND is_active = true), 0),
    seats_used = COALESCE((SELECT count(*) FROM public.org_memberships WHERE org_id = _org_id), 1)
  WHERE org_id = _org_id;
END;
$$;

-- 4) Triggers for live counts
CREATE OR REPLACE FUNCTION public.trg_contacts_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.org_id IS NOT NULL THEN
    PERFORM public.ensure_org_usage(NEW.org_id);
    UPDATE public.org_usage SET contacts_count = contacts_count + 1 WHERE org_id = NEW.org_id;
  ELSIF TG_OP = 'DELETE' AND OLD.org_id IS NOT NULL THEN
    UPDATE public.org_usage SET contacts_count = GREATEST(contacts_count - 1, 0) WHERE org_id = OLD.org_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS contacts_count_trg ON public.contacts;
CREATE TRIGGER contacts_count_trg AFTER INSERT OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_contacts_count();

CREATE OR REPLACE FUNCTION public.trg_kb_docs_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.org_id IS NOT NULL THEN
    PERFORM public.ensure_org_usage(NEW.org_id);
    UPDATE public.org_usage SET knowledge_docs_count = knowledge_docs_count + 1 WHERE org_id = NEW.org_id;
  ELSIF TG_OP = 'DELETE' AND OLD.org_id IS NOT NULL THEN
    UPDATE public.org_usage SET knowledge_docs_count = GREATEST(knowledge_docs_count - 1, 0) WHERE org_id = OLD.org_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS kb_docs_count_trg ON public.kb_documents;
CREATE TRIGGER kb_docs_count_trg AFTER INSERT OR DELETE ON public.kb_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_kb_docs_count();

CREATE OR REPLACE FUNCTION public.trg_agents_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid UUID;
BEGIN
  oid := COALESCE(NEW.org_id, OLD.org_id);
  IF oid IS NOT NULL THEN
    PERFORM public.recount_org_usage(oid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS agents_count_trg ON public.visi_agents;
CREATE TRIGGER agents_count_trg AFTER INSERT OR UPDATE OR DELETE ON public.visi_agents
  FOR EACH ROW EXECUTE FUNCTION public.trg_agents_count();

CREATE OR REPLACE FUNCTION public.trg_seats_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid UUID;
BEGIN
  oid := COALESCE(NEW.org_id, OLD.org_id);
  IF oid IS NOT NULL THEN
    PERFORM public.recount_org_usage(oid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS seats_count_trg ON public.org_memberships;
CREATE TRIGGER seats_count_trg AFTER INSERT OR DELETE ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.trg_seats_count();

CREATE OR REPLACE FUNCTION public.trg_social_posts_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.org_id IS NOT NULL THEN
    PERFORM public.ensure_org_usage(NEW.org_id);
    UPDATE public.org_usage SET social_posts_this_month = social_posts_this_month + 1 WHERE org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS social_posts_count_trg ON public.social_posts;
CREATE TRIGGER social_posts_count_trg AFTER INSERT ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_social_posts_count();

-- 5) RPC: increment vision messages (called from frontend on successful claude-proxy)
CREATE OR REPLACE FUNCTION public.increment_vision_usage(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _org_id IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_org_usage(_org_id);
  UPDATE public.org_usage
     SET vision_messages_used = vision_messages_used + 1
   WHERE org_id = _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_vision_usage(UUID) TO authenticated;

-- 6) Monthly reset
DO $$ BEGIN
  PERFORM cron.unschedule('reset-monthly-usage');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reset-monthly-usage',
  '0 0 1 * *',
  $$ UPDATE public.org_usage
       SET vision_messages_used = 0,
           social_posts_this_month = 0,
           month = to_char(now(), 'YYYY-MM') $$
);

-- 7) Backfill rows + counts
INSERT INTO public.org_usage (org_id)
  SELECT id FROM public.orgs ON CONFLICT (org_id) DO NOTHING;

DO $$
DECLARE o RECORD;
BEGIN
  FOR o IN SELECT id FROM public.orgs LOOP
    PERFORM public.recount_org_usage(o.id);
  END LOOP;
END $$;
