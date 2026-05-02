// Helper: which contact_review_queue rows are pending — used by sidebar badge & status bar.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AgentSettings {
  gmail_contact_sync_enabled: boolean;
  gmail_sync_frequency_hours: number;
  gmail_sync_lookback_days: number;
  gmail_auto_approve_known_domains: boolean;
  gmail_min_email_count: number;
  gmail_last_synced_at: string | null;
}

const DEFAULTS: AgentSettings = {
  gmail_contact_sync_enabled: false,
  gmail_sync_frequency_hours: 24,
  gmail_sync_lookback_days: 7,
  gmail_auto_approve_known_domains: false,
  gmail_min_email_count: 1,
  gmail_last_synced_at: null,
};

export function usePendingReviewCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { count: c } = await supabase
        .from("contact_review_queue")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (!cancelled) setCount(c ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user, tick]);

  return { count, refresh };
}

export function useAgentSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AgentSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("agent_settings")
      .select("gmail_contact_sync_enabled, gmail_sync_frequency_hours, gmail_sync_lookback_days, gmail_auto_approve_known_domains, gmail_min_email_count, gmail_last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setSettings({ ...DEFAULTS, ...data });
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (patch: Partial<AgentSettings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase
      .from("agent_settings")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
  }, [user, settings]);

  return { settings, loading, save, reload: load };
}
