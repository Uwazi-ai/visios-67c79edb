import { EMAIL, DUE, EVENTS, MISSING_SOURCES, Proposal, byScope } from "@/data/mock";
import { Eyebrow, Tag } from "@/components/primitives";

/**
 * Daily brief — the first thing on the page, full width.
 *
 * It has a lead, not four equal quadrants. "3 items need attention" tells
 * the reader nothing they could not have counted themselves; the brief's
 * job is to decide which one item matters most and say why it won.
 */

type Screen = "inbox" | "tasks" | "calendar" | "agents";

interface Lead {
  stream: string;
  tone: "risk" | "warn" | "accent" | "ok";
  headline: string;
  why: string;
  to: Screen;
}

/**
 * Severity order across four streams. First match wins — the order is the
 * editorial judgement, and it is here in one place rather than smeared
 * across the JSX.
 *
 *   1. an open proposal at confidence >= 0.85
 *   2. an email thread unanswered >= 7 days, longest first
 *   3. tasks due today
 *   4. nothing overdue — say so plainly and note the calendar load
 */
export function pickLead(
  proposals: Proposal[],
  email: typeof EMAIL,
  due: typeof DUE,
  events: typeof EVENTS,
): Lead {
  const confident = proposals
    .filter((p) => p.status === "pending" && p.confidence >= 0.85)
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (confident) {
    return {
      stream: `${confident.agent} · proposal`,
      tone: "risk",
      headline: confident.claim,
      why: `Leads because ${Math.round(confident.confidence * 100)}% of ${confident.agent}'s signals agree — the highest agreement anything reached today — and it is still waiting on you. ${confident.rationale}`,
      to: "agents",
    };
  }

  const stale = email
    .filter((m) => m.waitingDays >= 7)
    .sort((a, b) => b.waitingDays - a.waitingDays)[0];
  if (stale) {
    return {
      stream: "Inbox · unanswered",
      tone: "risk",
      headline: `${stale.from} has been waiting ${stale.waitingDays} days`,
      why: `Leads because it is the longest unanswered thread in scope: "${stale.subject}". No proposal cleared 85% agreement today, so this is the most severe thing open.`,
      to: "inbox",
    };
  }

  const today = due.filter((t) => t.dueToday);
  if (today.length) {
    return {
      stream: "Tasks · due today",
      tone: "warn",
      headline: today[0].title,
      why: `Leads because ${today.length === 1 ? "it is the only task" : `it is the first of ${today.length} tasks`} due today and nothing more severe is open — no high-confidence proposal, no thread past seven days.`,
      to: "tasks",
    };
  }

  return {
    stream: "All clear",
    tone: "ok",
    headline: "Nothing is overdue.",
    why: `No proposal above 85% agreement, no thread past seven days, nothing due today. Your load is ${events.length} ${events.length === 1 ? "event" : "events"} on the calendar${events[0] ? `, starting ${events[0].at} — ${events[0].title}` : ""}.`,
    to: "calendar",
  };
}

const Cell = ({
  label,
  count,
  notable,
  onOpen,
}: {
  label: string;
  count: number;
  notable: string;
  onOpen: () => void;
}) => (
  <button type="button" className="vo-brief-cell" onClick={onOpen}>
    <span className="vo-eyebrow">{label}</span>
    <span className="vo-brief-count">{count}</span>
    <span className="vo-meta vo-brief-notable">{notable}</span>
  </button>
);

export const DailyBrief = ({
  scope,
  proposals,
  navigate,
}: {
  scope: string;
  proposals: Proposal[];
  navigate: (screen: string) => void;
}) => {
  const email = byScope(EMAIL, scope);
  const due = byScope(DUE, scope);
  const events = byScope(EVENTS, scope);
  const pending = proposals.filter((p) => p.status === "pending");

  const lead = pickLead(proposals, email, due, events);
  const longest = [...email].sort((a, b) => b.waitingDays - a.waitingDays)[0];
  const dueToday = due.filter((t) => t.dueToday);
  const topPending = [...pending].sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <section className="vo-card vo-brief" aria-label="Daily brief">
      <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
        <Eyebrow>Daily brief</Eyebrow>
        <Tag tone={lead.tone === "ok" ? "ok" : lead.tone}>{lead.stream}</Tag>
      </div>

      {/* The lead. One item, chosen, with the reason it beat the others. */}
      <h2 className="vo-hero vo-brief-lead" data-tone={lead.tone}>
        {lead.headline}
      </h2>
      <p className="vo-desc vo-brief-why">{lead.why}</p>

      <div className="vo-brief-strip">
        <Cell
          label="Awaiting reply"
          count={email.length}
          notable={longest ? `${longest.from} — ${longest.waitingDays}d` : "Inbox clear"}
          onOpen={() => navigate("inbox")}
        />
        <Cell
          label="Due today"
          count={dueToday.length}
          notable={dueToday[0]?.title ?? "Nothing due"}
          onOpen={() => navigate("tasks")}
        />
        <Cell
          label="On calendar"
          count={events.length}
          notable={events[0] ? `${events[0].at} ${events[0].title}` : "No events"}
          onOpen={() => navigate("calendar")}
        />
        <Cell
          label="Need a decision"
          count={pending.length}
          notable={
            topPending
              ? `${topPending.agent} — ${Math.round(topPending.confidence * 100)}%`
              : "Queue clear"
          }
          onOpen={() => navigate("agents")}
        />
      </div>

      {/* What was missing. A brief that silently drops a dead source reads
          as complete, which is the failure mode worth designing against. */}
      <p className="vo-meta vo-brief-foot">
        Not included:{" "}
        {MISSING_SOURCES.map((s) => `${s.name} — ${s.reason}`).join(" · ")}
      </p>
    </section>
  );
};
