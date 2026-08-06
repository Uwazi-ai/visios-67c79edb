import { BrowserFrame } from "./Problem";

/* Honesty · Scale · Who it's for.
   Token-only styling; shots are live HTML, never images. */

export const SECTIONS_CSS = `
/* comparison */
.ksec-cmp { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 32px; }
@media (max-width: 820px) { .ksec-cmp { grid-template-columns: 1fr; } }
.ksec-cmp .hd { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); padding-bottom: 10px; }
.ksec-cmp .hd.ai { color: var(--ai-txt); }
.ksec-row { border-top: 1px solid var(--line); padding: 14px 0; font-size: 14px; line-height: 1.55; min-height: 78px; }
.ksec-cmp .col.most .ksec-row { color: var(--dim); }

/* slack triage shot */
.ksec-slack { background: var(--bg); padding: 18px; display: grid; gap: 12px; }
.ksec-thread { background: var(--card); border: var(--card-border); border-radius: var(--r-inner); padding: 14px; }
.ksec-tag {
  display: inline-block; font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  border-radius: var(--r-pill); padding: 3px 9px; border: 1px solid currentColor;
}
.ksec-tag.client { color: var(--ok-txt); }
.ksec-tag.contractor { color: var(--accent-txt); }
.ksec-who { font-size: 13px; color: var(--text); margin-top: 10px; }
.ksec-meta { font-size: 12px; color: var(--dim); }
.ksec-cost { font-size: 13px; margin-top: 8px; }

.ksec-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 26px; }
@media (max-width: 820px) { .ksec-three { grid-template-columns: 1fr; } }

/* ladder */
.ksec-ladder { margin-top: 32px; border-top: 1px solid var(--line); }
.ksec-rung {
  display: grid; grid-template-columns: 150px 180px 1fr; gap: 18px; align-items: baseline;
  padding: 18px 0; border-bottom: 1px solid var(--line);
}
@media (max-width: 760px) { .ksec-rung { grid-template-columns: 1fr; gap: 6px; } }
.ksec-rung .stage { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-txt); }
.ksec-rung .state { font-family: var(--display); font-size: 16px; letter-spacing: -.015em; }
.ksec-rung .say { font-size: 14px; color: var(--dim); line-height: 1.55; }

/* two-up shots */
.ksec-twoup { display: grid; grid-template-columns: 1fr 300px; gap: 22px; margin-top: 36px; align-items: start; }
@media (max-width: 900px) { .ksec-twoup { grid-template-columns: 1fr; } }
.ksec-cap { margin-top: 12px; font-size: 13px; color: var(--dim); max-width: 68ch; }

.ksec-week { background: var(--bg); padding: 16px; }
.ksec-weekhd { display: grid; grid-template-columns: 44px repeat(5, 1fr); gap: 6px; font-size: 10px; color: var(--dim); }
.ksec-weekgrid { display: grid; grid-template-columns: 44px repeat(5, 1fr); gap: 6px; margin-top: 6px; }
.ksec-hours { display: grid; gap: 6px; font-size: 9px; color: var(--dim); }
.ksec-col { display: grid; gap: 6px; }
.ksec-slot { height: 26px; border-radius: 4px; background: var(--inset); }
.ksec-slot.meet { background: var(--inset); border: 1px solid var(--line); }
.ksec-slot.task {
  background: var(--a-500); color: var(--on-fill); font-size: 9px;
  display: flex; align-items: center; padding: 0 6px; overflow: hidden; white-space: nowrap;
}
.ksec-slot.empty { background: transparent; border: 1px dashed var(--line); }
.ksec-slot.lbl { background: var(--inset); font-size: 9px; color: var(--dim); display: flex; align-items: center; padding: 0 6px; overflow: hidden; }

/* phone */
.ksec-phone {
  width: 300px; max-width: 100%; border: 1px solid var(--line); border-radius: 30px;
  background: var(--nav-bg); padding: 12px; box-shadow: 0 26px 60px -24px var(--scrim);
}
.ksec-screen { background: var(--bg); border-radius: 22px; padding: 14px; display: grid; gap: 10px; }
.ksec-notch { width: 74px; height: 5px; border-radius: var(--r-pill); background: var(--line); margin: 2px auto 10px; }
.ksec-mini { background: var(--card); border: var(--card-border); border-radius: var(--r-inner); padding: 12px; }
.ksec-mini .k { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
.ksec-mini .l { font-family: var(--display); font-size: 13px; line-height: 1.35; margin-top: 6px; letter-spacing: -.01em; }
.ksec-mini .big { font-family: var(--display); font-size: 24px; letter-spacing: -.04em; }
.ksec-mcomb { display: flex; align-items: flex-end; gap: 2px; height: 34px; margin-top: 10px; }
.ksec-mcomb i { flex: 1; background: var(--a-500); border-radius: 2px; display: block; }

/* who cards */
.ksec-who4 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 32px; }
@media (max-width: 760px) { .ksec-who4 { grid-template-columns: 1fr; } }
.ksec-seats { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-txt); }
.ksec-punch { margin-top: 12px; font-size: 15px; font-weight: 600; line-height: 1.45; }
`;

const CMP = [
  { l: "Revenue: $0", r: "Not included: revenue — not connected." },
  { l: "+36% this month", r: "Only 26 closes in scope — treat the percentage as noise." },
  { l: "93% accurate", r: "93% confidence across 3 signals. Confidence means agreement, not correctness." },
];

const PILLARS = [
  { t: "Agents propose", s: "People commit", d: "Nothing an agent writes becomes real on its own. It arrives dashed and waits for a person." },
  { t: "Nothing hidden", s: "You see what it read", d: "Every claim shows its source sentence, and every gap names the source it could not reach." },
  { t: "Your data", s: "Read, not written", d: "Kova reads your tools and writes back only where you asked it to. No silent edits." },
];

const LADDER = [
  { stage: "Day one", state: "Nothing connected", say: "Pipeline, digital card, booking link — value before setup" },
  { stage: "Week one", state: "Connected", say: "Daily brief, meetings into tasks, knowledge your assistant can cite" },
  { stage: "First hires", state: "A team", say: "Assignees, scoped access, agents your whole team can see" },
  { stage: "Next venture", state: "Two businesses", say: "One login, separate worlds, one morning brief across both" },
  { stage: "Portfolio", state: "Several", say: "Cross-venture reporting without asking which login that was under" },
];

const WHO4 = [
  {
    seats: "3–5 people", t: "Small teams",
    d: "Everyone sees the same record of what was decided and who owns it. No one re-types the call into a tracker afterwards.",
    p: "A meeting becomes four tasks with owners and time — before you leave the call.",
  },
  {
    seats: "Solo, with clients", t: "Agencies of one",
    d: "Each client is its own workspace with its own colour, contacts and threads. Switching context takes one click, not one login.",
    p: "Every workspace in one list, ranked by what it costs to keep someone waiting.",
  },
  {
    seats: "Several clients", t: "Fractional executives",
    d: "The brief remembers the last conversation so you don't. Notes, decisions and open threads roll forward per engagement.",
    p: "Walk into every call already knowing what moved since the last one.",
  },
  {
    seats: "2–10 ventures", t: "Portfolio operators",
    d: "Every venture keeps a separate world and a shared morning read. Reporting spans them without merging them.",
    p: "Six ventures, one morning.",
  },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = ["9", "10", "11", "12", "1", "2", "3"];
/* solid = booked meeting, task = accepted work placed into real gaps, empty = Friday held open */
const WEEK: ("meet" | "task" | "free")[][] = [
  ["meet", "task", "free", "meet", "task", "free", "meet"],
  ["task", "meet", "meet", "free", "task", "free", "free"],
  ["meet", "free", "task", "task", "meet", "free", "meet"],
  ["free", "meet", "task", "free", "meet", "task", "free"],
  ["free", "free", "free", "free", "free", "free", "free"],
];
const TASK_LABELS = ["Recap reel", "Ballot fix", "Dana call prep", "Board deck", "Invoice run", "Precinct QA"];

const MBARS = [40, 58, 34, 66, 47, 71, 38, 60, 52, 45, 63, 36, 55, 42];

export const HonestySection = () => (
  <section id="honesty">
    <div className="wrap">
      <div className="eyebrow">Why you can trust it</div>
      <h2 style={{ marginTop: 12 }}>It tells you when it doesn&apos;t know.</h2>
      <p className="dim" style={{ marginTop: 16 }}>
        Most dashboards fill the gaps. A source they can&apos;t read becomes a zero. Six data points
        become a confident percentage. You learn not to trust your own numbers, and then you stop
        looking.
      </p>

      <div className="ksec-cmp">
        <div className="card col most">
          <div className="hd">Most tools</div>
          {CMP.map((c) => (
            <div className="ksec-row" key={c.l}>{c.l}</div>
          ))}
        </div>
        <div className="card col">
          <div className="hd ai">Kova</div>
          {CMP.map((c) => (
            <div className="ksec-row" key={c.r}>{c.r}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <BrowserFrame url="app.kova.com/os/inbox">
          <div className="ksec-slack">
            <div className="ksec-thread">
              <span className="ksec-tag client">Client</span>
              <div className="ksec-who">
                Dana Reyes <span className="ksec-meta">· anheuser-busch · guest · 4 days ago</span>
              </div>
              <div className="ksec-cost">$48,000 · Q4 activation, in negotiation</div>
            </div>
            <div className="ksec-thread">
              <span className="ksec-tag contractor">Contractor</span>
              <div className="ksec-who">
                Darrien Cole <span className="ksec-meta">· #production · this morning</span>
              </div>
              <div className="ksec-cost">Contractor blocked · paid while waiting</div>
            </div>
          </div>
        </BrowserFrame>
        <div className="ksec-cap">
          Ranked by what it costs, not by timestamp. A client four days into a negotiation outranks
          this morning&apos;s internal note. Replying still happens in Slack — Kova just notices.
        </div>
      </div>

      <div className="ksec-three">
        {PILLARS.map((p) => (
          <div className="card" key={p.t}>
            <h3>
              {p.t} <span className="dim">/ {p.s}</span>
            </h3>
            <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const ScaleSection = () => (
  <section id="scale">
    <div className="wrap">
      <div className="eyebrow">Scale</div>
      <h2 style={{ marginTop: 12 }}>Nothing here breaks when you hire.</h2>
      <p className="dim" style={{ marginTop: 16 }}>
        Most stacks force a migration at every stage. Start solo with a pipeline and a booking link;
        add a teammate, then a second venture. Same login, same tools, no move.
      </p>

      <div className="ksec-ladder">
        {LADDER.map((r) => (
          <div className="ksec-rung" key={r.stage}>
            <div className="stage">{r.stage}</div>
            <div className="state">{r.state}</div>
            <div className="say">{r.say}</div>
          </div>
        ))}
      </div>

      <div className="ksec-twoup">
        <div>
          <BrowserFrame url="app.kova.com/os/tasks">
            <div className="ksec-week">
              <div className="ksec-weekhd">
                <span />
                {DAYS.map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="ksec-weekgrid">
                <div className="ksec-hours">
                  {HOURS.map((h) => (
                    <span key={h} style={{ height: 26, display: "flex", alignItems: "center" }}>{h}</span>
                  ))}
                </div>
                {WEEK.map((col, ci) => (
                  <div className="ksec-col" key={ci}>
                    {col.map((slot, ri) => {
                      if (slot === "task") {
                        return (
                          <div className="ksec-slot task" key={ri}>
                            {TASK_LABELS[(ci + ri) % TASK_LABELS.length]}
                          </div>
                        );
                      }
                      if (slot === "meet") {
                        return <div className="ksec-slot lbl" key={ri}>Meeting</div>;
                      }
                      return <div className="ksec-slot empty" key={ri} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </BrowserFrame>
          <div className="ksec-cap">
            Tasks with time attached. Accepted actions land in the hours you actually have — 5.5h a
            day after meetings, not a theoretical eight.
          </div>
        </div>

        <div className="ksec-phone">
          <div className="ksec-notch" />
          <div className="ksec-screen">
            <img
              src="/brand/kova-wordmark-white.png"
              alt="Kova"
              style={{ height: 13, width: "auto", display: "block" }}
            />
            <div className="ksec-mini">
              <div className="k">Morning brief</div>
              <div className="l">
                Bug Patrol flagged something that will bite today: ballot ingest is dropping Clay
                County precincts
              </div>
            </div>
            <div className="ksec-mini">
              <div className="k">Throughput · 20 days</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span className="big">172</span>
                <span style={{ fontSize: 11, color: "var(--err-txt)" }}>−13.0%</span>
              </div>
              <div className="ksec-mcomb">
                {MBARS.map((b, i) => <i key={i} style={{ height: `${b}%` }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const WhoSection = () => (
  <section id="who">
    <div className="wrap">
      <div className="eyebrow">Who it&apos;s for</div>
      <h2 style={{ marginTop: 12 }}>One surface, however many hats.</h2>
      <div className="ksec-who4">
        {WHO4.map((w) => (
          <div className="card" key={w.t}>
            <div className="ksec-seats">{w.seats}</div>
            <h3 style={{ marginTop: 8 }}>{w.t}</h3>
            <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>{w.d}</p>
            <div className="ksec-punch">{w.p}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
