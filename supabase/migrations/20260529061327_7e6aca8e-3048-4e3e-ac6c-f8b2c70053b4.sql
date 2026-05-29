
CREATE TABLE public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brief_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

GRANT SELECT, INSERT ON public.daily_briefs TO authenticated;
GRANT ALL ON public.daily_briefs TO service_role;

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DailyBriefs: self read"
  ON public.daily_briefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "DailyBriefs: self insert"
  ON public.daily_briefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_daily_briefs_user_date ON public.daily_briefs (user_id, brief_date DESC);
