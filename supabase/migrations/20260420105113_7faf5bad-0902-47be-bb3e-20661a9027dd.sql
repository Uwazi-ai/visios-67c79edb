-- Activity log + comments for tasks
CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL,                 -- 'comment' | 'status_change' | 'priority_change' | 'assignee_change' | 'due_change' | 'created'
  body text,                          -- comment text (for kind='comment')
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { from: 'todo', to: 'in_progress' }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activity_task_id_created_at
  ON public.task_activity (task_id, created_at DESC);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- Org members can read all activity for their org's tasks
CREATE POLICY "TaskActivity: org read"
ON public.task_activity FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), org_id));

-- Org members can insert; comments must be authored by the current user
CREATE POLICY "TaskActivity: org insert"
ON public.task_activity FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(auth.uid(), org_id)
  AND (kind <> 'comment' OR user_id = auth.uid())
);

-- Authors can edit/delete their own comments only
CREATE POLICY "TaskActivity: author update own comment"
ON public.task_activity FOR UPDATE TO authenticated
USING (kind = 'comment' AND user_id = auth.uid());

CREATE POLICY "TaskActivity: author delete own comment"
ON public.task_activity FOR DELETE TO authenticated
USING (kind = 'comment' AND user_id = auth.uid());

-- Auto-log task changes (status, priority, assignee, due_at) and creation
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity (task_id, org_id, user_id, kind, metadata)
    VALUES (NEW.id, NEW.org_id, COALESCE(actor, NEW.created_by),
            'created', jsonb_build_object('title', NEW.title));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.task_activity (task_id, org_id, user_id, kind, metadata)
      VALUES (NEW.id, NEW.org_id, actor, 'status_change',
              jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_activity (task_id, org_id, user_id, kind, metadata)
      VALUES (NEW.id, NEW.org_id, actor, 'priority_change',
              jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
    END IF;
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO public.task_activity (task_id, org_id, user_id, kind, metadata)
      VALUES (NEW.id, NEW.org_id, actor, 'assignee_change',
              jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id));
    END IF;
    IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      INSERT INTO public.task_activity (task_id, org_id, user_id, kind, metadata)
      VALUES (NEW.id, NEW.org_id, actor, 'due_change',
              jsonb_build_object('from', OLD.due_at, 'to', NEW.due_at));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_task_activity
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();

-- Realtime
ALTER TABLE public.task_activity REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity;