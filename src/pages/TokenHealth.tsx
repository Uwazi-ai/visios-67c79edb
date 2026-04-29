import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, ArrowLeft, Shield, Key, Clock,
} from "lucide-react";
import { toast } from "sonner";

const REQUIRED_SCOPES: { scope: string; label: string; capability: string }[] = [
  { scope: "openid", label: "openid", capability: "Identity" },
  { scope: "https://www.googleapis.com/auth/userinfo.email", label: "userinfo.email", capability: "Email address" },
  { scope: "https://www.googleapis.com/auth/userinfo.profile", label: "userinfo.profile", capability: "Profile info" },
  { scope: "https://www.googleapis.com/auth/gmail.readonly", label: "gmail.readonly", capability: "Read Gmail" },
  { scope: "https://www.googleapis.com/auth/gmail.send", label: "gmail.send", capability: "Send Gmail" },
  { scope: "https://www.googleapis.com/auth/gmail.modify", label: "gmail.modify", capability: "Modify Gmail" },
  { scope: "https://www.googleapis.com/auth/calendar.events", label: "calendar.events", capability: "Manage events" },
  { scope: "https://www.googleapis.com/auth/calendar.readonly", label: "calendar.readonly", capability: "Read calendar" },
  { scope: "https://www.googleapis.com/auth/drive.readonly", label: "drive.readonly", capability: "Read Drive" },
];

interface ProfileTokens {
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_granted_scopes: string | null;
  email: string;
}

interface TokenInfo {
  expires_in?: number;
  scope?: string;
  email?: string;
  error?: string;
  error_description?: string;
}

export default function TokenHealthPage() {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<ProfileTokens | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const runCheck = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_granted_scopes, email")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data as ProfileTokens | null);

    if (data?.google_access_token) {
      try {
        const r = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(data.google_access_token)}`
        );
        const j = (await r.json()) as TokenInfo;
        setTokenInfo(j);
      } catch (e) {
        setTokenInfo({ error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      setTokenInfo(null);
    }
    setCheckedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const tryServerRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-token");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Server refreshed access token");
      await runCheck();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const forceFreshConsent = async () => {
    // Revoke any existing Google grant so the next consent is treated as first-time
    // and Google returns a refresh_token.
    if (profile?.google_access_token) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(profile.google_access_token)}`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
      } catch {
        // ignore — the consent prompt below is what matters
      }
    }
    if (user) {
      await supabase
        .from("profiles")
        .update({ google_access_token: null, google_refresh_token: null, google_granted_scopes: null })
        .eq("id", user.id);
    }
    const scopes = REQUIRED_SCOPES.map((s) => s.scope).join(" ");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/settings/token-health`,
        scopes,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) toast.error(error.message);
  };

  const grantedSet = new Set(
    (profile?.google_granted_scopes ?? tokenInfo?.scope ?? "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const accessTokenPresent = !!profile?.google_access_token;
  const refreshTokenPresent = !!profile?.google_refresh_token;
  const tokenValid = !!tokenInfo && !tokenInfo.error && typeof tokenInfo.expires_in === "number" && tokenInfo.expires_in > 0;
  const expiresInSec = tokenInfo?.expires_in ?? null;
  const missingScopes = REQUIRED_SCOPES.filter((s) => !grantedSet.has(s.scope));

  const overallOk = accessTokenPresent && refreshTokenPresent && tokenValid && missingScopes.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="btn-ghost flex items-center gap-1.5">
            <ArrowLeft size={14} /> Settings
          </Link>
          <div>
            <h1 className="t-section">Token health</h1>
            <p className="t-mono mt-1" style={{ fontSize: 10 }}>
              GOOGLE<span className="slash">/</span>OAUTH<span className="slash">/</span>DIAGNOSTICS
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={runCheck} disabled={loading} className="btn-ghost flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Re-check
          </button>
        </div>
      </div>

      {/* Overall status */}
      <div
        className="glass p-5 mb-5 flex items-center gap-4"
        style={{
          borderColor: overallOk ? "hsl(142 70% 45% / 0.3)" : "hsl(38 90% 55% / 0.3)",
        }}
      >
        {overallOk ? (
          <CheckCircle2 size={32} style={{ color: "hsl(142 70% 55%)" }} />
        ) : (
          <AlertTriangle size={32} style={{ color: "hsl(38 90% 60%)" }} />
        )}
        <div className="flex-1">
          <div className="t-card-title" style={{ fontSize: 15 }}>
            {overallOk ? "All Google integrations healthy" : "Issues detected"}
          </div>
          <div className="t-body" style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
            {profile?.email ?? "—"}
            {checkedAt && ` · checked ${checkedAt.toLocaleTimeString()}`}
          </div>
        </div>
      </div>

      {/* Persistence checks */}
      <div className="glass p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} style={{ color: "var(--text-accent)" }} />
          <span className="t-card-title">Token persistence (profiles row)</span>
        </div>
        <div className="grid gap-3">
          <Row
            ok={accessTokenPresent}
            label="Access token stored"
            detail={accessTokenPresent ? mask(profile?.google_access_token) : "Not present"}
          />
          <Row
            ok={refreshTokenPresent}
            label="Refresh token stored"
            detail={
              refreshTokenPresent
                ? mask(profile?.google_refresh_token)
                : "Missing — Google APIs cannot refresh access. Reconnect with prompt=consent."
            }
          />
          <Row
            ok={!!profile?.google_granted_scopes}
            label="Granted scopes recorded"
            detail={profile?.google_granted_scopes ? `${grantedSet.size} scopes saved` : "Not recorded"}
          />
        </div>
      </div>

      {/* Token validity */}
      <div className="glass p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} style={{ color: "var(--text-accent)" }} />
          <span className="t-card-title">Access token validity (Google tokeninfo)</span>
        </div>
        {!accessTokenPresent ? (
          <div className="t-body" style={{ color: "var(--text-muted)", fontSize: 13 }}>
            No access token to verify.
          </div>
        ) : tokenInfo?.error ? (
          <Row
            ok={false}
            label="Token invalid"
            detail={`${tokenInfo.error}${tokenInfo.error_description ? ` · ${tokenInfo.error_description}` : ""}`}
          />
        ) : (
          <div className="grid gap-3">
            <Row
              ok={tokenValid}
              label="Token valid"
              detail={
                expiresInSec !== null
                  ? `Expires in ${formatDuration(expiresInSec)}`
                  : "Unknown expiry"
              }
            />
            {tokenInfo?.email && (
              <Row ok={true} label="Verified Google email" detail={tokenInfo.email} />
            )}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={tryServerRefresh}
            disabled={refreshing || !refreshTokenPresent}
            className="btn-ghost flex items-center gap-1.5"
            title={!refreshTokenPresent ? "No refresh token stored" : "Force server-side refresh"}
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Force server refresh
          </button>
          <button
            onClick={forceFreshConsent}
            className="btn-primary flex items-center gap-1.5"
            title="Revokes existing Google grant, then runs OAuth so Google issues a new refresh_token"
          >
            <Shield size={14} /> Force fresh consent (fix missing refresh token)
          </button>
        </div>
      </div>

      {/* Scopes */}
      <div className="glass p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} style={{ color: "var(--text-accent)" }} />
          <span className="t-card-title">Granted scopes ({grantedSet.size})</span>
        </div>
        <div className="grid gap-2">
          {REQUIRED_SCOPES.map((s) => {
            const ok = grantedSet.has(s.scope);
            return (
              <div
                key={s.scope}
                className="flex items-center gap-3 px-3 py-2 rounded-[8px]"
                style={{ background: "var(--bg-glass-1)" }}
              >
                {ok ? (
                  <CheckCircle2 size={16} style={{ color: "hsl(142 70% 55%)", flexShrink: 0 }} />
                ) : (
                  <XCircle size={16} style={{ color: "hsl(0 70% 60%)", flexShrink: 0 }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="t-mono" style={{ fontSize: 11, color: "var(--text-primary)" }}>
                    {s.label}
                  </div>
                  <div className="t-body" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {s.capability}
                  </div>
                </div>
                {!ok && <span className="badge">missing</span>}
              </div>
            );
          })}
        </div>

        {/* Extra scopes granted but not in required list */}
        {(() => {
          const extras = [...grantedSet].filter(
            (g) => !REQUIRED_SCOPES.some((r) => r.scope === g)
          );
          if (extras.length === 0) return null;
          return (
            <div className="mt-4">
              <div className="t-mono mb-2" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                EXTRA<span className="slash">/</span>SCOPES
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extras.map((s) => (
                  <span key={s} className="badge" title={s}>
                    {s.replace("https://www.googleapis.com/auth/", "")}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Session debug */}
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} style={{ color: "var(--text-accent)" }} />
          <span className="t-card-title">Session provider data</span>
        </div>
        <div className="grid gap-3">
          <Row
            ok={!!(session as any)?.provider_token}
            label="session.provider_token"
            detail={(session as any)?.provider_token ? "Present in current session" : "Not on session (may be normal after refresh)"}
          />
          <Row
            ok={!!(session as any)?.provider_refresh_token}
            label="session.provider_refresh_token"
            detail={
              (session as any)?.provider_refresh_token
                ? "Present in current session"
                : "Not on session — must be persisted during initial OAuth"
            }
          />
        </div>
      </div>
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-[8px]" style={{ background: "var(--bg-glass-1)" }}>
      {ok ? (
        <CheckCircle2 size={16} style={{ color: "hsl(142 70% 55%)", flexShrink: 0, marginTop: 1 }} />
      ) : (
        <XCircle size={16} style={{ color: "hsl(0 70% 60%)", flexShrink: 0, marginTop: 1 }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="t-body" style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
        {detail && (
          <div className="t-mono mt-0.5" style={{ fontSize: 10, color: "var(--text-muted)", wordBreak: "break-all" }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

function mask(t: string | null | undefined) {
  if (!t) return "";
  if (t.length <= 12) return "•".repeat(t.length);
  return `${t.slice(0, 6)}…${t.slice(-4)} (${t.length} chars)`;
}

function formatDuration(sec: number) {
  if (sec <= 0) return "expired";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
