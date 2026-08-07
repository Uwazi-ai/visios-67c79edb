import { useEffect, useRef, useState } from "react";
import { GatedButton, Button } from "@/components/primitives";

/**
 * Composer — three entry states, one gate.
 *
 * The transition that matters: while the body still equals the model's draft,
 * the border is dashed magenta and the label says Vision wrote it. The first
 * keystroke resolves it to a solid blue border and the label changes. That is
 * the visible moment authorship moves from the machine to the person, and it
 * is why the draft is editable in place rather than presented for approval.
 */
export const Composer = ({
  draftBody,
  hasProposal,
  recipient,
  bodyLoaded,
  sending,
  error,
  onSend,
  onSaveDraft,
  onGenerate,
  generating,
}: {
  draftBody: string | null;
  hasProposal: boolean;
  recipient: string | null;
  bodyLoaded: boolean;
  sending: boolean;
  error: string | null;
  onSend: (body: string) => void;
  onSaveDraft: (body: string) => void;
  onGenerate: () => void;
  generating: boolean;
}) => {
  const [body, setBody] = useState(draftBody ?? "");
  const [edited, setEdited] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setBody(draftBody ?? "");
    setEdited(false);
  }, [draftBody]);

  const fromVision = hasProposal && !!draftBody;
  const state = !fromVision ? "plain" : edited ? "edited" : "vision";

  const blocked =
    (body.trim().length === 0 ? 1 : 0) + (recipient ? 0 : 1) + (bodyLoaded ? 0 : 1);

  const blockedLabel = !bodyLoaded
    ? "Waiting for the message to load"
    : !recipient
      ? "No recipient resolved"
      : "Write a reply first";

  return (
    <div className="mb-composer" data-state={state}>
      <div className="vo-between mb-composerhead">
        <span className={state === "vision" ? "ai-mark" : "mb-composerlabel"}>
          {state === "vision" ? <span className="ai-dot" aria-hidden /> : null}
          {state === "vision"
            ? "Vision drafted this"
            : state === "edited"
              ? "Vision draft, edited by you"
              : "Reply"}
        </span>
        <span className="vo-meta">{recipient ? `To ${recipient}` : "No recipient"}</span>
      </div>

      <textarea
        ref={ref}
        className="mb-textarea"
        value={body}
        placeholder="Write a reply…"
        onChange={(e) => {
          setBody(e.target.value);
          if (fromVision && !edited && e.target.value !== draftBody) setEdited(true);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && blocked === 0 && !sending) {
            e.preventDefault();
            onSend(body);
          }
        }}
        rows={8}
      />

      {error ? <div className="mb-error" role="alert">{error}</div> : null}

      <div className="vo-row mb-composeractions">
        <GatedButton
          blockedCount={sending ? 1 : blocked}
          blockedLabel={sending ? "Sending…" : blockedLabel}
          readyLabel="Send"
          variant={fromVision ? "complete" : "plain"}
          onClick={() => onSend(body)}
        />
        <Button
          variant="quiet"
          disabled={blocked > 0 || sending}
          onClick={() => onSaveDraft(body)}
        >
          Save to Gmail drafts
        </Button>

        {!hasProposal ? (
          <button
            type="button"
            className="mb-generate"
            onClick={onGenerate}
            disabled={generating || !bodyLoaded}
          >
            <span className="ai-dot" aria-hidden />
            {generating ? "Drafting…" : "Generate a draft"}
          </button>
        ) : null}
      </div>

      <div className="vo-meta">Cmd+Enter sends. Nothing here leaves until you send it.</div>
    </div>
  );
};
