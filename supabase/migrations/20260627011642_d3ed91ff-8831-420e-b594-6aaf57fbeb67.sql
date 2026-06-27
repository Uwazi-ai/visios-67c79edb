
-- STEP 2: exemption columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exempt_reason TEXT,
  ADD COLUMN IF NOT EXISTS exempt_set_at TIMESTAMPTZ;

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exempt_reason TEXT;

-- STEP 3+4: exempt Myke and all @uwazi.ai team members
UPDATE public.profiles p
SET is_exempt = true,
    exempt_reason = CASE
      WHEN lower(au.email) = 'myke@uwazi.ai' THEN 'Founder — myke@uwazi.ai permanent access'
      ELSE 'Uwazi.AI team member — permanent access'
    END,
    exempt_set_at = now()
FROM auth.users au
WHERE au.id = p.id
  AND lower(au.email) LIKE '%@uwazi.ai';

-- STEP 5: set every org owned by Myke to growth/active, exempt, trial through 2099
WITH myke AS (
  SELECT id FROM auth.users WHERE lower(email) = 'myke@uwazi.ai' LIMIT 1
),
myke_orgs AS (
  SELECT om.org_id
  FROM public.org_memberships om
  JOIN myke ON myke.id = om.user_id
  WHERE om.role = 'owner'
)
UPDATE public.orgs o
SET subscription_tier = 'growth',
    subscription_status = 'active',
    trial_ends_at = '2099-12-31 00:00:00+00',
    is_exempt = true,
    exempt_reason = 'Founder org (Uwazi.AI) — permanent access'
WHERE o.id IN (SELECT org_id FROM myke_orgs);

-- STEP 6: exempt every member of any org Myke owns
WITH myke AS (
  SELECT id FROM auth.users WHERE lower(email) = 'myke@uwazi.ai' LIMIT 1
),
myke_orgs AS (
  SELECT om.org_id
  FROM public.org_memberships om
  JOIN myke ON myke.id = om.user_id
  WHERE om.role = 'owner'
)
UPDATE public.profiles p
SET is_exempt = true,
    exempt_reason = COALESCE(p.exempt_reason, 'Member of founder org — permanent access'),
    exempt_set_at = COALESCE(p.exempt_set_at, now())
WHERE p.is_exempt = false
  AND p.id IN (
    SELECT DISTINCT om.user_id
    FROM public.org_memberships om
    WHERE om.org_id IN (SELECT org_id FROM myke_orgs)
  );

-- STEP 7: helper functions
-- Note: is_super_admin(uuid) already exists. Add a no-arg convenience that uses auth.uid().
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_exempt_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_exempt FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_exempt_user() TO authenticated;

-- STEP 8: trigger to auto-exempt future @uwazi.ai signups.
-- Must run AFTER handle_new_user (which creates the profile row).
CREATE OR REPLACE FUNCTION public.auto_exempt_uwazi_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND lower(NEW.email) LIKE '%@uwazi.ai' THEN
    UPDATE public.profiles
       SET is_exempt = true,
           exempt_reason = 'Uwazi.AI team — auto-exempted on signup',
           exempt_set_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_uwazi_team_signup ON auth.users;
CREATE TRIGGER on_uwazi_team_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_exempt_uwazi_team();
