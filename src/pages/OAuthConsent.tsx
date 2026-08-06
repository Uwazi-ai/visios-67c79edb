import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * OAuth 2.1 consent screen. Supabase Auth redirects here when an MCP client
 * (Claude, ChatGPT, Lovable) asks to connect to this app as the signed-in user.
 */

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthNs(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const ns = oauthNs();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorizationId)
      : await ns.denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
    window.location.href = target;
  }

  const shell: React.CSSProperties = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "var(--bg, #0a0a0a)",
    color: "var(--text-primary, #ffffff)",
    fontFamily: "Inter, system-ui, sans-serif",
  };
  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 440,
    borderRadius: 16,
    padding: 32,
    background: "var(--surface-1, #111111)",
    border: "1px solid var(--border, #222222)",
  };
  const dim = { color: "var(--dim, #8a8a99)", fontSize: 14, lineHeight: 1.55 } as React.CSSProperties;

  if (error) {
    return (
      <main style={shell}>
        <div style={card}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Could not load this request</h1>
          <p style={dim}>{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main style={shell}>
        <div style={card}><p style={dim}>Loading…</p></div>
      </main>
    );
  }

  const clientName = details.client?.name ?? "An application";

  return (
    <main style={shell}>
      <div style={card}>
        <h1 style={{ fontSize: 22, margin: "0 0 10px", lineHeight: 1.25 }}>
          Connect {clientName} to Kova
        </h1>
        <p style={dim}>
          {clientName} will be able to read and act on your Kova data as you — your workspaces,
          tasks, contacts, knowledge documents and agent proposals. It cannot do anything your
          own account cannot do, and you can disconnect it at any time.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            style={{
              flex: 1, height: 44, borderRadius: 999, border: "none", cursor: "pointer",
              background: "var(--b-500, #2563EB)", color: "#fff", fontSize: 14, fontWeight: 600,
            }}
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            style={{
              flex: 1, height: 44, borderRadius: 999, cursor: "pointer",
              background: "transparent", color: "var(--dim, #8a8a99)",
              border: "1px solid var(--border, #333)", fontSize: 14, fontWeight: 500,
            }}
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
