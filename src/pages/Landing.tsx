import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Moon, Sun } from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   Kova marketing landing.
   Every value comes from src/design/tokens.css. No hex here, no new
   fonts — the display face is var(--display), the body var(--body).
   ────────────────────────────────────────────────────────────── */

const THEME_KEY = "kova:theme";
type Theme = "dark" | "light";

const CSS = `
.klp {
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  min-height: 100vh;
  overflow-x: hidden;
}
.klp .wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
.klp section { padding: clamp(64px, 9vw, 116px) 0; scroll-margin-top: 76px; }
.klp h1, .klp h2, .klp h3 { font-family: var(--display); margin: 0; font-weight: 600; }
.klp h1 .hb { display: block; height: 0; }
@media (max-width: 560px) { .klp h1 .hb { display: inline; } }
.klp h1 {
  font-size: clamp(38px, 7.2vw, 68px);
  letter-spacing: -0.03em;
  line-height: 1.04;
  max-width: 15ch;
}
.klp h2 { font-size: clamp(27px, 4.4vw, 40px); letter-spacing: -0.025em; line-height: 1.12; max-width: 20ch; }
.klp h3 { font-size: 17px; letter-spacing: -0.015em; line-height: 1.3; }
.klp p { margin: 0; font-size: clamp(15px, 1.35vw, 17px); line-height: 1.65; max-width: 62ch; }
.klp .dim { color: var(--dim); }
.klp .eyebrow {
  font-family: var(--body); font-weight: 500; text-transform: uppercase;
  letter-spacing: .16em; font-size: 11px; color: var(--dim);
}
.klp .card {
  background: var(--card); border: var(--card-border); border-radius: var(--r-card);
  box-shadow: var(--shadow); padding: 22px;
}
.klp .inset { background: var(--inset); border-radius: var(--r-inner); }

/* nav */
.klp-nav {
  position: sticky; top: 0; z-index: 40;
  background: color-mix(in srgb, var(--nav-bg) 88%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
}
.klp-nav .row { display: flex; align-items: center; gap: 18px; height: 64px; }
.klp-nav .links { display: flex; gap: 22px; margin-left: auto; }
.klp-nav a.nl { color: var(--dim); text-decoration: none; font-size: 14px; }
.klp-nav a.nl:hover { color: var(--text); }
@media (max-width: 820px) { .klp-nav .links { display: none; } }

/* buttons */
.klp .btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 44px; padding: 0 20px; border-radius: var(--r-pill);
  font-size: 15px; font-weight: 500; text-decoration: none; cursor: pointer;
  border: 1px solid transparent; transition: transform .12s ease, background .12s ease;
}
.klp .btn:active { transform: translateY(1px); }
.klp .btn-pri { background: var(--a-500); color: var(--on-fill); }
.klp .btn-pri:hover { background: var(--a-400); }
.klp .btn-sec { background: transparent; color: var(--text); border-color: var(--line); }
.klp .btn-sec:hover { border-color: var(--a-400); }
.klp .btn-sm { height: 36px; padding: 0 14px; font-size: 14px; }
.klp .icon-btn {
  height: 36px; width: 36px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--r-pill); border: 1px solid var(--line);
  background: transparent; color: var(--dim); cursor: pointer;
}
.klp .icon-btn:hover { color: var(--text); border-color: var(--a-400); }

/* hero */
.klp-hero { position: relative; padding-top: clamp(56px, 9vw, 104px); }
.klp-hero::before {
  content: ""; position: absolute; inset: -140px 0 auto 0; height: 780px;
  background: radial-gradient(60% 60% at 50% 0%, rgba(210, 31, 255, .13), transparent 72%);
  pointer-events: none;
}
[data-theme="light"] .klp-hero::before {
  background: radial-gradient(60% 60% at 50% 0%, rgba(210, 31, 255, .09), transparent 72%);
}
.klp-hero .inner { position: relative; }
.klp-hero .sub { margin-top: 20px; font-size: clamp(16px, 1.7vw, 19px); color: var(--dim); max-width: 56ch; }
.klp-hero .cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
.klp-hero .micro { margin-top: 14px; font-size: 13px; color: var(--dim); }

/* chain */
.klp-chain { display: grid; gap: 14px; grid-template-columns: repeat(4, 1fr); margin-top: 36px; }
.klp-chain .step .n {
  font-family: var(--display); font-size: 12px; letter-spacing: .12em; color: var(--accent-txt);
}
.klp-chain .step h3 { margin: 10px 0 6px; }
@media (max-width: 900px) { .klp-chain { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 520px) { .klp-chain { grid-template-columns: 1fr; } }

/* honesty */
.klp-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 32px; }
@media (max-width: 820px) { .klp-two { grid-template-columns: 1fr; } }
.klp-line { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid var(--line); }
.klp-line:last-child { border-bottom: 0; }
.klp-line svg { flex: none; margin-top: 2px; color: var(--accent-txt); }
.klp-draft {
  border: 1px dashed var(--p-500); border-radius: var(--r-inner);
  padding: 14px; color: var(--dim); font-size: 14px; background: transparent;
}
.klp-draft .tag { color: var(--ai-txt); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }

/* scale */
.klp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; }
@media (max-width: 720px) { .klp-stats { grid-template-columns: 1fr; } }
.klp-stats .v { font-family: var(--display); font-size: var(--t-stat); letter-spacing: -.04em; line-height: 1; }

/* who */
.klp-who { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; }
@media (max-width: 900px) { .klp-who { grid-template-columns: 1fr; } }
.klp-dot { width: 8px; height: 8px; border-radius: var(--r-pill); display: inline-block; margin-right: 8px; }

/* team */
.klp-team { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 32px; }
@media (max-width: 900px) { .klp-team { grid-template-columns: repeat(2, 1fr); } }
.klp-avatar {
  width: 44px; height: 44px; border-radius: var(--r-pill);
  background: var(--brand-gradient); display: flex; align-items: center; justify-content: center;
  color: var(--on-fill); font-family: var(--display); font-size: 15px;
}

/* pricing */
.klp-price { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; align-items: start; }
@media (max-width: 900px) { .klp-price { grid-template-columns: 1fr; } }
.klp-price .amt { font-family: var(--display); font-size: 34px; letter-spacing: -.03em; }
.klp-price .feat { display: flex; gap: 8px; font-size: 14px; color: var(--dim); padding: 6px 0; }
.klp-price .feat svg { flex: none; margin-top: 3px; color: var(--ok-txt); }
.klp-price .hi { border: 1px solid var(--a-500); }
.klp-badge {
  display: inline-block; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--accent-txt); margin-bottom: 8px;
}

/* faq */
.klp-faq { margin-top: 28px; border-top: 1px solid var(--line); }
.klp-faq .q {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: transparent; border: 0; border-bottom: 1px solid var(--line);
  padding: 18px 0; color: var(--text); font-size: 16px; text-align: left; cursor: pointer;
  font-family: var(--body);
}
.klp-faq .a { padding: 0 0 18px; border-bottom: 1px solid var(--line); }
.klp-faq svg { flex: none; color: var(--dim); transition: transform .16s ease; }
.klp-faq .open svg { transform: rotate(180deg); }

/* closing */
.klp-close { text-align: center; }
.klp-close h2 { margin: 0 auto; }
.klp-close .cta { display: flex; gap: 12px; justify-content: center; margin-top: 26px; flex-wrap: wrap; }

/* footer */
.klp-foot { border-top: 1px solid var(--line); padding: 34px 0 46px; }
.klp-foot .cols { display: flex; flex-wrap: wrap; gap: 40px; justify-content: space-between; }
.klp-foot a { color: var(--dim); text-decoration: none; font-size: 14px; display: block; padding: 4px 0; }
.klp-foot a:hover { color: var(--text); }
`;

const CHAIN = [
  { n: "01", t: "It happened", d: "Meetings, mail, messages and docs land in one timeline instead of eight tabs." },
  { n: "02", t: "It became a task", d: "Vision reads the record and proposes the work — owner, venture, due date attached." },
  { n: "03", t: "It got time", d: "Tasks are placed against your real calendar, so a full day says so before you promise it." },
  { n: "04", t: "It got reported", d: "Every venture rolls into one morning brief: what moved, what slipped, what needs you." },
];

const READS = [
  "Gmail and Google Calendar",
  "Meeting transcripts and notes",
  "Your task and project history",
  "Contacts and their provenance",
];

const STATS = [
  { v: "4", l: "ventures in one rail", d: "Scope switches everything on screen — nothing bleeds between orgs." },
  { v: "1", l: "morning brief", d: "One read replaces the standing check-in across every company you run." },
  { v: "0", l: "invented numbers", d: "A metric with no live source is not shown. Connect it or it stays dark." },
];

const WHO = [
  { c: "var(--ws-uwazi)", t: "Founders with more than one thing", d: "A studio, an agency and a nonprofit are three contexts, not three logins." },
  { c: "var(--ws-cc)", t: "Operators wearing every hat", d: "Sales in the morning, delivery at noon, payroll at five — one surface for all of it." },
  { c: "var(--ws-bin)", t: "Small teams that move fast", d: "Three to eight people who need shared context without a project-management ritual." },
];

const TEAM = [
  { i: "MK", n: "Myke", r: "Founder" },
  { i: "AV", n: "Vision", r: "Chief of staff, AI" },
  { i: "OP", n: "Ops", r: "Delivery" },
  { i: "DS", n: "Design", r: "Product" },
];

const PRICING = [
  {
    name: "Solo", price: "$29", note: "per month",
    feats: ["One workspace", "Unlimited tasks and notes", "Vision briefs, 100 a month", "Google Workspace sync"],
    cta: "Start free", hi: false,
  },
  {
    name: "Team", price: "$79", note: "per month", badge: "Most chosen",
    feats: ["Three seats", "Unlimited workspaces", "Team chat and meetings", "Agents and unlimited Vision"],
    cta: "Start free", hi: true,
  },
  {
    name: "Growth", price: "$179", note: "per month",
    feats: ["Eight seats", "Social and campaigns", "Admin controls", "Custom Vision persona"],
    cta: "Start free", hi: false,
  },
];

const FAQ = [
  { q: "Do I need to connect anything to start?", a: "No. Kova works unconnected for tasks, notes and manual entry. Metrics that need a live source stay dark until you connect it — we would rather show nothing than a number we invented." },
  { q: "How do multiple ventures work?", a: "Every record carries a venture. The rail switches scope, and each venture keeps one colour everywhere — chips, charts, the org face. Cross-venture views exist, but nothing leaks by accident." },
  { q: "What does Vision actually do?", a: "It reads the record you already have and proposes: tasks from a meeting, a reply draft, a schedule for the day. Proposals arrive dashed and dimmed. A person commits them." },
  { q: "Is my data used to train models?", a: "No. Your workspace content is used to answer your prompts and nothing else." },
  { q: "Can I leave?", a: "Export your tasks, contacts and notes at any time. No lock-in clause, no export fee." },
];

export default function Landing() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    return stored === "light" || stored === "dark"
      ? stored
      : ((document.documentElement.getAttribute("data-theme") as Theme) ?? "dark");
  });
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const wordmark =
    theme === "dark"
      ? "/brand/kova-wordmark-gradient-dark.png"
      : "/brand/kova-wordmark-gradient-light.png";

  return (
    <div className="klp">
      <style>{CSS}</style>

      <header className="klp-nav">
        <div className="wrap row">
          <Link to="/" aria-label="Kova home" style={{ lineHeight: 0 }}>
            <img src={wordmark} alt="Kova" style={{ height: 24, width: "auto", display: "block" }} />
          </Link>
          <nav className="links">
            <a className="nl" href="#chain">How it works</a>
            <a className="nl" href="#honesty">Honesty</a>
            <a className="nl" href="#pricing">Pricing</a>
            <a className="nl" href="#faq">FAQ</a>
          </nav>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link className="btn btn-sec btn-sm" to="/login">Sign in</Link>
          <Link className="btn btn-pri btn-sm" to="/login?tab=signup">Start free</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="klp-hero">
        <div className="wrap inner">
          <div className="eyebrow">The operating layer for entrepreneurs</div>
          <h1 style={{ marginTop: 18 }}>
            Every hat,<span className="hb"> </span>one place.
          </h1>
          <p className="sub">
            Kova turns what happened into what&apos;s next — meetings into tasks, tasks into time,
            and every venture into one morning brief.
          </p>
          <div className="cta">
            <Link className="btn btn-pri" to="/login?tab=signup">Start free</Link>
            <a className="btn btn-sec" href="#chain">See how it works</a>
          </div>
          <div className="micro">Free for one workspace. No card required.</div>
        </div>
      </section>

      {/* THE CHAIN */}
      <section id="chain">
        <div className="wrap">
          <div className="eyebrow">The chain</div>
          <h2 style={{ marginTop: 12 }}>What happened becomes what&apos;s next.</h2>
          <div className="klp-chain">
            {CHAIN.map((s) => (
              <div className="card step" key={s.n}>
                <div className="n">{s.n}</div>
                <h3>{s.t}</h3>
                <p className="dim" style={{ fontSize: 14 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HONESTY */}
      <section id="honesty">
        <div className="wrap">
          <div className="eyebrow">Honesty</div>
          <h2 style={{ marginTop: 12 }}>Kova has no data of its own.</h2>
          <p className="dim" style={{ marginTop: 14 }}>
            Every number on screen traces back to something you connected. Nothing is modelled,
            padded or filled in. If a source is missing, the card says which one.
          </p>
          <div className="klp-two">
            <div className="card">
              <h3>What it reads</h3>
              <div style={{ marginTop: 10 }}>
                {READS.map((r) => (
                  <div className="klp-line" key={r}>
                    <Check size={15} />
                    <span style={{ fontSize: 14 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>What it proposes</h3>
              <p className="dim" style={{ fontSize: 14, margin: "8px 0 14px" }}>
                AI output arrives dashed and dimmed. It is not real until a person commits it.
              </p>
              <div className="klp-draft">
                <div className="tag">Vision draft — not sent</div>
                <div style={{ marginTop: 8 }}>
                  Three tasks from this morning&apos;s call, owner set to you, due Friday.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCALE */}
      <section id="scale">
        <div className="wrap">
          <div className="eyebrow">Scale</div>
          <h2 style={{ marginTop: 12 }}>Built for the person running four things at once.</h2>
          <div className="klp-stats">
            {STATS.map((s) => (
              <div className="card" key={s.l}>
                <div className="v">{s.v}</div>
                <div style={{ marginTop: 8, fontSize: 15 }}>{s.l}</div>
                <p className="dim" style={{ fontSize: 14, marginTop: 6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who">
        <div className="wrap">
          <div className="eyebrow">Who it&apos;s for</div>
          <h2 style={{ marginTop: 12 }}>One surface, however many hats.</h2>
          <div className="klp-who">
            {WHO.map((w) => (
              <div className="card" key={w.t}>
                <h3>
                  <span className="klp-dot" style={{ background: w.c }} />
                  {w.t}
                </h3>
                <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section id="team">
        <div className="wrap">
          <div className="eyebrow">Team</div>
          <h2 style={{ marginTop: 12 }}>Small on purpose.</h2>
          <p className="dim" style={{ marginTop: 14 }}>
            Kova is built by operators who run the ventures it was made for — plus one member
            who never sleeps.
          </p>
          <div className="klp-team">
            {TEAM.map((m) => (
              <div className="card" key={m.n}>
                <div className="klp-avatar">{m.i}</div>
                <h3 style={{ marginTop: 12 }}>{m.n}</h3>
                <div className="dim" style={{ fontSize: 14, marginTop: 4 }}>{m.r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing">
        <div className="wrap">
          <div className="eyebrow">Pricing</div>
          <h2 style={{ marginTop: 12 }}>Start free. Pay when it&apos;s carrying weight.</h2>
          <div className="klp-price">
            {PRICING.map((p) => (
              <div className={`card${p.hi ? " hi" : ""}`} key={p.name}>
                {p.badge && <div className="klp-badge">{p.badge}</div>}
                <h3>{p.name}</h3>
                <div className="amt" style={{ marginTop: 10 }}>{p.price}</div>
                <div className="dim" style={{ fontSize: 13 }}>{p.note}</div>
                <div style={{ margin: "16px 0" }}>
                  {p.feats.map((f) => (
                    <div className="feat" key={f}>
                      <Check size={14} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link className={`btn ${p.hi ? "btn-pri" : "btn-sec"}`} to="/login?tab=signup" style={{ width: "100%" }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="dim" style={{ fontSize: 13, marginTop: 14 }}>
            Free for one workspace. No card required. Enterprise pricing on request.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="eyebrow">FAQ</div>
          <h2 style={{ marginTop: 12 }}>The questions that come up.</h2>
          <div className="klp-faq">
            {FAQ.map((f, i) => (
              <div key={f.q}>
                <button
                  className={`q${open === i ? " open" : ""}`}
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                >
                  <span>{f.q}</span>
                  <ChevronDown size={18} />
                </button>
                {open === i && (
                  <div className="a">
                    <p className="dim" style={{ fontSize: 15 }}>{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="klp-close">
        <div className="wrap">
          <h2>Put every hat in one place.</h2>
          <p className="dim" style={{ margin: "16px auto 0" }}>
            One workspace, free, for as long as you like.
          </p>
          <div className="cta">
            <Link className="btn btn-pri" to="/login?tab=signup">Start free</Link>
            <Link className="btn btn-sec" to="/login">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="klp-foot">
        <div className="wrap cols">
          <div>
            <img src={wordmark} alt="Kova" style={{ height: 22, width: "auto", display: "block" }} />
            <div className="dim" style={{ fontSize: 13, marginTop: 12 }}>
              The operating layer for entrepreneurs.
            </div>
          </div>
          <div>
            <Link to="/about">About</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/changelog">Changelog</Link>
            <Link to="/roadmap">Roadmap</Link>
          </div>
          <div>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
