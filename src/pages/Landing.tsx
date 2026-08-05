import { useEffect, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Layers, Sparkles, Plug, BookOpen, Check, Minus, ChevronDown, ArrowRight,
  Mail, Calendar, FileText, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ── design tokens (page-local, dark marketing surface) ───────────── */
const BG = "#0F172A";
const SURFACE = "#1E293B";
const ELEV = "#334155";
const BLUE = "#0052CC";
const GRAD = "linear-gradient(135deg, #0052CC 0%, #4D7FFF 100%)";
const TEXT = "#F8FAFC";
const MUTED = "#94A3B8";
const DISPLAY = "'Monument Extended', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

const ORGS = [
  { name: "Northwind Studio", short: "Northwind", color: "#0052CC" },
  { name: "Redline Capital", short: "Redline", color: "#DC2626" },
  { name: "Verdant Labs", short: "Verdant", color: "#16A34A" },
];

/* ── helpers ──────────────────────────────────────────────────────── */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShown(true),
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(18px)",
        transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Section({
  id, children, tight,
}: { id?: string; children: ReactNode; tight?: boolean }) {
  return (
    <section id={id} className={tight ? "py-14 md:py-16" : "py-14 md:py-24"}>
      <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8">{children}</div>
    </section>
  );
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-[1.9rem] md:text-[2.6rem] leading-[1.1] tracking-[-0.02em]"
      style={{ fontFamily: DISPLAY, color: TEXT }}
    >
      {children}
    </h2>
  );
}

function GradButton({
  children, onClick, as = "button", to, type,
}: {
  children: ReactNode; onClick?: () => void; as?: "button" | "link" | "a";
  to?: string; type?: "button" | "submit";
}) {
  const cls =
    "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[0.95rem] font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4D7FFF] motion-reduce:transform-none";
  const style = { background: GRAD, fontFamily: BODY };
  if (as === "link" && to) return <Link to={to} className={cls} style={style}>{children}</Link>;
  if (as === "a" && to) return <a href={to} className={cls} style={style}>{children}</a>;
  return <button type={type ?? "button"} onClick={onClick} className={cls} style={style}>{children}</button>;
}

function OrgPill({ name, color, dense }: { name: string; color: string; dense?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-medium ${dense ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
      style={{
        background: `${color}22`,
        color: "#F8FAFC",
        border: `1px solid ${color}66`,
        fontFamily: BODY,
      }}
    >
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

function Card({ children, accent, className = "" }: { children: ReactNode; accent?: string; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-6 ${className}`}
      style={{ background: SURFACE, border: `1px solid ${ELEV}` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accent ?? GRAD }}
      />
      {children}
    </div>
  );
}

/* ── hero product frame: always multi-org ─────────────────────────── */
function ProductFrame() {
  const feed = [
    { org: 0, icon: Mail, title: "Contract redline from Acme legal", meta: "Inbox · 12m ago" },
    { org: 1, icon: Calendar, title: "LP update call moved to Thursday", meta: "Calendar · 40m ago" },
    { org: 2, icon: FileText, title: "Q3 grant narrative ready for review", meta: "Drive · 1h ago" },
    { org: 0, icon: Users, title: "New lead: Harper & Co — referred by Redline", meta: "Pipeline · 2h ago" },
    { org: 1, icon: Mail, title: "Wire confirmation, seed tranche 2", meta: "Inbox · 3h ago" },
  ];
  return (
    <div
      className="rounded-2xl p-3 md:p-4"
      style={{ background: SURFACE, border: `1px solid ${ELEV}` }}
      role="img"
      aria-label="Kova dashboard showing three organizations — Northwind Studio, Redline Capital and Verdant Labs — side by side in one feed"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: BG, border: `1px solid ${ELEV}` }}>
        <span className="mr-1 text-[11px] uppercase tracking-[0.14em]" style={{ color: MUTED, fontFamily: BODY }}>
          All orgs
        </span>
        {ORGS.map((o) => <OrgPill key={o.name} name={o.short} color={o.color} dense />)}
      </div>

      <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
        <div className="space-y-2">
          {feed.map((f, i) => {
            const org = ORGS[f.org];
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                style={{ background: BG, borderLeft: `3px solid ${org.color}`, border: `1px solid ${ELEV}`, borderLeftWidth: 3, borderLeftColor: org.color }}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: org.color }} aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[13px]" style={{ color: TEXT, fontFamily: BODY }}>{f.title}</p>
                  <p className="text-[11px]" style={{ color: MUTED, fontFamily: BODY }}>
                    {org.short} · {f.meta}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg p-3" style={{ background: BG, border: `1px solid ${ELEV}` }}>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "#4D7FFF" }} aria-hidden />
            <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: MUTED, fontFamily: BODY }}>
              AI generated · Vision
            </span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: TEXT, fontFamily: BODY }}>
            Harper &amp; Co came in through Northwind but the intro came from a Redline LP.
            Same person, two ventures — worth one reply, not two.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <OrgPill name="Northwind" color={ORGS[0].color} dense />
            <OrgPill name="Redline" color={ORGS[1].color} dense />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── feature illustration (also multi-org) ────────────────────────── */
function FeatureVisual({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-xl p-4" style={{ background: SURFACE, border: `1px solid ${ELEV}` }}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ORGS.map((o) => <OrgPill key={o.name} name={o.short} color={o.color} dense />)}
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => {
          const org = ORGS[i % 3];
          return (
            <div
              key={l}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]"
              style={{ background: BG, border: `1px solid ${ELEV}`, borderLeftWidth: 3, borderLeftColor: org.color, color: TEXT, fontFamily: BODY }}
            >
              <span className="text-[11px]" style={{ color: MUTED }}>{org.short}</span>
              <span className="truncate">{l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Layers,
    title: "One workspace, every venture",
    body: "Each org is a first-class citizen, color-coded and scoped, with a real view across all of them. Not a switcher bolted onto separate accounts.",
    lines: ["Pipeline · 14 open", "Portfolio · 3 active deals", "Programs · 6 in flight"],
  },
  {
    icon: Sparkles,
    title: "An AI chief of staff that sees everything",
    body: "Vision reads across all your entities at once: email, calendar, Drive, Slack, meetings, pipeline. Six personas — Chief of Staff, Writer, Researcher, Analyst, Advisor, Creative Director.",
    lines: ["Draft the LP update", "Summarize this week across orgs", "Who have I not replied to?"],
  },
  {
    icon: Plug,
    title: "Built on the tools you already run on",
    body: "Google Workspace-native. Gmail, Calendar and Drive stay your source of truth. Kova is the layer that makes sense of them. No migration.",
    lines: ["Gmail connected", "Calendar connected", "Drive connected"],
  },
  {
    icon: BookOpen,
    title: "The system of record for decisions",
    body: "Task tools track what's due. Kova holds why things were decided — across every venture, retrievable later.",
    lines: ["Why we dropped the retainer", "Why we moved the raise to Q4", "Why we split the program"],
  },
];

const FAQS = [
  {
    q: "Isn't this just Notion with AI?",
    a: "Notion gives you a workspace per company and a switcher. Nothing is shared, nothing is visible across them, and the AI only sees whichever one you're currently in. That's the problem we exist to solve.",
  },
  {
    q: "We're small — is this overkill?",
    a: "If you run one company, we're probably not for you yet. If you run two, you already feel it.",
  },
  {
    q: "What about SOC 2?",
    a: "We're not certified yet, and we'd rather say so. Google OAuth means your Workspace data stays in Workspace — we read it live, we don't copy it. If you need SOC 2 today, we're not your vendor yet.",
  },
  {
    q: "What happens when a big player ships this?",
    a: "They might. But retrofitting multi-entity into a single-workspace product is a rebuild, not a release.",
  },
];

export default function Landing() {
  const [annual, setAnnual] = useState(false);
  const [email, setEmail] = useState("");
  const [orgCount, setOrgCount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "dupe" | "error">("idle");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Kova — One workspace. Every venture.";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Kova is the AI command center for operators running more than one business — every company, client and brand in a single system.");
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

  const price = (n: number) => (annual ? Math.round(n * 10 / 12) : n);

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: BODY }} className="min-h-screen">
      {/* Nav */}
      <header
        className="fixed inset-x-0 top-0 z-50 backdrop-blur-xl"
        style={{ background: "rgba(15,23,42,0.72)", borderBottom: `1px solid ${ELEV}` }}
      >
        <nav className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-3.5 md:px-8">
          <a href="#top" className="text-lg tracking-[0.02em]" style={{ fontFamily: DISPLAY, color: TEXT }}>
            Kova
          </a>
          <div className="hidden items-center gap-8 text-sm md:flex" style={{ color: MUTED }}>
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#who" className="hover:text-white">Who It's For</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </div>
          <GradButton as="link" to="/login">Start free</GradButton>
        </nav>
      </header>

      <main id="top" className="pt-20">
        {/* Hero */}
        <Section>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
            <Reveal>
              <h1
                className="tracking-[-0.02em]"
                style={{ fontFamily: DISPLAY, fontSize: "clamp(2.75rem, 6vw, 4.5rem)", lineHeight: 1.02 }}
              >
                One workspace.<br />Every venture.
              </h1>
              <p className="mt-6 max-w-xl text-[1.0625rem] leading-[1.7]" style={{ color: MUTED }}>
                Kova is the AI command center for operators running more than one business.
                Your companies, clients, and brands in a single system — with an AI chief of
                staff that sees across all of them.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <GradButton as="link" to="/login">
                  Start free — connect your first two orgs <ArrowRight className="h-4 w-4" aria-hidden />
                </GradButton>
                <a
                  href="#product"
                  className="rounded-xl px-6 py-3 text-[0.95rem] font-medium"
                  style={{ border: `1px solid ${ELEV}`, color: TEXT }}
                >
                  See how it works
                </a>
              </div>
              <p className="mt-6 text-[13px]" style={{ color: MUTED }}>
                Built by an operator running three organizations. Used daily to run all of them.
              </p>
            </Reveal>
            <Reveal delay={120}><ProductFrame /></Reveal>
          </div>
        </Section>

        {/* Problem */}
        <Section id="problem">
          <Reveal>
            <H2>Every tool assumes you run one company.</H2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Three workspaces", "A login for each business. Nothing shared, nothing connected.", ORGS[0].color],
              ["Three sets of context", "The lead from one brand never reaches the other's pipeline.", ORGS[1].color],
              ["One person holding it together", "You are the integration layer between your own companies.", ORGS[2].color],
            ].map(([t, b, c], i) => (
              <Reveal key={t} delay={i * 90}>
                <Card accent={c}>
                  <h3 className="text-[1.05rem] font-semibold" style={{ color: TEXT }}>{t}</h3>
                  <p className="mt-2 text-[0.95rem] leading-[1.7]" style={{ color: MUTED }}>{b}</p>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-8 max-w-3xl text-[0.9rem] leading-[1.7]" style={{ color: MUTED }}>
              Harvard Business Review found workers toggle between applications roughly 1,200 times
              a day — losing just under four hours a week, about 9% of work time, just reorienting.
            </p>
          </Reveal>
        </Section>

        {/* How it works */}
        <Section id="product">
          <Reveal><H2>How it works</H2></Reveal>
          <div className="mt-12 space-y-14">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const flip = i % 2 === 1;
              return (
                <Reveal key={f.title}>
                  <div className="grid items-center gap-8 md:grid-cols-2">
                    <div className={flip ? "md:order-2" : ""}>
                      <Card>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: GRAD }}>
                            <Icon className="h-4.5 w-4.5 text-white" aria-hidden />
                          </span>
                          <h3 className="text-[1.15rem] font-semibold" style={{ color: TEXT }}>{f.title}</h3>
                        </div>
                        <p className="mt-3 text-[0.98rem] leading-[1.7]" style={{ color: MUTED }}>{f.body}</p>
                      </Card>
                    </div>
                    <div className={flip ? "md:order-1" : ""}>
                      <FeatureVisual lines={f.lines} />
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* Who it's for */}
        <Section id="who">
          <Reveal><H2>Who it's for</H2></Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Multi-brand agencies", ORGS[0].color, "One org per client. One contact book behind all of them. Per-seat, per-contact tools were never built for running twenty client accounts."],
              ["Portfolio entrepreneurs", ORGS[1].color, "You didn't start a second business to double your admin. Every system assumes one company. You're the glue holding them together."],
              ["Fractional executives", ORGS[2].color, "Every client, one command center. Four clients means four stacks, four contexts, and a Monday spent remembering where everything is."],
            ].map(([t, c, b], i) => (
              <Reveal key={t} delay={i * 90}>
                <Card accent={c}>
                  <OrgPill name={t} color={c} />
                  <p className="mt-4 text-[0.95rem] leading-[1.7]" style={{ color: MUTED }}>{b}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Comparison */}
        <Section>
          <Reveal>
            <H2>Everyone's shipping an AI assistant this year.</H2>
            <p className="mt-4 text-[1.0625rem]" style={{ color: MUTED }}>
              Nobody's shipping one that works across all your companies.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10 overflow-x-auto rounded-xl" style={{ border: `1px solid ${ELEV}`, background: SURFACE }}>
              <table className="w-full min-w-[620px] border-collapse text-left text-[0.95rem]">
                <caption className="sr-only">Single-workspace tools compared with Kova</caption>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${ELEV}` }}>
                    <th scope="col" className="px-5 py-4 font-medium" style={{ color: MUTED }}> </th>
                    <th scope="col" className="px-5 py-4 font-medium" style={{ color: MUTED }}>Single-workspace tools</th>
                    <th scope="col" className="px-5 py-4 font-semibold" style={{ color: TEXT }}>Kova</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Multiple businesses", "Separate workspaces, manual switching", "One system, all orgs"],
                    ["AI context", "Sees only the workspace you're in", "Sees across every org"],
                    ["Setup", "Rebuild your stack", "Connects to Google Workspace"],
                    ["Built for", "One team", "One operator, several companies"],
                  ].map(([label, them, us]) => (
                    <tr key={label} style={{ borderTop: `1px solid ${ELEV}` }}>
                      <th scope="row" className="px-5 py-4 font-medium" style={{ color: TEXT }}>{label}</th>
                      <td className="px-5 py-4" style={{ color: MUTED }}>
                        <span className="inline-flex items-center gap-2">
                          <Minus className="h-4 w-4" aria-hidden />{them}
                        </span>
                      </td>
                      <td className="px-5 py-4" style={{ color: TEXT }}>
                        <span className="inline-flex items-center gap-2">
                          <Check className="h-4 w-4" style={{ color: "#4D7FFF" }} aria-hidden />{us}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-[0.95rem]" style={{ color: MUTED }}>
              Multi-entity is an architecture decision, not a feature. It's in the data model from the first table.
            </p>
          </Reveal>
        </Section>

        {/* Pricing */}
        <Section id="pricing">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <H2>Pricing</H2>
              <div className="flex items-center gap-3 text-sm" style={{ color: MUTED }}>
                <span>Monthly</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={annual}
                  aria-label="Bill annually — two months free"
                  onClick={() => setAnnual((v) => !v)}
                  className="relative h-6 w-11 rounded-full transition-colors"
                  style={{ background: annual ? BLUE : ELEV }}
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                    style={{ left: annual ? 22 : 2 }}
                  />
                </button>
                <span style={{ color: annual ? TEXT : MUTED }}>Annual · 2 months free</span>
              </div>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Free", price: "$0", unit: "", meta: "1 org, 1 seat", body: "For the operator with one business and a second one coming." },
              { name: "Starter", price: `$${price(29)}`, unit: "/seat", meta: "1 org, up to 3 seats", body: "Everything in one place, for one business." },
              { name: "Growth", price: `$${price(79)}`, unit: "/seat", meta: "Up to 5 orgs, up to 25 seats", body: "Every venture you run, one system.", hot: true },
              { name: "Enterprise", price: "Custom", unit: "", meta: "Unlimited orgs and seats", body: "White-label available." },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 70}>
                <div
                  className="relative flex h-full flex-col rounded-xl p-6"
                  style={{
                    background: SURFACE,
                    border: `1px solid ${t.hot ? "#4D7FFF" : ELEV}`,
                    transform: t.hot ? "scale(1.02)" : undefined,
                  }}
                >
                  {t.hot && (
                    <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-semibold text-white" style={{ background: GRAD }}>
                      Most popular
                    </span>
                  )}
                  <h3 className="text-[1.05rem] font-semibold">{t.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-[2rem] tracking-[-0.02em]" style={{ fontFamily: DISPLAY }}>{t.price}</span>
                    <span className="text-sm" style={{ color: MUTED }}>{t.unit}</span>
                  </div>
                  <p className="mt-1 text-[13px]" style={{ color: MUTED }}>{t.meta}</p>
                  <p className="mt-4 flex-1 text-[0.95rem] leading-[1.7]" style={{ color: MUTED }}>{t.body}</p>
                  <div className="mt-6">
                    <GradButton as="link" to="/login">
                      {t.name === "Enterprise" ? "Talk to us" : "Start free"}
                    </GradButton>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-8 text-[0.95rem]" style={{ color: MUTED }}>
              Need more than five orgs? Per-org pricing available for agencies and portfolio operators.{" "}
              <a href="mailto:hello@kova.app" className="underline" style={{ color: "#4D7FFF" }}>Contact us</a>
            </p>
          </Reveal>
        </Section>

        {/* FAQ */}
        <Section>
          <Reveal><H2>Honest answers</H2></Reveal>
          <div className="mt-8 max-w-3xl space-y-3">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={f.q} delay={i * 60}>
                  <div className="rounded-xl" style={{ background: SURFACE, border: `1px solid ${ELEV}` }}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenFaq(open ? null : i)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[1rem] font-medium"
                        style={{ color: TEXT }}
                      >
                        {f.q}
                        <ChevronDown
                          className="h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none"
                          style={{ color: MUTED, transform: open ? "rotate(180deg)" : "none" }}
                          aria-hidden
                        />
                      </button>
                    </h3>
                    {open && (
                      <p className="px-5 pb-5 text-[0.95rem] leading-[1.7]" style={{ color: MUTED }}>{f.a}</p>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* Final CTA */}
        <section style={{ background: GRAD }}>
          <div className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-8 md:py-24">
            <div className="max-w-2xl">
              <h2 className="text-[2rem] leading-[1.1] tracking-[-0.02em] md:text-[2.75rem]" style={{ fontFamily: DISPLAY, color: "#fff" }}>
                One workspace. Every venture.
              </h2>
              <p className="mt-4 text-[1.0625rem]" style={{ color: "rgba(255,255,255,0.85)" }}>
                Connect your first two orgs in under five minutes.
              </p>

              {status === "ok" ? (
                <p className="mt-8 rounded-xl px-5 py-4 text-[0.95rem]" style={{ background: "rgba(15,23,42,0.35)", color: "#fff" }}>
                  You're on the list. We'll be in touch shortly.
                </p>
              ) : (
                <form onSubmit={submit} className="mt-8 space-y-3" noValidate>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label htmlFor="wl-email" className="sr-only">Email address</label>
                    <input
                      id="wl-email"
                      type="email"
                      required
                      maxLength={255}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (status !== "loading") setStatus("idle"); }}
                      placeholder="you@company.com"
                      className="w-full rounded-xl px-4 py-3 text-[0.95rem] outline-none sm:max-w-sm"
                      style={{ background: "rgba(15,23,42,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)" }}
                    />
                    <label htmlFor="wl-orgs" className="sr-only">How many businesses do you run?</label>
                    <select
                      id="wl-orgs"
                      value={orgCount}
                      onChange={(e) => setOrgCount(e.target.value)}
                      className="rounded-xl px-4 py-3 text-[0.95rem] outline-none"
                      style={{ background: "rgba(15,23,42,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)" }}
                    >
                      <option value="">How many businesses?</option>
                      <option value="1">1</option>
                      <option value="2-4">2–4</option>
                      <option value="5-10">5–10</option>
                      <option value="10+">10+</option>
                    </select>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="rounded-xl px-6 py-3 text-[0.95rem] font-semibold disabled:opacity-70"
                      style={{ background: "#0F172A", color: "#fff" }}
                    >
                      {status === "loading" ? "Joining…" : "Join the waitlist"}
                    </button>
                  </div>
                  <p aria-live="polite" className="min-h-[20px] text-[13px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {status === "dupe" && "You're already on the list — we've got you."}
                    {status === "error" && "Enter a valid email address and try again."}
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${ELEV}` }}>
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <p className="text-base" style={{ fontFamily: DISPLAY }}>Kova</p>
              <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                The AI command center for operators running more than one business.
              </p>
            </div>
            <div className="flex items-center gap-6 text-[13px]" style={{ color: MUTED }}>
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <a href="mailto:hello@kova.app" className="hover:text-white">Contact</a>
              <span>© {new Date().getFullYear()} Kova</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
