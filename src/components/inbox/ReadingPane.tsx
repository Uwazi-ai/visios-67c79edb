import { useEffect, useState } from "react";
import { ArrowLeft, Archive, Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Eyebrow, Face, Tag } from "@/components/primitives";
import { Composer } from "@/components/inbox/Composer";
import {
  CATEGORIES,
  categoryColor,
  categoryLabel,
  fullTime,
  initialsOf,
  type Category,
} from "@/data/mailCategories";
import type { MailMessage, ReplyProposal } from "@/hooks/useInbox";

export const ReadingPane = ({
  message,
  proposal,
  orgName,
  isDemo,
  onBack,
  onTriage,
  onCategory,
  onSent,
  onReloadProposals,
}: {
  message: MailMessage;
  proposal: ReplyProposal | null;
  orgName: string;
  isDemo: boolean;
  onBack: () => void;
  onTriage: (status: MailMessage["triage_status"]) => void;
  onCategory: (c: Category) => void;
  onSent: () => void;
  onReloadProposals: () => void;
}) => {
  const [body, setBody] = useState<string | null>(message.body_text ?? null);
  const [bodyLoaded, setBodyLoaded] = useState(!!message.body_text);
  const [picker, setPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBody(message.body_text ?? null);
    setBodyLoaded(!!message.body_text);
    setPicker(false);
    setError(null);
    if (message.body_text) return;

    (async () => {
      const { data, error: err } = await supabase.functions.invoke("gmail-fetch-body", {
        body: { message_id: message.id },
      });
      if (cancelled) return;
      if (err || (data as any)?.error) {
        // Falling back to the snippet keeps the message readable; the gate
        // stays closed because the full body never arrived.
        setBody(message.snippet ?? "");
        setBodyLoaded(false);
      } else {
        setBody((data as any).body_text ?? message.snippet ?? "");
        setBodyLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [message.id, message.body_text, message.snippet]);

  const send = async (text: string, saveDraft = false) => {
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("send-reply", {
      body: {
        proposal_id: proposal?.id ?? null,
        message_id: message.id,
        body: text,
        save_draft: saveDraft,
      },
    });
    setSending(false);
    const failure = err?.message ?? (data as any)?.error;
    if (failure) {
      // Nothing is committed. The text stays exactly where the user left it.
      setError(String(failure));
      return;
    }
    if (saveDraft) {
      setError(null);
      return;
    }
    onSent();
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("draft-reply", {
      body: { message_id: message.id },
    });
    setGenerating(false);
    const failure = err?.message ?? (data as any)?.error;
    if (failure) setError(String(failure));
    else onReloadProposals();
  };

  return (
    <div className="mb-read">
      <div className="mb-readhead">
        <button type="button" className="mb-back" onClick={onBack} aria-label="Back to list">
          <ArrowLeft size={16} aria-hidden />
        </button>

        <div className="vo-stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
          <h3 className="vo-title">{message.subject || "(no subject)"}</h3>
          <span className="vo-meta">
            {message.from_name || message.from_address} · {orgName} · {fullTime(message.received_at)}
          </span>
        </div>

        <div className="vo-row mb-actions">
          <Button size="sm" variant="quiet" onClick={() => onTriage("waiting")} title="Waiting on someone else">
            <Clock size={14} aria-hidden /> Waiting
          </Button>
          <Button size="sm" variant="quiet" onClick={() => onTriage("archived")} title="Archive (e)">
            <Archive size={14} aria-hidden /> Archive
          </Button>
          <Button size="sm" variant="primary" onClick={() => onTriage("done")} title="Done">
            <Check size={14} aria-hidden /> Done
          </Button>
        </div>
      </div>

      <div className="mb-catrow">
        <button
          type="button"
          className="mb-catbtn"
          onClick={() => setPicker((p) => !p)}
          aria-expanded={picker}
        >
          <span
            className="mb-dot"
            style={{ background: categoryColor(message.category) }}
            aria-hidden
          />
          {message.category_source === "pending" ? "Sorting" : categoryLabel(message.category)}
          {message.category_source === "ai" ? <span className="mb-aidot" aria-hidden /> : null}
        </button>
        {message.needs_reply ? <Tag>needs reply</Tag> : null}

        {picker ? (
          <div className="mb-picker" role="menu">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="menuitem"
                onClick={() => { onCategory(c.key); setPicker(false); }}
              >
                <span className="mb-dot" style={{ background: c.color }} aria-hidden />
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mb-body">
        <div className="vo-row" style={{ gap: "var(--s-2)", alignItems: "flex-start" }}>
          <Face initials={initialsOf(message.from_name, message.from_address)} title={message.from_address} />
          <div className="vo-stack" style={{ gap: 2, minWidth: 0 }}>
            <span className="vo-chauthor">{message.from_name || message.from_address}</span>
            <span className="vo-chtime">to {message.to_addresses.join(", ") || "you"}</span>
          </div>
        </div>
        <pre className="mb-bodytext">{body ?? "Loading the message…"}</pre>
      </div>

      {isDemo ? (
        <div className="mb-empty mb-empty-sm">
          <Eyebrow>Demo workspace</Eyebrow>
          <span className="vo-meta">
            Sample mail. Sending and drafting are refused here so nothing reaches a real inbox.
          </span>
        </div>
      ) : (
        <Composer
          draftBody={proposal?.payload?.draft_body ?? null}
          hasProposal={!!proposal}
          recipient={message.from_address || null}
          bodyLoaded={bodyLoaded}
          sending={sending}
          error={error}
          onSend={(t) => send(t, false)}
          onSaveDraft={(t) => send(t, true)}
          onGenerate={generate}
          generating={generating}
        />
      )}
    </div>
  );
};
