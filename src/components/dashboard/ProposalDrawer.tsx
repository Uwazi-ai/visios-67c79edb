import { useEffect, useRef, useState } from "react";
import { Button, GatedButton } from "@/components/primitives";
import type { PendingProposal } from "@/hooks/useDashboardSummary";

const AGENT_LABEL: Record<string, string> = {
  chief_of_staff: "Chief of Staff",
  writer: "Writer",
  researcher: "Researcher",
  analyst: "Analyst",
  advisor: "Advisor",
  creative_director: "Creative Director",
};

export const agentLabel = (key: string) => AGENT_LABEL[key] ?? key.replace(/_/g, " ");

/**
 * The commit gate. Commit lives here and nowhere else — a single click on a
 * card must never reach a system of record. The button carries a real
 * `disabled` attribute until the payload has rendered and the reader has
 * reached the bottom of the content; visually-disabled-but-clickable is the
 * failure mode that commits agent output by accident.
 */
export const ProposalDrawer = ({
  proposal,
  onClose,
  onCommit,
}: {
  proposal: PendingProposal;
  onClose: () => void;
  onCommit: (id: string) => void;
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [read, setRead] = useState(false);
  const [payloadOk, setPayloadOk] = useState(true);
  const [payloadText, setPayloadText] = useState("");

  useEffect(() => {
    try {
      setPayloadText(JSON.stringify(proposal.payload ?? {}, null, 2));
      setPayloadOk(true);
    } catch {
      setPayloadOk(false);
    }
  }, [proposal]);

  /* A body short enough not to scroll counts as read. */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = () => {
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atEnd) setRead(true);
    };
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [payloadText]);

  const ready = read && payloadOk;

  return (
    <>
      <div className="dsh-scrim" onClick={onClose} />
      <aside className="dsh-drawer" role="dialog" aria-modal="true" aria-label={proposal.title}>
        <div className="dsh-drawer-head">
          <div className="dsh-prop-meta">
            <span className="dsh-dot" style={{ background: proposal.identity_color }} />
            {proposal.org_name}
            <span className="ai-mark">
              <span className="ai-dot" aria-hidden />
              {agentLabel(proposal.agent_key)}
            </span>
          </div>
          <h2 style={{ margin: "8px 0 0", fontSize: 18, color: "var(--text-1)" }}>
            {proposal.title}
          </h2>
        </div>

        <div className="dsh-drawer-body" ref={bodyRef}>
          <div>
            <h3 className="dsh-mod" style={{ all: "unset", display: "block", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2)" }}>
              Why this was proposed
            </h3>
            <p style={{ marginTop: 8, color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>
              {proposal.rationale ?? "No rationale was recorded for this proposal."}
            </p>
          </div>

          <div>
            <h3 style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-2)" }}>
              {proposal.kind.replace(/_/g, " ")} payload
            </h3>
            {payloadOk ? (
              <pre className="dsh-pre" style={{ marginTop: 8 }}>{payloadText}</pre>
            ) : (
              <p style={{ color: "var(--st-warn)" }}>
                This payload could not be rendered, so it cannot be committed.
              </p>
            )}
          </div>

          {typeof proposal.confidence === "number" ? (
            <p style={{ margin: 0, color: "var(--text-2)", fontSize: 13 }}>
              Confidence — agreement across signals: {Math.round(proposal.confidence * 100)}%
            </p>
          ) : null}
        </div>

        <div className="dsh-drawer-foot">
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          <GatedButton
            blockedCount={ready ? 0 : 1}
            blockedLabel={payloadOk ? "Read to the end to commit" : "Payload failed to render"}
            readyLabel="Commit"
            onClick={() => onCommit(proposal.id)}
          />
        </div>
      </aside>
    </>
  );
};
