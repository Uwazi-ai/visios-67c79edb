import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { VisiLogo } from "@/components/visi/Logo";
import {
  Menu, X, Eye, MessageSquare, CheckSquare, Mail,
  Clock, Zap, ChevronDown, ArrowUpRight, Brain,
  AlertTriangle, TrendingUp, BarChart3, Check,
} from "lucide-react";

// ============ TOKENS ============
const BG = "#0a0a0a";
const CARD = "#111111";
const CARD_BORDER = "#222222";
const NAVY = "#0d1929";
const NAVY_CARD = "#0f1e35";
const NAVY_BORDER = "#1a3a5a";
const BLUE = "#2563EB";
const MUTED = "#888888";
const PILL_BG = "#1a1a1a";
const PILL_BORDER = "#2a2a2a";
const GREEN = "#4ade80";
const RED = "#ef4444";
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

// ============ GENERATED STAR-FIELD BG ============
function buildStarField(count = 110) {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 100).toFixed(2);
    const a = (0.2 + rnd() * 0.3).toFixed(2);
    const s = rnd() > 0.85 ? 2 : 1;
    parts.push(
      `radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${a}) 0%, transparent 100%)`
    );
  }
  return parts.join(",");
}

function goToAuth(tab: "signup" | "signin", navigate: (to: string) => void) {
  navigate(`/login?tab=${tab}`);
}

// ============ REVEAL ON SCROLL ============
function Reveal({ children, as: As = "div", className = "", style }: { children: React.ReactNode; as?: any; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); obs.disconnect(); }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <As
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 400ms ease, transform 400ms ease",
      }}
    >
      {children}
    </As>
  );
}

// ============ SHARED UI ============
function SectionPill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="inline-block"
      style={{
        background: PILL_BG,
        border: `1px solid ${accent ? "rgba(37,99,235,0.4)" : PILL_BORDER}`,
        borderRadius: 999,
        padding: "6px 16px",
        fontSize: 12,
        fontWeight: 500,
        color: accent ? "#93c5fd" : "white",
        letterSpacing: "0.04em",
        marginBottom: 20,
      }}
    >
      {children}
    </span>
  );
}

function NavyButton({ onClick, href, children, className = "" }: { onClick?: () => void; href?: string; children: React.ReactNode; className?: string }) {
  const style: React.CSSProperties = {
    background: BTN_NAVY,
    color: "white",
    borderRadius: 999,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 500,
    border: `1px solid ${BTN_NAVY_BORDER}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background 200ms ease",
    cursor: "pointer",
  };
  const inner = <>{children} <ArrowUpRight size={14} /></>;
  if (href) return <a href={href} className={className} style={style} onMouseEnter={e => (e.currentTarget.style.background = "#1f3060")} onMouseLeave={e => (e.currentTarget.style.background = BTN_NAVY)}>{inner}</a>;
  return <button onClick={onClick} className={className} style={style} onMouseEnter={e => (e.currentTarget.style.background = "#1f3060")} onMouseLeave={e => (e.currentTarget.style.background = BTN_NAVY)}>{inner}</button>;
}

function GhostButton({ onClick, href, children }: { onClick?: () => void; href?: string; children: React.ReactNode }) {
  const style: React.CSSProperties = {
    background: "transparent",
    color: "white",
    borderRadius: 999,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 500,
    border: `1px solid ${INPUT_BORDER}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background 200ms ease",
    cursor: "pointer",
  };
  if (href) return <a href={href} style={style} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>{children}</a>;
  return <button onClick={onClick} style={style} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>{children}</button>;
}

function BlueButton({ onClick, full = false, children }: { onClick?: () => void; full?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: BLUE,
        color: "white",
        borderRadius: 999,
        padding: "12px 28px",
        fontSize: 14,
        fontWeight: 500,
        border: "none",
        display: full ? "flex" : "inline-flex",
        width: full ? "100%" : undefined,
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        transition: "background 200ms ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#1d50c8")}
      onMouseLeave={e => (e.currentTarget.style.background = BLUE)}
    >
      {children} <ArrowUpRight size={14} />
    </button>
  );
}

// ============ MAIN ============
const Landing = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  void params;
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const starField = useMemo(() => buildStarField(110), []);

  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [session, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .feat-card { transition: transform 200ms ease, border-color 200ms ease; }
        .feat-card:hover { transform: translateY(-4px); border-color: ${BLUE} !important; }
        .nav-link { transition: opacity 150ms ease; }
        .nav-link:hover { opacity: 0.7; }
        .replaces-name { transition: color 150ms ease; cursor: default; }
        .replaces-name:hover { color: #888 !important; }
        .footer-link { transition: color 150ms ease; }
        .footer-link:hover { color: white !important; }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 64,
          background: scrolled ? "rgba(10,10,10,0.8)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          transition: "background 200ms ease",
        }}
      >
        <div className="mx-auto flex h-full items-center justify-between px-5 md:px-8" style={{ maxWidth: 1200 }}>
          <Link to="/" className="flex items-center"><VisiLogo size={28} showWordmark /></Link>
          <div className="hidden md:flex items-center gap-8" style={{ fontSize: 14, fontWeight: 500, color: "white" }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <a href="#features" className="nav-link">For Teams</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => goToAuth("signin", navigate)} className="nav-link" style={{ fontSize: 14, color: "white", background: "transparent", border: "none", cursor: "pointer", padding: "8px 12px" }}>
              Sign in
            </button>
            <NavyButton onClick={() => goToAuth("signup", navigate)}>Get started free</NavyButton>
          </div>
          <button className="md:hidden p-2" onClick={() => setNavOpen(true)} aria-label="Menu" style={{ background: "transparent", border: "none", color: "white" }}>
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* MOBILE NAV */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col" style={{ background: BG }}>
          <div className="flex items-center justify-between h-16 px-5" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            <VisiLogo size={28} showWordmark />
            <button onClick={() => setNavOpen(false)} className="p-2" aria-label="Close" style={{ background: "transparent", border: "none", color: "white" }}><X size={22} /></button>
          </div>
          <div className="flex flex-col gap-6 p-8 text-lg flex-1">
            <a href="#features" onClick={() => setNavOpen(false)} className="text-white">Features</a>
            <a href="#pricing" onClick={() => setNavOpen(false)} className="text-white">Pricing</a>
            <a href="#features" onClick={() => setNavOpen(false)} className="text-white">For Teams</a>
          </div>
          <div className="flex flex-col gap-3 p-6" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
            <GhostButton onClick={() => { setNavOpen(false); goToAuth("signin", navigate); }}>Sign in</GhostButton>
            <NavyButton onClick={() => { setNavOpen(false); goToAuth("signup", navigate); }}>Get started free</NavyButton>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="relative flex items-center justify-center px-5" style={{ minHeight: "100vh", paddingTop: 96, paddingBottom: 80 }}>
        {/* Orb */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 500, height: 500,
            transform: "translate(-50%, -45%)",
            background: `radial-gradient(circle, ${NAVY_CARD} 0%, #0a1628 60%, transparent 100%)`,
            opacity: 0.9,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
        <div className="relative z-10 text-center mx-auto" style={{ maxWidth: 760 }}>
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            <span style={{ background: PILL_BG, border: `1px solid rgba(37,99,235,0.4)`, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 500, color: "#93c5fd", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: BLUE }}>✦</span> VisiOS
            </span>
            <span style={{ background: PILL_BG, border: `1px solid ${PILL_BORDER}`, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 500, color: "white" }}>
              AI-Native Team OS
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(42px, 7vw, 72px)",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            The AI Operating System<br />for Modern Teams.
          </h1>
          <p className="mx-auto mt-6" style={{ fontSize: 16, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
            VisiOS replaces your entire tech stack with one AI-native workspace.
            Vision, your Chief of Staff, keeps your team aligned — automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <NavyButton onClick={() => goToAuth("signup", navigate)}>Get started free</NavyButton>
            <GhostButton href="#features">View features</GhostButton>
          </div>
        </div>
      </section>

      {/* REPLACES STRIP */}
      <section className="px-5" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <Reveal className="text-center">
          <SectionPill>ONE SUBSCRIPTION REPLACES</SectionPill>
          <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2" style={{ maxWidth: 900 }}>
            {["Slack", "Asana", "Notion", "Calendly", "Motion", "Loom"].map((name, i, arr) => (
              <span key={name} className="flex items-center gap-4">
                <span className="replaces-name" style={{ fontSize: 14, fontWeight: 500, color: "#555555" }}>{name}</span>
                {i < arr.length - 1 && <span style={{ color: "#333" }}>·</span>}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-5 py-24">
        <div className="mx-auto" style={{ maxWidth: 1000 }}>
          <Reveal className="text-center mb-12">
            <SectionPill>THE PLATFORM</SectionPill>
            <h2 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
              Everything your team needs.<br />Nothing you don't.
            </h2>
            <p className="mx-auto mt-5" style={{ fontSize: 16, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
              One workspace, one login, one subscription. Vision connects every surface so context never gets lost.
            </p>
          </Reveal>
          <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { Icon: Eye, title: "Vision AI Chief of Staff", desc: "Morning briefs, blocker alerts, and sprint summaries — delivered before you ask." },
              { Icon: MessageSquare, title: "Team Chat", desc: "Real-time channels + DMs. Vision summarizes long threads so no one misses context." },
              { Icon: CheckSquare, title: "Tasks + Projects", desc: "List, board, and timeline views. Vision flags what's overdue and blocked automatically." },
              { Icon: Mail, title: "Unified Inbox", desc: "Gmail synced and AI-triaged. Vision drafts replies and surfaces what matters." },
              { Icon: Clock, title: "Calendar + Bookings", desc: "Google Calendar synced. Booking links built in. Cancel your Calendly subscription." },
              { Icon: Zap, title: "Agents (Automations)", desc: "Build workflows once, let them run. Vision triggers and monitors every step." },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="feat-card" style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 28 }}>
                <Icon size={28} color="white" style={{ display: "block", marginBottom: 16 }} />
                <div style={{ fontSize: 18, fontWeight: 600, color: "white", marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* WHY VISIOS — COMPARISON */}
      <section className="px-5 py-24">
        <div className="mx-auto" style={{ maxWidth: 900 }}>
          <Reveal className="text-center mb-12">
            <SectionPill>WHY VISIOS</SectionPill>
            <h2 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
              What makes VisiOS different
            </h2>
            <p className="mx-auto mt-5" style={{ fontSize: 16, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
              Stop duct-taping six tools together. VisiOS gives you one OS where every surface talks to every other.
            </p>
          </Reveal>
          <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* LEFT */}
            <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 32 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "white", marginBottom: 24 }}>The Fragmented Stack</div>
              {[
                "Prone to human errors",
                "6+ subscriptions, 6+ logins",
                "Tools that don't talk to each other",
                "High cost ($172–$250/mo for 3 people)",
                "No team visibility for founders",
                "Slow, disconnected workflows",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2.5" style={{ padding: "10px 0", borderBottom: `1px solid #1a1a1a`, fontSize: 14, color: MUTED }}>
                  <X size={16} color={RED} style={{ flexShrink: 0 }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
            {/* RIGHT */}
            <div style={{ background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`, borderRadius: 12, padding: 32 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "white", marginBottom: 24 }}>VisiOS</div>
              {[
                "AI-powered, always accurate",
                "One subscription, one login",
                "Vision connects everything",
                "Team plan at $79/mo (save $90+)",
                "Full team visibility for founders",
                "Automated workflows built in",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2.5" style={{ padding: "10px 0", borderBottom: `1px solid #1a2a3a`, fontSize: 14, color: "white" }}>
                  <Check size={16} color={GREEN} style={{ flexShrink: 0 }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* STATS */}
      <section className="px-5 py-16">
        <Reveal className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-4" style={{ maxWidth: 900 }}>
          {[
            { Icon: BarChart3, stat: "200+", label: "Founders on the waitlist", body: "Early adopters already building on VisiOS across Kansas City and beyond." },
            { Icon: Clock, stat: "$172/mo", label: "Average stack cost replaced", body: "What teams pay for 6 tools that VisiOS replaces for $79/mo." },
            { Icon: Zap, stat: "1 Login", label: "For your entire stack", body: "Email, tasks, chat, calendar, agents — one workspace." },
          ].map(({ Icon, stat, label, body }) => (
            <div key={label} style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 28 }}>
              <Icon size={28} color="white" style={{ display: "block", marginBottom: 16 }} />
              <div style={{ fontSize: 32, fontWeight: 700, color: "white", lineHeight: 1 }}>{stat}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "white", margin: "8px 0 6px" }}>{label}</div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{body}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* VISION SPOTLIGHT */}
      <section className="px-5 py-24">
        <div className="mx-auto" style={{ maxWidth: 800 }}>
          <Reveal className="text-center mb-12">
            <SectionPill accent>✦ MEET VISION</SectionPill>
            <h2 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
              Your AI Chief of Staff.<br />Always on.
            </h2>
            <p className="mx-auto mt-5" style={{ fontSize: 16, color: MUTED, maxWidth: 540, lineHeight: 1.6 }}>
              Vision isn't a chatbot. It runs across your entire workspace and tells you what matters before you have to ask.
            </p>
          </Reveal>
          <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { Icon: Brain, title: "Morning Briefs", desc: "Every morning Vision briefs you on what's urgent, who's blocked, and what needs a decision today." },
              { Icon: AlertTriangle, title: "Blocker Alerts", desc: "Vision monitors your team's tasks and flags blockers before they derail your sprint." },
              { Icon: TrendingUp, title: "Team Velocity", desc: "Weekly summaries of output, focus time, and momentum — without micromanaging." },
              { Icon: MessageSquare, title: "Ask Anything", desc: "Type /vision in chat. Get instant answers about your tasks, calendar, team, or next priority." },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="feat-card" style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 28 }}>
                <Icon size={24} color="white" style={{ display: "block", marginBottom: 16 }} />
                <div style={{ fontSize: 18, fontWeight: 600, color: "white", marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection onCTA={() => goToAuth("signup", navigate)} />


      {/* WAITLIST */}
      <WaitlistStrip />

      {/* CTA BANNER */}
      <section className="px-5 py-20">
        <Reveal
          className="mx-auto text-center"
          style={{
            maxWidth: 860,
            background: NAVY,
            border: `1px solid ${NAVY_BORDER}`,
            borderRadius: 20,
            padding: "clamp(40px, 8vw, 80px) clamp(24px, 6vw, 60px)",
          }}
        >
          <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
            Let Vision do the work so<br />your team can scale faster.
          </h2>
          <p className="mx-auto mt-5" style={{ fontSize: 16, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
            Start your free trial today and replace your entire tech stack with one OS.
          </p>
          <div className="mt-8 flex justify-center">
            <NavyButton onClick={() => goToAuth("signup", navigate)}>Start for free</NavyButton>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
};

// ============ PRICING ============
function PricingSection({ onCTA }: { onCTA: () => void }) {
  const [annual, setAnnual] = useState(false);
  const plans = [
    {
      name: "SOLO", monthly: 29, annual: 290,
      tag: "1 user · 1 workspace",
      sub: "For independent founders and solopreneurs",
      features: ["Vision AI (100 msgs/mo)", "Tasks + Calendar + Inbox", "Knowledge Base (50 docs)", "Contacts (500)", "Bookings link", "14-day free trial"],
      popular: false,
    },
    {
      name: "TEAM", monthly: 79, annual: 790, popular: true,
      tag: "Up to 3 users · unlimited workspaces",
      sub: "For early-stage founding teams",
      features: ["Everything in Solo", "Vision AI (unlimited)", "Team Chat (channels + DMs)", "Meetings + Fathom sync", "Agents (3 active)", "Team productivity dashboard", "Shared knowledge base", "+$20/seat after 3 users"],
    },
    {
      name: "GROWTH", monthly: 179, annual: 1790,
      tag: "Up to 8 users · unlimited workspaces",
      sub: "For scaling startups and agencies",
      features: ["Everything in Team", "Agents (unlimited)", "Social + Campaign builder", "Admin controls + permissions", "Custom Vision AI persona", "Priority support", "SSO + audit log", "Advanced analytics", "Dedicated onboarding", "+$20/seat after 8"],
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="px-5 py-24">
      <div className="mx-auto" style={{ maxWidth: 1000 }}>
        <Reveal className="text-center mb-10">
          <SectionPill>PRICING</SectionPill>
          <h2 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
            Simple pricing.<br />Serious value.
          </h2>
          <p className="mx-auto mt-5" style={{ fontSize: 16, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
            Start free for 14 days. No credit card required.
          </p>
          <div className="inline-flex items-center gap-1 mt-6 p-1 rounded-full" style={{ background: PILL_BG, border: `1px solid ${PILL_BORDER}` }}>
            {(["Monthly", "Annual"] as const).map((label) => {
              const active = (label === "Annual") === annual;
              return (
                <button
                  key={label}
                  onClick={() => setAnnual(label === "Annual")}
                  className="rounded-full transition flex items-center gap-2"
                  style={{
                    padding: "8px 18px", fontSize: 13,
                    background: active ? "white" : "transparent",
                    color: active ? "#0a0a0a" : MUTED,
                    fontWeight: active ? 600 : 500,
                    border: "none", cursor: "pointer",
                  }}
                >
                  {label}
                  {label === "Annual" && (
                    <span style={{ background: "rgba(74,222,128,0.18)", color: GREEN, fontSize: 10, padding: "2px 6px", borderRadius: 999, fontWeight: 600 }}>Save 17%</span>
                  )}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-12">
          {plans.map((p) => (
            <div
              key={p.name}
              className="relative"
              style={{
                background: CARD,
                border: `1px solid ${p.popular ? BLUE : CARD_BORDER}`,
                borderRadius: 12,
                padding: 32,
                boxShadow: p.popular ? "0 0 40px -10px rgba(37,99,235,0.4)" : "none",
              }}
            >
              {p.popular && (
                <div className="absolute left-1/2" style={{ top: -14, transform: "translateX(-50%)", background: BLUE, color: "white", fontSize: 11, fontWeight: 600, padding: "4px 14px", borderRadius: 999, letterSpacing: "0.04em" }}>
                  Most popular
                </div>
              )}
              <div style={{ fontSize: 14, color: MUTED, letterSpacing: "0.08em", fontWeight: 500 }}>{p.name}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span style={{ fontSize: 48, fontWeight: 800, color: "white", lineHeight: 1 }}>${annual ? p.annual : p.monthly}</span>
                <span style={{ color: MUTED, fontSize: 18 }}>/{annual ? "yr" : "mo"}</span>
              </div>
              <div className="mt-1" style={{ fontSize: 13, color: MUTED }}>{p.tag}</div>
              <div className="mt-2" style={{ fontSize: 14, color: MUTED }}>{p.sub}</div>
              <div style={{ height: 1, background: CARD_BORDER, margin: "20px 0" }} />
              <ul className="space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 items-start" style={{ fontSize: 14, color: "white" }}>
                    <Check size={16} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {p.popular ? (
                  <BlueButton onClick={onCTA} full>Start free</BlueButton>
                ) : (
                  <button
                    onClick={onCTA}
                    style={{
                      background: BTN_NAVY, color: "white", borderRadius: 999,
                      padding: "12px 24px", fontSize: 14, fontWeight: 500,
                      border: `1px solid ${BTN_NAVY_BORDER}`, width: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      cursor: "pointer", transition: "background 200ms ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1f3060")}
                    onMouseLeave={e => (e.currentTarget.style.background = BTN_NAVY)}
                  >
                    Start free <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
              <div className="text-center mt-3" style={{ fontSize: 12, color: "#555" }}>
                14-day trial · No card required
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ============ AUTH ============
function AuthPanel({ tab, setTab }: { tab: "signup" | "signin"; setTab: (t: "signup" | "signin") => void }) {
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
        redirectTo: window.location.origin + "/",
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
      options: { emailRedirectTo: window.location.origin + "/" },
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
    <section id="auth-panel" className="px-5 py-24" style={{ scrollMarginTop: 80 }}>
      <div className="mx-auto" style={{ maxWidth: 480 }}>
        <div className="text-center mb-8">
          <SectionPill>GET STARTED</SectionPill>
          <h2 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", fontWeight: 700, color: "white", lineHeight: 1.1, margin: 0 }}>
            Start your free trial today.
          </h2>
        </div>
        <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 40 }}>
          {/* Tabs */}
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

        {/* DEV BYPASS */}
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
    </section>
  );
}

// ============ WAITLIST ============
function WaitlistStrip() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading"); setMsg("");
    const { error } = await supabase.from("waitlist").insert({ email, source: "landing" });
    if (error) {
      setStatus("error");
      setMsg(/duplicate|unique/i.test(error.message) ? "You're already on the list." : error.message);
    } else {
      setStatus("done");
      setMsg("You're on the list. We'll reach out soon.");
      setEmail("");
    }
  };

  return (
    <section className="px-5 pb-12">
      <div className="mx-auto" style={{ maxWidth: 480, background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>Not ready yet? Join the waitlist.</div>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mt-3">
          <input
            type="email" required placeholder="your@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 outline-none"
            style={{ background: BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 8, padding: "10px 14px", height: 40, fontSize: 13, color: "white" }}
          />
          <button type="submit" disabled={status === "loading"} style={{ background: BTN_NAVY, color: "white", border: `1px solid ${BTN_NAVY_BORDER}`, borderRadius: 8, padding: "0 18px", height: 40, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {status === "loading" ? "…" : "Join waitlist →"}
          </button>
        </form>
        {msg && <div className="mt-3 text-xs" style={{ color: status === "done" ? GREEN : "#fca5a5" }}>{msg}</div>}
      </div>
    </section>
  );
}

// ============ FOOTER ============
function Footer() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("waitlist").insert({ email, source: "footer-newsletter" });
    setDone(true); setEmail("");
  };
  return (
    <footer style={{ background: NAVY, borderTop: `1px solid #1a2a3a`, marginTop: 40 }}>
      <div className="mx-auto px-5 md:px-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10" style={{ maxWidth: 1200, padding: "60px 20px 40px" }}>
        {/* COL 1 */}
        <div className="sm:col-span-2 md:col-span-1" style={{ flexBasis: "35%" }}>
          <VisiLogo size={28} showWordmark />
          <p className="mt-4" style={{ fontSize: 14, color: MUTED, maxWidth: 260, lineHeight: 1.5 }}>
            VisiOS — Your tech stack. One OS. One subscription.
          </p>
          <div style={{ marginTop: 24, color: "white", fontSize: 14, fontWeight: 500 }}>Join our newsletter</div>
          <form onSubmit={subscribe} className="mt-3 flex gap-2" style={{ maxWidth: 320 }}>
            <input
              type="email" required placeholder="name@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 outline-none"
              style={{ background: BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "white" }}
            />
            <button type="submit" style={{ background: BTN_NAVY, color: "white", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 500, border: `1px solid ${BTN_NAVY_BORDER}`, cursor: "pointer" }}>
              Subscribe
            </button>
          </form>
          {done && <div className="mt-2 text-xs" style={{ color: GREEN }}>Subscribed ✓</div>}
        </div>

        <FooterCol title="Links" links={[
          ["Features", "#features"], ["Pricing", "#pricing"],
          ["For Teams", "#features"], ["Changelog", "/changelog"], ["Roadmap", "/roadmap"],
        ]} />
        <FooterCol title="Pages" links={[
          ["Home", "/"], ["About", "/about"], ["Blog", "/blog"],
          ["Contact", "mailto:myke@uwazi.ai"], ["404", "/does-not-exist"],
        ]} />
        <FooterCol title="Socials" links={[
          ["Instagram", "https://instagram.com"],
          ["LinkedIn", "https://linkedin.com"],
          ["Twitter/X", "https://twitter.com/mykeshaw36"],
        ]} />
      </div>
      <div style={{ borderTop: `1px solid #1a2a3a` }}>
        <div className="mx-auto px-5 md:px-20 flex flex-col sm:flex-row justify-between items-center gap-2" style={{ maxWidth: 1200, padding: "24px 20px", fontSize: 14, color: "#555" }}>
          <div>© 2026 VisiOS · Built by Uwazi.AI</div>
          <div>Made with <span style={{ color: BLUE }}>✦</span> Vision</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "white", letterSpacing: "0.08em", marginBottom: 16 }}>{title}</div>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("/") ? (
              <Link to={href} className="footer-link" style={{ fontSize: 14, color: MUTED }}>{label}</Link>
            ) : (
              <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="footer-link" style={{ fontSize: 14, color: MUTED }}>{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Landing;
