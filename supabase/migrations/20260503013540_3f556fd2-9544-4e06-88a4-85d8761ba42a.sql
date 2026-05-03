
-- Extend projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📋';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by UUID;

-- task_sections
CREATE TABLE IF NOT EXISTS public.task_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sections: org read" ON public.task_sections FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Sections: org write" ON public.task_sections FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Sections: org update" ON public.task_sections FOR UPDATE TO authenticated
USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Sections: org delete" ON public.task_sections FOR DELETE TO authenticated
USING (public.is_org_member(auth.uid(), org_id));

-- Extend tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.task_sections(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Auto completed_at trigger
CREATE OR REPLACE FUNCTION public.tasks_completed_at_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_set_completed_at ON public.tasks;
CREATE TRIGGER tasks_set_completed_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_completed_at_trigger();

-- task_comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  org_id UUID,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TaskComments: org read" ON public.task_comments FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "TaskComments: self write" ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_org_member(auth.uid(), org_id));
CREATE POLICY "TaskComments: self update" ON public.task_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "TaskComments: self delete" ON public.task_comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- task_attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  org_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'upload',
  drive_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TaskAttach: org read" ON public.task_attachments FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "TaskAttach: org write" ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "TaskAttach: org update" ON public.task_attachments FOR UPDATE TO authenticated
USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "TaskAttach: org delete" ON public.task_attachments FOR DELETE TO authenticated
USING (public.is_org_member(auth.uid(), org_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_section ON public.tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_sections_project ON public.task_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_attach_task ON public.task_attachments(task_id);
