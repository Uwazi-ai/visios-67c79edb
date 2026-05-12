import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCalendarPreferences() {
  const { user } = useAuth();
  const [visibleMemberIds, setVisibleMemberIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("calendar_preferences")
        .select("visible_member_ids")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setVisibleMemberIds(((data as any)?.visible_member_ids as string[]) ?? []);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggleMember = useCallback(async (memberId: string, on: boolean) => {
    if (!user) return;
    setVisibleMemberIds((prev) => {
      const set = new Set(prev);
      if (on) set.add(memberId); else set.delete(memberId);
      const next = Array.from(set);
      supabase
        .from("calendar_preferences")
        .upsert({ user_id: user.id, visible_member_ids: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .then(() => {});
      return next;
    });
  }, [user]);

  const setAll = useCallback(async (ids: string[]) => {
    if (!user) return;
    setVisibleMemberIds(ids);
    await supabase
      .from("calendar_preferences")
      .upsert({ user_id: user.id, visible_member_ids: ids, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }, [user]);

  return { visibleMemberIds, toggleMember, setAll, loaded };
}
