import { useState } from "react";
import { Desc, Eyebrow, Title } from "@/components/primitives";
import { Proposal, Sight, ToolCall } from "@/data/vision";
import { Decision } from "@/data/visionStore";

/* ------------------------------------------------------------------ */
/* Tool trace                                                           */
/* ------------------------------------------------------------------ */

const STATUS_LABEL: Record<ToolCall["status"], string> = {
  ok: "ok",
  denied: "denied",
  failed: "failed",
};

/**
 * Collapsed by default so the answer reads first, but always present and
 * always counting the calls that did not work. "Read 3 sources" with two
 * silent denials underneath would be the same dishonesty in a smaller font.
 */
export const CallTrace = ({ calls }: { calls: ToolCall[] }) => {
  const [open, setOpen] = useState(false);
  const ok = calls.filter((c) => c.status === "ok").length;
  const bad = calls.length - ok;

  return (
    <div className="vo-trace" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="vo-trace-chip"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vo-trace-dot" data-bad={bad > 0 ? "true" : "false"} aria-hidden="true" />
        Read {ok} source{ok === 1 ? "" : "s"}
        {bad > 0 ? ` · ${bad} blocked or failed` : ""}
        <span className="vo-trace-more">{open ? "hide calls" : "show calls"}</span>
      </button>

      {open ? (
        <ol className="vo-calls">
          {calls.map((c, i) => (
            <li key={i} className="vo-call" data-status={c.status}>
              <div className="vo-call-head">
                <code className="vo-mono">{c.tool}</code>
                <span className="vo-call-status" data-status={c.status}>
                  {STATUS_LABEL[c.status]}
                </span>
                <span className="vo-call-ms">{c.ms}ms</span>
              </div>
              <code className="vo-call-args">
                {Object.entries(c.args)
                  .map(([k, v]) => `${k}: ${typeof v === "number" ? v : `"${v}"`}`)
                  .join("  ·  ")}
              </code>
              <div className="vo-call-result">{c.result}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Gated side effect                                                    */
/* ------------------------------------------------------------------ */

const KIND_WORD: Record<Proposal["kind"], string> = {
  send: "Sends",
  post: "Posts",
  spend: "Spends",
  delete: "Deletes",
};

/**
 * The model returned an intent. Nothing has happened yet, and the card says
 * so in the present tense rather than the past. Both buttons are real and
 * both are terminal; the decline branch is labelled "Not now" because the
 * safe answer to an agent's suggestion is usually "not yet", not "never".
 */
export const GateCard = ({
  proposal,
  decision,
  onDecide,
}: {
  proposal: Proposal;
  decision?: Decision;
  onDecide: (d: Decision) => void;
}) => (
  <div className="vo-gate vo-vgate" data-decision={decision ?? "pending"}>
    <div className="vo-vgate-head">
      <Eyebrow>{decision ? (decision === "approved" ? "Approved by you" : "Declined") : "Waiting on you"}</Eyebrow>
      <Title>{proposal.title}</Title>
    </div>

    <blockquote className="vo-vgate-body">{proposal.body}</blockquote>

    <dl className="vo-vgate-effect">
      <div>
        <dt>Effect</dt>
        <dd>
          {KIND_WORD[proposal.kind]} — {proposal.reach}
        </dd>
      </div>
      <div>
        <dt>If you do nothing</dt>
        <dd>{proposal.ifIgnored}</dd>
      </div>
    </dl>

    {decision ? (
      <Desc>
        {decision === "approved"
          ? "Executed on your approval. This decision is final for the session — the write is not something a second click can undo."
          : "Nothing was written. Ask again and Vision will re-draft rather than resurrect this one."}
      </Desc>
    ) : (
      <div className="vo-vgate-actions">
        <button type="button" className="vo-btn" data-variant="primary" onClick={() => onDecide("approved")}>
          Approve
        </button>
        <button type="button" className="vo-btn" onClick={() => onDecide("declined")}>
          Not now
        </button>
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Right rail                                                           */
/* ------------------------------------------------------------------ */

export const Sightlines = ({ rows }: { rows: Sight[] }) => (
  <ul className="vo-sight">
    {rows.map((s) => (
      <li key={s.name} className="vo-sight-row" data-blocked={s.blocked ? "true" : "false"}>
        <div className="vo-sight-name">
          {s.name}
          {s.blocked ? <span className="vo-sight-flag">blocked</span> : null}
        </div>
        <div className="vo-meta">{s.detail}</div>
      </li>
    ))}
  </ul>
);
