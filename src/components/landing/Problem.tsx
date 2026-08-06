import { Check } from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   The problem — the argument, before any feature.
   Product shots are live HTML on the tokens, never images: they
   restyle with the theme and cannot drift from the real UI.
   No hex here. Everything comes from src/design/tokens.css.
   ────────────────────────────────────────────────────────────── */

export const PROBLEM_CSS = `
/* chain of six */
.kpb-chain { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-top: 34px; }
@media (max-width: 1040px) { .kpb-chain { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 760px)  { .kpb-chain { grid-template-columns: 1fr; } }
.kpb-step {
  border-radius: var(--r-card); padding: 16px; min-height: 118px;
  display: flex; flex-direction: column; gap: 6px;
}
.kpb-step.solid { background: var(--card); border: var(--card-border); box-shadow: var(--shadow); }
.kpb-step.gap { background: transparent; border: 1px dashed var(--warn); }
.kpb-step .n { font-family: var(--display); font-size: 11px; letter-spacing: .14em; color: var(--dim); }
.kpb-step .t { font-family: var(--display); font-size: 15px; letter-spacing: -.015em; line-height: 1.25; }
.kpb-step .o { font-size: 13px; margin-top: auto; color: var(--dim); }
.kpb-step.gap .o { color: var(--warn-txt); }
.kpb-note { margin-top: 26px; max-width: 68ch; }

/* browser frame */
.kpb-shots { display: grid; gap: 26px; margin-top: 40px; }
.kpb-frame {
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
  background: var(--card); box-shadow: 0 26px 60px -24px var(--scrim);
}
.kpb-bar {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: var(--inset); border-bottom: 1px solid var(--line);
}
.kpb-dot { width: 10px; height: 10px; border-radius: var(--r-pill); display: block; }
.kpb-url {
  margin-left: 10px; font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  font-size: 11px; color: var(--dim);
}
.kpb-cap { margin-top: 12px; font-size: 13px; color: var(--dim); max-width: 72ch; }

/* shot 1 */
.kpb-app { display: grid; grid-template-columns: 158px 1fr; min-height: 372px; background: var(--bg); }
.kpb-rail {
  background: var(--nav-bg); border-right: 1px solid var(--line);
  padding: 14px 12px; display: flex; flex-direction: column; gap: 12px;
}
.kpb-ws {
  display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text);
  background: var(--inset); border-radius: var(--r-pill); padding: 5px 9px;
}
.kpb-navitem {
  font-size: 12px; color: var(--dim); padding: 6px 9px; border-radius: var(--r-inner);
  display: flex; align-items: center; gap: 8px;
}
.kpb-navitem.on { background: var(--inset); color: var(--text); }
.kpb-navdot { width: 5px; height: 5px; border-radius: var(--r-pill); background: var(--a-500); }
.kpb-ask {
  margin-top: auto; border-radius: var(--r-inner); padding: 10px;
  background: var(--brand-gradient); color: var(--on-fill); font-size: 11px; line-height: 1.35;
}
.kpb-main { padding: 16px; display: grid; gap: 12px; }
.kpb-card {
  background: var(--card); border: var(--card-border); border-radius: var(--r-inner); padding: 14px;
}
.kpb-eyebrow { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); }
.kpb-lead { font-family: var(--display); font-size: 15px; line-height: 1.35; letter-spacing: -.015em; margin-top: 7px; }
.kpb-streams { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
.kpb-stream { background: var(--inset); border-radius: var(--r-inner); padding: 8px 10px; }
.kpb-stream .v { font-family: var(--display); font-size: 17px; letter-spacing: -.03em; }
.kpb-stream .l { font-size: 10px; color: var(--dim); margin-top: 2px; }
.kpb-row2 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
@media (max-width: 620px) { .kpb-row2 { grid-template-columns: 1fr; } .kpb-app { grid-template-columns: 1fr; } .kpb-rail { display: none; } }
.kpb-stat { font-family: var(--display); font-size: 28px; letter-spacing: -.04em; line-height: 1; }
.kpb-delta { font-size: 11px; color: var(--err-txt); margin-left: 8px; }
.kpb-comb { display: flex; align-items: flex-end; gap: 3px; height: 46px; margin-top: 12px; }
.kpb-comb i { flex: 1; background: var(--a-500); border-radius: 2px; display: block; }
.kpb-notconn {
  border: 1px dashed var(--line); border-radius: var(--r-inner); padding: 14px;
  display: flex; flex-direction: column; justify-content: center; gap: 6px;
}
.kpb-notconn .h { font-size: 11px; color: var(--warn-txt); }
.kpb-notconn .b { font-size: 12px; color: var(--dim); }

/* shot 2 */
.kpb-extract { background: var(--bg); padding: 26px; display: flex; justify-content: center; }
.kpb-xcard {
  background: var(--card); border: var(--card-border); border-left: 3px dashed var(--warn);
  border-radius: var(--r-inner); padding: 16px; max-width: 520px; width: 100%;
}
.kpb-xtag { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ai-txt); }
.kpb-xclaim { font-family: var(--display); font-size: 17px; letter-spacing: -.02em; margin-top: 8px; line-height: 1.3; }
.kpb-xquote {
  border-left: 2px solid var(--line); padding-left: 10px; margin-top: 12px;
  font-style: italic; font-size: 13px; color: var(--dim); line-height: 1.5;
}
.kpb-xbtns { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.kpb-b {
  height: 36px; padding: 0 14px; border-radius: var(--r-pill); font-size: 13px;
  display: inline-flex; align-items: center; border: 1px solid transparent;
}
.kpb-b.off { border: 1px dashed var(--line); color: var(--dim); background: transparent; opacity: .7; }
.kpb-b.go { background: var(--grad-action); color: var(--on-fill); }
`;

const CHAIN6 = [
  { n: "01", t: "Recorded", o: "Fathom, Zoom", gap: false },
  { n: "02", t: "Decisions", o: "nobody", gap: true },
  { n: "03", t: "Tasks", o: "nobody", gap: true },
  { n: "04", t: "Time on a calendar", o: "nobody", gap: true },
  { n: "05", t: "Tracked", o: "Asana, Linear", gap: false },
  { n: "06", t: "Reported back", o: "nobody", gap: true },
];

const NAV = ["Dashboard", "Inbox", "Tasks", "Calendar", "Knowledge"];

const BARS = [38, 52, 30, 61, 44, 70, 35, 58, 47, 66, 29, 54, 40, 63, 33, 49, 57, 42, 68, 36];

const BrowserFrame = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <div className="kpb-frame">
    <div className="kpb-bar">
      <span className="kpb-dot" style={{ background: "var(--err)" }} />
      <span className="kpb-dot" style={{ background: "var(--warn)" }} />
      <span className="kpb-dot" style={{ background: "var(--ok)" }} />
      <span className="kpb-url">{url}</span>
    </div>
    {children}
  </div>
);

export const ProblemSection = () => (
  <section id="problem">
    <div className="wrap">
      <div className="eyebrow">The problem</div>
      <h2 style={{ marginTop: 12 }}>Your work doesn&apos;t live in one tool. It dies between them.</h2>
      <p className="dim" style={{ marginTop: 16 }}>
        A meeting gets recorded. Then what? Someone re-reads it, writes the actions down, guesses
        how long they&apos;ll take, and hunts for room in a week that&apos;s already full. Six links
        in the chain — and four of them belong to nobody.
      </p>

      <div className="kpb-chain">
        {CHAIN6.map((s) => (
          <div className={`kpb-step ${s.gap ? "gap" : "solid"}`} key={s.n}>
            <div className="n">{s.n}</div>
            <div className="t">{s.t}</div>
            <div className="o">{s.o}</div>
          </div>
        ))}
      </div>

      <p className="kpb-note">
        Kova does the four in the middle — and asks you to approve them. It doesn&apos;t try to beat
        Slack at chat or Asana at projects. It owns the handoffs, which is where the work usually
        goes missing.
      </p>

      <div className="kpb-shots">
        {/* SHOT 1 — the morning brief */}
        <div>
          <BrowserFrame url="app.kova.com/os">
            <div className="kpb-app">
              <div className="kpb-rail">
                <img
                  src="/brand/kova-wordmark-white.png"
                  alt="Kova"
                  style={{ height: 13, width: "auto", display: "block" }}
                />
                <div className="kpb-ws">
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "var(--r-pill)",
                      background: "var(--ws-uwazi)",
                    }}
                  />
                  All ventures
                </div>
                <div style={{ display: "grid", gap: 2 }}>
                  {NAV.map((n, i) => (
                    <div className={`kpb-navitem${i === 0 ? " on" : ""}`} key={n}>
                      <span
                        className="kpb-navdot"
                        style={{ background: i === 0 ? "var(--a-500)" : "var(--line)" }}
                      />
                      {n}
                    </div>
                  ))}
                </div>
                <div className="kpb-ask">
                  <strong style={{ display: "block", fontSize: 12 }}>Ask Vision</strong>
                  What needs me first?
                </div>
              </div>

              <div className="kpb-main">
                <div className="kpb-card">
                  <div className="kpb-eyebrow">Morning brief · Thursday</div>
                  <div className="kpb-lead">
                    Bug Patrol flagged something that will bite today: ballot ingest is dropping
                    Clay County precincts
                  </div>
                  <div className="kpb-streams">
                    <div className="kpb-stream"><div className="v">4</div><div className="l">awaiting reply</div></div>
                    <div className="kpb-stream"><div className="v">3</div><div className="l">due today</div></div>
                    <div className="kpb-stream"><div className="v">4</div><div className="l">on calendar</div></div>
                    <div className="kpb-stream"><div className="v">3</div><div className="l">need a decision</div></div>
                  </div>
                </div>

                <div className="kpb-row2">
                  <div className="kpb-card">
                    <div className="kpb-eyebrow">Throughput · 20 days</div>
                    <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
                      <span className="kpb-stat">172</span>
                      <span className="kpb-delta">−13.0%</span>
                    </div>
                    <div className="kpb-comb">
                      {BARS.map((b, i) => (
                        <i key={i} style={{ height: `${b}%`, opacity: i > 15 ? 0.55 : 1 }} />
                      ))}
                    </div>
                  </div>
                  <div className="kpb-notconn">
                    <div className="h">Not connected</div>
                    <div className="b">Revenue — connect Stripe</div>
                  </div>
                </div>
              </div>
            </div>
          </BrowserFrame>
          <div className="kpb-cap">
            One brief, every venture. It leads with the most severe thing rather than four equal
            counts — and names what it couldn&apos;t see rather than showing a zero.
          </div>
        </div>

        {/* SHOT 2 — the extraction moment */}
        <div>
          <BrowserFrame url="app.kova.com/os/tasks">
            <div className="kpb-extract">
              <div className="kpb-xcard">
                <div className="kpb-xtag">Extracted from your 11:30</div>
                <div className="kpb-xclaim">
                  Ship the Hoop Tea recap reel to Dana — 3h, due Friday
                </div>
                <div className="kpb-xquote">
                  &ldquo;Dana needs the recap reel before her Friday board read, so let&apos;s get
                  the cut over to her by end of week.&rdquo;
                </div>
                <div className="kpb-xbtns">
                  <span className="kpb-b off">Not a task</span>
                  <span className="kpb-b go">
                    <Check size={14} style={{ marginRight: 6 }} />
                    Make it a task
                  </span>
                </div>
              </div>
            </div>
          </BrowserFrame>
          <div className="kpb-cap">
            Every action shows the sentence it came from. Nothing is created until you say so.
          </div>
        </div>
      </div>
    </div>
  </section>
);
