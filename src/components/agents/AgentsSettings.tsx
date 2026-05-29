import { useEffect, useState } from "react";
import { X, Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, callMake } from "@/hooks/useAgents";
import { TEAM_MEMBERS } from "@/lib/agents";
import { toast } from "sonner";

export function AgentsSettings({ onClose, onOpenBuildAI }: { onClose: () => void; onOpenBuildAI: (desc: string) => void }) {
  const { settings, save, refresh } = useSettings();
  const [reveal, setReveal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("us1");
  const [teamId, setTeamId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [testing, setTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<"unknown" | "ok" | "fail">("unknown");
  const [migrationTasks, setMigrationTasks] = useState<any[]>([]);

  useEffect(() => {
    setApiKey(settings.make_api_key || "");
    setRegion(settings.make_region || "us1");
    setTeamId(settings.make_team_id || "");
    setFolderId(settings.make_folder_id || "");
  }, [settings]);

  useEffect(() => {
    supabase.from("visi_migration_tasks" as any).select("*").neq("status", "complete")
      .then(({ data }) => setMigrationTasks((data as any) || []));
  }, []);

  const saveAll = async () => {
    try {
      await save("make_api_key", apiKey);
      await save("make_region", region);
      await save("make_team_id", teamId);
      await save("make_folder_id", folderId);
      toast.success("Settings saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const testConnection = async () => {
    setTesting(true); setConnStatus("unknown");
    try {
      await save("make_api_key", apiKey);
      await save("make_region", region);
      await save("make_team_id", teamId);
      await callMake("/scenarios", { query: { "pg[limit]": 1 } });
      setConnStatus("ok");
      toast.success("Connected to Make.com");
    } catch (e: any) {
      setConnStatus("fail");
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-xl w-full max-h-[90vh] flex flex-col"
        style={{ maxWidth: 720 }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div className="t-section" style={{ fontSize: 14 }}>Agents Settings</div>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Make.com connection */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="t-card-title" style={{ fontSize: 13 }}>Make.com connection</div>
              {connStatus === "ok" && <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: "#22C55E" }}>
                <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: 4, background: "#22C55E" }} /> Connected
              </span>}
              {connStatus === "fail" && <span style={{ fontSize: 11, color: "#EF4444" }}>Invalid key</span>}
            </div>

            <Field label="API key">
              <div className="flex gap-2">
                <input
                  type={reveal ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-glass flex-1"
                  style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
                  placeholder="Paste your Make.com API key"
                />
                <button onClick={() => setReveal((r) => !r)} className="btn-icon" title={reveal ? "Hide" : "Reveal"}>
                  {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>

            <Field label="Region">
              <div className="flex gap-3">
                {[{ k: "us1", l: "US (us1)" }, { k: "eu1", l: "EU (eu1)" }].map((r) => (
                  <label key={r.k} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="region" checked={region === r.k} onChange={() => setRegion(r.k)} />
                    <span style={{ fontSize: 12 }}>{r.l}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Team ID">
              <input value={teamId} onChange={(e) => setTeamId(e.target.value)} className="input-glass w-full" style={{ fontSize: 12 }} placeholder="e.g. 123456" />
            </Field>

            <Field label="Folder ID">
              <input value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input-glass w-full" style={{ fontSize: 12 }} placeholder="Optional" />
            </Field>

            <div className="flex gap-2 mt-3">
              <button onClick={testConnection} disabled={testing || !apiKey} className="btn-ghost" style={{ fontSize: 12 }}>
                {testing ? <><Loader2 size={12} className="animate-spin" /> Testing...</> : "Test connection"}
              </button>
              <button onClick={saveAll} className="btn-primary" style={{ fontSize: 12 }}>Save</button>
              <a href={`https://${region}.make.com/scenarios`} target="_blank" rel="noreferrer" className="btn-ghost ml-auto" style={{ fontSize: 12 }}>
                Open Make.com dashboard <ExternalLink size={11} />
              </a>
            </div>
          </section>

          {/* Permissions */}
          <section>
            <div className="t-card-title mb-3" style={{ fontSize: 13 }}>Team permissions</div>
            <div className="glass rounded-lg overflow-hidden">
              <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    {["Member", "Activate", "Run manually", "Build new", "Admin"].map((h) => (
                      <th key={h} className="text-left p-2 t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEAM_MEMBERS.map((m) => {
                    const isAdmin = m.key === "myke";
                    return (
                      <tr key={m.key} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                        <td className="p-2 font-semibold">{m.label}</td>
                        <td className="p-2"><input type="checkbox" defaultChecked /></td>
                        <td className="p-2"><input type="checkbox" defaultChecked /></td>
                        <td className="p-2"><input type="checkbox" defaultChecked={isAdmin} /></td>
                        <td className="p-2"><input type="checkbox" defaultChecked={isAdmin} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Defaults: Anna & Alexis can activate and run; only Myke can build & admin.</div>
          </section>

          {/* Legacy migration */}
          {migrationTasks.length > 0 && (
            <section>
              <div className="t-card-title mb-2" style={{ fontSize: 13 }}>Legacy workflows to migrate</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>From n8n → Make.com</div>
              <div className="space-y-2">
                {migrationTasks.map((t) => (
                  <div key={t.id} className="glass rounded-lg p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{t.workflow_name}</div>
                      <div className="truncate" style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.workflow_description}</div>
                    </div>
                    <span className="t-mono uppercase" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                      {t.status}
                    </span>
                    <button
                      onClick={() => { onOpenBuildAI(t.workflow_description || t.workflow_name); onClose(); }}
                      className="btn-ghost"
                      style={{ fontSize: 11 }}
                    >
                      Rebuild in Make →
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-3">
    <label className="t-mono uppercase mb-1.5 block" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{label}</label>
    {children}
  </div>
);
