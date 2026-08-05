import { useEffect, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Layers, Sparkles, ScanLine, Plug, ChevronDown, Check, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import kovaWordmark from "@/assets/kova-wordmark.png";

/* ──────────────────────────────────────────────────────────────
   Kova landing — v4.1
   THE COLOUR RULE: blue is the app, magenta is the thinking.
   All colour lives in the token block below. No hex elsewhere.
   ────────────────────────────────────────────────────────────── */

const TOKENS = `
.kova-lp {
  --bg:       #08080B;
  --nav-bg:   #0B0B0F;
  --card:     #131317;
  --inset:    #1D1D23;
  --line:     #26262E;
  --text:     #F7F7F9;
  --dim:      #96969F;

  --a-500:    #2563EB;
  --a-400:    #3B82F6;
  --a-300:    #60A5FA;

  --p-500:    #D21FFF;
  --p-600:    #BD1CE5;
  --p-300:    #E272FF;

  --ok:       #22C55E;
  --warn:     #F59E0B;
  --err:      #EF4444;

  --org-blue:  #2563EB;
  --org-green: #059669;
  --org-red:   #EF4444;

  --brand-gradient: linear-gradient(100deg,
    #000E21 0%, #003276 14%, #0046A3 26%, #2542BC 38%,
    #842FE1 52%, #B425F4 62%, #D21FFF 72%, #DF5FFF 84%, #EF9FFF 100%);

  --m-hero:  clamp(38px, 7.2vw, 68px);
  --m-h2:    clamp(28px, 4.4vw, 42px);
  --m-h3:    clamp(19px, 2.2vw, 24px);
  --m-body:  clamp(16px, 1.4vw, 17px);
  --m-stat:  clamp(34px, 6.4vw, 52px);

  background: var(--bg);
  color: var(--text);
  font-family: "Inter", system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  min-height: 100vh;
}
.kova-lp .wrap { max-width: 1120px; margin: 0 auto; padding-left: 20px; padding-right: 20px; }
.kova-lp section { padding: clamp(64px, 9vw, 112px) 0; scroll-margin-top: 72px; }
.kova-lp h1, .kova-lp h2, .kova-lp h3 {
  font-family: "Inter Tight", system-ui, sans-serif;
  font-weight: 600; letter-spacing: -0.02em; margin: 0; line-height: 1.1;
}
.kova-lp h1 { font-size: var(--m-hero); }
.kova-lp h2 { font-size: var(--m-h2); }
.kova-lp h3 { font-size: var(--m-h3); }
.kova-lp p { margin: 0; font-size: var(--m-body); line-height: 1.65; max-width: 68ch; }
.kova-lp .dim { color: var(--dim); }
.kova-lp .eyebrow {
  font-weight: 500; text-transform: uppercase; letter-spacing: 0.16em;
  font-size: 11px; color: var(--dim);
}
.kova-lp .stat {
  font-family: "Inter Tight", system-ui, sans-serif;
  font-weight: 700; letter-spacing: -0.04em; font-size: var(--m-stat); line-height: 1;
}
.kova-lp .card {
  background: var(--card); border: 1px solid var(--line); border-radius: 16px;
}
.kova-lp .inset { background: var(--inset); border-radius: 12px; }
.kova-lp .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 44px; padding: 0 20px; border-radius: 10px; font-size: 15px; font-weight: 500;
  border: 1px solid transparent; cursor: pointer; text-decoration: none;
  transition: background 150ms cubic-bezier(0.4,0,0.2,1);
}
.kova-lp .btn-lg { height: 48px; padding: 0 24px; font-size: 16px; }
.kova-lp .btn-primary { background: var(--a-500); color: var(--text); }
.kova-lp .btn-primary:hover { background: var(--a-400); }
.kova-lp .btn-secondary { background: var(--inset); color: var(--text); }
.kova-lp .btn-ghost { border-color: var(--line); color: var(--text); background: transparent; }
.kova-lp a:focus-visible, .kova-lp button:focus-visible,
.kova-lp input:focus-visible, .kova-lp select:focus-visible, .kova-lp summary:focus-visible {
  outline: 2px solid var(--a-400); outline-offset: 2px;
}
.kova-lp .pill {
  display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  padding: 3px 10px; font-size: 11px; font-weight: 500; letter-spacing: 0.04em;
  text-transform: uppercase; border: 1px solid var(--line); color: var(--text);
}
.kova-lp .dot { width: 6px; height: 6px; border-radius: 999px; }
.kova-lp .ai-mark {
  display: inline-flex; align-items: center; gap: 5px; border-radius: 999px;
  padding: 2px 8px; font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--p-300); border: 1px solid var(--p-600);
}
.kova-lp .grid2 { display: grid; grid-template-columns: 1fr; gap: 20px; }
.kova-lp .grid3 { display: grid; grid-template-columns: 1fr; gap: 16px; }
.kova-lp .grid4 { display: grid; grid-template-columns: 1fr; gap: 16px; }
.kova-lp input, .kova-lp select {
  width: 100%; height: 48px; border-radius: 10px; padding: 0 14px;
  background: var(--inset); border: 1px solid var(--line); color: var(--text);
  font-size: 15px; font-family: inherit;
}
.kova-lp .reveal { opacity: 0; transform: translateY(8px); }
.kova-lp .reveal.in {
  opacity: 1; transform: none;
  transition: opacity 180ms cubic-bezier(0.4,0,0.2,1), transform 180ms cubic-bezier(0.4,0,0.2,1);
}
@media (min-width: 860px) {
  .kova-lp .grid2 { grid-template-columns: 1fr 1fr; gap: 28px; }
  .kova-lp .grid3 { grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .kova-lp .grid4 { grid-template-columns: repeat(4, 1fr); gap: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .kova-lp .reveal { opacity: 1; transform: none; transition: none; }
}
`;

const ORGS = [
  { label: "Northwind", color: "var(--org-blue)" },
  { label: "Verdant", color: "var(--org-green)" },
  { label: "Redline", color: "var(--org-red)" },
];

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal${shown ? " in" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function OrgPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="pill">
      <span className="dot" style={{ background: color }} />
      {label}
    </span>
  );
}

/* Product frame — always shows more than one org. */
function ProductFrame() {
  const rows = [
    { org: ORGS[0], text: "Contract review — Q3 retainer renewal", meta: "Inbox · 2:14 PM" },
    { org: ORGS[1], text: "Series A data room checklist updated", meta: "Drive · 1:02 PM" },
    { org: ORGS[2], text: "Standup moved to Thursday 9:30 AM", meta: "Calendar · 11:40 AM" },
  ];
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "12px 14px", borderBottom: "1px solid var(--line)", background: "var(--nav-bg)",
        }}
      >
        {ORGS.map((o) => <OrgPill key={o.label} {...o} />)}
        <span className="dim" style={{ fontSize: 11, marginLeft: "auto" }}>All orgs</span>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.text}
            className="inset"
            style={{ padding: "12px 14px", borderLeft: `3px solid ${r.org.color}` }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>{r.text}</div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
              {r.org.label} · {r.meta}
            </div>
          </div>
        ))}
        <div
          style={{
            padding: "12px 14px", borderRadius: 12,
            border: "1px dashed var(--p-600)", background: "var(--inset)", opacity: 0.92,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="ai-mark"><Sparkles size={11} /> Vision</span>
            <span className="dim" style={{ fontSize: 11 }}>Draft — not sent</span>
          </div>
          <div style={{ fontSize: 14 }}>
            Northwind's renewal and Verdant's raise both land next Tuesday. Move the standup?
          </div>
        </div>
      </div>
    </div>
  );
}

/* Section 4 visual: authored beside model-written. */
function MarkVisual() {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="inset" style={{ padding: 14, borderLeft: "3px solid var(--org-blue)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>You wrote this</div>
        <div style={{ fontSize: 14 }}>Confirming Thursday. I'll bring the updated deck.</div>
      </div>
      <div style={{ padding: 14, borderRadius: 12, border: "1px dashed var(--p-600)", background: "var(--inset)", opacity: 0.92 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="ai-mark"><Sparkles size={11} /> Kova wrote this</span>
        </div>
        <div style={{ fontSize: 14 }}>
          Suggested reply: propose Thursday 9:30 AM, attach the Q3 summary.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary" style={{ height: 36, fontSize: 13 }}>Approve</button>
          <button className="btn btn-ghost" style={{ height: 36, fontSize: 13 }}>Discard</button>
        </div>
      </div>
    </div>
  );
}

const HOW = [
  {
    icon: Layers,
    title: "One workspace, every venture",
    body: "Each organisation is a first-class citizen, colour-coded and scoped, with a real view across all of them. Not a switcher bolted onto separate accounts.",
  },
  {
    icon: Sparkles,
    title: "An AI chief of staff that sees everything",
    body: "Vision reads across every entity at once: email, calendar, drive, meetings, pipeline. Six personas — Chief of Staff, Writer, Researcher, Analyst, Advisor, Creative Director.",
  },
  {
    icon: ScanLine,
    title: "You can always tell what it wrote",
    body: "Model output carries a magenta mark; anything you authored stays blue. Nothing sends until you approve it.",
  },
  {
    icon: Plug,
    title: "Built on the tools you already run on",
    body: "Google Workspace-native. Gmail, Calendar and Drive stay your source of truth. No migration.",
  },
];

const AUDIENCE = [
  { title: "Multi-brand agencies", color: "var(--org-blue)", body: "One org per client. One contact book behind all of them." },
  { title: "Portfolio entrepreneurs", color: "var(--org-green)", body: "You didn't start a second business to double your admin." },
  { title: "Fractional executives", color: "var(--org-red)", body: "Every client, one command center. Four clients means four stacks and a Monday spent remembering where everything is." },
];

const COMPARE = [
  ["Multiple businesses", "Separate workspaces, manual switching", "One system, all orgs"],
  ["AI context", "Sees only the workspace you're in", "Sees across every org"],
  ["Human vs. AI output", "Indistinguishable", "Marked, always"],
  ["Setup", "Rebuild your stack", "Connects to Google Workspace"],
];

const TIERS = [
  { name: "Free", price: 0, unit: "", orgs: "2 orgs, 1 seat", line: "See both your businesses in one place." },
  { name: "Starter", price: 29, unit: "/seat", orgs: "2 orgs, 3 seats", line: "Everything in one place, for one business." },
  { name: "Growth", price: 79, unit: "/seat", orgs: "5 orgs, 25 seats", line: "Every venture you run, one system.", popular: true },
  { name: "Enterprise", price: null, unit: "", orgs: "Unlimited orgs and seats", line: "White-label available." },
];

const FAQ = [
  ["Isn't this just Notion with AI?", "Notion gives you a workspace per company and a switcher. Nothing is shared, nothing is visible across them, and the AI only sees whichever one you're in."],
  ["We're small — is this overkill?", "If you run one company, we're probably not for you yet. If you run two, you already feel it."],
  ["What about SOC 2?", "Not certified yet, and we'd rather say so. Google OAuth means your Workspace data stays in Workspace — we read it live, we don't copy it. If you need SOC 2 today, we're not your vendor yet."],
  ["What happens when a big player ships this?", "They might. Retrofitting multi-entity into a single-workspace product is a rebuild, not a release."],
];

export default function Landing() {
  const [annual, setAnnual] = useState(false);
  const [email, setEmail] = useState("");
  const [orgCount, setOrgCount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "dupe" | "error">("idle");

  useEffect(() => {
    document.title = "Kova — One workspace. Every venture.";
    const desc = document.querySelector('meta[name="description"]');
    if (desc)
      desc.setAttribute(
        "content",
        "Kova is the AI command center for operators running more than one business — every company, client and brand in a single system."
      );
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 255) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: value, org_count: orgCount || null, source: "landing" });
    if (error) {
      setStatus(error.code === "23505" || /duplicate/i.test(error.message) ? "dupe" : "error");
      return;
    }
    setStatus("ok");
  };

  const price = (n: number) => (annual ? Math.round((n * 10) / 12) : n);

  return (
    <div className="kova-lp">
      <style>{TOKENS}</style>

      {/* 1 — Nav */}
      <header
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, height: 64,
          background: "color-mix(in srgb, var(--nav-bg) 85%, transparent)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="wrap" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" aria-label="Kova home" style={{ display: "flex", alignItems: "center" }}>
            <img src={kovaWordmark} alt="Kova" style={{ height: 22, width: "auto", filter: "grayscale(1) brightness(3)" }} />
          </Link>
          <nav className="dim" style={{ display: "flex", gap: 24, fontSize: 14 }}>
            <a href="#product" style={{ color: "inherit", textDecoration: "none" }}>Product</a>
            <a href="#who" style={{ color: "inherit", textDecoration: "none" }}>Who It's For</a>
            <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing</a>
          </nav>
          <Link to="/login?tab=signup" className="btn btn-primary">Start free</Link>
        </div>
      </header>

      <main style={{ paddingTop: 64 }}>
        {/* 2 — Hero */}
        <section>
          <div className="wrap grid2" style={{ alignItems: "center" }}>
            <Reveal>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <h1>One workspace.<br />Every venture.</h1>
                <p className="dim" style={{ maxWidth: "60ch" }}>
                  Kova is the AI command center for operators running more than one business.
                  Your companies, clients, and brands in a single system — with an AI chief of
                  staff that sees across all of them.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link to="/login?tab=signup" className="btn btn-primary btn-lg">
                    Start free — connect your first two orgs
                  </Link>
                  <a href="#product" className="btn btn-ghost btn-lg">See how it works</a>
                </div>
                <div className="dim" style={{ fontSize: 13 }}>
                  Built by an operator running six organisations. Used daily to run all of them.
                </div>
              </div>
            </Reveal>
            <Reveal delay={80}><ProductFrame /></Reveal>
          </div>
        </section>

        {/* 3 — The problem */}
        <section>
          <div className="wrap">
            <Reveal>
              <h2 style={{ maxWidth: "18ch" }}>Every tool assumes you run one company.</h2>
            </Reveal>
            <div className="grid3" style={{ marginTop: 36 }}>
              {[
                ["Three workspaces", "A login for each business. Nothing shared, nothing connected."],
                ["Three sets of context", "The lead from one brand never reaches the other's pipeline."],
                ["One person holding it together", "You are the integration layer between your own companies."],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 60}>
                  <div className="card" style={{ padding: 24, height: "100%" }}>
                    <h3>{t}</h3>
                    <p className="dim" style={{ marginTop: 10, fontSize: 15 }}>{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="dim" style={{ fontSize: 13, marginTop: 24 }}>
              Harvard Business Review found workers toggle between applications roughly 1,200 times
              a day — losing just under four hours a week, about 9% of work time, reorienting.
            </p>
          </div>
        </section>

        {/* 4 — How it works */}
        <section id="product">
          <div className="wrap">
            <Reveal><div className="eyebrow">How it works</div></Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 28 }}>
              {HOW.map((h, i) => {
                const Icon = h.icon;
                const flip = i % 2 === 1;
                return (
                  <Reveal key={h.title} delay={i * 50}>
                    <div className="card grid2" style={{ padding: 24, alignItems: "center" }}>
                      <div style={{ order: flip ? 2 : 1 }}>
                        <Icon size={22} style={{ color: "var(--a-300)" }} />
                        <h3 style={{ marginTop: 14 }}>{h.title}</h3>
                        <p className="dim" style={{ marginTop: 10, fontSize: 15 }}>{h.body}</p>
                      </div>
                      <div style={{ order: flip ? 1 : 2 }}>
                        {i === 2 ? <MarkVisual /> : <ProductFrame />}
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5 — Who it's for */}
        <section id="who">
          <div className="wrap">
            <Reveal><h2>Who it's for</h2></Reveal>
            <div className="grid3" style={{ marginTop: 32 }}>
              {AUDIENCE.map((a, i) => (
                <Reveal key={a.title} delay={i * 60}>
                  <div className="card" style={{ padding: 24, borderLeft: `3px solid ${a.color}`, height: "100%" }}>
                    <h3>{a.title}</h3>
                    <p className="dim" style={{ marginTop: 10, fontSize: 15 }}>{a.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 6 — Why not just use Notion */}
        <section>
          <div className="wrap">
            <Reveal>
              <h2>Everyone's shipping an AI assistant this year.</h2>
              <p className="dim" style={{ marginTop: 12 }}>
                Nobody's shipping one that works across all your companies.
              </p>
            </Reveal>
            <Reveal delay={60}>
              <div className="card" style={{ marginTop: 28, overflow: "hidden" }}>
                <div
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
                    borderBottom: "1px solid var(--line)", padding: "14px 20px",
                  }}
                >
                  <div className="eyebrow">Single-workspace tools</div>
                  <div className="eyebrow" style={{ color: "var(--a-300)" }}>Kova</div>
                </div>
                {COMPARE.map(([label, them, us]) => (
                  <div key={label} style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
                    <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>{label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div className="dim" style={{ fontSize: 15, display: "flex", gap: 8 }}>
                        <Minus size={16} style={{ flexShrink: 0, marginTop: 3 }} /> {them}
                      </div>
                      <div style={{ fontSize: 15, display: "flex", gap: 8 }}>
                        <Check size={16} style={{ flexShrink: 0, marginTop: 3, color: "var(--a-300)" }} /> {us}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="dim" style={{ padding: "16px 20px", fontSize: 14 }}>
                  Multi-entity is an architecture decision, not a feature. It's in the data model
                  from the first table.
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 7 — Pricing */}
        <section id="pricing">
          <div className="wrap">
            <Reveal>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <h2>Pricing</h2>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-pressed={annual}
                  onClick={() => setAnnual((v) => !v)}
                >
                  {annual ? "Annual — two months free" : "Monthly — switch to annual"}
                </button>
              </div>
            </Reveal>
            <div className="grid4" style={{ marginTop: 32, alignItems: "stretch" }}>
              {TIERS.map((t, i) => (
                <Reveal key={t.name} delay={i * 50}>
                  <div
                    className="card"
                    style={{
                      padding: 22, height: "100%", display: "flex", flexDirection: "column", gap: 10,
                      border: t.popular ? "1px solid var(--a-500)" : undefined,
                      transform: t.popular ? "scale(1.02)" : undefined,
                    }}
                  >
                    {t.popular && (
                      <div className="eyebrow" style={{ color: "var(--a-300)" }}>Most popular</div>
                    )}
                    <h3>{t.name}</h3>
                    <div className="stat" style={{ fontSize: "clamp(28px, 4vw, 36px)" }}>
                      {t.price === null ? "Custom" : `$${price(t.price)}`}
                      <span className="dim" style={{ fontSize: 14, fontWeight: 400, letterSpacing: 0 }}>{t.unit}</span>
                    </div>
                    <div style={{ fontSize: 14 }}>{t.orgs}</div>
                    <p className="dim" style={{ fontSize: 14 }}>{t.line}</p>
                    <Link
                      to="/login?tab=signup"
                      className={`btn ${t.popular ? "btn-primary" : "btn-secondary"}`}
                      style={{ marginTop: "auto" }}
                    >
                      {t.price === null ? "Talk to us" : "Start free"}
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="dim" style={{ fontSize: 14, marginTop: 20 }}>
              Need more than five orgs? Per-org pricing for agencies and portfolio operators.
            </p>
          </div>
        </section>

        {/* 8 — Honest answers */}
        <section>
          <div className="wrap">
            <Reveal><h2>Honest answers</h2></Reveal>
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
              {FAQ.map(([q, a], i) => (
                <Reveal key={q} delay={i * 50}>
                  <details className="card" style={{ padding: "18px 20px" }}>
                    <summary
                      style={{
                        cursor: "pointer", listStyle: "none", display: "flex",
                        alignItems: "center", justifyContent: "space-between", gap: 16,
                        fontSize: 16, fontWeight: 500,
                      }}
                    >
                      {q}
                      <ChevronDown size={18} className="dim" style={{ flexShrink: 0 }} />
                    </summary>
                    <p className="dim" style={{ marginTop: 12, fontSize: 15 }}>{a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 9 — Final CTA */}
        <section style={{ background: "var(--brand-gradient)" }}>
          <div className="wrap grid2" style={{ alignItems: "center" }}>
            <div>
              <h2>One workspace.<br />Every venture.</h2>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontSize: 15, marginBottom: 16 }}>
                Connect your first two orgs in under five minutes.
              </p>
              {status === "ok" ? (
                <div style={{ fontSize: 15, color: "var(--ok)" }}>
                  You're on the list. We'll be in touch.
                </div>
              ) : (
                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label className="eyebrow" htmlFor="lp-email">Email</label>
                  <input
                    id="lp-email" type="email" value={email} autoComplete="email"
                    onChange={(e) => { setEmail(e.target.value); if (status !== "loading") setStatus("idle"); }}
                    placeholder="you@company.com" required
                  />
                  <label className="eyebrow" htmlFor="lp-orgs">How many businesses do you run?</label>
                  <select id="lp-orgs" value={orgCount} onChange={(e) => setOrgCount(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option value="1">1</option>
                    <option value="2-4">2–4</option>
                    <option value="5-10">5–10</option>
                    <option value="10+">10+</option>
                  </select>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={status === "loading"}>
                    {status === "loading" ? "Joining…" : "Join the waitlist"}
                  </button>
                  {status === "dupe" && (
                    <div className="dim" style={{ fontSize: 13 }}>You're already on the list.</div>
                  )}
                  {status === "error" && (
                    <div style={{ fontSize: 13, color: "var(--err)" }}>
                      Enter a valid email address and try again.
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </section>

        {/* 10 — Footer */}
        <footer style={{ borderTop: "1px solid var(--line)", padding: "40px 0" }}>
          <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <img src={kovaWordmark} alt="Kova" style={{ height: 20, width: "auto", filter: "grayscale(1) brightness(3)" }} />
              <div className="dim" style={{ fontSize: 13, marginTop: 8 }}>
                The AI command center for operators running more than one business.
              </div>
            </div>
            <div className="dim" style={{ display: "flex", gap: 20, fontSize: 13 }}>
              <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
              <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
              <a href="mailto:hello@kova.app" style={{ color: "inherit", textDecoration: "none" }}>Contact</a>
            </div>
            <div className="dim" style={{ fontSize: 13 }}>© {new Date().getFullYear()} Kova</div>
          </div>
        </footer>
      </main>
    </div>
  );
}
