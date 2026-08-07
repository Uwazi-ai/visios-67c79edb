CREATE EXTENSION IF NOT EXISTS citext;

DROP TABLE IF EXISTS public.mail_routing_rules;

DO $$ BEGIN
  CREATE TYPE public.message_category AS ENUM ('urgent','meetings','transactions','outreach','marketing','uncategorized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.category_source AS ENUM ('pending','ai','user','rule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.triage_status AS ENUM ('inbox','needs_reply','waiting','done','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  connected_by uuid NOT NULL,
  provider text NOT NULL DEFAULT 'gmail',
  email_address citext NOT NULL,
  display_name text,
  status public.connection_status NOT NULL DEFAULT 'disconnected',
  history_id text,
  delta_token text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email_address)
);
CREATE UNIQUE INDEX idx_mail_accounts_address_unique ON public.mail_accounts (email_address);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_accounts TO authenticated;
GRANT ALL ON public.mail_accounts TO service_role;
ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read mail accounts" ON public.mail_accounts FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members write mail accounts" ON public.mail_accounts FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id) AND connected_by = auth.uid());
CREATE POLICY "org members update mail accounts" ON public.mail_accounts FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members delete mail accounts" ON public.mail_accounts FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  mail_account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL,
  provider_thread_id text NOT NULL,
  from_name text,
  from_address citext NOT NULL,
  to_addresses citext[] NOT NULL DEFAULT '{}',
  cc_addresses citext[] NOT NULL DEFAULT '{}',
  subject text,
  snippet text,
  body_text text,
  body_html text,
  body_cached_at timestamptz,
  received_at timestamptz NOT NULL,
  is_unread boolean NOT NULL DEFAULT true,
  is_starred boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  gmail_labels text[] NOT NULL DEFAULT '{}',
  category public.message_category NOT NULL DEFAULT 'uncategorized',
  category_source public.category_source NOT NULL DEFAULT 'pending',
  category_confidence numeric(3,2),
  categorized_at timestamptz,
  triage_status public.triage_status NOT NULL DEFAULT 'inbox',
  needs_reply boolean NOT NULL DEFAULT false,
  triaged_at timestamptz,
  triaged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mail_account_id, provider_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read mail" ON public.mail_messages FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members insert mail" ON public.mail_messages FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members update mail" ON public.mail_messages FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members delete mail" ON public.mail_messages FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE TABLE public.mail_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  match_type text NOT NULL CHECK (match_type IN ('from_address','from_domain','subject_contains')),
  match_value text NOT NULL,
  category public.message_category NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_category_rules TO authenticated;
GRANT ALL ON public.mail_category_rules TO service_role;
ALTER TABLE public.mail_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read rules" ON public.mail_category_rules FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members insert rules" ON public.mail_category_rules FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members update rules" ON public.mail_category_rules FOR UPDATE TO authenticated USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members delete rules" ON public.mail_category_rules FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE INDEX idx_messages_org_list ON public.mail_messages (org_id, received_at DESC)
  WHERE triage_status NOT IN ('done','archived');
CREATE INDEX idx_messages_category ON public.mail_messages (org_id, category, received_at DESC)
  WHERE triage_status NOT IN ('done','archived');
CREATE INDEX idx_messages_needs_reply ON public.mail_messages (org_id, received_at DESC)
  WHERE needs_reply AND triage_status NOT IN ('done','archived');
CREATE INDEX idx_messages_uncategorized ON public.mail_messages (org_id, received_at)
  WHERE category_source = 'pending';
CREATE INDEX idx_messages_thread ON public.mail_messages (provider_thread_id);
CREATE INDEX idx_mail_accounts_org ON public.mail_accounts (org_id);