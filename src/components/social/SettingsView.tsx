import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_ORDER, BRANDS, TEAM, type BrandKey, type SocialPlatform } from "./shared";
import { toast } from "sonner";
import { PLATFORM_META, PLATFORM_ORDER, tokenExpired, tokenExpiresSoon, type PlatformToken } from "@/lib/socialPlatforms";
import { useSocialConnections } from "@/hooks/useSocialConnections";
import { SetupGuideDrawer } from "./SetupGuideDrawer";
import { useAuth } from "@/contexts/AuthContext";

const CRED_KEYS = [
  { key: "meta_app_id", label: "Meta App ID" },
  { key: "meta_app_secret", label: "Meta App Secret" },
  { key: "tiktok_client_key", label: "TikTok Client Key" },
  { key: "tiktok_client_secret", label: "TikTok Client Secret" },
  { key: "linkedin_client_id", label: "LinkedIn Client ID" },
  { key: "linkedin_client_secret", label: "LinkedIn Client Secret" },
];

export function SettingsView() {
  const { tokens, getFor, refresh, disconnect } = useSocialConnections();
  const [brandPrompts, setBrandPrompts] = useState<Record<string, { voice_notes: string; require_approval: boolean }>>({});
  const [teamPerms, setTeamPerms] = useState<Array<{ id: string; name: string; permissions: any }>>([]);
  const [guidePlatform, setGuidePlatform] = useState<SocialPlatform | null>(null);
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<PlatformToken | null>(null);
  const [credsOpen, setCredsOpen] = useState(false);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [credShow, setCredShow] = useState<Record<string, boolean>>({});
  const [savingCreds, setSavingCreds] = useState(false);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setIsAdmin(false); return; }
      const { data, error } = await (supabase as any).rpc("is_super_admin", { _user_id: user.id });
      if (!cancelled) setIsAdmin(!error && data === true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => { void loadExtras(); }, []);

  // Listen for OAuth popup completion
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.source !== "visios-oauth") return;
      setConnecting(null);
      if (e.data.ok) {
        toast.success(`${e.data.platform} connected ✓`);
        refresh();
      } else {
        toast.error(e.data.error || "Connection failed");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refresh]);

  async function loadExtras() {
    const { data: prompts } = await supabase.from("social_ai_prompts").select("brand,voice_notes,require_approval");
    const pm: any = {};
    (prompts || []).forEach((r: any) => { pm[r.brand] = { voice_notes: r.voice_notes || "", require_approval: r.require_approval || false }; });
    setBrandPrompts(pm);

    const { data: tm } = await supabase.from("social_team_members").select("id,name,permissions");
    setTeamPerms((tm || []) as any);

    // Load creds if admin
    const { data: c } = await (supabase as any).from("visi_settings").select("key,value").in("key", CRED_KEYS.map((k) => k.key));
    const cm: Record<string, string> = {};
    (c || []).forEach((r: any) => { cm[r.key] = r.value || ""; });
    setCreds(cm);
  }

  async function connect(platform: SocialPlatform, brand: BrandKey = "uwazi") {
    try {
      setConnecting(platform);
      const { data, error } = await supabase.functions.invoke("social-oauth-init", {
        body: { platform, brand, redirect_base: window.location.origin },
      });
      if (error || (data as any)?.error) {
        throw new Error(error?.message || (data as any)?.error || "Failed to start OAuth");
      }
      const url = (data as any).url as string;
      const w = window.open(url, "social-oauth", "width=600,height=700");
      if (!w) {
        setConnecting(null);
        toast.error("Popup blocked — allow popups for this site and try again.");
      }
    } catch (e: any) {
      setConnecting(null);
      toast.error(e.message);
    }
  }

  async function saveBrand(brand: BrandKey, patch: Partial<{ voice_notes: string; require_approval: boolean }>) {
    const { error } = await supabase.from("social_ai_prompts").update(patch).eq("brand", brand);
    if (error) toast.error(error.message); else { toast.success("Saved"); loadExtras(); }
  }

  async function togglePerm(id: string, key: string, value: boolean, current: any) {
    const next = { ...current, [key]: value };
    const { error } = await supabase.from("social_team_members").update({ permissions: next }).eq("id", id);
    if (error) toast.error(error.message); else loadExtras();
  }

  async function saveCreds() {
    setSavingCreds(true);
    try {
      const rows = CRED_KEYS.map((k) => ({ key: k.key, value: creds[k.key] || "", is_secret: true, updated_at: new Date().toISOString() }));
      const { error } = await (supabase as any).from("visi_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Credentials saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingCreds(false);
    }
  }

  const permKeys: { key: string; label: string }[] = [
    { key: "draft", label: "Draft" },
    { key: "schedule", label: "Schedule" },
    { key: "post", label: "Post" },
    { key: "approve", label: "Approve" },
    { key: "delete", label: "Delete" },
  ];

  const connectedPlatforms = PLATFORM_ORDER.filter((p) => !!getFor(p));
  const disconnectedPlatforms = PLATFORM_ORDER.filter((p) => !getFor(p));

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-4xl mx-auto w-full space-y-6">
      <Section title="Connected Accounts">
        <div className="space-y-3">
          {connectedPlatforms.map((p) => (
            <ConnectionCard
              key={p}
              platform={p}
              token={getFor(p)!}
              onDisconnect={() => setConfirmDisconnect(getFor(p)!)}
              onReconnect={() => connect(p)}
              onGuide={() => setGuidePlatform(p)}
              connecting={connecting === p}
            />
          ))}
          {connectedPlatforms.length > 0 && disconnectedPlatforms.length > 0 && (
            <div className="my-2 flex items-center gap-2">
              <div className="flex-1 h-px" style={{ background: "var(--border-glass)" }} />
              <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                Available to connect
              </div>
              <div className="flex-1 h-px" style={{ background: "var(--border-glass)" }} />
            </div>
          )}
          {disconnectedPlatforms.map((p) => (
            <ConnectionCard
              key={p}
              platform={p}
              token={null}
              onConnect={() => connect(p)}
              onGuide={() => setGuidePlatform(p)}
              connecting={connecting === p}
            />
          ))}
        </div>
      </Section>

      {isAdmin && (
        <Section title="API Credentials" subtitle="Admin only — used by all OAuth flows">
          <div className="glass rounded-xl">
            <button
              onClick={() => setCredsOpen(!credsOpen)}
              className="w-full flex items-center gap-2 px-4 py-3"
              style={{ fontSize: 12 }}
            >
              {credsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Manage Meta / TikTok / LinkedIn credentials</span>
            </button>
            {credsOpen && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border-glass)" }}>
                <div className="mt-3" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  YouTube uses your existing Google credentials — no additional setup needed.
                </div>
                {CRED_KEYS.map((k) => (
                  <div key={k.key}>
                    <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                      {k.label}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type={credShow[k.key] ? "text" : "password"}
                        value={creds[k.key] || ""}
                        onChange={(e) => setCreds({ ...creds, [k.key]: e.target.value })}
                        className="input-glass flex-1"
                        style={{ fontSize: 12 }}
                      />
                      <button
                        onClick={() => setCredShow({ ...credShow, [k.key]: !credShow[k.key] })}
                        className="btn-icon"
                      >
                        {credShow[k.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-2">
                  <button onClick={saveCreds} disabled={savingCreds} className="btn-primary" style={{ fontSize: 12 }}>
                    {savingCreds ? <Loader2 size={12} className="animate-spin" /> : "Save credentials"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Team Access">
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                <th className="p-2 text-left t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>Member</th>
                {permKeys.map((p) => (
                  <th key={p.key} className="p-2 text-center t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamPerms.map((t) => {
                const member = TEAM.find((tm) => tm.name === t.name);
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span style={{
                          width: 24, height: 24, borderRadius: 99,
                          background: member?.color, color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 600,
                        }}>{member?.initials}</span>
                        <div>
                          <div style={{ fontSize: 12 }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{member?.role}</div>
                        </div>
                      </div>
                    </td>
                    {permKeys.map((p) => (
                      <td key={p.key} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!t.permissions?.[p.key]}
                          onChange={(e) => togglePerm(t.id, p.key, e.target.checked, t.permissions || {})}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Brand Settings">
        <div className="space-y-4">
          {BRAND_ORDER.map((b) => {
            const cfg = BRANDS[b];
            const bp = brandPrompts[b] ?? { voice_notes: "", require_approval: false };
            return (
              <div key={b} className="glass p-4 rounded-xl" style={{ borderLeft: `2px solid ${cfg.color}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold" style={{ fontSize: 14, color: cfg.color }}>{cfg.label}</div>
                  <label className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={bp.require_approval}
                      onChange={(e) => saveBrand(b, { require_approval: e.target.checked })}
                    />
                    Require Myke's approval
                  </label>
                </div>
                <textarea
                  defaultValue={bp.voice_notes}
                  onBlur={(e) => { if (e.target.value !== bp.voice_notes) saveBrand(b, { voice_notes: e.target.value }); }}
                  rows={3}
                  className="input-glass w-full"
                  placeholder="Brand voice notes..."
                  style={{ fontSize: 12 }}
                />
              </div>
            );
          })}
        </div>
      </Section>

      {guidePlatform && <SetupGuideDrawer platform={guidePlatform} onClose={() => setGuidePlatform(null)} />}

      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDisconnect(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-xl p-5 max-w-sm w-full relative"
            style={{ background: "var(--bg-base, #02020a)" }}
          >
            <div className="t-section mb-2" style={{ fontSize: 14 }}>
              Disconnect {PLATFORM_META[confirmDisconnect.platform].label}?
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }} className="mb-4">
              VisiOS will no longer be able to post or read data for this account. You can reconnect at any time.
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirmDisconnect(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: "#EF4444", color: "#fff" }}
                onClick={async () => {
                  await disconnect(confirmDisconnect.id);
                  setConfirmDisconnect(null);
                  toast.success("Disconnected");
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionCard({
  platform, token, onConnect, onDisconnect, onReconnect, onGuide, connecting,
}: {
  platform: SocialPlatform;
  token: PlatformToken | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onGuide: () => void;
  connecting: boolean;
}) {
  const meta = PLATFORM_META[platform];
  const expired = tokenExpired(token?.token_expires_at);
  const expiresSoon = tokenExpiresSoon(token?.token_expires_at);
  const Icon = meta.Icon;

  return (
    <div
      className="glass rounded-xl p-4"
      style={{ borderLeft: `2px solid ${token ? "#22C55E" : meta.color}` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${meta.color}1F` }}
        >
          <Icon size={18} style={{ color: meta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{meta.label}</div>
            <span style={{
              width: 7, height: 7, borderRadius: 99,
              background: token ? "#22C55E" : "#6b7280",
            }} />
            <span style={{ fontSize: 11, color: token ? "#22C55E" : "var(--text-muted)" }}>
              {token ? "Connected" : "Not connected"}
            </span>
          </div>

          {!token && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {meta.description}
            </div>
          )}

          {token && (
            <div className="mt-2 flex items-center gap-2">
              {token.account_avatar_url ? (
                <img src={token.account_avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: 99 }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: 99, background: `${meta.color}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: meta.color, fontSize: 11, fontWeight: 600,
                }}>
                  {(token.account_name || token.account_username || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 12 }}>{token.account_name || token.account_username}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {token.account_username ? `@${token.account_username.replace(/^@/, "")}` : meta.label}
                  {token.follower_count != null && ` · ${token.follower_count.toLocaleString()} followers`}
                </div>
              </div>
            </div>
          )}

          {token?.scopes && token.scopes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {token.scopes.slice(0, 5).map((s) => (
                <span key={s} className="badge" style={{ fontSize: 9 }}>{s}</span>
              ))}
            </div>
          )}

          {token && expired && (
            <div className="mt-2 p-2 rounded" style={{ background: "rgba(239,68,68,0.12)", fontSize: 11, color: "#FCA5A5" }}>
              Token expired — reconnect to keep posting.
            </div>
          )}
          {token && !expired && expiresSoon && (
            <div className="mt-2 p-2 rounded" style={{ background: "rgba(245,158,11,0.12)", fontSize: 11, color: "#FCD34D" }}>
              Token expires in under 7 days. Consider refreshing the connection.
            </div>
          )}

          {!token && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              {meta.setupNote}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end">
          {token ? (
            <>
              {expired ? (
                <button onClick={onReconnect} className="btn-primary" style={{ fontSize: 11, background: meta.color, color: "#fff" }}>
                  Reconnect
                </button>
              ) : (
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: "#22C55E" }}>
                  <Check size={12} /> Active
                </span>
              )}
              <button onClick={onDisconnect} className="btn-ghost" style={{ fontSize: 11, color: "#EF4444" }}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              disabled={connecting}
              className="btn-ghost"
              style={{
                fontSize: 11,
                border: `1px solid ${meta.color}`,
                color: meta.color,
              }}
            >
              {connecting ? <><Loader2 size={11} className="animate-spin inline mr-1" /> Connecting…</> : `Connect ${meta.label}`}
            </button>
          )}
          <button onClick={onGuide} className="btn-ghost" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Setup guide →
          </button>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div>
    <div className="t-section mb-1" style={{ fontSize: 14 }}>{title}</div>
    {subtitle && <div className="mb-3" style={{ fontSize: 11, color: "var(--text-muted)" }}>{subtitle}</div>}
    {!subtitle && <div className="mb-3" />}
    {children}
  </div>
);
