
CREATE TABLE public.fundraising_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num integer NOT NULL,
  name text NOT NULL,
  organization text NOT NULL,
  type text NOT NULL DEFAULT 'vc',
  entity text NOT NULL DEFAULT 'UWAZI.AI',
  target_amount text,
  deadline text,
  phase integer NOT NULL DEFAULT 1,
  urgency text NOT NULL DEFAULT 'soon',
  status text NOT NULL DEFAULT 'not started',
  notes text,
  assigned_to text,
  next_action text,
  committed_amount numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fundraising_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fundraising: auth read" ON public.fundraising_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Fundraising: auth insert" ON public.fundraising_opportunities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Fundraising: auth update" ON public.fundraising_opportunities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Fundraising: auth delete" ON public.fundraising_opportunities FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_fundraising_opportunities_updated_at
BEFORE UPDATE ON public.fundraising_opportunities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fundraising_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.fundraising_opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  assigned_to text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fundraising_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FundTasks: auth read" ON public.fundraising_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "FundTasks: auth insert" ON public.fundraising_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "FundTasks: auth update" ON public.fundraising_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "FundTasks: auth delete" ON public.fundraising_tasks FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_fundraising_tasks_updated_at
BEFORE UPDATE ON public.fundraising_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fundraising_tasks_opp ON public.fundraising_tasks(opportunity_id);
CREATE INDEX idx_fundraising_opps_order ON public.fundraising_opportunities(order_num);
