
-- 1. plans
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_monthly integer NOT NULL DEFAULT 0,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_authenticated" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_write_platform_admin" ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_owner_id uuid NOT NULL,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','grace','read_only','export_only')),
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_owner_uniq ON public.subscriptions(org_owner_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_owner_read" ON public.subscriptions FOR SELECT TO authenticated
  USING (
    org_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_members m
      JOIN public.orgs o ON o.id = m.org_id
      WHERE m.user_id = auth.uid() AND o.owner_id = public.subscriptions.org_owner_id
    )
  );
CREATE POLICY "subscriptions_platform_admin_all" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

-- 3. usage_counters
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  metric text NOT NULL,
  period text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, metric, period)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_counters_owner_read" ON public.usage_counters FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- 4. lock_events
CREATE TABLE public.lock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  tier text,
  lock_type text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lock_events TO authenticated;
GRANT ALL ON public.lock_events TO service_role;
ALTER TABLE public.lock_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lock_events_own_read" ON public.lock_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- updated_at triggers
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed plans
INSERT INTO public.plans (id, name, price_monthly, limits) VALUES
('free','Free',0,'{"org_cap":2,"seat_cap":1,"vision_messages_mo":30,"contacts_cap":100,"documents_cap":25,"personas":2,"features":{"team_chat":false,"agents":false,"social":false,"meetings":false,"custom_personas":false,"admin_controls":false,"priority_support":false}}'::jsonb),
('starter','Starter',29,'{"org_cap":2,"seat_cap":3,"vision_messages_mo":500,"contacts_cap":2500,"documents_cap":500,"personas":-1,"features":{"team_chat":true,"agents":true,"social":false,"meetings":true,"custom_personas":true,"admin_controls":false,"priority_support":false}}'::jsonb),
('growth','Growth',79,'{"org_cap":5,"seat_cap":25,"vision_messages_mo":-1,"contacts_cap":-1,"documents_cap":-1,"personas":-1,"features":{"team_chat":true,"agents":true,"social":true,"meetings":true,"custom_personas":true,"admin_controls":true,"priority_support":true}}'::jsonb),
('enterprise','Enterprise',0,'{"custom_pricing":true,"org_cap":-1,"seat_cap":-1,"vision_messages_mo":-1,"contacts_cap":-1,"documents_cap":-1,"personas":-1,"features":{"team_chat":true,"agents":true,"social":true,"meetings":true,"custom_personas":true,"admin_controls":true,"priority_support":true}}'::jsonb);

-- monthly counter reset at period boundary
CREATE OR REPLACE FUNCTION public.reset_usage_counters()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.usage_counters WHERE period < to_char(now(), 'YYYY-MM');
$$;
REVOKE ALL ON FUNCTION public.reset_usage_counters() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('usage-counters-monthly-reset', '5 0 1 * *', $$SELECT public.reset_usage_counters();$$);
