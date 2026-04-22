import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Sparkles, Send, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";

export interface MentionUser {
  id: string;
  display_name: string | null;
  email: string;
  handle: string; // lowercased name for @-matching
}

export interface ChatAttachment {
  path: string; // storage object key
  name: string; // original file name
  size: number; // bytes
  type: string; // mime type
}

interface Props {
  channelName: string;
  disabled?: boolean;
  members: MentionUser[];
  onSend: (text: string, mentions: string[], attachments: ChatAttachment[]) => Promise<void> | void;
  onUpload?: (file: File) => Promise<ChatAttachment>;
  onTyping?: () => void;
  onSummarize?: () => void;
  summarizing?: boolean;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_ATTACHMENTS = 5;

interface MentionState {
  open: boolean;
  query: string;
  start: number; // index of '@' in text
  index: number; // selected suggestion
}

const initialMention: MentionState = { open: false, query: "", start: -1, index: 0 };

export const MessageInput = ({
  channelName,
  disabled,
  members,
  onSend,
  onTyping,
  onSummarize,
  summarizing,
}: Props) => {
  const [text, setText] = useState("");
  const [mention, setMention] = useState<MentionState>(initialMention);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  // Filter members by current @query
  const suggestions = useMemo(() => {
    if (!mention.open) return [];
    const q = mention.query.toLowerCase();
    const list = members
      .filter((m) => !q || m.handle.includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 6);
    return list;
  }, [members, mention]);

  // Keep selected index in range
  useEffect(() => {
    if (mention.open && mention.index >= suggestions.length) {
      setMention((s) => ({ ...s, index: 0 }));
    }
  }, [suggestions.length, mention.open, mention.index]);

  function detectMention(value: string, caret: number) {
    // Find an '@' before caret with no whitespace between '@' and caret
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        const prev = value[i - 1];
        if (i === 0 || prev === " " || prev === "\n" || prev === "\t") {
          const query = value.slice(i + 1, caret);
          if (/^[a-zA-Z0-9_.-]*$/.test(query)) {
            setMention({ open: true, query, start: i, index: 0 });
            return;
          }
        }
        break;
      }
      if (ch === " " || ch === "\n" || ch === "\t") break;
      i--;
    }
    setMention(initialMention);
  }

  function insertMention(user: MentionUser) {
    if (mention.start < 0) return;
    const before = text.slice(0, mention.start);
    const caret = taRef.current?.selectionStart ?? text.length;
    const after = text.slice(caret);
    const tag = `@${user.handle} `;
    const next = before + tag + after;
    setText(next);
    setMention(initialMention);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = (before + tag).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function extractMentions(value: string): string[] {
    const ids = new Set<string>();
    const handles = new Map(members.map((m) => [m.handle, m.id]));
    const re = /(?:^|\s)@([a-zA-Z0-9_.-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      const id = handles.get(m[1].toLowerCase());
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }

  async function send() {
    const t = text.trim();
    if (!t || disabled) return;
    const mentions = extractMentions(t);
    setText("");
    setMention(initialMention);
    await onSend(t, mentions);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((s) => ({ ...s, index: (s.index + 1) % suggestions.length }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((s) => ({
          ...s,
          index: (s.index - 1 + suggestions.length) % suggestions.length,
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[mention.index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(initialMention);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      className="px-4 py-3 relative"
      style={{
        borderTop: "1px solid var(--border-glass)",
        background: "rgba(2,2,10,0.55)",
      }}
    >
      {/* Mention suggestions popover */}
      {mention.open && suggestions.length > 0 && (
        <div
          className="absolute z-20"
          style={{
            left: 16,
            right: 16,
            bottom: "100%",
            marginBottom: 6,
            maxWidth: 320,
          }}
        >
          <div
            className="rounded-[10px] overflow-hidden"
            style={{
              background: "rgba(10,10,20,0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--border-glass-hover)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="t-mono px-3 py-1.5"
              style={{
                fontSize: 9,
                borderBottom: "1px solid var(--border-glass)",
              }}
            >
              People · ↑↓ navigate · ↵ insert
            </div>
            {suggestions.map((u, i) => (
              <button
                key={u.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
                onMouseEnter={() => setMention((s) => ({ ...s, index: i }))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                style={{
                  background: i === mention.index ? "var(--bg-glass-active)" : "transparent",
                  borderLeft:
                    i === mention.index
                      ? "2px solid var(--primary-bright)"
                      : "2px solid transparent",
                }}
              >
                <div
                  className="flex items-center justify-center font-display"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "rgba(96,165,250,0.15)",
                    color: "#60A5FA",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {(u.display_name ?? u.email)
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    @{u.handle}
                  </div>
                  <div className="t-mono truncate" style={{ fontSize: 9 }}>
                    {u.display_name ?? u.email}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex items-end gap-2 p-2 rounded-[12px]"
        style={{
          background: "var(--bg-glass-1)",
          border: "1px solid var(--border-glass)",
        }}
      >
        <button
          className="btn-icon"
          style={{ width: 32, height: 32, flexShrink: 0 }}
          title="Attach (coming soon)"
          disabled
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            onTyping?.();
            const caret = e.target.selectionStart ?? v.length;
            detectMention(v, caret);
          }}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            detectMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onClick={(e) => {
            const el = e.currentTarget;
            detectMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onBlur={() => setTimeout(() => setMention(initialMention), 120)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Read-only channel" : `Message #${channelName}…`}
          rows={1}
          disabled={disabled}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "none",
            padding: "6px 4px",
            maxHeight: 140,
          }}
        />
        <button
          className="btn-icon"
          style={{ width: 32, height: 32, flexShrink: 0 }}
          onClick={onSummarize}
          disabled={summarizing}
          title="AI summarize this channel"
        >
          <Sparkles
            size={14}
            strokeWidth={1.5}
            style={{ color: summarizing ? "var(--text-muted)" : "#60A5FA" }}
          />
        </button>
        <button
          onClick={() => void send()}
          disabled={disabled || !text.trim()}
          className="btn-primary"
          style={{ height: 32, padding: "0 12px", flexShrink: 0 }}
        >
          <Send size={12} strokeWidth={2} />
        </button>
      </div>
      <div className="t-mono mt-1" style={{ fontSize: 9, paddingLeft: 4 }}>
        Enter to send · Shift+Enter newline · @mention · /todo /meeting · ✦ summarize
      </div>
    </div>
  );
};
