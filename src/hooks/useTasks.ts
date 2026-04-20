import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "@/hooks/use-toast";

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type TaskPriority = "urgent" | "high" | "normal" | "low";

export interface Task {
  id: string;
  org_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus | string | null;
  priority: TaskPriority | string | null;
  due_at: string | null;
  estimate_mins: number | null;
  assignee_id: string | null;
  created_by: string | null;
  parent_task_id: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  org_id: string | null;
  status: string | null;
}

export function useTasks() {
  const { activeOrgId, orgs } = useOrg();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let tq = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    let pq = supabase.from("projects").select("*").order("name");
    if (activeOrgId && activeOrgId !== "all") {
      tq = tq.eq("org_id", activeOrgId);
      pq = pq.eq("org_id", activeOrgId);
    }
    const [{ data: t }, { data: p }] = await Promise.all([tq, pq]);
    setTasks((t ?? []) as Task[]);
    setProjects((p ?? []) as Project[]);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-${activeOrgId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
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
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeOrgId]);

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
      status: input.status ?? "todo",
      priority: input.priority ?? "normal",
      due_at: input.due_at ?? null,
      assignee_id: input.assignee_id ?? user?.id ?? null,
      created_by: user?.id ?? null,
      parent_task_id: input.parent_task_id ?? null,
      description: input.description ?? null,
      estimate_mins: input.estimate_mins ?? null,
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

  const createProject = async (name: string, org_id: string) => {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, org_id, status: "active" })
      .select()
      .single();
    if (error) {
      toast({ title: "Project failed", description: error.message, variant: "destructive" });
      return null;
    }
    setProjects((p) => [...p, data as Project]);
    return data as Project;
  };

  return { tasks, projects, orgs, loading, updateTask, createTask, deleteTask, createProject, reload: load };
}
