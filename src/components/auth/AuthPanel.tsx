import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Tokens (mirrors Landing.tsx)
const BG = "#0a0a0a";
const CARD = "#111111";
const CARD_BORDER = "#222222";
const BLUE = "#2563EB";
const MUTED = "#888888";
const GREEN = "#4ade80";
const BTN_NAVY = "#1a2744";
const BTN_NAVY_BORDER = "#2a3a5a";
const INPUT_BORDER = "#333333";

const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export function AuthPanel({ tab, setTab, next }: { tab: "signup" | "signin"; setTab: (t: "signup" | "signin") => void; next?: string }) {
  // Where auth should return to. `next` carries flows like the OAuth consent screen.
  const returnTo = window.location.origin + (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [devPw, setDevPw] = useState("");

  const onGoogle = async () => {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: returnTo,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
      },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (pw !== pw2) { setError("Passwords don't match."); return; }
    if (pw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: returnTo },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setInfo("Check your email to confirm your account.");
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) setError("Invalid email or password. Try again.");
  };

  const onForgot = async () => {
    setError(null); setInfo(null);
    if (!email) { setError("Enter your email above first."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) setError(error.message);
    else setInfo("Password reset link sent to your email.");
  };

  const onDev = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    let { error } = await supabase.auth.signInWithPassword({ email: devEmail, password: devPw });
    if (error && /invalid login|invalid credentials/i.test(error.message)) {
      const r = await supabase.auth.signUp({ email: devEmail, password: devPw });
      error = r.error;
    }
    if (error) { setError(error.message); setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 8,
    padding: "12px 16px", height: 44, fontSize: 14, color: "white",
    width: "100%", outline: "none",
  };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 480 }}>
      <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 40 }}>
        <div className="flex gap-6 mb-7" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          {(["signup", "signin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setInfo(null); }}
              className="pb-3 transition"
              style={{
                color: tab === t ? "white" : MUTED,
                fontSize: 14, fontWeight: 600,
                borderBottom: tab === t ? `2px solid white` : "2px solid transparent",
                marginBottom: -1, background: "transparent", cursor: "pointer", padding: "0 0 12px",
              }}
            >{t === "signup" ? "Sign up" : "Sign in"}</button>
          ))}
        </div>

        <button
          onClick={onGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 transition"
          style={{ background: BTN_NAVY, color: "white", border: `1px solid ${BTN_NAVY_BORDER}`, borderRadius: 999, height: 44, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1f3060")}
          onMouseLeave={e => (e.currentTarget.style.background = BTN_NAVY)}
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5" style={{ color: MUTED, fontSize: 11 }}>
          <div className="flex-1 h-px" style={{ background: CARD_BORDER }} />
          <span>or</span>
          <div className="flex-1 h-px" style={{ background: CARD_BORDER }} />
        </div>

        {tab === "signup" ? (
          <form onSubmit={onSignUp} className="flex flex-col gap-3">
            <input type="email" required placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            <div className="relative">
              <input type={showPw ? "text" : "password"} required minLength={6} placeholder="Create password" value={pw} onChange={e => setPw(e.target.value)} style={inputStyle} />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED, background: "transparent", border: "none", cursor: "pointer" }}>
                {showPw ? "hide" : "show"}
              </button>
            </div>
            <input type="password" required minLength={6} placeholder="Confirm password" value={pw2} onChange={e => setPw2(e.target.value)} style={inputStyle} />
            <button type="submit" disabled={loading} className="w-full transition" style={{ background: BLUE, color: "white", border: "none", borderRadius: 999, height: 44, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1d50c8")}
              onMouseLeave={e => (e.currentTarget.style.background = BLUE)}
            >
              {loading ? "Creating…" : "Create account →"}
            </button>
            <div className="text-xs mt-1" style={{ color: MUTED }}>
              By signing up you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
            </div>
          </form>
        ) : (
          <form onSubmit={onSignIn} className="flex flex-col gap-3">
            <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            <div className="relative">
              <input type={showPw ? "text" : "password"} required placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} style={inputStyle} />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED, background: "transparent", border: "none", cursor: "pointer" }}>
                {showPw ? "hide" : "show"}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onForgot} className="text-xs" style={{ color: BLUE, background: "transparent", border: "none", cursor: "pointer" }}>Forgot password?</button>
            </div>
            <button type="submit" disabled={loading} className="w-full transition" style={{ background: BLUE, color: "white", border: "none", borderRadius: 999, height: 44, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1d50c8")}
              onMouseLeave={e => (e.currentTarget.style.background = BLUE)}
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        )}

        {error && <div className="mt-4 text-xs" style={{ color: "#fca5a5" }}>{error}</div>}
        {info && <div className="mt-4 text-xs" style={{ color: GREEN }}>{info}</div>}

        <div className="mt-6 text-center text-xs" style={{ color: MUTED }}>
          {tab === "signup" ? (
            <>Already have an account?{" "}
              <button onClick={() => setTab("signin")} style={{ color: BLUE, background: "transparent", border: "none", cursor: "pointer" }}>Sign in →</button></>
          ) : (
            <>Don't have an account?{" "}
              <button onClick={() => setTab("signup")} style={{ color: BLUE, background: "transparent", border: "none", cursor: "pointer" }}>Start for free →</button></>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => setDevOpen(o => !o)}
          className="flex items-center gap-2 mx-auto text-xs"
          style={{ color: MUTED, opacity: 0.6, background: "transparent", border: "none", cursor: "pointer", fontFamily: "monospace", letterSpacing: "0.1em" }}
        >
          <ChevronDown size={12} style={{ transform: devOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }} />
          DEV BYPASS
        </button>
        {devOpen && (
          <form onSubmit={onDev} className="mt-3 flex flex-col gap-2 mx-auto" style={{ maxWidth: 360 }}>
            <input type="email" required placeholder="email@dev.local" value={devEmail} onChange={e => setDevEmail(e.target.value)} style={{ ...inputStyle, height: 38, fontSize: 12 }} />
            <input type="password" required minLength={6} placeholder="password (min 6 chars)" value={devPw} onChange={e => setDevPw(e.target.value)} style={{ ...inputStyle, height: 38, fontSize: 12 }} />
            <button type="submit" disabled={loading} className="w-full" style={{ background: BLUE, color: "white", borderRadius: 8, height: 38, fontSize: 12, border: "none", cursor: "pointer" }}>
              Sign in / Sign up
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
