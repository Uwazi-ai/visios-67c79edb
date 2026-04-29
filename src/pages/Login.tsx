import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { VisiLogo } from "@/components/visi/Logo";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const Login = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate("/", { replace: true });
  }, [session, loading, navigate]);

  const handleGoogle = async () => {
    setSigning(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/",
        scopes: GOOGLE_SCOPES,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });
    if (error) {
      setError(error.message ?? "Sign-in failed");
      setSigning(false);
    }
  };

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4">
      <div className="bg-orb-1" />
      <div className="bg-orb-2" />
      <div
        className="glass-elevated card-enter relative z-10 w-full max-w-md p-10"
        style={{ borderRadius: 24 }}
      >
        <div className="flex flex-col items-center text-center">
          <VisiLogo size={64} showWordmark />
          <h1
            className="t-hero mt-8"
            style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
          >
            Your companies.<br />
            <span className="slash" style={{ margin: 0 }}>/</span> One OS.
          </h1>
          <p
            className="mt-4 max-w-sm"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 300,
              fontSize: 15,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            The operating system for the multi-venture builder. Email, tasks, calendar, decisions — unified.
          </p>

          <button
            onClick={handleGoogle}
            disabled={signing}
            className="btn-ghost mt-8 w-full justify-center"
            style={{ height: 48, fontSize: 13 }}
          >
            <GoogleIcon />
            <span style={{ fontFamily: "var(--font-body)", textTransform: "none", letterSpacing: 0, fontWeight: 500, color: "var(--text-primary)" }}>
              {signing ? "Connecting…" : "Continue with Google"}
            </span>
          </button>

          {error && <p className="mt-4 text-xs" style={{ color: "var(--sev-critical)" }}>{error}</p>}

          <p className="t-mono mt-10">THREE COMPANIES <span className="slash">/</span> ZERO CHAOS</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
