
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'solo';
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days');

ALTER TABLE public.orgs ADD CONSTRAINT orgs_subscription_tier_check CHECK (subscription_tier IN ('solo','team','growth','enterprise'));
ALTER TABLE public.orgs ADD CONSTRAINT orgs_subscription_status_check CHECK (subscription_status IN ('trialing','active','past_due','canceled'));
