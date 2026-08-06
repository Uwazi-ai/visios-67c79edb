import { useEffect, useState } from "react";
import { Rocket, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AppVersion {
  id: string;
  version: number;
  notes: string | null;
  released_at: string;
  released_by: string | null;
}

export default function UpdatesTab() {
  const { user } = useAuth();
  const [latest, setLatest] = useState<AppVersion | null>(null);
  const [history, setHistory] = useState<AppVersion[]>([]);
  const [notes, setNotes] = useState("");
  const [pushing, setPushing] = useState(false);

  const load = async () => {
    // Release notes are super-admin only; served by a gated RPC rather than a
    // direct table read (the table's notes column is not readable by clients).
    const { data } = await supabase.rpc("admin_app_version_history", { _limit: 10 });
    const list = (data ?? []) as AppVersion[];
    setHistory(list);
    setLatest(list[0] ?? null);
  };

  useEffect(() => {
    load();
  }, []);

  async function pushUpdate() {
    if (!user) return;
    if (!confirm("Push a UI update to all connected users? Their open tabs will be prompted to reload.")) return;
    setPushing(true);
    const version = Math.floor(Date.now() / 1000);
    const { error } = await supabase.from("app_versions").insert({
      version,
      notes: notes.trim() || null,
      released_by: user.id,
    });
    setPushing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes("");
    toast.success("Update broadcast to all users");
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="t-section">Platform Updates</h2>
        <div className="t-mono mt-1" style={{ color: "var(--text-muted)" }}>
          Super admin only — broadcast a refresh signal to every connected user.
        </div>
      </div>

      <div className="glass p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Rocket size={16} style={{ color: "hsl(var(--primary))" }} />
          <div className="t-card-title">Push UI update</div>
        </div>
        <div className="t-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Every user with the app open will see a banner prompting them to reload and get the latest version.
        </div>
        <div>
          <label className="t-mono block mb-1" style={{ fontSize: 10, textTransform: "uppercase" }}>
            Release notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What's new in this release?"
            rows={3}
            className="input-glass w-full"
            style={{ padding: 10, fontSize: 13, resize: "vertical" }}
          />
        </div>
        <button
          className="btn-primary inline-flex items-center gap-2"
          onClick={pushUpdate}
          disabled={pushing}
        >
          <RefreshCw size={14} className={pushing ? "animate-spin" : ""} />
          {pushing ? "Pushing…" : "Push update to everyone"}
        </button>
      </div>

      <div className="glass p-5">
        <div className="t-card-title mb-3">Recent releases</div>
        {history.length === 0 ? (
          <div className="t-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            No releases yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((v) => (
              <li
                key={v.id}
                className="flex items-start justify-between gap-3 py-2"
                style={{ borderBottom: "1px solid var(--border-glass)" }}
              >
                <div className="min-w-0">
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    v{v.version}
                    {latest?.id === v.id && (
                      <span className="badge ml-2" style={{ fontSize: 9 }}>current</span>
                    )}
                  </div>
                  {v.notes && (
                    <div className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                      {v.notes}
                    </div>
                  )}
                </div>
                <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {new Date(v.released_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
