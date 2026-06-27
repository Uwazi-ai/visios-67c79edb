import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VisiLogo } from "@/components/visi/Logo";

const ResetPassword = () => {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase recovery sets a session via URL hash; just wait for it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) { setError("Passwords don't match."); return; }
    if (pw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setError(error.message);
    else navigate("/dashboard", { replace: true });
  };

  return (
    <div style={{ background: "#02020A", color: "white", minHeight: "100vh" }} className="flex flex-col items-center justify-center px-5">
      <div className="mb-8"><VisiLogo size={32} showWordmark /></div>
      <div className="w-full p-8" style={{ maxWidth: 440, background: "#0d0d14", border: "1px solid #1a1a2e", borderRadius: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display, 'Monument Extended')", fontSize: 24 }}>Set a new password</h1>
        <p className="mt-2 text-sm" style={{ color: "#9ca3af" }}>
          {ready ? "Enter your new password below." : "Validating recovery link…"}
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <input
            type="password" required minLength={6} placeholder="New password"
            value={pw} onChange={e => setPw(e.target.value)}
            disabled={!ready}
            className="w-full px-3.5 rounded-lg outline-none"
            style={{ background: "#02020A", border: "1px solid #1a1a2e", height: 44, fontSize: 14, color: "white" }}
          />
          <input
            type="password" required minLength={6} placeholder="Confirm new password"
            value={pw2} onChange={e => setPw2(e.target.value)}
            disabled={!ready}
            className="w-full px-3.5 rounded-lg outline-none"
            style={{ background: "#02020A", border: "1px solid #1a1a2e", height: 44, fontSize: 14, color: "white" }}
          />
          <button
            type="submit" disabled={loading || !ready}
            className="w-full rounded-lg font-medium hover:brightness-110 transition disabled:opacity-50"
            style={{ background: "#2563EB", height: 44, fontSize: 14, color: "white" }}
          >
            {loading ? "Updating…" : "Set new password →"}
          </button>
          {error && <div className="text-xs" style={{ color: "#fca5a5" }}>{error}</div>}
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
