import { CheckCircle2, Mail, ShieldAlert } from "lucide-react";
import { Button, Desc, Eyebrow, Tag, Title } from "@/components/primitives";
import type { Draft } from "@/data/inbox";
import type { SendState } from "@/data/inboxStore";

/**
 * DraftBox — the main event of the reader.
 *
 * Dashed while unsent, solid once sent. The border is the state, not a
 * badge next to it: the shape of the block tells you before you have read
 * a word of it. Discarded keeps the dashed edge and drops the contents,
 * because a discarded draft that still looks sendable is a trap.
 */
export const DraftBox = ({
  draft,
  state,
  onSend,
  onDiscard,
}: {
  draft: Draft;
  state: SendState;
  onSend: () => void;
  onDiscard: () => void;
}) => {
  const sent = state === "sent";
  const discarded = state === "discarded";

  return (
    <div className="vo-draft" data-state={state}>
      <div className="vo-between">
        <div className="vo-row" style={{ gap: "var(--s-2)" }}>
          {sent ? <CheckCircle2 size={15} aria-hidden /> : <Mail size={15} aria-hidden />}
          {sent || discarded ? null : (
            <span className="ai-mark">
              <span className="ai-dot" aria-hidden />
              Vision
            </span>
          )}
          <Eyebrow>
            {sent
              ? "Sent by you — 9:42 AM"
              : discarded
                ? "Discarded — nothing was sent"
                : "Draft by Kova — not sent"}
          </Eyebrow>
        </div>

        <Tag tone={sent ? "ok" : undefined}>{sent ? "sent" : discarded ? "discarded" : "waiting on you"}</Tag>
      </div>

      {!discarded && (
        <>
          <Title>{draft.subject}</Title>
          <p className="vo-draftbody">{draft.body}</p>

          <div className="vo-stack" style={{ gap: 4 }}>
            <Eyebrow>Why this draft exists</Eyebrow>
            <Desc>{draft.because}</Desc>
          </div>

          <div className="vo-stack" style={{ gap: 4 }}>
            <Eyebrow>What sending touches</Eyebrow>
            <Desc>{draft.reach}</Desc>
          </div>
        </>
      )}

      {discarded && (
        <Desc>
          You discarded this draft. Kova will not rewrite it on its own — reopening the
          thread does not bring it back.
        </Desc>
      )}

      {state === "draft" ? (
        <div className="vo-row" style={{ marginTop: "var(--s-1)" }}>
          <Button variant="primary" onClick={onSend}>
            Send
          </Button>
          <Button variant="quiet" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      ) : (
        <div className="vo-meta">Decided for this session. There is no undo here because the mail has left.</div>
      )}
    </div>
  );
};

/** The rule, stated once per screen rather than implied by the styling. */
export const SendRule = () => (
  <div className="vo-warn" role="note">
    <ShieldAlert size={14} aria-hidden />
    <div>
      <strong>Kova drafts. You send.</strong>{" "}
      <span className="vo-meta">
        No draft on this screen has left the building. Nothing is queued, scheduled or
        auto-sent — the dashed edge is the whole state of it.
      </span>
    </div>
  </div>
);
