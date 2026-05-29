import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Mail, Calendar, FolderOpen, Users, CheckSquare, MessageSquare, BookOpen, Ticket, FileText, Eye, EyeOff } from "lucide-react";
import SharedDrivesPanel from "./SharedDrivesPanel";

interface IntegrationRow {
  id: string;
  provider: string;
  vision_enabled: boolean;
  metadata: any;
  last_synced_at: string | null;
  kb_doc_count: number;
}

const TILES = [
  { provider: "google", sub: "gmail_enabled", icon: Mail, label: "Gmail", desc: "Recent threads, sender history" },
  { provider: "google", sub: "calendar_enabled", icon: Calendar, label: "Calendar", desc: "Today + upcoming events" },
  { provider: "google", sub: "drive_enabled", icon: FolderOpen, label: "Google Drive", desc: "Search + read org folders" },
  { provider: "contacts", icon: Users, label: "Contacts", desc: "CRM + interactions", builtin: true },
  { provider: "tasks", icon: CheckSquare, label: "Tasks", desc: "Open + upcoming", builtin: true },
  { provider: "kb", icon: BookOpen, label: "Knowledge Base", desc: "Semantic search", builtin: true },
  { provider: "slack", icon: MessageSquare, label: "Slack", desc: "Channel messages", comingSoon: true },
  { provider: "jira", icon: Ticket, label: "Jira", desc: "Open issues", comingSoon: true },
  { provider: "confluence", icon: FileText, label: "Confluence", desc: "Wiki pages", comingSoon: true },
];

export default function ConnectionsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kbCount, setKbCount] = useState(0);
  const [hasGoogle, setHasGoogle] = useState(false);

  const reload = async () => {
    if (!user) return;
    const [{ data: ints }, { data: profile }, { count }] = await Promise.all([
      supabase.from("integrations").select("*").eq("user_id", user.id),
      supabase.from("profiles").select("google_refresh_token").eq("id", user.id).maybeSingle(),
      supabase.from("kb_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setRows((ints ?? []) as IntegrationRow[]);
    setHasGoogle(!!profile?.google_refresh_token);
    setKbCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user]);

  const getRow = (provider: string) => rows.find((r) => r.provider === provider);

  const ensureRow = async (provider: string, metadata: any = {}) => {
    if (!user) return null;
    const existing = getRow(provider);
    if (existing) return existing;
    const { data } = await supabase.from("integrations")
      .insert({ user_id: user.id, provider, metadata, vision_enabled: true })
      .select().single();
    if (data) setRows((p) => [...p, data as IntegrationRow]);
    return data as IntegrationRow | null;
  };

  const toggleVision = async (provider: string, value: boolean) => {
    const row = await ensureRow(provider);
    if (!row) return;
    await supabase.from("integrations").update({ vision_enabled: value }).eq("id", row.id);
    setRows((p) => p.map((r) => r.id === row.id ? { ...r, vision_enabled: value } : r));
  };

  const toggleSub = async (provider: string, key: string, value: boolean) => {
    const row = await ensureRow(provider);
    if (!row) return;
    const newMeta = { ...(row.metadata ?? {}), [key]: value };
    await supabase.from("integrations").update({ metadata: newMeta }).eq("id", row.id);
    setRows((p) => p.map((r) => r.id === row.id ? { ...r, metadata: newMeta } : r));
  };

  const updateDriveFolders = async (folderIdsRaw: string) => {
    const ids = folderIdsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    const row = await ensureRow("google");
    if (!row) return;
    const newMeta = { ...(row.metadata ?? {}), drive_folder_ids: ids };
    await supabase.from("integrations").update({ metadata: newMeta }).eq("id", row.id);
    setRows((p) => p.map((r) => r.id === row.id ? { ...r, metadata: newMeta } : r));
    toast.success(`Saved ${ids.length} Drive folder${ids.length === 1 ? "" : "s"}`);
  };

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;

  const googleRow = getRow("google");
  const googleMeta = googleRow?.metadata ?? {};

  return (
    <div className="space-y-6">
      <div>
        <div className="t-section text-white">Connections</div>
        <p className="text-sm text-gray-400 mt-1">Control which data sources Vision can see in every conversation.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map((t) => {
          const Icon = t.icon;
          let connected = false;
          let visionOn = true;
          let detail = "";

          if (t.provider === "google") {
            connected = hasGoogle;
            const subOn = t.sub ? googleMeta[t.sub] !== false : true;
            visionOn = (googleRow?.vision_enabled !== false) && subOn;
            detail = connected ? "Connected via Google sign-in" : "Sign in with Google to enable";
          } else if (t.builtin) {
            connected = true;
            visionOn = getRow(t.provider)?.vision_enabled !== false;
            if (t.provider === "kb") detail = `${kbCount} document${kbCount === 1 ? "" : "s"}`;
            else detail = "Built-in";
          } else if (t.comingSoon) {
            connected = false;
            detail = "Coming soon";
          }

          return (
            <div
              key={`${t.provider}-${t.sub ?? ""}`}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
                  <Icon size={18} className="text-[#a78bfa]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{t.label}</div>
                  <div className="text-xs text-gray-400">{t.desc}</div>
                </div>
                <span className={`inline-block w-2 h-2 rounded-full mt-2 ${connected ? "bg-emerald-400" : "bg-gray-600"}`} />
              </div>
              <div className="text-[11px] text-gray-500">{detail}</div>

              {connected && !t.comingSoon && (
                <button
                  onClick={() => {
                    if (t.provider === "google" && t.sub) {
                      toggleSub("google", t.sub, !visionOn);
                    } else {
                      toggleVision(t.provider, !visionOn);
                    }
                  }}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md"
                  style={{ background: visionOn ? "rgba(34,197,94,0.12)" : "var(--bg-glass-2)", color: visionOn ? "#86efac" : "#9ca3af", border: `1px solid ${visionOn ? "rgba(34,197,94,0.3)" : "var(--border-glass)"}` }}
                >
                  <span className="flex items-center gap-1.5">
                    {visionOn ? <Eye size={12} /> : <EyeOff size={12} />}
                    Vision {visionOn ? "ON" : "OFF"}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hasGoogle && (
        <div className="rounded-xl p-4" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
          <div className="text-sm font-medium text-white mb-1">Drive folder IDs</div>
          <p className="text-xs text-gray-400 mb-3">Comma- or space-separated Google Drive folder IDs Vision is allowed to search. Get the ID from the folder URL.</p>
          <DriveFoldersInput
            initial={(googleMeta.drive_folder_ids ?? []).join(", ")}
            onSave={updateDriveFolders}
          />
        </div>
      )}

      {hasGoogle && <SharedDrivesPanel />}
    </div>
  );
}

function DriveFoldersInput({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="1AbCdEf..., 2GhIjKl..."
        className="flex-1 input-glass text-sm"
      />
      <button onClick={() => onSave(val)} className="btn-primary text-sm px-4">Save</button>
    </div>
  );
}
