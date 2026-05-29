import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformToken } from "@/lib/socialPlatforms";
import type { SocialPlatform } from "@/components/social/shared";

export function useSocialConnections() {
  const [tokens, setTokens] = useState<PlatformToken[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("social_platform_tokens")
      .select("*")
      .eq("is_active", true);
    setTokens(((data || []) as PlatformToken[]));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getFor = useCallback(
    (p: SocialPlatform) => tokens.find((t) => t.platform === p) || null,
    [tokens],
  );

  const disconnect = useCallback(async (id: string) => {
    await (supabase as any).from("social_platform_tokens").delete().eq("id", id);
    await load();
  }, [load]);

  return { tokens, loading, getFor, refresh: load, disconnect };
}
