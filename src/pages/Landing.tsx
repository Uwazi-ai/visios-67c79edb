import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { VisiLogo } from "@/components/visi/Logo";
import {
  Menu, X, ArrowUpRight, LayoutDashboard, Sparkles, Coins,
  RefreshCw, EyeOff, Clock, Briefcase, Layers, Users,
  Check, Mail, Calendar, MessageSquare, CheckSquare, BookOpen,
  Zap, Brain, DollarSign, ChevronDown,
} from "lucide-react";

// ============ TOKENS ============
const BG = "#0a0a0a";
const SURFACE = "#111111";
const SURFACE_2 = "#161616";
const BORDER = "#1f1f1f";
const BORDER_2 = "#2a2a2a";
const TEXT = "#f5f5f5";
const MUTED = "#9a9a9a";
const DIM = "#6b6b6b";
const GOLD = "#d4a24c";
const GOLD_SOFT = "rgba(212,162,76,0.12)";
const GOLD_BORDER = "rgba(212,162,76,0.35)";

const SERIF = `'Instrument Serif', 'Times New Roman', serif`;
const SANS = `'DM Sans', system-ui, -apple-system, sans-serif`;

// ============ STAR FIELD ============
function buildStarField(count = 90) {
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 100).toFixed(2);
    const a = (0.15 + rnd() * 0.35).toFixed(2);
    const s = rnd() > 0.9 ? 2 : 1;
    parts.push(`radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${a}) 0%, transparent 100%)`);
  }
  return parts.join(",");
}

// ============ REVEAL ============
function Reveal({ children, delay = 0, as: As = "div", style }: { children: React.ReactNode; delay?: number; as?: any; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <As ref={ref} style={{
      ...style,
      opacity: shown ? 1 : 0,
      transform: shown ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 600ms ease ${delay}ms, transform 600ms ease ${delay}ms`,
    }}>{children}</As>
  );
}

// ============ UI PRIMITIVES ============
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`,
      color: GOLD, borderRadius: 999, padding: "6px 14px",
      fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      fontFamily: SANS,
    }}>{children}</span>
  );
}

function GoldButton({ onClick, children, large = false }: { onClick?: () => void; children: React.ReactNode; large?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: GOLD, color: "#1a1000", borderRadius: 8,
        padding: large ? "16px 28px" : "12px 22px",
        fontSize: large ? 15 : 14, fontWeight: 600,
        border: "none", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: SANS,
        transition: "all 200ms ease",
        boxShadow: "0 6px 24px rgba(212,162,76,0.25)",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px) scale(1.02)"; e.currentTarget.style.background = "#e6b25a"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.background = GOLD; }}
    >
      {children} <ArrowUpRight size={16} />
    </button>
  );
}

function OutlineButton({ onClick, children, large = false }: { onClick?: () => void; children: React.ReactNode; large?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", color: TEXT, borderRadius: 8,
        padding: large ? "16px 28px" : "12px 22px",
        fontSize: large ? 15 : 14, fontWeight: 500,
        border: `1px solid ${BORDER_2}`, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: SANS, transition: "all 200ms ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD_BORDER; e.currentTarget.style.background = GOLD_SOFT; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER_2; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

function Card({ children, style, hover = true }: { children: React.ReactNode; style?: React.CSSProperties; hover?: boolean }) {
  return (
    <div
      style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
        padding: 28, transition: "all 250ms ease", ...style,
      }}
      onMouseEnter={hover ? (e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = GOLD_BORDER; }) : undefined}
      onMouseLeave={hover ? (e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = BORDER; }) : undefined}
    >
      {children}
    </div>
  );
}

function H2({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h2 style={{
    fontFamily: SERIF, fontSize: "clamp(36px, 5vw, 56px)",
    fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.02em",
    color: TEXT, margin: 0, ...style,
  }}>{children}</h2>;
}

function Sub({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{
    fontFamily: SANS, fontSize: 17, lineHeight: 1.6, color: MUTED,
    margin: "20px 0 0", maxWidth: 680, ...style,
  }}>{children}</p>;
}

// ============ DATA ============
const TOOLS = [
  { name: "Gmail + Calendar", cost: "$8–14 /user/mo" },
  { name: "Asana", cost: "$10–25 /user/mo" },
  { name: "Notion", cost: "$10 /user/mo" },
  { name: "Slack", cost: "$8–12.5 /user/mo" },
  { name: "Jira + Confluence", cost: "$7 /user/mo" },
  { name: "HubSpot", cost: "$50–300 /mo" },
  { name: "QuickBooks", cost: "$180–880 /yr" },
  { name: "Make.com", cost: "$99+ /mo" },
  { name: "Fathom", cost: "$20 /mo" },
];

const PILLARS = [
  {
    icon: LayoutDashboard, title: "Unified Visibility",
    body: "All organizations, projects, teams, finance—one dashboard. See what matters at a glance; drill into detail when you need to. No switching. No context loss.",
    bullets: ["Multi-org dashboards", "Real-time project status", "Team capacity across contexts", "Cash, margin, and health in one view"],
  },
  {
    icon: Sparkles, title: "AI-Powered Intelligence",
    body: "Vision Chief of Staff surfaces risks, opportunities, and decisions you'd miss manually. Writes briefs from raw data. Org-aware. Speeds up decisions by 10x.",
    bullets: ["Vision reads full business context", "Daily and weekly briefs", "Org-specific insights", "No more manual report-gathering"],
  },
  {
    icon: Coins, title: "Cost Consolidation",
    body: "Replace 8 tools with 1. Save $200–400 per person per month. Simplify contracts, billing, security, and onboarding.",
    bullets: ["Cut SaaS spend by 40%", "One vendor relationship", "Unified security & compliance", "Faster onboarding"],
  },
];

const SEGMENTS = [
  {
    icon: Briefcase, tag: "Startup Founders",
    title: "The Operating System for Founders Wearing Multiple Hats",
    sub: "One dashboard. Your UWAZI strategy, Black Innovators Network ops, Culture Club client work—all visible, all managed, all intelligent.",
    benefits: ["See everything at a glance", "Vision AI writes briefs, flags risks", "2 hours/week on admin instead of 10", "Pay for one tool instead of eight"],
    quote: "I went from 10 windows to 1 dashboard. That alone changed how fast we move.",
    cta: "Start your unified ops today",
  },
  {
    icon: Layers, tag: "Serial Entrepreneurs",
    title: "Build Your Founder's Operating System",
    sub: "Manage UWAZI, BIN, and Culture Club from one place. One login. One source of truth. Org-scoped AI that knows the context of each company.",
    benefits: ["Multi-org architecture", "Portfolio view", "Unified hiring, finance, strategy", "Consolidate 8+ tools per org", "Org-aware Vision AI"],
    quote: "Managing 3 companies used to mean 24 separate logins. Now it's one.",
    cta: "Build your portfolio OS",
  },
  {
    icon: Users, tag: "Client-Based Service Orgs",
    title: "One Platform for Every Client, Every Project, Every Team",
    sub: "Culture Club manages client work, internal ops, and team bandwidth—all visible, all unified, all profitable.",
    benefits: ["Client-scoped workspaces", "Real-time margin visibility", "Team capacity across clients", "Unified CRM + PM + finance", "Intelligence flags margin killers"],
    quote: "Our margins are no longer invisible. We see project profitability in real time.",
    cta: "See your client business clearly",
  },
];

const FEATURES = [
  { icon: LayoutDashboard, label: "Dashboard & Overview" },
  { icon: CheckSquare, label: "Projects & Tasks" },
  { icon: Users, label: "Team & People" },
  { icon: DollarSign, label: "Finance & Cash" },
  { icon: BookOpen, label: "Knowledge Base" },
  { icon: MessageSquare, label: "Communication" },
  { icon: Zap, label: "Automation" },
  { icon: Brain, label: "Vision AI Chief of Staff" },
];

const TESTIMONIALS = [
  { quote: "I went from logging into 8 tools to 1 dashboard. That alone changed how fast we move.", name: "Founder, 5-person team", org: "UWAZI.AI", color: "#2563EB" },
  { quote: "Managing UWAZI, BIN, and Culture Club used to mean 8 logins per org. Now it's one login for all three.", name: "Myke Shaw", org: "Serial Entrepreneur", color: GOLD },
  { quote: "Our margins are no longer invisible. We see project profitability in real time.", name: "Agency Founder", org: "20-person team", color: "#22C55E" },
  { quote: "One platform eliminated 40% of our SaaS spend and gave our team 5 hours back per week.", name: "Operations Lead", org: "Service Org", color: "#EF4444" },
];

const FAQS = [
  { q: "Is this just Asana plus a spreadsheet?", a: "No. VisiOS is a unified operating system that consolidates your entire stack—projects, people, finance, comms, and intelligence—in one place." },
  { q: "Can we still use our existing tools?", a: "Yes. We integrate with Gmail, Google Calendar, Slack, and more. You just stop switching between them." },
  { q: "How is the AI better than Claude or ChatGPT?", a: "Vision is org-aware. It reads your business context—projects, contacts, finance, calendar—and writes briefs specific to your operation." },
  { q: "Is VisiOS right for my company?", a: "If you're managing multiple organizations or complex projects, yes. If you run one simple project, you probably don't need VisiOS yet." },
  { q: "How long does setup take?", a: "About 20 minutes. Migration is handled. You're operational in 48 hours." },
  { q: "What about security?", a: "Enterprise-grade encryption, SOC 2 aligned, and GDPR-compliant. Your data is scoped per org." },
  { q: "Can we try it first?", a: "Yes. 14-day free trial, full access, no credit card required." },
];

const PLANS = [
  {
    name: "Solo Founder", price: "$29", period: "/mo",
    for: "Solopreneurs and early-stage founders managing 1–2 orgs",
    features: ["1 organization", "Vision AI daily briefs", "All core modules", "Email + calendar sync", "5 GB storage"],
    cta: "Get started", popular: false,
  },
  {
    name: "Founder / Operator", price: "$79", period: "/mo",
    for: "Multi-org founders and serial entrepreneurs",
    features: ["Up to 3 organizations", "Vision daily + weekly briefs", "All modules included", "Slack + Jira integrations", "50 GB storage", "Team capacity planning", "Portfolio dashboard", "Priority support"],
    cta: "Start here", popular: true,
  },
  {
    name: "Team", price: "Custom", period: "",
    for: "Agencies, service orgs, and 10+ person teams",
    features: ["Unlimited organizations", "Advanced permissions", "White-label options", "Custom integrations", "Dedicated onboarding", "SLA support"],
    cta: "Contact sales", popular: false,
  },
];

// ============ MAIN ============
const Landing = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const starField = useMemo(() => buildStarField(90), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  const goSignup = () => navigate("/login?tab=signup");
  const goSignin = () => navigate("/login?tab=signin");
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{
      fontFamily: SANS, color: TEXT, background: BG, minHeight: "100vh",
      backgroundImage: starField, backgroundAttachment: "fixed",
    }}>
      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50, height: 68,
        background: scrolled ? "rgba(10,10,10,0.85)" : "rgba(10,10,10,0.4)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
        transition: "all 250ms ease",
      }}>
        <div className="mx-auto flex h-full items-center justify-between px-5 md:px-8" style={{ maxWidth: 1240 }}>
          <Link to="/" className="flex items-center"><VisiLogo size={28} showWordmark /></Link>
          <div className="hidden md:flex items-center gap-8" style={{ fontSize: 14, color: MUTED }}>
            <a href="#features" style={{ color: MUTED, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>Features</a>
            <a href="#segments" style={{ color: MUTED, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>Who it's for</a>
            <a href="#pricing" style={{ color: MUTED, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>Pricing</a>
            <a href="#faq" style={{ color: MUTED, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>FAQ</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button onClick={goSignin} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 14, cursor: "pointer", fontFamily: SANS }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>Sign in</button>
            <GoldButton onClick={goSignup}>Start free</GoldButton>
          </div>
          <button className="md:hidden" onClick={() => setNavOpen(v => !v)} style={{ background: "transparent", border: "none", color: TEXT }}>
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {navOpen && (
          <div className="md:hidden" style={{ background: BG, borderTop: `1px solid ${BORDER}`, padding: "20px 20px 24px" }}>
            <div className="flex flex-col gap-4" style={{ fontSize: 15, color: MUTED }}>
              <a href="#features" onClick={() => setNavOpen(false)} style={{ color: MUTED, textDecoration: "none" }}>Features</a>
              <a href="#segments" onClick={() => setNavOpen(false)} style={{ color: MUTED, textDecoration: "none" }}>Who it's for</a>
              <a href="#pricing" onClick={() => setNavOpen(false)} style={{ color: MUTED, textDecoration: "none" }}>Pricing</a>
              <a href="#faq" onClick={() => setNavOpen(false)} style={{ color: MUTED, textDecoration: "none" }}>FAQ</a>
              <button onClick={goSignin} style={{ textAlign: "left", background: "transparent", border: "none", color: TEXT, fontSize: 15, padding: 0, fontFamily: SANS }}>Sign in</button>
              <GoldButton onClick={goSignup}>Start free</GoldButton>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", padding: "80px 20px 100px", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -55%)",
          width: 900, height: 900, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,162,76,0.14) 0%, rgba(212,162,76,0.04) 40%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div className="mx-auto text-center" style={{ maxWidth: 900, position: "relative", zIndex: 1 }}>
          <Reveal><Pill>The Operating System for Multi-Org Leaders</Pill></Reveal>
          <Reveal delay={80}>
            <h1 style={{
              fontFamily: SERIF, fontWeight: 400,
              fontSize: "clamp(44px, 7vw, 84px)", lineHeight: 1.02, letterSpacing: "-0.025em",
              margin: "24px 0 0", color: TEXT,
            }}>
              The Operating System<br />
              Built for <em style={{ color: GOLD, fontStyle: "italic" }}>Multi-Org Leaders</em>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p style={{ fontFamily: SANS, fontSize: 19, lineHeight: 1.55, color: MUTED, margin: "28px auto 0", maxWidth: 640 }}>
              Consolidate strategy, projects, people, and finance into one intelligent command center. Replace your tool sprawl. Accelerate decisions. Save money.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: 40 }}>
              <GoldButton onClick={goSignup} large>Start your unified ops journey</GoldButton>
              <OutlineButton onClick={() => scrollTo("features")} large>Watch the demo</OutlineButton>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div className="flex flex-wrap justify-center gap-6" style={{ marginTop: 32, fontSize: 13, color: DIM }}>
              <span>14-day free trial</span>
              <span>·</span>
              <span>No credit card</span>
              <span>·</span>
              <span>Setup in 20 minutes</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: "80px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <Reveal><Pill>The Problem</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Your Stack is <em style={{ color: GOLD, fontStyle: "italic" }}>Costing You</em></H2></Reveal>
          <Reveal delay={160}>
            <Sub>You're paying for 8 tools. Switching between 12 windows. Making decisions from incomplete data. Every founder and service team we've talked to says the same thing: "We're drowning in tools. We're missing signals. We're slow."</Sub>
          </Reveal>

          <Reveal delay={220}>
            <div className="grid gap-3" style={{ marginTop: 48, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {TOOLS.map(t => (
                <div key={t.name} style={{
                  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
                  padding: "18px 20px",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: DIM, marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>{t.cost}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={280}>
            <div style={{
              marginTop: 40, padding: "28px 32px",
              background: `linear-gradient(135deg, ${GOLD_SOFT}, transparent)`,
              border: `1px solid ${GOLD_BORDER}`, borderRadius: 16,
            }}>
              <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, fontWeight: 600 }}>What it really costs</div>
              <div className="grid gap-6 md:grid-cols-3" style={{ marginTop: 20 }}>
                {[
                  { label: "1 person", val: "$300–600", per: "per month" },
                  { label: "5-person team", val: "$1.5k–3k+", per: "per month" },
                  { label: "10-person team", val: "$3k–6k+", per: "per month" },
                ].map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>{x.label}</div>
                    <div style={{ fontFamily: SERIF, fontSize: 36, color: TEXT, marginTop: 4, lineHeight: 1 }}>{x.val}</div>
                    <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>{x.per}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={340}>
            <div className="grid gap-4 md:grid-cols-3" style={{ marginTop: 32 }}>
              {[
                { icon: RefreshCw, title: "Context Switching Kills Momentum", body: "40 minutes per distraction. That's $50K/year in lost founder time." },
                { icon: EyeOff, title: "Margins Are Invisible", body: "Agencies: 5–15% margin leakage. You can't manage what you can't see." },
                { icon: Clock, title: "Decisions Take Hours", body: "Pull from Notion, check Asana, open HubSpot, cross-reference a spreadsheet. Where's the answer?" },
              ].map(p => (
                <Card key={p.title}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
                    <p.icon size={20} />
                  </div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: TEXT, margin: "18px 0 8px", lineHeight: 1.2 }}>{p.title}</h3>
                  <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: 0 }}>{p.body}</p>
                </Card>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* SOLUTION */}
      <section id="solution" style={{ padding: "100px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <Reveal><Pill>The Solution</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>One Platform. One Source of Truth.<br /><em style={{ color: GOLD, fontStyle: "italic" }}>One AI Chief of Staff.</em></H2></Reveal>

          <div className="grid gap-6 md:grid-cols-3" style={{ marginTop: 56 }}>
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <Card style={{ height: "100%" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
                    <p.icon size={22} />
                  </div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: TEXT, margin: "20px 0 10px", lineHeight: 1.15 }}>{p.title}</h3>
                  <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>{p.body}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0" }}>
                    {p.bullets.map(b => (
                      <li key={b} style={{ fontSize: 13, color: TEXT, padding: "8px 0", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
                        <Check size={14} style={{ color: GOLD, flexShrink: 0 }} /> {b}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <div style={{
              marginTop: 40, padding: 32,
              background: SURFACE_2, border: `1px solid ${BORDER}`, borderRadius: 16,
              display: "flex", gap: 20, alignItems: "flex-start",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, flexShrink: 0 }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, fontWeight: 600 }}>Founder Insight</div>
                <p style={{ fontFamily: SERIF, fontSize: 22, color: TEXT, margin: "10px 0 0", lineHeight: 1.4 }}>
                  Context switching costs 40 minutes per distraction. When you're managing multiple organizations, that's <em style={{ color: GOLD }}>$50K/year</em> in lost founder time. VisiOS gives that time back.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SEGMENTS */}
      <section id="segments" style={{ padding: "100px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <Reveal><Pill>Who It's For</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Built for <em style={{ color: GOLD, fontStyle: "italic" }}>Multi-Org Leaders</em></H2></Reveal>

          <div className="grid gap-6" style={{ marginTop: 56 }}>
            {SEGMENTS.map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <Card style={{ padding: 40 }}>
                  <div className="grid gap-8" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                    <div className="md:grid md:grid-cols-[1fr_360px] md:gap-10">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
                            <s.icon size={18} />
                          </div>
                          <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD, fontWeight: 600 }}>{s.tag}</span>
                        </div>
                        <h3 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, color: TEXT, margin: "18px 0 12px", lineHeight: 1.15 }}>{s.title}</h3>
                        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.65, margin: 0, maxWidth: 620 }}>{s.sub}</p>
                        <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 24px", display: "grid", gap: 8 }}>
                          {s.benefits.map(b => (
                            <li key={b} style={{ fontSize: 14, color: TEXT, display: "flex", alignItems: "center", gap: 10 }}>
                              <Check size={14} style={{ color: GOLD, flexShrink: 0 }} /> {b}
                            </li>
                          ))}
                        </ul>
                        <OutlineButton onClick={goSignup}>{s.cta} <ArrowUpRight size={14} /></OutlineButton>
                      </div>
                      <div style={{ marginTop: 28 }} className="md:mt-0">
                        <div style={{
                          background: SURFACE_2, border: `1px solid ${BORDER}`, borderRadius: 14,
                          padding: 24, height: "100%",
                        }}>
                          <div style={{ fontFamily: SERIF, fontSize: 40, color: GOLD, lineHeight: 1 }}>"</div>
                          <p style={{ fontFamily: SERIF, fontSize: 20, color: TEXT, margin: "8px 0 0", lineHeight: 1.4, fontStyle: "italic" }}>{s.quote}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "100px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <Reveal><Pill>Features</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Everything You Need. <em style={{ color: GOLD, fontStyle: "italic" }}>In One Place.</em></H2></Reveal>

          <div className="grid gap-4" style={{ marginTop: 56, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.label} delay={i * 40}>
                <div style={{
                  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14,
                  padding: 24, transition: "all 200ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD_BORDER; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = ""; }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
                    <f.icon size={18} />
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 20, color: TEXT, marginTop: 16, lineHeight: 1.2 }}>{f.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "100px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <Reveal><Pill>Pricing</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Pricing That <em style={{ color: GOLD, fontStyle: "italic" }}>Makes Sense</em></H2></Reveal>

          <div className="grid gap-6 md:grid-cols-3" style={{ marginTop: 56, alignItems: "stretch" }}>
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 100}>
                <div style={{
                  background: p.popular ? `linear-gradient(180deg, ${GOLD_SOFT}, ${SURFACE})` : SURFACE,
                  border: `1px solid ${p.popular ? GOLD_BORDER : BORDER}`,
                  borderRadius: 18, padding: 32, height: "100%",
                  position: "relative", display: "flex", flexDirection: "column",
                }}>
                  {p.popular && (
                    <div style={{
                      position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                      background: GOLD, color: "#1a1000", fontSize: 11, fontWeight: 700,
                      padding: "6px 14px", borderRadius: 999, letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>Recommended</div>
                  )}
                  <div style={{ fontSize: 13, color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{p.name}</div>
                  <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 52, color: TEXT, lineHeight: 1 }}>{p.price}</span>
                    <span style={{ fontSize: 15, color: MUTED }}>{p.period}</span>
                  </div>
                  <p style={{ fontSize: 13, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>{p.for}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", display: "grid", gap: 10, flex: 1 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ fontSize: 14, color: TEXT, display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Check size={16} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  {p.popular ? <GoldButton onClick={goSignup}>{p.cta}</GoldButton> : <OutlineButton onClick={p.name === "Team" ? () => (window.location.href = "mailto:hello@uwazi.ai") : goSignup}>{p.cta}</OutlineButton>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: "100px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <Reveal><Pill>Voices</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Trusted by Founders <em style={{ color: GOLD, fontStyle: "italic" }}>and Operators</em></H2></Reveal>

          <div className="grid gap-5 md:grid-cols-2" style={{ marginTop: 56 }}>
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 60}>
                <Card>
                  <div style={{ fontFamily: SERIF, fontSize: 40, color: GOLD, lineHeight: 0.5, marginBottom: 12 }}>"</div>
                  <p style={{ fontFamily: SERIF, fontSize: 22, color: TEXT, margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>{t.quote}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: 999, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: DIM }}>{t.org}</div>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* THE ASK */}
      <section style={{ padding: "120px 20px", borderTop: `1px solid ${BORDER}`, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 800, height: 800, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,162,76,0.10) 0%, transparent 60%)`,
          pointerEvents: "none",
        }} />
        <div className="mx-auto text-center" style={{ maxWidth: 780, position: "relative", zIndex: 1 }}>
          <Reveal><Pill>Ready?</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Ready to Consolidate<br /><em style={{ color: GOLD, fontStyle: "italic" }}>Your Ops?</em></H2></Reveal>
          <Reveal delay={160}>
            <Sub style={{ margin: "24px auto 0", textAlign: "center" }}>
              Join founders and operators who've traded tool sprawl for unified intelligence. No more context switching. No more invisible margins. No more slow decisions.
            </Sub>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: 40 }}>
              <GoldButton onClick={goSignup} large>Start your unified ops journey</GoldButton>
              <OutlineButton onClick={() => (window.location.href = "mailto:hello@uwazi.ai")} large>Schedule a walkthrough</OutlineButton>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <div style={{ marginTop: 28, fontSize: 13, color: DIM, lineHeight: 1.8 }}>
              Free 14-day trial, no credit card · Setup takes 20 minutes, migration support included<br />
              Questions? Email or book a call.
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 20px", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto" style={{ maxWidth: 860 }}>
          <Reveal><Pill>FAQ</Pill></Reveal>
          <Reveal delay={80}><H2 style={{ marginTop: 20 }}>Common <em style={{ color: GOLD, fontStyle: "italic" }}>Questions</em></H2></Reveal>

          <div style={{ marginTop: 48 }}>
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={f.q} delay={i * 40}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    style={{
                      width: "100%", textAlign: "left", background: "transparent",
                      border: "none", borderTop: `1px solid ${BORDER}`,
                      padding: "22px 0", cursor: "pointer", color: TEXT,
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
                      fontFamily: SANS,
                    }}
                  >
                    <span style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.3, color: TEXT }}>{f.q}</span>
                    <ChevronDown size={20} style={{ color: GOLD, flexShrink: 0, marginTop: 4, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }} />
                  </button>
                  {open && (
                    <div style={{ padding: "0 0 22px", fontSize: 15, color: MUTED, lineHeight: 1.65, maxWidth: 720 }}>{f.a}</div>
                  )}
                </Reveal>
              );
            })}
            <div style={{ borderTop: `1px solid ${BORDER}` }} />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "60px 20px 40px", borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
        <div className="mx-auto" style={{ maxWidth: 1200 }}>
          <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div>
              <VisiLogo size={28} showWordmark />
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginTop: 16, maxWidth: 320 }}>
                The operating system built for multi-org leaders. Consolidate your stack, accelerate decisions, save money.
              </p>
            </div>
            <FooterCol title="Product" links={[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ]} />
            <FooterCol title="Company" links={[
              { label: "About", href: "/about" },
              { label: "Blog", href: "/blog" },
              { label: "Changelog", href: "/changelog" },
              { label: "Roadmap", href: "/roadmap" },
            ]} />
            <FooterCol title="Legal" links={[
              { label: "Terms", href: "/terms" },
              { label: "Privacy", href: "/privacy" },
            ]} />
          </div>
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12, color: DIM }}>
            <div>© {new Date().getFullYear()} VisiOS. All rights reserved.</div>
            <div>Built for founders. Made with intent.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: GOLD, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 10 }}>
        {links.map(l => (
          <li key={l.label}>
            <a href={l.href} style={{ fontSize: 14, color: MUTED, textDecoration: "none" }} onMouseEnter={e => (e.currentTarget.style.color = TEXT)} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Landing;
