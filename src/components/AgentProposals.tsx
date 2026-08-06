import { Proposal, ProposalStatus } from "@/data/mock";
import { Button, Desc, Tag, Title } from "@/components/primitives";

/**
 * Agent proposals.
 *
 * Unapproved output reads as unfinished: dashed amber left edge, dimmed
 * heading. Approved goes solid green, rejected solid grey at reduced
 * opacity. This is the inverse of the usual pattern, where model output
 * looks authoritative by default and the caveat sits in a footnote.
 *
 * Approval state lives on the record and is passed in. Nothing here reads
 * state back out of the DOM, so a re-render can never revert an approved
 * item to pending.
 */

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: "awaiting review",
  approved: "approved",
  rejected: "rejected",
};

export const AgentProposalCard = ({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: Proposal;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const pct = Math.round(proposal.confidence * 100);
  return (
    <article className="vo-prop" data-status={proposal.status}>
      <div className="vo-between">
        <span className="ai-mark">
          <span className="ai-dot" aria-hidden />
          {proposal.agent}
        </span>
        <Tag
          tone={
            proposal.status === "approved" ? "ok" : proposal.status === "pending" ? "warn" : undefined
          }
        >
          {STATUS_LABEL[proposal.status]}
        </Tag>
      </div>

      {/* The claim is model-written, so it carries the rule. */}
      <Title>{proposal.claim}</Title>
      <span className="ai-rule" aria-hidden />
      <Desc>{proposal.rationale}</Desc>


      <div className="vo-prop-conf">
        <div className="vo-between">
          <span className="vo-meta">Confidence — agreement across signals</span>
          <span className="vo-meta">{pct}%</span>
        </div>
        <div className="vo-track" style={{ marginTop: 4 }}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="vo-meta" style={{ marginTop: 4 }}>
          {proposal.signals.length} signals · {proposal.signals.join(" · ")}
        </div>
      </div>

      {proposal.status === "pending" ? (
        <div className="vo-row">
          <Button variant="primary" onClick={onApprove}>
            Approve
          </Button>
          <Button variant="quiet" onClick={onReject}>
            Reject
          </Button>
        </div>
      ) : null}
    </article>
  );
};
