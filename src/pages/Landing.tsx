import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { VisiLogo } from "@/components/visi/Logo";
import {
  Menu, X, Eye, MessageSquare, CheckSquare, Mail,
  Clock, Zap, Star, ChevronDown,
} from "lucide-react";

const BG = "#02020A";
const BLUE = "#2563EB";
const GREEN = "#22C55E";
const BORDER = "#1a1a2e";
const CARD = "#0d0d14";
const MUTED = "#6b7280";
const MUTED2 = "#9ca3af";

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
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const mono: React.CSSProperties = { fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", letterSpacing: "0.1em" };
const display: React.CSSProperties = { fontFamily: "var(--font-display, 'Monument Extended', sans-serif)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 };
const body: React.CSSProperties = { fontFamily: "var(--font-body, 'Garet', sans-serif)" };

function scrollToAuth(tab: "signup" | "signin", setTab: (t: "signup" | "signin") => void) {
  setTab(tab);
  const el = document.getElementById("auth-panel");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

const Landing = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [authTab, setAuthTab] = useState<"signup" | "signin">(
    params.get("tab") === "signup" || params.get("signup") !== null ? "signup" : "signin"
  );
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [session, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: BG, color: "white", minHeight: "100vh", ...body }}>
      {/* NAV */}
      <nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 64,
          borderBottom: `1px solid ${scrolled ? BORDER : "transparent"}`,
          background: scrolled ? "rgba(2,2,10,0.7)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          transition: "all 200ms",
        }}
      >
        <div className="mx-auto flex h-full items-center justify-between px-5 md:px-8" style={{ maxWidth: 1200 }}>
          <Link to="/" className="flex items-center"><VisiLogo size={28} showWordmark /></Link>
          <div className="hidden md:flex items-center gap-7" style={{ fontSize: 13, color: MUTED2 }}>
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#features" className="hover:text-white transition">For Teams</a>
            <Link to="/changelog" className="hover:text-white transition">Changelog</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => scrollToAuth("signin", setAuthTab)} className="text-sm text-white/80 hover:text-white transition px-3 py-2">
              Sign in
            </button>
            <button
              onClick={() => scrollToAuth("signup", setAuthTab)}
              className="text-sm font-medium px-4 py-2 rounded-lg transition hover:brightness-110"
              style={{ background: BLUE, color: "white" }}
            >
              Get started free →
            </button>
          </div>
          <button className="md:hidden p-2" onClick={() => setNavOpen(true)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* MOBILE NAV OVERLAY */}
      {navOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col" style={{ background: BG }}>
          <div className="flex items-center justify-between h-16 px-5" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <VisiLogo size={28} showWordmark />
            <button onClick={() => setNavOpen(false)} className="p-2" aria-label="Close"><X size={22} /></button>
          </div>
          <div className="flex flex-col gap-6 p-8 text-lg">
            {[
              { l: "Features", h: "#features" },
              { l: "Pricing", h: "#pricing" },
              { l: "For Teams", h: "#features" },
              { l: "Changelog", h: "/changelog" },
            ].map((i) =>
              i.h.startsWith("/") ? (
                <Link key={i.l} to={i.h} onClick={() => setNavOpen(false)} className="text-white/80">{i.l}</Link>
              ) : (
                <a key={i.l} href={i.h} onClick={() => setNavOpen(false)} className="text-white/80">{i.l}</a>
              )
            )}
            <div className="h-px my-2" style={{ background: BORDER }} />
            <button
              onClick={() => { setNavOpen(false); scrollToAuth("signin", setAuthTab); }}
              className="text-left text-white/80 py-2"
            >Sign in</button>
            <button
              onClick={() => { setNavOpen(false); scrollToAuth("signup", setAuthTab); }}
              className="text-sm font-medium px-4 py-3 rounded-lg" style={{ background: BLUE }}
            >Get started free →</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="relative flex items-center justify-center px-5" style={{ minHeight: "100vh", paddingTop: 96 }}>
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
            background: "radial-gradient(60% 50% at 50% 35%, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0) 70%)",
            animation: "pulseGlow 8s ease-in-out infinite",
          }}
        />
        <style>{`@keyframes pulseGlow { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

        <div className="relative z-10 text-center" style={{ maxWidth: 800 }}>
          <div className="inline-block px-3 py-1.5 rounded-full mb-8" style={{ background: "rgba(37,99,235,0.10)", border: `1px solid rgba(37,99,235,0.30)` }}>
            <span style={{ ...mono, fontSize: 11, color: BLUE }}>✦ THE AI-NATIVE TEAM OS</span>
          </div>
          <h1 style={{ ...display, fontSize: "clamp(42px, 7vw, 72px)", color: "white" }}>
            Your tech stack.<br />
            <span style={{ color: BLUE }}>/</span> One OS.
          </h1>
          <p className="mx-auto mt-6" style={{ fontSize: 18, color: MUTED, maxWidth: 520, lineHeight: 1.55 }}>
            Replace Slack, Asana, Notion, Calendly, and Motion with one AI-powered workspace.
            Vision, your AI Chief of Staff, keeps your whole team aligned — automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <button
              onClick={() => scrollToAuth("signup", setAuthTab)}
              className="px-6 py-3 rounded-lg font-medium hover:brightness-110 transition"
              style={{ background: BLUE, color: "white", fontSize: 14 }}
            >Start free — 14 days →</button>
            <a
              href="#how-it-works"
              className="px-6 py-3 rounded-lg font-medium transition hover:bg-white/5"
              style={{ border: `1px solid ${BORDER}`, color: "white", fontSize: 14 }}
            >See how it works ↓</a>
          </div>

          <div className="flex items-center justify-center gap-3 mt-10">
            <div className="flex -space-x-2">
              {["#3B82F6", "#22C55E", "#EF4444", "#F59E0B", "#A855F7"].map((c, i) => (
                <div key={i} style={{ background: c, width: 28, height: 28, borderRadius: 999, border: `2px solid ${BG}` }} />
              ))}
            </div>
            <div className="text-left">
              <div style={{ fontSize: 12, color: MUTED2 }}>200+ founders already building on VisiOS</div>
              <div className="flex items-center gap-1" style={{ fontSize: 11, color: MUTED }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={11} fill="#F59E0B" stroke="#F59E0B" />)}
                <span className="ml-1">5.0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REPLACES STRIP */}
      <section className="px-5 py-12">
        <div className="text-center" style={{ ...mono, fontSize: 11, color: "#4b5563" }}>
          ONE SUBSCRIPTION REPLACES
        </div>
        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 overflow-x-auto" style={{ maxWidth: 900 }}>
          {[
            ["S", "Slack"], ["A", "Asana"], ["N", "Notion"],
            ["C", "Calendly"], ["M", "Motion"], ["L", "Loom"],
          ].map(([i, name]) => (
            <div key={name} className="relative flex items-center gap-2" style={{ color: MUTED }}>
              <div
                className="flex items-center justify-center font-bold"
                style={{ width: 28, height: 28, borderRadius: 6, background: "#1f2937", color: "#9ca3af", fontSize: 13 }}
              >{i}</div>
              <span style={{ fontSize: 14 }}>{name}</span>
              <div className="absolute left-0 right-0 top-1/2" style={{ height: 1, background: "rgba(239,68,68,0.5)", transform: "rotate(-8deg)" }} />
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="px-5 py-24">
        <div className="mx-auto" style={{ maxWidth: 1100 }}>
          <div className="text-center mb-12">
            <div style={{ ...mono, fontSize: 11, color: BLUE }}>THE PLATFORM</div>
            <h2 className="mt-3" style={{ ...display, fontSize: "clamp(32px, 5vw, 48px)" }}>
              Everything your team needs.<br />Nothing you don't.
            </h2>
          </div>
          <div id="features" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Eye, title: "Vision AI Chief of Staff", desc: "Morning briefs, blocker alerts, and sprint summaries — delivered before you ask." },
              { icon: MessageSquare, title: "Team Chat", desc: "Real-time channels + DMs. Vision summarizes long threads so no one misses context." },
              { icon: CheckSquare, title: "Tasks + Projects", desc: "List, board, and timeline views. Vision flags what's overdue and blocked — automatically." },
              { icon: Mail, title: "Unified Inbox", desc: "Gmail synced and AI-triaged. Vision drafts replies and surfaces what matters." },
              { icon: Clock, title: "Calendar + Bookings", desc: "Google Calendar synced. Booking links built in. Cancel your Calendly subscription." },
              { icon: Zap, title: "Agents (Automations)", desc: "Make.com-powered workflows inside VisiOS. Build once, let it run." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group p-6 transition-all duration-200 hover:-translate-y-1"
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = BLUE)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
              >
                <Icon size={20} style={{ color: BLUE }} />
                <div className="mt-3 font-semibold" style={{ fontSize: 17 }}>{title}</div>
                <div className="mt-2" style={{ fontSize: 14, color: MUTED2, lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISION SPOTLIGHT */}
      <VisionSpotlight />

      {/* COST COMPARISON */}
      <section className="px-5 py-24" style={{ background: BG }}>
        <div className="mx-auto" style={{ maxWidth: 900 }}>
          <div className="text-center mb-12">
            <div style={{ ...mono, fontSize: 11, color: BLUE }}>THE MATH</div>
            <h2 className="mt-3" style={{ ...display, fontSize: "clamp(28px, 4.5vw, 44px)" }}>
              Stop paying for 6 tools<br />that don't talk to each other.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* LEFT */}
            <div className="p-7" style={{ background: "#1a0a0a", border: "1px solid #3d1515", borderRadius: 14 }}>
              <div className="text-sm font-semibold mb-4" style={{ color: "#fca5a5" }}>What you're paying now</div>
              {[["Slack", "$25/mo"], ["Asana", "$33/mo"], ["Notion", "$24/mo"], ["Calendly", "$20/mo"], ["Motion", "$45/mo"], ["Loom / Fathom", "$25/mo"]].map(([n, p]) => (
                <div key={n} className="flex justify-between py-2" style={{ fontSize: 14, color: "#e5e7eb" }}>
                  <span>{n}</span><span style={{ color: MUTED2 }}>{p}</span>
                </div>
              ))}
              <div className="h-px my-3" style={{ background: "#3d1515" }} />
              <div className="flex justify-between font-semibold" style={{ fontSize: 16 }}>
                <span>Total:</span><span style={{ color: "#fca5a5" }}>$172–$250/mo</span>
              </div>
              <div className="mt-4 text-xs" style={{ color: "#9b6b6b" }}>And they still don't talk to each other.</div>
            </div>
            {/* RIGHT */}
            <div className="p-7 relative" style={{ background: "#0a0f1a", border: "1px solid #1a2d4a", borderRadius: 14, boxShadow: "0 0 40px -10px rgba(37,99,235,0.4)" }}>
              <div className="text-sm font-semibold mb-4" style={{ color: "#93c5fd" }}>What you pay with VisiOS</div>
              {["Team Chat", "Tasks + Projects", "Email (AI-triaged)", "Calendar + Bookings", "Automations", "Vision AI CoS"].map((n) => (
                <div key={n} className="flex justify-between py-2" style={{ fontSize: 14, color: "#e5e7eb" }}>
                  <span>{n}</span><span style={{ color: GREEN }}>✓ included</span>
                </div>
              ))}
              <div className="h-px my-3" style={{ background: "#1a2d4a" }} />
              <div className="flex justify-between font-semibold" style={{ fontSize: 16 }}>
                <span>Team plan:</span><span style={{ color: "#93c5fd" }}>$79/mo</span>
              </div>
              <div className="mt-4 inline-block px-3 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: GREEN, fontSize: 12, fontWeight: 600 }}>
                Save $90–170/mo
              </div>
              <button
                onClick={() => scrollToAuth("signup", setAuthTab)}
                className="block w-full mt-5 py-3 rounded-lg font-medium hover:brightness-110 transition"
                style={{ background: BLUE, fontSize: 14 }}
              >Start your 14-day free trial →</button>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection onCTA={() => scrollToAuth("signup", setAuthTab)} />

      {/* AUTH PANEL */}
      <AuthPanel tab={authTab} setTab={setAuthTab} />

      {/* WAITLIST */}
      <WaitlistStrip />

      {/* FOOTER */}
      <Footer />
    </div>
  );
};

function VisionSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && step === 0) {
        setStep(1);
        setTimeout(() => setStep(2), 1200);
        setTimeout(() => setStep(3), 3500);
        setTimeout(() => setStep(4), 4500);
      }
    }, { threshold: 0.4 });
    obs.observe(el); return () => obs.disconnect();
  }, [step]);

  return (
    <section ref={ref} className="px-5 py-24" style={{ background: CARD }}>
      <div className="mx-auto" style={{ maxWidth: 700 }}>
        <div style={{ ...mono, fontSize: 11, color: BLUE }}>✦ MEET VISION</div>
        <h2 className="mt-3" style={{ ...display, fontSize: "clamp(32px, 5vw, 48px)" }}>
          Your AI Chief of Staff.<br />Always on.
        </h2>
        <p className="mt-5" style={{ fontSize: 16, color: MUTED2, lineHeight: 1.6 }}>
          Vision isn't a chatbot. It's an operating layer that runs across your entire workspace —
          tasks, calendar, inbox, and team chat — and tells you what matters before you have to ask.
        </p>

        <div className="mt-10 p-6 space-y-3" style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, minHeight: 320 }}>
          {step >= 1 && (
            <div className="flex justify-end" style={{ animation: "fadeUp 300ms ease" }}>
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl" style={{ background: "#1f2937", fontSize: 14 }}>Good morning Vision</div>
            </div>
          )}
          {step >= 2 && (
            <div className="flex gap-2 items-start" style={{ animation: "fadeUp 300ms ease" }}>
              <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(37,99,235,0.15)", color: BLUE, flexShrink: 0 }}>✦</div>
              <div className="max-w-[85%] px-4 py-3 rounded-2xl whitespace-pre-line" style={{ background: "#0f172a", fontSize: 14, lineHeight: 1.6 }}>
                {`Good morning. Here's your 8am brief:

• 3 tasks are overdue in the Design sprint
• Anna hasn't checked in since Tuesday — worth a ping
• You have back-to-back meetings at 2pm — want me to suggest a reschedule?
• Team velocity this week: 📈 up 22%`}
                {step === 2 && <span style={{ display: "inline-block", width: 7, height: 14, background: BLUE, marginLeft: 2, animation: "blink 1s steps(1) infinite", verticalAlign: "text-bottom" }} />}
              </div>
            </div>
          )}
          {step >= 3 && (
            <div className="flex justify-end" style={{ animation: "fadeUp 300ms ease" }}>
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl" style={{ background: "#1f2937", fontSize: 14 }}>What's blocking the design sprint?</div>
            </div>
          )}
          {step >= 4 && (
            <div className="flex gap-2 items-start" style={{ animation: "fadeUp 300ms ease" }}>
              <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(37,99,235,0.15)", color: BLUE, flexShrink: 0 }}>✦</div>
              <div className="max-w-[85%] px-4 py-3 rounded-2xl" style={{ background: "#0f172a", fontSize: 14, lineHeight: 1.6 }}>
                Two tasks are blocked waiting on feedback from the client. I've flagged them for Anna to follow up today.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ onCTA }: { onCTA: () => void }) {
  const [annual, setAnnual] = useState(false);
  const plans = [
    {
      name: "SOLO", monthly: 29, annual: 290,
      tag: "1 user · 1 workspace",
      sub: "For independent founders and solopreneurs",
      features: ["Vision AI (100 msgs/mo)", "Tasks + Calendar + Inbox", "Knowledge Base (50 docs)", "Contacts (500)", "Bookings link", "14-day free trial"],
    },
    {
      name: "TEAM", monthly: 79, annual: 790, popular: true,
      tag: "Up to 3 users · unlimited workspaces",
      sub: "For early-stage founding teams",
      features: ["Everything in Solo", "Vision AI (unlimited)", "Team Chat (channels + DMs)", "Meetings + Fathom sync", "Agents (3 active)", "Team productivity dashboard", "+$20/seat after 3 users"],
    },
    {
      name: "GROWTH", monthly: 179, annual: 1790,
      tag: "Up to 8 users · unlimited workspaces",
      sub: "For scaling startups and agencies",
      features: ["Everything in Team", "Agents (unlimited)", "Social + Campaign builder", "Admin controls + permissions", "Custom Vision AI persona", "Priority support", "+$20/seat after 8"],
    },
  ];

  return (
    <section id="pricing" className="px-5 py-24">
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        <div className="text-center mb-10">
          <div style={{ ...mono, fontSize: 11, color: BLUE }}>PRICING</div>
          <h2 className="mt-3" style={{ ...display, fontSize: "clamp(32px, 5vw, 48px)" }}>
            Simple pricing.<br />Serious value.
          </h2>
          <div className="inline-flex items-center gap-1 mt-6 p-1 rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            {(["Monthly", "Annual"] as const).map((label) => {
              const active = (label === "Annual") === annual;
              return (
                <button
                  key={label}
                  onClick={() => setAnnual(label === "Annual")}
                  className="px-4 py-1.5 rounded-full text-sm transition flex items-center gap-2"
                  style={{ background: active ? BLUE : "transparent", color: active ? "white" : MUTED2 }}
                >
                  {label}
                  {label === "Annual" && (
                    <span style={{ background: "rgba(34,197,94,0.2)", color: GREEN, fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 600 }}>Save 17%</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className="p-7 relative"
              style={{
                background: CARD,
                border: `1px solid ${p.popular ? BLUE : BORDER}`,
                borderRadius: 14,
                boxShadow: p.popular ? "0 0 40px -10px rgba(37,99,235,0.4)" : "none",
              }}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full" style={{ background: BLUE, fontSize: 11, fontWeight: 600 }}>
                  Most popular
                </div>
              )}
              <div style={{ ...mono, fontSize: 12, color: BLUE }}>{p.name}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span style={{ ...display, fontSize: 40 }}>${annual ? p.annual : p.monthly}</span>
                <span style={{ color: MUTED, fontSize: 13 }}>/{annual ? "yr" : "mo"}</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: MUTED2 }}>{p.tag}</div>
              <div className="mt-2 text-sm" style={{ color: MUTED2 }}>{p.sub}</div>
              <div className="h-px my-5" style={{ background: BORDER }} />
              <ul className="space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 items-start text-sm" style={{ color: "#e5e7eb" }}>
                    <span style={{ color: GREEN }}>✓</span><span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onCTA}
                className="block w-full mt-6 py-3 rounded-lg font-medium hover:brightness-110 transition"
                style={{ background: p.popular ? BLUE : "transparent", border: p.popular ? "none" : `1px solid ${BORDER}`, color: "white", fontSize: 14 }}
              >Start free →</button>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 text-sm" style={{ color: MUTED }}>
          All plans include a 14-day free trial. No credit card required. Cancel anytime.
        </div>

        <div className="mt-10 p-6" style={{ background: CARD, border: `1px dashed ${BORDER}`, borderRadius: 14 }}>
          <div className="font-semibold" style={{ fontSize: 16 }}>🤝 Building for a community of founders?</div>
          <div className="mt-1 text-sm" style={{ color: MUTED2 }}>
            Ask about Keystone partnership pricing — bulk seats for accelerators, cohorts, and communities.
          </div>
          <a href="mailto:myke@uwazi.ai" className="inline-block mt-3 text-sm font-medium" style={{ color: BLUE }}>
            Contact us about partnerships →
          </a>
        </div>
      </div>
    </section>
  );
}

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

  const inputCls = "w-full px-3.5 rounded-lg outline-none transition";
  const inputStyle: React.CSSProperties = {
    background: BG, border: `1px solid ${BORDER}`, height: 44, fontSize: 14, color: "white",
  };

  return (
    <section id="auth-panel" className="px-5 py-20" style={{ scrollMarginTop: 80 }}>
      <div className="mx-auto" style={{ maxWidth: 480 }}>
        <div className="p-8 sm:p-10" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
          {/* Tabs */}
          <div className="flex gap-6 mb-7" style={{ borderBottom: `1px solid ${BORDER}` }}>
            {(["signup", "signin"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setInfo(null); }}
                className="pb-3 transition relative"
                style={{
                  color: tab === t ? "white" : MUTED,
                  fontSize: 14, fontWeight: 600,
                  borderBottom: tab === t ? `2px solid ${BLUE}` : "2px solid transparent",
                  marginBottom: -1,
                }}
              >{t === "signup" ? "Sign up" : "Sign in"}</button>
            ))}
          </div>

          {tab === "signup" ? (
            <>
              <h3 style={{ ...display, fontSize: 24 }}>Start your free 14-day trial</h3>
              <div className="mt-1 text-sm" style={{ color: MUTED2 }}>No credit card required.</div>
            </>
          ) : (
            <>
              <h3 style={{ ...display, fontSize: 24 }}>Welcome back.</h3>
              <div className="mt-1 text-sm" style={{ color: MUTED2 }}>Sign in to your workspace.</div>
            </>
          )}

          <button
            onClick={onGoogle}
            disabled={loading}
            className="w-full mt-6 flex items-center justify-center gap-2 rounded-lg transition hover:bg-white/90"
            style={{ background: "white", color: "#111", height: 44, fontSize: 14, fontWeight: 500 }}
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5" style={{ color: MUTED, fontSize: 11 }}>
            <div className="flex-1 h-px" style={{ background: BORDER }} />
            <span>or</span>
            <div className="flex-1 h-px" style={{ background: BORDER }} />
          </div>

          {tab === "signup" ? (
            <form onSubmit={onSignUp} className="flex flex-col gap-3">
              <input type="email" required placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
              <div className="relative">
                <input type={showPw ? "text" : "password"} required minLength={6} placeholder="Create password" value={pw} onChange={e => setPw(e.target.value)} className={inputCls} style={inputStyle} />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED }}>
                  {showPw ? "hide" : "show"}
                </button>
              </div>
              <input type="password" required minLength={6} placeholder="Confirm password" value={pw2} onChange={e => setPw2(e.target.value)} className={inputCls} style={inputStyle} />
              <button type="submit" disabled={loading} className="w-full rounded-lg font-medium hover:brightness-110 transition" style={{ background: BLUE, height: 44, fontSize: 14 }}>
                {loading ? "Creating…" : "Create account →"}
              </button>
              <div className="text-xs mt-1" style={{ color: MUTED }}>
                By signing up you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </div>
            </form>
          ) : (
            <form onSubmit={onSignIn} className="flex flex-col gap-3">
              <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
              <div className="relative">
                <input type={showPw ? "text" : "password"} required placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} className={inputCls} style={inputStyle} />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: MUTED }}>
                  {showPw ? "hide" : "show"}
                </button>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={onForgot} className="text-xs" style={{ color: BLUE }}>Forgot password?</button>
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-lg font-medium hover:brightness-110 transition" style={{ background: BLUE, height: 44, fontSize: 14 }}>
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>
          )}

          {error && <div className="mt-4 text-xs" style={{ color: "#fca5a5" }}>{error}</div>}
          {info && <div className="mt-4 text-xs" style={{ color: GREEN }}>{info}</div>}

          <div className="mt-6 text-center text-xs" style={{ color: MUTED2 }}>
            {tab === "signup" ? (
              <>Already have an account?{" "}
                <button onClick={() => setTab("signin")} style={{ color: BLUE }}>Sign in →</button></>
            ) : (
              <>Don't have an account?{" "}
                <button onClick={() => setTab("signup")} style={{ color: BLUE }}>Start for free →</button></>
            )}
          </div>
        </div>

        {/* DEV BYPASS */}
        <div className="mt-4">
          <button
            onClick={() => setDevOpen(o => !o)}
            className="flex items-center gap-2 mx-auto text-xs"
            style={{ ...mono, color: MUTED, opacity: 0.6 }}
          >
            <ChevronDown size={12} style={{ transform: devOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }} />
            DEV BYPASS
          </button>
          {devOpen && (
            <form onSubmit={onDev} className="mt-3 flex flex-col gap-2 mx-auto" style={{ maxWidth: 360 }}>
              <input type="email" required placeholder="email@dev.local" value={devEmail} onChange={e => setDevEmail(e.target.value)} className={inputCls} style={{ ...inputStyle, height: 38, fontSize: 12 }} />
              <input type="password" required minLength={6} placeholder="password (min 6 chars)" value={devPw} onChange={e => setDevPw(e.target.value)} className={inputCls} style={{ ...inputStyle, height: 38, fontSize: 12 }} />
              <button type="submit" disabled={loading} className="w-full rounded-lg font-medium" style={{ background: BLUE, height: 38, fontSize: 12 }}>
                Sign in / Sign up
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

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
    <section className="px-5 pb-20">
      <div className="mx-auto p-6" style={{ maxWidth: 480, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
        <div className="text-sm font-semibold">Not ready yet? Join the waitlist.</div>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mt-3">
          <input
            type="email" required placeholder="your@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 px-3 rounded-lg outline-none"
            style={{ background: BG, border: `1px solid ${BORDER}`, height: 40, fontSize: 13, color: "white" }}
          />
          <button type="submit" disabled={status === "loading"} className="px-4 rounded-lg font-medium hover:brightness-110 transition" style={{ background: BLUE, height: 40, fontSize: 13 }}>
            {status === "loading" ? "…" : "Join waitlist →"}
          </button>
        </form>
        {msg && <div className="mt-3 text-xs" style={{ color: status === "done" ? GREEN : "#fca5a5" }}>{msg}</div>}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${BORDER}` }}>
      <div className="mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-8" style={{ maxWidth: 1200 }}>
        <div className="col-span-2 md:col-span-1">
          <VisiLogo size={28} showWordmark />
          <p className="mt-4 text-sm" style={{ color: MUTED2, maxWidth: 240 }}>
            The AI-native team OS for founders and small teams.
          </p>
          <div className="flex gap-3 mt-4 text-xs" style={{ color: MUTED }}>
            <a href="https://twitter.com/mykeshaw36" target="_blank" rel="noreferrer" className="hover:text-white">Twitter</a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-white">LinkedIn</a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a>
          </div>
        </div>
        <FooterCol title="Product" links={[
          ["Features", "#features"], ["Pricing", "#pricing"],
          ["Changelog", "/changelog"], ["Roadmap", "/roadmap"],
        ]} />
        <FooterCol title="Company" links={[
          ["About", "/about"], ["Blog", "/blog"],
          ["Partnerships", "mailto:myke@uwazi.ai"], ["Contact", "mailto:myke@uwazi.ai"],
        ]} />
        <FooterCol title="Legal" links={[
          ["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"],
        ]} />
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto px-5 py-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs" style={{ maxWidth: 1200, color: MUTED }}>
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
      <div className="text-xs font-semibold mb-3" style={{ ...mono, color: "white" }}>{title.toUpperCase()}</div>
      <ul className="space-y-2 text-sm" style={{ color: MUTED2 }}>
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("/") ? (
              <Link to={href} className="hover:text-white transition">{label}</Link>
            ) : (
              <a href={href} className="hover:text-white transition">{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Landing;
