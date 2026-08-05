import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "valid" | "used" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const j = await r.json().catch(() => ({}));
        if (j?.status === "valid") setState("valid");
        else if (j?.status === "already_unsubscribed" || j?.status === "used") setState("used");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setBusy(false);
    if (error) setState("error"); else setState("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg-page, #fff)" }}>
      <div className="glass max-w-md w-full p-8 text-center">
        <div className="t-mono mb-3" style={{ fontSize: 11 }}>KOVA / EMAIL PREFERENCES</div>
        {state === "loading" && <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>}
        {state === "valid" && (
          <>
            <h1 className="t-hero mb-3" style={{ fontSize: 24 }}>Unsubscribe?</h1>
            <p className="mb-6" style={{ color: "var(--text-muted)", fontSize: 14 }}>
              You'll stop receiving non-essential emails from Kova.
            </p>
            <button onClick={confirm} disabled={busy} className="btn-primary">
              {busy ? <Loader2 size={12} className="animate-spin" /> : null} Confirm unsubscribe
            </button>
          </>
        )}
        {state === "used" && <p>You're already unsubscribed.</p>}
        {state === "done" && <p>Done — you've been unsubscribed.</p>}
        {state === "invalid" && <p>This unsubscribe link is invalid.</p>}
        {state === "error" && <p>Something went wrong. Please try again later.</p>}
      </div>
    </div>
  );
}
