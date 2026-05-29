import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Agent, AgentRun } from "@/lib/agents";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("visi_agents" as any)
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    setAgents((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const update = useCallback(async (id: string, patch: Partial<Agent>) => {
    const { error } = await supabase.from("visi_agents" as any).update(patch as any).eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const create = useCallback(async (a: Partial<Agent>) => {
    const { data, error } = await supabase.from("visi_agents" as any).insert(a as any).select().single();
    if (error) throw error;
    await refresh();
    return data as any as Agent;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("visi_agents" as any).delete().eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { agents, loading, refresh, update, create, remove };
}

export function useAgentRuns(agentId: string | null) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) { setRuns([]); return; }
    setLoading(true);
    supabase
      .from("visi_agent_runs" as any)
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setRuns((data as any) || []);
        setLoading(false);
      });
  }, [agentId]);

  return { runs, loading };
}

export function useWeeklyRunCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    supabase
      .from("visi_agent_runs" as any)
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .then(({ count: c }) => setCount(c || 0));
  }, []);
  return count;
}

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("visi_settings" as any).select("key,value");
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value || ""; });
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (key: string, value: string) => {
    const { error } = await supabase.from("visi_settings" as any).update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { settings, loading, save, refresh };
}

// Make.com proxy calls
export async function callMake(path: string, opts: { method?: string; query?: Record<string, any>; body?: any } = {}) {
  const { data, error } = await supabase.functions.invoke("make-proxy", {
    body: { path, method: opts.method || "GET", query: opts.query, body: opts.body },
  });
  if (error) throw new Error(humanError(error.message || "Make API error"));
  if (!data?.ok) {
    const status = data?.status;
    const msg = data?.data?.message || data?.data?.detail || JSON.stringify(data?.data);
    throw new Error(humanError(msg, status));
  }
  return data.data;
}

function humanError(msg: string, status?: number): string {
  if (status === 401 || /unauthor/i.test(msg)) return "Make.com API key invalid — update in Settings";
  if (status === 429 || /rate/i.test(msg)) return "Rate limit hit — try again in a moment";
  if (/No Make\.com API key/i.test(msg)) return "Connect Make.com in Settings → Agents to get started";
  return msg;
}
