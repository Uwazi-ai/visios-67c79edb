import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_TZ,
  formatTime as fmtTime,
  formatDate as fmtDate,
  formatDateTime as fmtDateTime,
  formatTimeShort as fmtTimeShort,
  type TimeOpts,
} from "@/lib/time";

interface TimezoneCtx {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const Ctx = createContext<TimezoneCtx>({ timezone: DEFAULT_TZ, setTimezone: () => {} });

export const TimezoneProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState<string>(DEFAULT_TZ);

  useEffect(() => {
    if (!user) {
      setTimezone(DEFAULT_TZ);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      if (!cancelled) setTimezone((data?.timezone as string) || DEFAULT_TZ);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return <Ctx.Provider value={{ timezone, setTimezone }}>{children}</Ctx.Provider>;
};

export const useTimezone = () => useContext(Ctx).timezone;

/**
 * Returns 12-hour, timezone-aware formatters bound to the current user's tz.
 * All date/time UI in the app should use these.
 */
export function useTime() {
  const tz = useTimezone();
  return useMemo(() => ({
    tz,
    formatTime: (d: Date | string | number, opts?: TimeOpts) => fmtTime(d, tz, opts),
    formatDate: (d: Date | string | number, opts?: TimeOpts) => fmtDate(d, tz, opts),
    formatDateTime: (d: Date | string | number, opts?: TimeOpts) => fmtDateTime(d, tz, opts),
    formatTimeShort: (d: Date | string | number) => fmtTimeShort(d, tz),
  }), [tz]);
}
