import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useSurfaceActivity — records "this person is looking at this surface right now".
 *
 * The email job reads it to suppress alerts about something the user already
 * watched happen. Throttled to once a minute: presence is not telemetry.
 */
export const useSurfaceActivity = (surface: string) => {
  const last = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const beat = async () => {
      if (Date.now() - last.current < 60_000) return;
      last.current = Date.now();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", auth.user.id)
        .maybeSingle();
      const prefs = ((profile as any)?.preferences ?? {}) as Record<string, any>;
      await supabase
        .from("profiles")
        .update({
          preferences: {
            ...prefs,
            surface_activity: { ...(prefs.surface_activity ?? {}), [surface]: new Date().toISOString() },
          },
        } as never)
        .eq("id", auth.user.id);
    };

    void beat();
    const t = setInterval(beat, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [surface]);
};
