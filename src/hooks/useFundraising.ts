import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type OppType = "accelerator" | "vc" | "grant";
export type Urgency = "fire" | "now" | "soon" | "build" | "watch";
export type OppStatus =
  | "not started"
  | "researching"
  | "drafting"
  | "applied"
  | "in review"
  | "awarded"
  | "declined"
  | "watching";

export interface Opportunity {
  id: string;
  order_num: number;
  name: string;
  organization: string;
  type: OppType | string;
  entity: string;
  target_amount: string | null;
  deadline: string | null;
  phase: number;
  urgency: Urgency | string;
  status: OppStatus | string;
  notes: string | null;
  assigned_to: string | null;
  next_action: string | null;
  committed_amount: number;
  created_at: string;
  updated_at: string;
}

export interface FundraisingTask {
  id: string;
  opportunity_id: string | null;
  title: string;
  due_at: string | null;
  assigned_to: string | null;
  status: "open" | "done" | string;
  created_at: string;
}

export function useFundraising() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<FundraisingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: o }, { data: t }] = await Promise.all([
      supabase.from("fundraising_opportunities").select("*").order("order_num"),
      supabase.from("fundraising_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
    ]);
    setOpportunities((o ?? []) as Opportunity[]);
    setTasks((t ?? []) as FundraisingTask[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("fundraising")
      .on("postgres_changes", { event: "*", schema: "public", table: "fundraising_opportunities" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "fundraising_tasks" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const updateOpportunity = async (id: string, patch: Partial<Opportunity>) => {
    setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    const { error } = await supabase.from("fundraising_opportunities").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      void load();
    }
  };

  const createTask = async (input: Omit<FundraisingTask, "id" | "created_at" | "status"> & { status?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fundraising_tasks").insert({
      opportunity_id: input.opportunity_id,
      title: input.title,
      due_at: input.due_at,
      assigned_to: input.assigned_to,
      status: input.status ?? "open",
      created_by: user?.id ?? null,
    });
    if (error) toast({ title: "Task failed", description: error.message, variant: "destructive" });
  };

  const updateTask = async (id: string, patch: Partial<FundraisingTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("fundraising_tasks").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("fundraising_tasks").delete().eq("id", id);
  };

  return { opportunities, tasks, loading, updateOpportunity, createTask, updateTask, deleteTask, reload: load };
}
