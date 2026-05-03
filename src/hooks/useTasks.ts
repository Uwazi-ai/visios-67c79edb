import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "@/hooks/use-toast";

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type TaskPriority = "urgent" | "high" | "normal" | "medium" | "low";

export interface Task {
  id: string;
  org_id: string | null;
  project_id: string | null;
  section_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus | string | null;
  priority: TaskPriority | string | null;
  due_at: string | null;
  start_date: string | null;
  estimate_mins: number | null;
  assignee_id: string | null;
  created_by: string | null;
  parent_task_id: string | null;
  sort_order: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  org_id: string | null;
  status: string | null;
  emoji: string | null;
  is_archived: boolean;
  display_order: number;
  created_by: string | null;
}

export interface TaskSection {
  id: string;
  project_id: string;
  org_id: string | null;
  name: string;
  display_order: number;
  is_collapsed: boolean;
}

export function useTasks() {
  const { activeOrgId, orgs } = useOrg();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let tq = supabase.from("tasks").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    let pq = supabase.from("projects").select("*").eq("is_archived", false).order("display_order").order("name");
    let sq = supabase.from("task_sections").select("*").order("display_order");
    if (activeOrgId && activeOrgId !== "all") {
      tq = tq.eq("org_id", activeOrgId);
      pq = pq.eq("org_id", activeOrgId);
      sq = sq.eq("org_id", activeOrgId);
    }
    const [{ data: t }, { data: p }, { data: s }] = await Promise.all([tq, pq, sq]);
    setTasks((t ?? []) as Task[]);
    setProjects((p ?? []) as Project[]);
    setSections((s ?? []) as TaskSection[]);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`tasks-v2-${activeOrgId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        setTasks((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Task;
            if (activeOrgId && activeOrgId !== "all" && row.org_id !== activeOrgId) return prev;
            if (prev.find((t) => t.id === row.id)) return prev;
            return [row, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Task;
            return prev.map((t) => (t.id === row.id ? { ...t, ...row } : t));
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as Task;
            return prev.filter((t) => t.id !== row.id);
          }
          return prev;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_sections" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [activeOrgId, load]);

  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const createTask = async (input: Partial<Task> & { title: string; org_id: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: input.title,
      org_id: input.org_id,
      project_id: input.project_id ?? null,
      section_id: input.section_id ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "normal",
      due_at: input.due_at ?? null,
      start_date: input.start_date ?? null,
      assignee_id: input.assignee_id ?? user?.id ?? null,
      created_by: user?.id ?? null,
      parent_task_id: input.parent_task_id ?? null,
      description: input.description ?? null,
      estimate_mins: input.estimate_mins ?? null,
      sort_order: input.sort_order ?? 0,
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return null;
    }
    return data as Task;
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const createProject = async (input: { name: string; org_id: string; emoji?: string; description?: string; template?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: input.name,
        org_id: input.org_id,
        description: input.description ?? null,
        emoji: input.emoji ?? "📋",
        status: "active",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Project failed", description: error.message, variant: "destructive" });
      return null;
    }
    const project = data as Project;

    // Seed sections from template
    const SECTION_TEMPLATES: Record<string, string[]> = {
      blank: ["To Do"],
      sprint: ["Backlog", "Sprint", "In Review", "Done"],
      launch: ["Pre-Launch", "Launch Week", "Post-Launch"],
      client: ["Discovery", "Active Work", "Client Review", "Wrapped"],
      personal: ["Today", "This Week", "Someday"],
    };
    const tpl = SECTION_TEMPLATES[input.template ?? "blank"] ?? SECTION_TEMPLATES.blank;
    if (tpl.length > 0) {
      await supabase.from("task_sections").insert(
        tpl.map((name, i) => ({
          project_id: project.id,
          org_id: input.org_id,
          name,
          display_order: i,
        })),
      );
    }
    void load();
    return project;
  };

  const updateProject = async (id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
  };

  const archiveProject = async (id: string) => {
    await updateProject(id, { is_archived: true });
  };

  const deleteProject = async (id: string) => {
    setProjects((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const createSection = async (input: { project_id: string; org_id: string; name: string }) => {
    const { data, error } = await supabase
      .from("task_sections")
      .insert({ ...input, display_order: sections.filter((s) => s.project_id === input.project_id).length })
      .select()
      .single();
    if (error) {
      toast({ title: "Section failed", description: error.message, variant: "destructive" });
      return null;
    }
    return data as TaskSection;
  };

  const updateSection = async (id: string, patch: Partial<TaskSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("task_sections").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
  };

  const deleteSection = async (id: string) => {
    setSections((p) => p.filter((s) => s.id !== id));
    const { error } = await supabase.from("task_sections").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
  };

  return {
    tasks, projects, sections, orgs, loading,
    updateTask, createTask, deleteTask,
    createProject, updateProject, archiveProject, deleteProject,
    createSection, updateSection, deleteSection,
    reload: load,
  };
}
