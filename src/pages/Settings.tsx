import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";
import { toast } from "sonner";
import {
  Plug, User as UserIcon, Building2, Sparkles, Clock, Bell,
  Check, Loader2, RefreshCw, Copy, ExternalLink, Eye, EyeOff,
  AlertTriangle, Lock, Camera,
} from "lucide-react";

type TabKey = "integrations" | "profile" | "orgs" | "ai" | "scheduling" | "notifications";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "orgs", label: "Orgs", icon: Building2 },
  { key: "ai", label: "AI", icon: Sparkles },
  { key: "scheduling", label: "Scheduling", icon: Clock },
  { key: "notifications", label: "Notifications", icon: Bell },
];

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  preferred_name: string | null;
  username: string | null;
  timezone: string | null;
  avatar_url: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_granted_scopes: string | null;
  voice_profile: string | null;
  ai_prefs: any;
  notification_prefs: any;
  scheduling_prefs: any;
}

const DEFAULT_VOICE = `Direct. Warm but efficient. Founder-to-founder. 5 sentences max.
Never corporate. Never says "I hope this email finds you well."
Always has a specific next action.`;

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("integrations");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(data as ProfileRow);
      setLoading(false);
    })();
  }, [user]);

  if (loading || !profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="shimmer-block h-10 rounded-lg mb-6" style={{ width: 240 }} />
        <div className="shimmer-block h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-5">
        {/* LEFT NAV */}
        <aside className="md:w-[170px] shrink-0">
          <div className="t-mono mb-3" style={{ fontSize: 9, paddingLeft: 4 }}>SETTINGS</div>
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all text-left"
                  style={{
                    background: active ? "var(--bg-glass-active)" : "transparent",
                    border: `1px solid ${active ? "var(--border-active)" : "transparent"}`,
                    boxShadow: active ? "0 0 0 1px var(--border-active-glow)" : "none",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} style={{ color: active ? "var(--text-accent)" : "var(--text-muted)" }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT CONTENT */}
        <main className="flex-1 min-w-0 space-y-5">
          {tab === "integrations" && <IntegrationsTab profile={profile} setProfile={setProfile} />}
          {tab === "profile" && <ProfileTab profile={profile} setProfile={setProfile} />}
          {tab === "orgs" && <OrgsTab />}
          {tab === "ai" && <AITab profile={profile} setProfile={setProfile} />}
          {tab === "scheduling" && <SchedulingTab profile={profile} setProfile={setProfile} />}
          {tab === "notifications" && <NotificationsTab profile={profile} setProfile={setProfile} />}
        </main>
      </div>
    </div>
  );
}

// ===================== Shared bits =====================
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="t-mono" style={{ fontSize: 9 }}>{children}</div>
      <div className="flex-1 h-px" style={{ background: "var(--border-glass)" }} />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative shrink-0 transition-colors"
      style={{
        width: 36, height: 20, borderRadius: 999,
        background: on ? "var(--primary-hover)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${on ? "var(--border-active)" : "var(--border-glass)"}`,
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 transition-all"
        style={{
          left: on ? 18 : 2,
          width: 14, height: 14, borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

async function patchProfile(userId: string, patch: any) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) {
    toast.error(error.message.includes("duplicate") ? "That username is taken." : error.message);
    return false;
  }
  toast.success("Saved ✓");
  return true;
}

// ===================== INTEGRATIONS =====================
function IntegrationsTab({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const [reconnecting, setReconnecting] = useState(false);
  const np = (profile.notification_prefs ?? {}) as any;
  const [n8nUrl, setN8nUrl] = useState<string>(np.n8n_url ?? "");
  const [n8nTesting, setN8nTesting] = useState(false);
  const n8nConnected = !!np.n8n_url;
  const fathomWebhook = `${window.location.origin}/api/webhooks/fathom`;
  const connected = !!profile.google_refresh_token;

  // Derive scope status from actually granted scopes on the profile
  const granted = (profile.google_granted_scopes ?? "").toLowerCase();
  const scopes = {
    gmail: granted.includes("gmail."),
    calendar: granted.includes("calendar."),
    drive: granted.includes("drive."),
  };
  const anyScopeOff = connected && (!scopes.gmail || !scopes.calendar || !scopes.drive);

  async function reconnectGoogle() {
    setReconnecting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/settings`,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      toast.error(error.message);
      setReconnecting(false);
    }
  }

  async function disconnectGoogle() {
    if (!confirm("Disconnect Google? Inbox and Calendar will stop working until you reconnect.")) return;
    const ok = await patchProfile(profile.id, {
      google_access_token: null,
      google_refresh_token: null,
      google_granted_scopes: null,
    });
    if (ok) setProfile({ ...profile, google_access_token: null, google_refresh_token: null, google_granted_scopes: null });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  async function connectN8n() {
    const raw = n8nUrl.trim();
    if (!raw) return toast.error("Enter your n8n instance URL");
    let normalized = raw;
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      normalized = u.origin;
    } catch {
      return toast.error("Invalid URL");
    }
    setN8nTesting(true);
    try {
      // n8n instances typically don't allow CORS — use no-cors so a successful
      // network round-trip doesn't throw. Network failures (DNS, offline) still throw.
      try {
        await fetch(`${normalized}/healthz`, { method: "GET", mode: "no-cors" });
      } catch {
        await fetch(normalized, { method: "GET", mode: "no-cors" });
      }
      const nextPrefs = { ...np, n8n_url: normalized };
      const ok = await patchProfile(profile.id, { notification_prefs: nextPrefs });
      if (ok) {
        setProfile({ ...profile, notification_prefs: nextPrefs });
        setN8nUrl(normalized);
      }
    } catch (err: any) {
      toast.error(`Couldn't reach n8n: ${err?.message ?? "network error"}`);
    } finally {
      setN8nTesting(false);
    }
  }

  async function disconnectN8n() {
    const nextPrefs = { ...np };
    delete nextPrefs.n8n_url;
    const ok = await patchProfile(profile.id, { notification_prefs: nextPrefs });
    if (ok) {
      setProfile({ ...profile, notification_prefs: nextPrefs });
      setN8nUrl("");
    }
  }

  return (
    <>
      <SectionLabel>GOOGLE WORKSPACE</SectionLabel>
      <section
        className="p-5 rounded-[10px]"
        style={{
          background: "rgba(37,99,235,0.06)",
          border: "1px solid rgba(37,99,235,0.20)",
          borderTopColor: "rgba(37,99,235,0.40)",
        }}
      >
        <div className="flex items-start gap-3 flex-wrap">
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 8, background: "#fff" }}
          >
            <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2c-2 1.5-4.6 2.4-7.3 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.6l6.3 5.2C41.3 34.9 44 29.8 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="t-card-title">Google Workspace</div>
            <div className="t-body" style={{ fontSize: 12 }}>{profile.email}</div>
          </div>
          <span className={`badge ${connected ? "badge-success" : "badge-muted"}`}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: connected ? "var(--sev-success)" : "var(--text-muted)" }} />
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {(["gmail", "calendar", "drive"] as const).map((s) => {
            const on = scopes[s];
            return (
              <span
                key={s}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: on ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${on ? "rgba(34,197,94,0.25)" : "var(--border-glass)"}`,
                  fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  color: on ? "var(--sev-success)" : "var(--text-muted)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? "var(--sev-success)" : "var(--text-muted)" }} />
                {s.toUpperCase()}
              </span>
            );
          })}
        </div>

        {anyScopeOff && (
          <div
            className="mt-4 flex items-center gap-2 p-2.5 rounded-lg"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <AlertTriangle size={14} style={{ color: "var(--sev-warn)" }} />
            <div className="t-body" style={{ fontSize: 12, color: "var(--sev-warn)" }}>
              Some scopes are missing — click Reconnect and approve all permissions.
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={reconnectGoogle} disabled={reconnecting} className="btn-ghost">
            {reconnecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Reconnect
          </button>
          <button
            onClick={disconnectGoogle}
            className="btn-ghost"
            style={{ color: "var(--sev-critical)", borderColor: "rgba(239,68,68,0.25)" }}
          >
            Disconnect
          </button>
        </div>
      </section>

      <SectionLabel>TOOLS</SectionLabel>

      <TwilioCard profile={profile} setProfile={setProfile} />
      <AnthropicCard profile={profile} setProfile={setProfile} />

      <IntegrationCard
        name="Fathom"
        right={<span className="badge badge-muted">Not connected</span>}
      >
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>WEBHOOK URL</div>
          <div className="flex gap-2">
            <input className="input-glass flex-1" value={fathomWebhook} readOnly />
            <button className="btn-icon" onClick={() => copy(fathomWebhook)} title="Copy"><Copy size={14} /></button>
          </div>
        </div>
        <a href="https://fathom.video/integrations" target="_blank" rel="noreferrer" className="btn-primary mt-2 inline-flex">
          <ExternalLink size={14} /> Connect Fathom
        </a>
      </IntegrationCard>

      <IntegrationCard
        name="n8n Automations"
        connected={n8nConnected}
        right={
          n8nConnected ? (
            <span className="badge badge-success">
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sev-success)" }} />
              Connected
            </span>
          ) : (
            <span className="badge badge-muted">Not connected</span>
          )
        }
      >
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>INSTANCE URL</div>
          <input
            className="input-glass"
            placeholder="https://n8n.example.com"
            value={n8nUrl}
            onChange={(e) => setN8nUrl(e.target.value)}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="btn-primary inline-flex"
            onClick={connectN8n}
            disabled={n8nTesting}
          >
            {n8nTesting ? <><Loader2 size={14} className="animate-spin" /> Testing…</> : n8nConnected ? "Update" : "Connect"}
          </button>
          {n8nConnected && (
            <button
              className="btn-ghost"
              onClick={disconnectN8n}
              style={{ color: "var(--sev-critical)", borderColor: "rgba(239,68,68,0.25)" }}
            >
              Disconnect
            </button>
          )}
        </div>
      </IntegrationCard>

      <IntegrationCard
        name="Lovable Cloud"
        connected
        right={<span className="badge badge-info"><Lock size={10} /> Core</span>}
      >
        <Field label="PROJECT REF" value="qzurwsqecdsgziyvnuul" />
        <div className="t-body" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Core dependency — cannot be disconnected.
        </div>
      </IntegrationCard>
    </>
  );
}

// ----- Twilio editable card -----
function TwilioCard({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const np = (profile.notification_prefs ?? {}) as any;
  const tw = (np.twilio ?? {}) as any;
  const [accountSid, setAccountSid] = useState<string>(tw.account_sid ?? "");
  const [authToken, setAuthToken] = useState<string>(tw.auth_token ?? "");
  const [fromNumber, setFromNumber] = useState<string>(tw.from_number ?? "");
  const [phone, setPhone] = useState<string>(np.phone ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const active = !!tw.active;

  async function saveAndTest() {
    if (!accountSid.startsWith("AC")) return toast.error("Account SID must start with AC");
    if (authToken.length < 16) return toast.error("Auth Token looks too short");
    if (!/^\+\d{8,15}$/.test(fromNumber)) return toast.error("Twilio number must be E.164 (+14155551234)");
    if (!/^\+\d{8,15}$/.test(phone)) return toast.error("Your mobile number must be E.164 (+14155551234)");
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-test-sms", {
        body: {
          account_sid: accountSid,
          auth_token: authToken,
          from_number: fromNumber,
          to_number: phone,
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Test failed";
        toast.error(msg);
        const next = { ...np, twilio: { ...(np.twilio ?? {}), active: false } };
        setProfile({ ...profile, notification_prefs: next });
      } else {
        toast.success("Test SMS sent ✓");
        const next = {
          ...np,
          phone,
          twilio: {
            account_sid: accountSid,
            auth_token: authToken,
            from_number: fromNumber,
            active: true,
            last_test_at: new Date().toISOString(),
          },
        };
        setProfile({ ...profile, notification_prefs: next });
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <IntegrationCard
      name="Twilio SMS"
      connected={active}
      right={
        active ? (
          <span className="badge badge-success">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sev-success)" }} />
            Active
          </span>
        ) : (
          <span className="badge badge-muted">Not tested</span>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>ACCOUNT SID</div>
          <input
            className="input-glass"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value.trim())}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>AUTH TOKEN</div>
          <div className="flex gap-2">
            <input
              className="input-glass flex-1"
              type={showToken ? "text" : "password"}
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value.trim())}
              placeholder="••••••••••••••••"
            />
            <button className="btn-icon" onClick={() => setShowToken((v) => !v)} title="Toggle">
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>TWILIO PHONE NUMBER</div>
          <input
            className="input-glass"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value.trim())}
            placeholder="+14155551234"
          />
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>YOUR MOBILE (TEST RECIPIENT)</div>
          <input
            className="input-glass"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            placeholder="+14155551234"
          />
        </div>
      </div>
      <button onClick={saveAndTest} disabled={testing} className="btn-primary mt-1">
        {testing ? <><Loader2 size={14} className="animate-spin" /> Sending test…</> : <>Save &amp; Test</>}
      </button>
    </IntegrationCard>
  );
}

// ----- Anthropic editable card -----
function AnthropicCard({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const ai = (profile.ai_prefs ?? {}) as any;
  const [apiKey, setApiKey] = useState<string>(ai.anthropic_key ?? "");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<"idle" | "active" | "invalid">(
    ai.anthropic_verified_at && ai.anthropic_key ? "active" : "idle"
  );

  async function saveAndVerify() {
    if (!apiKey.startsWith("sk-ant-")) {
      setStatus("invalid");
      return toast.error("Key must start with sk-ant-");
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-verify-anthropic", {
        body: { api_key: apiKey },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Invalid key";
        toast.error(msg);
        setStatus("invalid");
      } else {
        toast.success("Anthropic key verified ✓");
        setStatus("active");
        const next = { ...ai, anthropic_key: apiKey, anthropic_verified_at: new Date().toISOString() };
        setProfile({ ...profile, ai_prefs: next });
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <IntegrationCard
      name="Anthropic Claude"
      connected={status === "active"}
      right={
        status === "active" ? (
          <span className="badge badge-success">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sev-success)" }} />
            Active
          </span>
        ) : status === "invalid" ? (
          <span
            className="badge"
            style={{
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              color: "var(--sev-critical)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--sev-critical)" }} />
            Invalid
          </span>
        ) : (
          <span className="badge badge-muted">Not verified</span>
        )
      }
    >
      <div>
        <div className="t-mono mb-1" style={{ fontSize: 10 }}>API KEY</div>
        <div className="flex gap-2">
          <input
            className="input-glass flex-1"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value.trim());
              if (status !== "idle") setStatus("idle");
            }}
            placeholder="sk-ant-api03-…"
          />
          <button className="btn-icon" onClick={() => setShowKey((v) => !v)} title="Toggle">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div className="t-body mt-2" style={{ fontSize: 11 }}>
          Model in use: <span className="t-mono" style={{ color: "var(--text-accent)" }}>Claude Sonnet 4.6</span>
        </div>
      </div>
      <button onClick={saveAndVerify} disabled={verifying} className="btn-primary mt-1">
        {verifying ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : <>Save &amp; Verify</>}
      </button>
    </IntegrationCard>
  );
}

function IntegrationCard({
  name, connected, right, children,
}: { name: string; connected?: boolean; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className="p-4 rounded-[10px] space-y-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTopColor: connected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="t-card-title">{name}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-mono mb-1" style={{ fontSize: 10 }}>{label}</div>
      <input className="input-glass" value={value} readOnly />
    </div>
  );
}

// ===================== PROFILE =====================
function ProfileTab({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [preferredName, setPreferredName] = useState(profile.preferred_name ?? "");
  const [timezone, setTimezone] = useState(profile.timezone ?? "America/Los_Angeles");
  const [username, setUsername] = useState(profile.username ?? "");
  const [savingId, setSavingId] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = useMemo(() => {
    const n = (preferredName || displayName || profile.email || "U").trim();
    const parts = n.split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
  }, [preferredName, displayName, profile.email]);

  async function saveIdentity() {
    setSavingId(true);
    const ok = await patchProfile(profile.id, {
      display_name: displayName || null,
      preferred_name: preferredName || null,
      timezone,
    });
    setSavingId(false);
    if (ok) setProfile({ ...profile, display_name: displayName, preferred_name: preferredName, timezone });
  }

  async function saveBooking() {
    const cleaned = username.toLowerCase().replace(/[^a-z0-9-_]/g, "");
    setSavingBook(true);
    const ok = await patchProfile(profile.id, { username: cleaned || null });
    setSavingBook(false);
    if (ok) {
      setUsername(cleaned);
      setProfile({ ...profile, username: cleaned });
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "0" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const ok = await patchProfile(profile.id, { avatar_url: url });
      if (ok) setProfile({ ...profile, avatar_url: url });
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <SectionLabel>IDENTITY</SectionLabel>
      <section className="glass p-5">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="flex items-center justify-center font-bold relative overflow-hidden"
            style={{
              width: 48, height: 48, borderRadius: 999,
              background: "rgba(37,99,235,0.18)",
              border: "1px solid rgba(37,99,235,0.40)",
              boxShadow: "0 0 24px rgba(37,99,235,0.30)",
              color: "var(--text-accent)", fontFamily: "var(--font-display)", fontSize: 18,
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              initials
            )}
            {uploading && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.55)" }}
              >
                <Loader2 size={18} className="animate-spin" style={{ color: "#fff" }} />
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickAvatar}
          />
          <button
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {uploading ? "Uploading…" : "Change photo"}
          </button>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledInput label="FULL NAME" value={displayName} onChange={setDisplayName} placeholder="Myke Sentongo" />
          <LabeledInput label="PREFERRED NAME" value={preferredName} onChange={setPreferredName} placeholder="Myke" />
          <LabeledInput label="EMAIL (read-only)" value={profile.email} onChange={() => {}} disabled />
          <div>
            <div className="t-mono mb-1" style={{ fontSize: 10 }}>TIMEZONE</div>
            <select
              className="input-glass"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ appearance: "none", cursor: "pointer" }}
            >
              {[
                { v: "America/Chicago", l: "America/Chicago (Central)" },
                { v: "America/New_York", l: "America/New_York (Eastern)" },
                { v: "America/Denver", l: "America/Denver (Mountain)" },
                { v: "America/Los_Angeles", l: "America/Los_Angeles (Pacific)" },
                { v: "America/Phoenix", l: "America/Phoenix (Arizona)" },
                { v: "Pacific/Honolulu", l: "Pacific/Honolulu (Hawaii)" },
              ].map((tz) => (
                <option key={tz.v} value={tz.v} style={{ background: "#0b0b0f", color: "#fff" }}>
                  {tz.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={saveIdentity} disabled={savingId} className="btn-primary mt-4">
          {savingId ? <><Loader2 size={14} className="animate-spin" /> Saving</> : "Save Changes"}
        </button>
      </section>

      <SectionLabel>BOOKING IDENTITY</SectionLabel>
      <section className="glass p-5">
        <LabeledInput label="USERNAME" value={username} onChange={setUsername} placeholder="myke" />
        <div className="t-body mt-2" style={{ fontSize: 11 }}>
          Booking links: <span className="t-mono" style={{ color: "var(--text-accent)" }}>
            {window.location.origin}/book/{username || "your-username"}/[event-slug]
          </span>
        </div>
        <button onClick={saveBooking} disabled={savingBook} className="btn-primary mt-3">
          {savingBook ? <><Loader2 size={14} className="animate-spin" /> Saving</> : "Save"}
        </button>
      </section>
    </>
  );
}

function LabeledInput({
  label, value, onChange, placeholder, disabled,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <div className="t-mono mb-1" style={{ fontSize: 10 }}>{label}</div>
      <input
        className="input-glass"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={disabled ? { opacity: 0.6 } : undefined}
      />
    </div>
  );
}

// ===================== ORGS =====================
function OrgsTab() {
  const { orgs, memberships } = useOrg();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const c: Record<string, number> = {};
      await Promise.all(orgs.map(async (o) => {
        const { count } = await supabase
          .from("org_memberships")
          .select("*", { count: "exact", head: true })
          .eq("org_id", o.id);
        c[o.id] = count ?? 0;
      }));
      setCounts(c);
    })();
  }, [orgs]);

  return (
    <>
      <SectionLabel>YOUR ORGANIZATIONS</SectionLabel>
      <div className="space-y-2">
        {orgs.map((o) => {
          const role = memberships.find((m) => m.org_id === o.id)?.role ?? "—";
          const color = ORG_COLORS[o.slug] ?? o.color ?? "#60A5FA";
          const isPilot = o.slug === "uwazi";
          return (
            <section
              key={o.id}
              className="p-4 rounded-[10px] flex items-center gap-3 flex-wrap"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 12px ${color}66` }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="t-card-title">{o.name}</div>
                  {isPilot && <span className="badge badge-info">Pilot org</span>}
                </div>
                <div className="t-body" style={{ fontSize: 11 }}>
                  <span className="t-mono" style={{ textTransform: "uppercase" }}>{role}</span>
                  {" · "}
                  {counts[o.id] ?? "…"} member{counts[o.id] === 1 ? "" : "s"}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => toast.info("Org editing — owner-only, coming soon")}>
                Edit
              </button>
            </section>
          );
        })}
      </div>
      <button className="btn-ghost mt-3" onClick={() => toast.info("Add Organization — coming soon")}>
        + Add Organization
      </button>
    </>
  );
}

// ===================== AI =====================
function AITab({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const ai = profile.ai_prefs ?? {};
  const [model, setModel] = useState<string>(ai.model ?? "claude-sonnet-4.6");
  const [voice, setVoice] = useState(profile.voice_profile ?? DEFAULT_VOICE);
  const [askBeforeSend, setAskBeforeSend] = useState<boolean>(ai.ask_before_send ?? true);
  const [includeContext, setIncludeContext] = useState<boolean>(ai.include_thread_context ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const next = { model, ask_before_send: askBeforeSend, include_thread_context: includeContext };
    const ok = await patchProfile(profile.id, { voice_profile: voice, ai_prefs: next });
    setSaving(false);
    if (ok) setProfile({ ...profile, voice_profile: voice, ai_prefs: next });
  }

  return (
    <>
      <SectionLabel>MODEL</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ModelCard
          selected={model === "claude-sonnet-4.6"}
          onClick={() => setModel("claude-sonnet-4.6")}
          title="Claude Sonnet 4.6"
          subtitle="Primary · all reasoning + drafting"
        />
        <ModelCard
          selected={model === "gpt-4o"}
          onClick={() => setModel("gpt-4o")}
          title="GPT-4o"
          subtitle="Secondary · CC image gen only"
        />
      </div>

      <SectionLabel>EMAIL VOICE PROFILE</SectionLabel>
      <section className="glass p-5">
        <textarea
          className="input-glass"
          rows={6}
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          style={{ resize: "vertical", lineHeight: 1.6 }}
        />
        <div className="t-body mt-2" style={{ fontSize: 11 }}>
          Used by AI when drafting emails on your behalf.
        </div>
      </section>

      <SectionLabel>DRAFT BEHAVIOR</SectionLabel>
      <section className="glass p-5 space-y-4">
        <Row title="Always ask before sending drafts" subtitle="Show preview + confirm before any send">
          <Toggle on={askBeforeSend} onChange={setAskBeforeSend} />
        </Row>
        <Row title="Include thread context in prompts" subtitle="Pass the full thread to the model when drafting">
          <Toggle on={includeContext} onChange={setIncludeContext} />
        </Row>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : "Save AI Preferences"}
      </button>
    </>
  );
}

function ModelCard({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-[10px] transition-all"
      style={{
        background: selected ? "var(--bg-glass-active)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${selected ? "var(--border-active)" : "var(--border-glass)"}`,
        boxShadow: selected ? "0 0 0 1px var(--border-active-glow)" : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 16, height: 16, borderRadius: 999,
            border: `2px solid ${selected ? "var(--text-accent)" : "var(--text-muted)"}`,
          }}
        >
          {selected && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--text-accent)" }} />}
        </span>
        <div>
          <div className="t-card-title">{title}</div>
          <div className="t-body" style={{ fontSize: 11 }}>{subtitle}</div>
        </div>
      </div>
    </button>
  );
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="t-body" style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{title}</div>
        {subtitle && <div className="t-body" style={{ fontSize: 11 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// ===================== SCHEDULING =====================
function SchedulingTab({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const sp = profile.scheduling_prefs ?? {};
  const [focusStart, setFocusStart] = useState<string>(sp.focus_start ?? "09:00");
  const [focusEnd, setFocusEnd] = useState<string>(sp.focus_end ?? "17:00");
  const [maxMeetings, setMaxMeetings] = useState<number>(sp.max_meeting_hours ?? 4);
  const [buffer, setBuffer] = useState<number>(sp.buffer_mins ?? 10);
  const [deepWork, setDeepWork] = useState<boolean>(sp.protect_deep_work ?? true);
  const [autoLunch, setAutoLunch] = useState<boolean>(sp.auto_block_lunch ?? true);
  const [preferAfternoon, setPreferAfternoon] = useState<boolean>(sp.prefer_afternoon ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const next = {
      ...sp,
      focus_start: focusStart, focus_end: focusEnd,
      max_meeting_hours: maxMeetings, buffer_mins: buffer,
      protect_deep_work: deepWork, auto_block_lunch: autoLunch, prefer_afternoon: preferAfternoon,
      deep_work_start: "09:00", deep_work_end: "11:00",
      lunch_start: "12:00", lunch_end: "13:00",
    };
    const ok = await patchProfile(profile.id, { scheduling_prefs: next });
    setSaving(false);
    if (ok) setProfile({ ...profile, scheduling_prefs: next });
  }

  return (
    <>
      <SectionLabel>FOCUS WINDOW</SectionLabel>
      <section className="glass p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>FOCUS START</div>
          <input className="input-glass" type="time" value={focusStart} onChange={(e) => setFocusStart(e.target.value)} />
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>FOCUS END</div>
          <input className="input-glass" type="time" value={focusEnd} onChange={(e) => setFocusEnd(e.target.value)} />
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>MAX MEETINGS / DAY</div>
          <input className="input-glass" type="number" min={0} max={20} value={maxMeetings} onChange={(e) => setMaxMeetings(Number(e.target.value))} />
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10 }}>BUFFER BETWEEN MEETINGS (MIN)</div>
          <input className="input-glass" type="number" min={0} max={60} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
        </div>
      </section>

      <SectionLabel>RULES</SectionLabel>
      <section className="glass p-5 space-y-4">
        <Row title="Protect 9–11 AM for deep work" subtitle="Block AI scheduling from booking this window">
          <Toggle on={deepWork} onChange={setDeepWork} />
        </Row>
        <Row title="Auto-block lunch 12–1 PM">
          <Toggle on={autoLunch} onChange={setAutoLunch} />
        </Row>
        <Row title="Prefer afternoon meetings (1–4 PM)">
          <Toggle on={preferAfternoon} onChange={setPreferAfternoon} />
        </Row>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : "Save Scheduling"}
      </button>
    </>
  );
}

// ===================== NOTIFICATIONS =====================
function NotificationsTab({ profile, setProfile }: { profile: ProfileRow; setProfile: (p: ProfileRow) => void }) {
  const np = profile.notification_prefs ?? {};
  const [emailDigest, setEmailDigest] = useState<boolean>(np.email_digest ?? true);
  const [smsUrgent, setSmsUrgent] = useState<boolean>(np.sms_urgent ?? true);
  const [inApp, setInApp] = useState<boolean>(np.in_app ?? true);
  const [slackDm, setSlackDm] = useState<boolean>(np.slack_dm ?? false);
  const [smsOnUrgentEmail, setSmsOnUrgentEmail] = useState<boolean>(np.sms_on_urgent_email ?? true);
  const [smsOnBooking, setSmsOnBooking] = useState<boolean>(np.sms_on_booking ?? false);
  const [briefTime, setBriefTime] = useState<string>(np.daily_brief_time ?? "07:00");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const next = {
      email_digest: emailDigest, sms_urgent: smsUrgent, in_app: inApp, slack_dm: slackDm,
      sms_on_urgent_email: smsOnUrgentEmail, sms_on_booking: smsOnBooking,
      daily_brief_time: briefTime,
    };
    const ok = await patchProfile(profile.id, { notification_prefs: next });
    setSaving(false);
    if (ok) setProfile({ ...profile, notification_prefs: next });
  }

  return (
    <>
      <SectionLabel>CHANNELS</SectionLabel>
      <section className="glass p-5 space-y-4">
        <Row title="Email digest (daily)" subtitle={`Sent to ${profile.email}`}>
          <Toggle on={emailDigest} onChange={setEmailDigest} />
        </Row>
        <Row title="SMS alerts (urgent only)" subtitle="via Twilio · URGENT-tagged items only">
          <Toggle on={smsUrgent} onChange={setSmsUrgent} />
        </Row>
        <Row title="In-app notifications" subtitle="Bell icon + badge">
          <Toggle on={inApp} onChange={setInApp} />
        </Row>
        <Row title="Slack DM (external)" subtitle="Requires Slack integration">
          <Toggle on={slackDm} onChange={setSlackDm} />
        </Row>
      </section>

      <SectionLabel>URGENCY THRESHOLDS</SectionLabel>
      <section className="glass p-5 space-y-4">
        <Row title="Send SMS when email tagged URGENT">
          <Toggle on={smsOnUrgentEmail} onChange={setSmsOnUrgentEmail} />
        </Row>
        <Row title="Send SMS for booking confirmations">
          <Toggle on={smsOnBooking} onChange={setSmsOnBooking} />
        </Row>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="t-body" style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>Daily brief email at</div>
            <div className="t-body" style={{ fontSize: 11 }}>Local time ({profile.timezone ?? "—"})</div>
          </div>
          <input
            className="input-glass"
            type="time"
            value={briefTime}
            onChange={(e) => setBriefTime(e.target.value)}
            style={{ width: 120 }}
          />
        </div>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : "Save Notifications"}
      </button>
    </>
  );
}
