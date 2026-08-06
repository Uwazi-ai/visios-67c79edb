import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { VisiLogo } from "@/components/visi/Logo";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { ArrowLeft } from "lucide-react";

const BG = "#0a0a0a";
const MUTED = "#888888";

// Simple deterministic star field (mirrors Landing look)
function buildStarField(count = 90) {
  let seed = 11;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 100).toFixed(2);
    const a = (0.15 + rnd() * 0.55).toFixed(2);
    const s = rnd() > 0.85 ? 2 : 1;
    parts.push(`radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${a}) 0%, transparent 100%)`);
  }
  return parts.join(",");
}

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function SignIn() {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const initialTab: "signup" | "signin" =
    params.get("tab") === "signup" || params.get("signup") !== null ? "signup" : "signin";
  const [tab, setTab] = useState<"signup" | "signin">(initialTab);

  const starField = useMemo(() => buildStarField(90), []);

  useEffect(() => {
    // keep URL in sync so links share correctly
    const qs = new URLSearchParams(window.location.search);
    qs.set("tab", tab);
    const next = `${window.location.pathname}?${qs.toString()}`;
    window.history.replaceState(null, "", next);
  }, [tab]);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return (
    <div
      style={{
        color: "white",
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        backgroundColor: BG,
        backgroundImage: starField,
        backgroundAttachment: "fixed",
      }}
    >
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 20, height: 64,
          background: "rgba(10,10,10,0.6)", backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="mx-auto flex h-full items-center justify-between px-5 md:px-8" style={{ maxWidth: 1200 }}>
          <Link to="/" className="flex items-center"><VisiLogo size={28} showWordmark /></Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm"
            style={{ color: MUTED, textDecoration: "none" }}
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </nav>

      <main className="px-5 py-16 md:py-24">
        <div className="text-center mb-8">
          <h1 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
            {tab === "signup" ? "Start your free trial." : "Welcome back."}
          </h1>
          <p className="mx-auto mt-3" style={{ fontSize: 15, color: MUTED, maxWidth: 420, lineHeight: 1.5 }}>
            {tab === "signup"
              ? "Create your Kova account. No credit card required."
              : "Sign in to your Kova workspace."}
          </p>
        </div>
        <AuthPanel tab={tab} setTab={setTab} />
      </main>
    </div>
  );
}
