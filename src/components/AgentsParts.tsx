import { Desc, Eyebrow, Tag } from "@/components/primitives";
import { Agent, hitPhrase, hitRate } from "@/data/agents";

/**
 * A 14-day comb. Bar height is runs, the notch is a day it raised a call,
 * and a day it failed is drawn rather than dropped — an agent that fell
 * over on Tuesday and reported nothing looks identical to a quiet Tuesday
 * unless you draw it.
 */
export const RunComb = ({ agent, accent }: { agent: Agent; accent: string }) => {
  const top = Math.max(...agent.history.map((r) => r.runs), 1);
  return (
    <div className="vo-comb" role="img" aria-label="14 days of runs">
      {agent.history.map((r) => (
        <span
          key={r.day}
          className="vo-comb-col"
          title={
            r.failed
              ? `${r.day === 0 ? "Today" : `${r.day}d ago`} — run failed`
              : `${r.day === 0 ? "Today" : `${r.day}d ago`} — ${r.runs} runs, ${r.calls} calls, ${r.correct} right`
          }
        >
          <span
            className="vo-comb-bar"
            data-failed={r.failed ? "true" : undefined}
            style={{
              height: `${Math.max(6, (r.runs / top) * 100)}%`,
              background: r.failed ? undefined : accent,
            }}
          />
          {r.calls > 0 ? <span className="vo-comb-notch" data-miss={r.correct < r.calls ? "true" : undefined} /> : null}
        </span>
      ))}
    </div>
  );
};

export const AgentCard = ({ agent, accent }: { agent: Agent; accent: string }) => {
  const h = hitRate(agent);
  const tone = h.pct >= 75 ? "ok" : h.pct >= 50 ? "warn" : "risk";

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-between">
        <div className="vo-row" style={{ gap: "var(--s-2)" }}>
          <span className="vo-chip-dot" style={{ background: accent }} />
          <h3 className="vo-title">{agent.name}</h3>
        </div>
        <Tag tone={agent.state === "on" ? "ok" : undefined}>
          {agent.state === "on" ? "Running" : "Paused"}
        </Tag>
      </div>

      <Desc>{agent.purpose}</Desc>

      <div className="vo-claim">
        <Eyebrow>The call it makes</Eyebrow>
        <span>{agent.claim}</span>
      </div>

      <RunComb agent={agent} accent={accent} />
      <span className="vo-meta">
        14 days · {h.runs} runs
        {h.failedDays ? ` · ${h.failedDays} failed day${h.failedDays === 1 ? "" : "s"} drawn in red` : ""}
      </span>

      <div className="vo-hit" data-tone={tone}>
        <span className="vo-hit-num">{h.pct}%</span>
        <div className="vo-stack" style={{ gap: 2 }}>
          <strong>{hitPhrase(h)}</strong>
          <span className="vo-meta">
            Scored against what happened afterwards, not against whether it found
            something. "{h.calls} issues found" would read the same at 20%.
          </span>
        </div>
      </div>

      <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
        <Eyebrow>Last call</Eyebrow>
        <span className="vo-opp-name">{agent.lastCall}</span>
      </div>

      <div className="vo-perms">
        <div>
          <Eyebrow>Does on its own</Eyebrow>
          <div className="vo-row" style={{ gap: 6, flexWrap: "wrap" }}>
            {agent.allowed.map((a) => (
              <Tag key={a}>{a}</Tag>
            ))}
          </div>
        </div>
        <div>
          <Eyebrow>Stops and asks</Eyebrow>
          <div className="vo-row" style={{ gap: 6, flexWrap: "wrap" }}>
            {agent.gated.map((a) => (
              <span key={a} className="vo-gatetag">
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
