// Public page hit by OAuth providers as redirect_uri. It forwards the `code` to
// the social-oauth-callback edge function (carrying the user's auth session
// inherited from the popup opener), then notifies the opener and closes.
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "working" | "success" | "error";

export default function OAuthCallback() {
  const { platform } = useParams<{ platform: string }>();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      const state = params.get("state") || "";
      const error = params.get("error") || params.get("error_description");
      if (error) {
        setStatus("error");
        setMessage(error);
        window.opener?.postMessage({ source: "visios-oauth", ok: false, platform, error }, "*");
        return;
      }
      if (!code || !platform) {
        setStatus("error");
        setMessage("Missing code or platform.");
        return;
      }

      const redirect_uri = `${window.location.origin}/oauth-callback/${platform}`;
      const { data, error: fnErr } = await supabase.functions.invoke("social-oauth-callback", {
        body: { platform, code, state, redirect_uri },
      });

      if (fnErr || (data as any)?.error) {
        const msg = fnErr?.message || (data as any)?.error || "Token exchange failed.";
        setStatus("error");
        setMessage(msg);
        window.opener?.postMessage({ source: "visios-oauth", ok: false, platform, error: msg }, "*");
        return;
      }

      setStatus("success");
      setMessage("Connected! You can close this window.");
      window.opener?.postMessage({ source: "visios-oauth", ok: true, platform, account: (data as any).account }, "*");
      setTimeout(() => window.close(), 800);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-base, #02020a)", color: "var(--text-primary, #fff)" }}
    >
      <div className="glass p-6 rounded-xl text-center max-w-sm w-full">
        <div className="t-section mb-2" style={{ fontSize: 16 }}>
          {status === "working" && `Connecting ${platform}…`}
          {status === "success" && "Connected"}
          {status === "error" && "Connection failed"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{message}</div>
      </div>
    </div>
  );
}
