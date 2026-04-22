-- 1. channels table updates
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS is_dm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_participants uuid[] NOT NULL DEFAULT '{}';

-- Backfill is_dm/is_system from existing 'type' column if present
UPDATE public.channels SET is_dm = true WHERE type = 'dm' AND is_dm = false;
UPDATE public.channels SET is_system = true WHERE type = 'system' AND is_system = false;

-- 2. messages: rename body -> content (only if body exists and content doesn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='messages' AND column_name='body'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='messages' AND column_name='content'
  ) THEN
    ALTER TABLE public.messages RENAME COLUMN body TO content;
  END IF;
END $$;

-- 3. Refine RLS for channels: DMs visible only to participants
DROP POLICY IF EXISTS "Channels: org read" ON public.channels;
CREATE POLICY "Channels: org read"
ON public.channels FOR SELECT
TO authenticated
USING (
  (is_dm = false AND public.is_org_member(auth.uid(), org_id))
  OR (is_dm = true AND auth.uid() = ANY(dm_participants))
);

-- Block client inserts/updates/deletes on system channels
DROP POLICY IF EXISTS "Channels: org write" ON public.channels;
CREATE POLICY "Channels: org write"
ON public.channels FOR INSERT
TO authenticated
WITH CHECK (
  is_system = false 
  AND public.is_org_member(auth.uid(), org_id)
  AND (
    is_dm = false 
    OR (is_dm = true AND auth.uid() = ANY(dm_participants))
  )
);

DROP POLICY IF EXISTS "Channels: org update" ON public.channels;
CREATE POLICY "Channels: org update"
ON public.channels FOR UPDATE
TO authenticated
USING (is_system = false AND public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Channels: org delete" ON public.channels;
CREATE POLICY "Channels: org delete"
ON public.channels FOR DELETE
TO authenticated
USING (is_system = false AND public.is_org_member(auth.uid(), org_id));

-- 4. Refine messages RLS: block writes to system channels (clients can't post; only service role bypasses RLS)
DROP POLICY IF EXISTS "Messages: org write" ON public.messages;
CREATE POLICY "Messages: org write"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_member(auth.uid(), org_id)
  AND user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = messages.channel_id AND c.is_system = true
  )
);

-- 5. Realtime publication for messages + channels
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;

-- 6. Seed default channels for each existing org
INSERT INTO public.channels (org_id, name, type, is_dm, is_system)
SELECT o.id, ch.name, 'channel', false, false
FROM public.orgs o
CROSS JOIN (
  VALUES 
    ('uwazi', 'general'),
    ('uwazi', 'dev'),
    ('uwazi', 'raia-g1'),
    ('uwazi', 'visi-os'),
    ('cc', 'general'),
    ('cc', 'campaigns'),
    ('bin', 'general'),
    ('bin', 'events')
) AS ch(slug, name)
WHERE o.slug = ch.slug
  AND NOT EXISTS (
    SELECT 1 FROM public.channels c2 
    WHERE c2.org_id = o.id AND c2.name = ch.name AND c2.is_dm = false
  );

-- 7. Seed system channels per org
INSERT INTO public.channels (org_id, name, type, is_dm, is_system)
SELECT o.id, ch.name, 'system', false, true
FROM public.orgs o
CROSS JOIN (VALUES ('alerts'), ('deploys')) AS ch(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.channels c2 
  WHERE c2.org_id = o.id AND c2.name = ch.name AND c2.is_system = true
);