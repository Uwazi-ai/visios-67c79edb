import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Listens for new rows in app_versions and shows a reload banner to every
 * connected user when the super admin pushes an update.
 */
export function AppUpdateListener() {
  const { user } = useAuth();
  const baselineRef = useRef<number | null>(null);
  // Only the version number is readable by ordinary users — release notes stay
  // with the platform admin, so the banner announces the update without them.
  const [pending, setPending] = useState<{ version: number } | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("app_versions")
        .select("version")
        .order("released_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      baselineRef.current = (data?.version as number) ?? 0;
    })();

    const channel = supabase
      .channel("app-versions-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_versions" },
        (payload) => {
          const v = payload.new as { version: number };
          const baseline = baselineRef.current ?? 0;
          if (v.version > baseline && v.version !== dismissed) {
            setPending({ version: v.version });
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, dismissed]);

  if (!pending) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-[12px] glass"
      style={{
        bottom: 24,
        border: "1px solid var(--border-active)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        maxWidth: "calc(100vw - 32px)",
      }}
      role="status"
    >
      <RefreshCw size={16} style={{ color: "hsl(var(--primary))" }} />
      <div className="min-w-0">
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
          A new update is available
        </div>
        <div className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          v{pending.version}
        </div>
      </div>
      <button
        className="btn-primary"
        style={{ padding: "6px 12px", fontSize: 12 }}
        onClick={() => window.location.reload()}
      >
        Reload now
      </button>
      <button
        className="btn-ghost"
        style={{ padding: 6 }}
        onClick={() => {
          setDismissed(pending.version);
          setPending(null);
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
