import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Mail, Calendar, FolderOpen, MessageSquare, Ticket, FileText, BookOpen, Phone, Mic, Eye, EyeOff, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SectionCard, { Field, ToggleRow } from "../SectionCard";
import { ensureIntegrationRow } from "@/lib/settingsHelpers";
import MCPTokensPanel from "../MCPTokensPanel";

interface IntegrationRow {
  id: string;
  provider: string;
  status: string;
  vision_enabled: boolean;
  metadata: any;
  last_synced_at: string | null;
  kb_doc_count: number;
}

const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

export default function ConnectionsTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [kbCount, setKbCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!user) return;
    const [{ data: ints }, { data: privateRows }, { count }] = await Promise.all([
      supabase.from("integrations").select("*").eq("user_id", user.id),
      supabase.rpc("get_my_profile_private"),
      supabase.from("kb_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    const profile = (Array.isArray(privateRows) ? privateRows[0] : null) as any;
    setRows((ints ?? []) as IntegrationRow[]);
    setHasGoogle(!!profile?.google_refresh_token);
    setGoogleEmail(profile?.email ?? user.email ?? null);
    setKbCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user]);

  const getRow = (provider: string) => rows.find((r) => r.provider === provider);

  const toggleVision = async (provider: string, value: boolean) => {
    if (!user) return;
    const row = await ensureIntegrationRow(user.id, provider);
    if (!row) return;
    await supabase.from("integrations").update({ vision_enabled: value }).eq("id", row.id);
    reload();
  };

  const toggleSubMeta = async (provider: string, key: string, value: any) => {
    if (!user) return;
    const row = await ensureIntegrationRow(user.id, provider);
    if (!row) return;
    const newMeta = { ...((row.metadata as any) ?? {}), [key]: value };
    await supabase.from("integrations").update({ metadata: newMeta }).eq("id", row.id);
    reload();
  };

  const connectGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/settings`,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) toast.error(error.message);
  };

  const disconnectGoogle = async () => {
    if (!user) return;
    if (!confirm("Disconnect Google? Vision will lose access to Gmail, Calendar, and Drive.")) return;
    await supabase.from("profiles").update({ google_access_token: null, google_refresh_token: null, google_granted_scopes: null }).eq("id", user.id);
    toast.success("Google disconnected");
    reload();
  };

  if (loading) return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;

  const googleRow = getRow("google");
  const googleMeta = (googleRow?.metadata as any) ?? {};
  const driveFolders = (googleMeta.drive_folders as Record<string, string>) ?? {};

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Manage what Visi OS and Vision can access. Vision only reads data from sources you've enabled.
        </p>
      </div>

      {/* GOOGLE WORKSPACE */}
      <ConnectionTile
        icon={Mail}
        title="Google Workspace"
        connected={hasGoogle}
        statusText={hasGoogle ? `Connected as ${googleEmail}` : "Not connected"}
      >
        {!hasGoogle ? (
          <button onClick={connectGoogle} className="btn-primary mt-2">Connect Google →</button>
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <div className="t-mono mb-2" style={{ fontSize: 10 }}>📧 Gmail</div>
              <ToggleRow label="Vision reads Gmail" value={googleMeta.gmail_enabled !== false} onChange={(v) => toggleSubMeta("google", "gmail_enabled", v)} />
              <ToggleRow label="Sync contact interactions" hint="Log Gmail conversations on contact records." value={!!googleMeta.gmail_sync_interactions} onChange={(v) => toggleSubMeta("google", "gmail_sync_interactions", v)} />
              <ToggleRow label="Gmail contact auto-sync" value={!!googleMeta.gmail_contact_sync} onChange={(v) => toggleSubMeta("google", "gmail_contact_sync", v)} />
              <Field label="Sync frequency">
                <select className="input-glass" value={googleMeta.gmail_sync_freq ?? "24"} onChange={(e) => toggleSubMeta("google", "gmail_sync_freq", e.target.value)}>
                  <option value="1">Every hour</option>
                  <option value="6">Every 6 hours</option>
                  <option value="24">Every 24 hours</option>
                </select>
              </Field>
              {googleRow?.last_synced_at && (
                <div className="t-mono mt-2" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Last synced {new Date(googleRow.last_synced_at).toLocaleString()}
                </div>
              )}
            </div>

            <div className="border-t pt-4" style={{ borderColor: "var(--border-glass)" }}>
              <div className="t-mono mb-2" style={{ fontSize: 10 }}>📅 Calendar</div>
              <ToggleRow label="Vision reads Calendar" value={googleMeta.calendar_enabled !== false} onChange={(v) => toggleSubMeta("google", "calendar_enabled", v)} />
              <ToggleRow label="Auto-tag events with org" value={!!googleMeta.calendar_auto_tag} onChange={(v) => toggleSubMeta("google", "calendar_auto_tag", v)} />
              <ToggleRow label="Auto-generate meeting prep" value={!!googleMeta.calendar_auto_prep} onChange={(v) => toggleSubMeta("google", "calendar_auto_prep", v)} />
            </div>

            <div className="border-t pt-4" style={{ borderColor: "var(--border-glass)" }}>
              <div className="t-mono mb-2" style={{ fontSize: 10 }}>📁 Drive</div>
              <ToggleRow label="Vision reads Drive" value={googleMeta.drive_enabled !== false} onChange={(v) => toggleSubMeta("google", "drive_enabled", v)} />
              {(["uwazi", "bin", "cc"] as const).map((slug) => (
                <Field key={slug} label={`${slug.toUpperCase()} folder ID`}>
                  <input className="input-glass" placeholder="Drive folder ID" defaultValue={driveFolders[slug] ?? ""} onBlur={(e) => toggleSubMeta("google", "drive_folders", { ...driveFolders, [slug]: e.target.value })} />
                </Field>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={connectGoogle} className="btn-ghost"><RefreshCw size={12} /> Reconnect</button>
              <button onClick={disconnectGoogle} className="btn-ghost" style={{ color: "#FCA5A5" }}><Trash2 size={12} /> Revoke Access</button>
            </div>
          </div>
        )}
      </ConnectionTile>

      {/* SLACK */}
      <ApiTokenTile
        provider="slack"
        title="Slack"
        icon={MessageSquare}
        description="Connect Slack so Vision can reference team messages."
        fields={[{ key: "workspace", label: "Workspace name", type: "text" }, { key: "bot_token", label: "Bot token (xoxb-...)", type: "password" }]}
        onSaved={reload}
        existing={getRow("slack")}
        onToggleVision={(v) => toggleVision("slack", v)}
        extraToggles={[
          { key: "freq", label: "Sync frequency", type: "select", options: ["15", "30", "60"], suffix: "min" },
        ]}
      />

      {/* JIRA */}
      <ApiTokenTile
        provider="jira"
        title="Jira"
        icon={Ticket}
        description="Pull open issues into Vision context."
        fields={[
          { key: "domain", label: "Jira domain", type: "text", placeholder: "mycompany.atlassian.net" },
          { key: "email", label: "Email", type: "text" },
          { key: "api_token", label: "API token", type: "password", helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens" },
        ]}
        onSaved={reload}
        existing={getRow("jira")}
        onToggleVision={(v) => toggleVision("jira", v)}
      />

      {/* CONFLUENCE */}
      <ApiTokenTile
        provider="confluence"
        title="Confluence"
        icon={FileText}
        description="Index wiki pages into the knowledge base."
        fields={[
          { key: "domain", label: "Confluence domain", type: "text", placeholder: "mycompany.atlassian.net" },
          { key: "email", label: "Email", type: "text" },
          { key: "api_token", label: "API token", type: "password", helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens" },
        ]}
        onSaved={reload}
        existing={getRow("confluence")}
        onToggleVision={(v) => toggleVision("confluence", v)}
      />

      {/* KNOWLEDGE BASE */}
      <ConnectionTile icon={BookOpen} title="Knowledge Base" connected={kbCount > 0} statusText={`${kbCount} document${kbCount === 1 ? "" : "s"} indexed`}>
        <a href="/knowledge" className="btn-ghost mt-2" style={{ display: "inline-flex" }}>
          <ExternalLink size={12} /> Open Knowledge Base
        </a>
      </ConnectionTile>

      {/* TWILIO */}
      <ApiTokenTile
        provider="twilio"
        title="SMS Quick Capture"
        icon={Phone}
        description="Text Visi from your phone — captures land in your inbox automatically."
        fields={[
          { key: "account_sid", label: "Account SID", type: "password" },
          { key: "auth_token", label: "Auth token", type: "password" },
          { key: "phone_number", label: "Twilio phone number", type: "text", placeholder: "+15555550123" },
        ]}
        onSaved={reload}
        existing={getRow("twilio")}
        onToggleVision={(v) => toggleVision("twilio", v)}
        extraToggles={[
          { key: "auto_classify", label: "AI auto-classify captures", type: "boolean", default: true },
          { key: "confirm_reply", label: "Confirm via reply", type: "boolean", default: false },
        ]}
      />

      {/* MEETING NOTES */}
      <ConnectionTile icon={Mic} title="Meeting Notes" connected={!!getRow("fathom") || !!getRow("granola")} statusText={(getRow("fathom") ? "Fathom · " : "") + (getRow("granola") ? "Granola" : (getRow("fathom") ? "" : "Not connected"))}>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <ApiTokenInline provider="fathom" title="Fathom" tokenLabel="API key" existing={getRow("fathom")} onSaved={reload} />
          <ApiTokenInline provider="granola" title="Granola" tokenLabel="API key" existing={getRow("granola")} onSaved={reload} />
        </div>
      </ConnectionTile>

      {/* MCP Tokens (Claude Desktop) */}
      <MCPTokensPanel />
    </div>
  );
}

/* Reusable tile wrapper */
function ConnectionTile({ icon: Icon, title, connected, statusText, children }: { icon: any; title: string; connected: boolean; statusText: string; children?: React.ReactNode }) {
  return (
    <div
      className="glass p-5"
      style={{ borderLeft: `3px solid ${connected ? "#22C55E" : "#EF4444"}` }}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, background: "var(--bg-glass-2)" }}>
          <Icon size={16} style={{ color: "var(--text-secondary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
            <span className="badge" style={{ background: connected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: connected ? "#86efac" : "#fca5a5", fontSize: 9, padding: "1px 6px", borderRadius: 4 }}>
              {connected ? "🟢 Connected" : "🔴 Not connected"}
            </span>
          </div>
          <div className="t-mono mt-1" style={{ fontSize: 10, color: "var(--text-muted)" }}>{statusText}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

interface FieldDef { key: string; label: string; type: "text" | "password"; placeholder?: string; helpUrl?: string }
interface ExtraToggle { key: string; label: string; type: "boolean" | "select"; default?: boolean; options?: string[]; suffix?: string }

function ApiTokenTile({
  provider, title, icon, description, fields, existing, onSaved, onToggleVision, extraToggles,
}: {
  provider: string; title: string; icon: any; description: string;
  fields: FieldDef[]; existing?: IntegrationRow; onSaved: () => void;
  onToggleVision: (v: boolean) => void; extraToggles?: ExtraToggle[];
}) {
  const { user } = useAuth();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const meta = (existing?.metadata as any) ?? {};
    const init: Record<string, string> = {};
    fields.forEach((f) => { init[f.key] = meta[f.key] ?? ""; });
    return init;
  });
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const connected = existing?.status === "connected";
  const meta = (existing?.metadata as any) ?? {};

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const row = await ensureIntegrationRow(user.id, provider);
    if (!row) { setBusy(false); return; }
    const sanitizedMeta: any = {};
    fields.forEach((f) => { if (f.type !== "password") sanitizedMeta[f.key] = vals[f.key]; });
    await supabase.from("integrations").update({ metadata: { ...meta, ...sanitizedMeta }, status: "connected" }).eq("id", row.id);

    // Store secrets in user_integration_secrets (token = primary, refresh_token = secondary, metadata for extras)
    const secretFields = fields.filter((f) => f.type === "password");
    if (secretFields.length) {
      const secretMeta: any = {};
      secretFields.forEach((f) => { if (vals[f.key]) secretMeta[f.key] = vals[f.key]; });
      const { data: existSec } = await supabase.from("user_integration_secrets").select("id").eq("user_id", user.id).eq("provider", provider).maybeSingle();
      if (existSec) {
        await supabase.from("user_integration_secrets").update({ metadata: secretMeta, token: secretMeta[secretFields[0].key] ?? null }).eq("id", existSec.id);
      } else {
        await supabase.from("user_integration_secrets").insert({ user_id: user.id, provider, metadata: secretMeta, token: secretMeta[secretFields[0].key] ?? null });
      }
    }
    setBusy(false);
    toast.success(`${title} connected`);
    onSaved();
  };

  const disconnect = async () => {
    if (!user || !existing) return;
    if (!confirm(`Disconnect ${title}?`)) return;
    await supabase.from("integrations").update({ status: "disconnected" }).eq("id", existing.id);
    await supabase.from("user_integration_secrets").delete().eq("user_id", user.id).eq("provider", provider);
    onSaved();
  };

  return (
    <ConnectionTile icon={icon} title={title} connected={connected} statusText={connected ? "Credentials stored securely" : description}>
      <div className="flex flex-col gap-3 mt-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            <div className="flex gap-2">
              <input
                type={f.type === "password" && !showSecret[f.key] ? "password" : "text"}
                className="input-glass"
                style={{ flex: 1 }}
                placeholder={f.placeholder}
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {f.type === "password" && (
                <button onClick={() => setShowSecret((s) => ({ ...s, [f.key]: !s[f.key] }))} className="btn-ghost" type="button">
                  {showSecret[f.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )}
              {f.helpUrl && <a href={f.helpUrl} target="_blank" rel="noreferrer" className="btn-ghost"><ExternalLink size={12} /></a>}
            </div>
          </Field>
        ))}

        {connected && extraToggles?.map((t) => {
          if (t.type === "boolean") {
            const v = meta[t.key] ?? t.default ?? false;
            return <ToggleRow key={t.key} label={t.label} value={!!v} onChange={(val) => supabase.from("integrations").update({ metadata: { ...meta, [t.key]: val } }).eq("id", existing!.id).then(onSaved)} />;
          }
          return (
            <Field key={t.key} label={t.label}>
              <select className="input-glass" value={meta[t.key] ?? t.options?.[0]} onChange={(e) => supabase.from("integrations").update({ metadata: { ...meta, [t.key]: e.target.value } }).eq("id", existing!.id).then(onSaved)}>
                {t.options?.map((o) => <option key={o} value={o}>Every {o} {t.suffix}</option>)}
              </select>
            </Field>
          );
        })}

        {connected && (
          <ToggleRow label={`Vision reads ${title}`} value={existing?.vision_enabled !== false} onChange={onToggleVision} />
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={save} className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : null} {connected ? "Update" : "Connect"} {title}
          </button>
          {connected && <button onClick={disconnect} className="btn-ghost" style={{ color: "#FCA5A5" }}>Disconnect</button>}
        </div>
      </div>
    </ConnectionTile>
  );
}

function ApiTokenInline({ provider, title, tokenLabel, existing, onSaved }: { provider: string; title: string; tokenLabel: string; existing?: IntegrationRow; onSaved: () => void }) {
  const { user } = useAuth();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const connected = existing?.status === "connected";
  const save = async () => {
    if (!user || !val) return;
    setBusy(true);
    const row = await ensureIntegrationRow(user.id, provider);
    if (!row) { setBusy(false); return; }
    await supabase.from("integrations").update({ status: "connected" }).eq("id", row.id);
    const { data: existSec } = await supabase.from("user_integration_secrets").select("id").eq("user_id", user.id).eq("provider", provider).maybeSingle();
    if (existSec) await supabase.from("user_integration_secrets").update({ token: val }).eq("id", existSec.id);
    else await supabase.from("user_integration_secrets").insert({ user_id: user.id, provider, token: val });
    setVal("");
    setBusy(false);
    toast.success(`${title} connected`);
    onSaved();
  };
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--bg-glass-1)", border: `1px solid ${connected ? "#22C55E55" : "var(--border-glass)"}` }}>
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <span className="badge" style={{ fontSize: 9, color: connected ? "#86efac" : "#9ca3af" }}>{connected ? "🟢" : "🔴"}</span>
      </div>
      <input type="password" className="input-glass" placeholder={tokenLabel} value={val} onChange={(e) => setVal(e.target.value)} />
      <button onClick={save} disabled={busy || !val} className="btn-primary mt-2 w-full" style={{ justifyContent: "center" }}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : null} {connected ? "Update" : "Connect"}
      </button>
    </div>
  );
}
