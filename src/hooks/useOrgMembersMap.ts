import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";

export interface MemberInfo {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Returns a map of user_id -> MemberInfo for every member of every org
 * the current user belongs to. Used to render assignee avatars.
 */
export function useOrgMembersMap() {
  const { memberships } = useOrg();
  const [map, setMap] = useState<Record<string, MemberInfo>>({});

  useEffect(() => {
    const orgIds = memberships.map((m) => m.org_id);
    if (orgIds.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: mems } = await supabase
        .from("org_memberships")
        .select("user_id")
        .in("org_id", orgIds);
      const userIds = Array.from(new Set((mems ?? []).map((m: any) => m.user_id)));
      if (userIds.length === 0) {
        if (!cancelled) setMap({});
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", userIds);
      if (cancelled) return;
      const next: Record<string, MemberInfo> = {};
      for (const p of (profs ?? []) as any[]) {
        next[p.id] = {
          user_id: p.id,
          display_name: p.display_name,
          email: p.email,
          avatar_url: p.avatar_url,
        };
      }
      setMap(next);
    })();
    return () => { cancelled = true; };
  }, [memberships.map((m) => m.org_id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}
