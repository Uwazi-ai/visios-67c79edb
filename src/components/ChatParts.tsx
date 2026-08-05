import { KeyboardEvent, useState } from "react";
import { MessageSquare, Smile } from "lucide-react";
import { Desc, Eyebrow, Face, Title } from "@/components/primitives";
import {
  ActionState,
  AUTHORS,
  Channel,
  clock,
  KIND_WORD,
  ME,
  Message,
  MessageAction,
  QUICK_EMOJI,
} from "@/data/chat";

/* ------------------------------------------------------------------ */
/* Channel list                                                        */
/* ------------------------------------------------------------------ */

export const ChannelRail = ({
  channels,
  activeId,
  onSelect,
}: {
  channels: Channel[];
  activeId: string;
  onSelect: (id: string) => void;
}) => {
  const rooms = channels.filter((c) => c.kind === "channel");
  const dms = channels.filter((c) => c.kind === "dm");

  const row = (c: Channel) => {
    const peer = c.peer ? AUTHORS[c.peer] : undefined;
    return (
      <li key={c.id}>
        <button
          type="button"
          className="vo-chrow"
          aria-current={c.id === activeId ? "true" : undefined}
          onClick={() => onSelect(c.id)}
        >
          {peer ? (
            <span className="vo-chdot" data-presence={peer.presence ?? "offline"} title={peer.presence} />
          ) : (
            <span className="vo-chhash" aria-hidden>
              #
            </span>
          )}
          <span className="vo-chname">{c.name}</span>
          {c.unread > 0 ? <span className="vo-chpip">{c.unread}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <nav className="vo-chlist" aria-label="Conversations">
      <Eyebrow>Channels</Eyebrow>
      <ul>{rooms.map(row)}</ul>
      <Eyebrow>Direct messages</Eyebrow>
      <ul>{dms.map(row)}</ul>
      {rooms.length + dms.length === 0 ? (
        <Desc>No conversations in this workspace scope.</Desc>
      ) : null}
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/* Gated action card, carried by an agent's message                    */
/* ------------------------------------------------------------------ */

export const ActionCard = ({
  action,
  state,
  onDecide,
}: {
  action: MessageAction;
  state: ActionState;
  onDecide: (d: ActionState) => void;
}) => (
  <div className="vo-gate vo-vgate" data-decision={state}>
    <div className="vo-vgate-head">
      <Eyebrow>
        {state === "approved" ? "Approved by you" : state === "declined" ? "Declined" : "Waiting on you"}
      </Eyebrow>
      <Title>{action.title}</Title>
    </div>

    <pre className="vo-chdiff">{action.body}</pre>

    <dl className="vo-vgate-effect">
      <div>
        <dt>Effect</dt>
        <dd>
          {KIND_WORD[action.kind]} — {action.reach}
        </dd>
      </div>
      <div>
        <dt>If you do nothing</dt>
        <dd>{action.ifIgnored}</dd>
      </div>
    </dl>

    {state === "pending" ? (
      <div className="vo-vgate-actions">
        <button type="button" className="vo-btn" data-variant="primary" onClick={() => onDecide("approved")}>
          Approve
        </button>
        <button type="button" className="vo-btn" onClick={() => onDecide("declined")}>
          Not now
        </button>
      </div>
    ) : (
      <Desc>
        {state === "approved"
          ? "Executed on your approval. Final for the session — the write is not something a second click takes back."
          : "Nothing was written. Bug Patrol will re-raise it if the condition persists."}
      </Desc>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Reactions                                                           */
/* ------------------------------------------------------------------ */

const Reactions = ({
  message,
  onReact,
}: {
  message: Message;
  onReact: (emoji: string) => void;
}) => {
  const entries = Object.entries(message.reactions);
  if (!entries.length) return null;
  return (
    <div className="vo-chreacts">
      {entries.map(([emoji, who]) => (
        <button
          key={emoji}
          type="button"
          className="vo-chreact"
          data-mine={who.includes(ME) ? "true" : undefined}
          onClick={() => onReact(emoji)}
          title={who.map((w) => AUTHORS[w]?.name ?? w).join(", ")}
        >
          <span>{emoji}</span>
          <span>{who.length}</span>
        </button>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Message row                                                         */
/* ------------------------------------------------------------------ */

export const MessageRow = ({
  message,
  grouped,
  onReact,
  onOpenThread,
  onDecide,
  threadOpen,
  compact,
}: {
  message: Message;
  grouped: boolean;
  onReact: (emoji: string) => void;
  onOpenThread?: () => void;
  onDecide?: (d: ActionState) => void;
  threadOpen?: boolean;
  compact?: boolean;
}) => {
  const [picker, setPicker] = useState(false);
  const author = AUTHORS[message.author];
  const isAgent = author?.kind === "agent";

  return (
    <article className="vo-chmsg" data-grouped={grouped ? "true" : undefined} data-agent={isAgent ? "true" : undefined}>
      <div className="vo-chmsg-gutter">
        {grouped ? (
          <span className="vo-chtime-hover">{clock(message.at)}</span>
        ) : (
          <Face initials={author?.initials ?? "??"} title={author?.name} color={author?.color} shape={isAgent ? "square" : "circle"} />
        )}
      </div>

      <div className="vo-chmsg-body">
        {!grouped && (
          <div className="vo-chmsg-head">
            <span className="vo-chauthor">{author?.name ?? message.author}</span>
            {isAgent ? (
              <span className="vo-chagent" title={author?.remit}>
                AGENT
              </span>
            ) : null}
            <span className="vo-chtime">{clock(message.at)}</span>
          </div>
        )}

        <p className="vo-chtext">{message.text}</p>

        {message.action && onDecide ? (
          <ActionCard action={message.action} state={message.actionState ?? "pending"} onDecide={onDecide} />
        ) : null}

        <Reactions message={message} onReact={onReact} />

        {!compact && message.replies.length > 0 && onOpenThread ? (
          <button type="button" className="vo-chthreadlink" onClick={onOpenThread} aria-pressed={threadOpen}>
            <MessageSquare size={13} strokeWidth={1.75} aria-hidden />
            {message.replies.length} {message.replies.length === 1 ? "reply" : "replies"}
          </button>
        ) : null}
      </div>

      <div className="vo-chactions" role="group" aria-label="Message actions">
        {picker ? (
          <div className="vo-chpicker">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onReact(e);
                  setPicker(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="vo-chaction" onClick={() => setPicker((v) => !v)} title="React">
          <Smile size={14} strokeWidth={1.75} aria-hidden />
        </button>
        {!compact && onOpenThread ? (
          <button type="button" className="vo-chaction" onClick={onOpenThread} title="Reply in thread">
            <MessageSquare size={14} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
};

/* ------------------------------------------------------------------ */
/* Composer — Enter sends, Shift+Enter newlines                         */
/* ------------------------------------------------------------------ */

export const Composer = ({
  placeholder,
  onSend,
  label,
}: {
  placeholder: string;
  onSend: (text: string) => void;
  label: string;
}) => {
  const [draft, setDraft] = useState("");

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="vo-chcomposer">
      <textarea
        className="vo-input vo-chtextarea"
        value={draft}
        rows={1}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="vo-chcomposer-foot">
        <span className="vo-meta">Enter sends · Shift+Enter for a new line</span>
        <button type="button" className="vo-btn" data-variant="primary" disabled={!draft.trim()} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
};
