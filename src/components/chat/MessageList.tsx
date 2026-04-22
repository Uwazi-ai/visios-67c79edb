import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Pencil, Check, X, History, FileText, Download } from "lucide-react";
import type { ChatAttachment, MentionUser } from "./MessageInput";

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string | null;
  org_id: string | null;
  content: string;
  created_at: string;
  edited_at?: string | null;
  metadata?: any;
}

export interface ProfileLite {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Props {
  messages: ChatMessage[];
  profiles: Record<string, ProfileLite>;
  currentUserId: string;
  members: MentionUser[];
  isSystemChannel: boolean;
  typingUsers: { user_id: string }[];
  onEdit?: (messageId: string, newContent: string) => Promise<void> | void;
  resolveAttachmentUrl?: (path: string) => Promise<string | null>;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentTile({
  att,
  resolve,
  mine,
}: {
  att: ChatAttachment;
  resolve?: (path: string) => Promise<string | null>;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = att.type?.startsWith("image/");
  const isPdf = att.type === "application/pdf";

  useEffect(() => {
    let cancelled = false;
    if (!resolve) return;
    void resolve(att.path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [att.path, resolve]);

  if (isImg) {
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden"
        style={{
          maxWidth: 320,
          borderRadius: 8,
          border: "1px solid var(--border-glass)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        {url ? (
          <img
            src={url}
            alt={att.name}
            style={{
              maxWidth: "100%",
              maxHeight: 280,
              display: "block",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            className="t-mono"
            style={{ padding: 24, textAlign: "center", fontSize: 10 }}
          >
            Loading image…
          </div>
        )}
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3 py-2"
      style={{
        background: mine ? "rgba(37,99,235,0.10)" : "rgba(255,255,255,0.04)",
        border: "1px solid var(--border-glass)",
        borderRadius: 8,
        color: "var(--text-primary)",
        textDecoration: "none",
        maxWidth: 320,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: isPdf ? "rgba(239,68,68,0.18)" : "rgba(96,165,250,0.18)",
          color: isPdf ? "#FCA5A5" : "#93C5FD",
        }}
      >
        <FileText size={14} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{ fontSize: 12, fontWeight: 500 }}
        >
          {att.name}
        </div>
        <div className="t-mono" style={{ fontSize: 9 }}>
          {(isPdf ? "PDF · " : "") + formatBytes(att.size)}
        </div>
      </div>
      <Download size={12} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
    </a>
  );
}

function renderContent(
  content: string,
  handles: Map<string, string>,
  meHandle: string | null,
) {
  const re = /(@[a-zA-Z0-9_.-]+)/g;
  const parts = content.split(re);
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return <span key={i}>{part}</span>;
    const handle = part.slice(1).toLowerCase();
    if (!handles.has(handle)) return <span key={i}>{part}</span>;
    const isMe = meHandle === handle;
    return (
      <span
        key={i}
        style={{
          background: isMe ? "rgba(245,158,11,0.18)" : "rgba(96,165,250,0.18)",
          color: isMe ? "#FCD34D" : "#93C5FD",
          border: isMe
            ? "1px solid rgba(245,158,11,0.35)"
            : "1px solid rgba(96,165,250,0.35)",
          borderRadius: 4,
          padding: "0 4px",
          fontWeight: 600,
        }}
      >
        {part}
      </span>
    );
  });
}

function timeStr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString();
  const yest = new Date(Date.now() - 86400000).toDateString();
  const k = d.toDateString();
  if (k === today) return "Today";
  if (k === yest) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function initials(p?: ProfileLite) {
  if (!p) return "?";
  const n = p.display_name ?? p.email ?? "?";
  return n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

const HUE_COLORS = ["#60A5FA", "#34D399", "#F59E0B", "#A78BFA", "#F472B6", "#22D3EE"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HUE_COLORS[h % HUE_COLORS.length];
}

export const MessageList = ({
  messages,
  profiles,
  currentUserId,
  members,
  isSystemChannel,
  typingUsers,
  onEdit,
  resolveAttachmentUrl,
}: Props) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  const handles = useMemo(() => new Map(members.map((m) => [m.handle, m.id])), [members]);
  const meHandle = useMemo(
    () => members.find((m) => m.id === currentUserId)?.handle ?? null,
    [members, currentUserId],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  // Last own non-system message (only this one is editable)
  const lastOwnId = useMemo(() => {
    if (isSystemChannel) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].user_id === currentUserId) return messages[i].id;
    }
    return null;
  }, [messages, currentUserId, isSystemChannel]);

  function startEdit(m: ChatMessage) {
    setEditingId(m.id);
    setEditValue(m.content);
  }

  async function commitEdit(m: ChatMessage) {
    const next = editValue.trim();
    if (!next || next === m.content) {
      setEditingId(null);
      return;
    }
    if (!onEdit) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      await onEdit(m.id, next);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  let lastDay: string | null = null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="t-mono">No messages yet</div>
        </div>
      )}
      {messages.map((m) => {
        const day = dayKey(m.created_at);
        const showDay = day !== lastDay;
        lastDay = day;
        const mine = m.user_id === currentUserId;
        const isSystem = isSystemChannel || m.user_id === null;
        const profile = m.user_id ? profiles[m.user_id] : undefined;
        const name = profile?.display_name ?? profile?.email ?? "System";
        const nameColor = m.user_id ? colorFor(m.user_id) : "#818cf8";

        return (
          <div key={m.id}>
            {showDay && (
              <div className="flex justify-center my-3">
                <div
                  className="t-mono"
                  style={{
                    background: "var(--bg-glass-1)",
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border-glass)",
                    fontSize: 9,
                  }}
                >
                  {dayLabel(m.created_at)}
                </div>
              </div>
            )}

            {isSystem ? (
              <div className="flex justify-center">
                <div
                  className="flex items-start gap-2 max-w-[70%]"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontStyle: "italic",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  <Zap size={12} style={{ color: "#818cf8", marginTop: 2 }} />
                  <span>{m.content}</span>
                </div>
              </div>
            ) : (
              <div
                className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
                style={{ alignItems: "flex-start" }}
              >
                <div
                  className="flex items-center justify-center font-display"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${nameColor}22`,
                    color: nameColor,
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials(profile)}
                </div>
                <div
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                  style={{ maxWidth: "70%" }}
                >
                  <div
                    className={`flex items-center gap-2 mb-1 ${mine ? "flex-row-reverse" : ""}`}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 12,
                        color: nameColor,
                      }}
                    >
                      {mine ? "You" : name}
                    </span>
                    <span className="t-mono" style={{ fontSize: 9 }}>
                      {timeStr(m.created_at)}
                    </span>
                    {m.edited_at && (
                      <button
                        onClick={() =>
                          setHistoryOpenId(historyOpenId === m.id ? null : m.id)
                        }
                        className="t-mono inline-flex items-center gap-1"
                        title={`Edited ${timeStr(m.edited_at)} · click to view history`}
                        style={{
                          fontSize: 9,
                          fontStyle: "italic",
                          color: "var(--text-muted)",
                          padding: "0 2px",
                        }}
                      >
                        <History size={9} strokeWidth={1.5} /> edited
                      </button>
                    )}
                  </div>
                  <div className={`group/msg relative ${mine ? "self-end" : "self-start"}`}>
                    <div
                      style={{
                        background: mine ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.06)",
                        border: mine
                          ? "1px solid rgba(37,99,235,0.40)"
                          : "1px solid var(--border-glass)",
                        borderRadius: mine ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                        padding: "8px 12px",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {editingId === m.id ? (
                        <div className="flex flex-col gap-2" style={{ minWidth: 220 }}>
                          <textarea
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void commitEdit(m);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            rows={Math.min(6, editValue.split("\n").length)}
                            disabled={saving}
                            style={{
                              background: "rgba(0,0,0,0.25)",
                              border: "1px solid var(--border-glass)",
                              borderRadius: 6,
                              color: "var(--text-primary)",
                              fontFamily: "var(--font-body)",
                              fontSize: 14,
                              lineHeight: 1.5,
                              padding: "6px 8px",
                              outline: "none",
                              resize: "vertical",
                              minHeight: 60,
                            }}
                          />
                          <div className="flex items-center justify-end gap-2">
                            <span className="t-mono" style={{ fontSize: 9, marginRight: "auto" }}>
                              Enter to save · Esc to cancel
                            </span>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={saving}
                              className="btn-ghost"
                              style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                            >
                              <X size={11} strokeWidth={1.5} /> Cancel
                            </button>
                            <button
                              onClick={() => void commitEdit(m)}
                              disabled={saving || !editValue.trim()}
                              className="btn-primary"
                              style={{ height: 24, padding: "0 10px", fontSize: 11 }}
                            >
                              <Check size={11} strokeWidth={2} /> {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        renderContent(m.content, handles, meHandle)
                      )}
                    </div>

                    {mine && m.id === lastOwnId && editingId !== m.id && onEdit && (
                      <button
                        onClick={() => startEdit(m)}
                        title="Edit message"
                        className="absolute opacity-0 group-hover/msg:opacity-100 transition-opacity"
                        style={{
                          top: -10,
                          right: -10,
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: "rgba(15,15,25,0.95)",
                          border: "1px solid var(--border-glass-hover)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Pencil size={11} strokeWidth={1.5} />
                      </button>
                    )}

                    {historyOpenId === m.id && Array.isArray(m.metadata?.edits) && m.metadata.edits.length > 0 && (
                      <div
                        className={`absolute z-10 ${mine ? "right-0" : "left-0"}`}
                        style={{
                          top: "100%",
                          marginTop: 6,
                          minWidth: 240,
                          maxWidth: 320,
                          background: "rgba(10,10,20,0.95)",
                          backdropFilter: "blur(20px)",
                          border: "1px solid var(--border-glass-hover)",
                          borderRadius: 10,
                          padding: 8,
                          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                        }}
                      >
                        <div
                          className="t-mono px-1 pb-1 mb-1 flex items-center justify-between"
                          style={{
                            fontSize: 9,
                            borderBottom: "1px solid var(--border-glass)",
                          }}
                        >
                          <span>Edit history · {m.metadata.edits.length}</span>
                          <button onClick={() => setHistoryOpenId(null)}>
                            <X size={10} strokeWidth={1.5} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                          {[...m.metadata.edits].reverse().map((e: any, i: number) => (
                            <div
                              key={i}
                              style={{
                                background: "var(--bg-glass-1)",
                                border: "1px solid var(--border-glass)",
                                borderRadius: 6,
                                padding: "6px 8px",
                              }}
                            >
                              <div className="t-mono mb-1" style={{ fontSize: 9 }}>
                                {e.at ? timeStr(e.at) : "earlier"}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-secondary)",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {e.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {typingUsers.length > 0 && (
        <div
          className="flex items-center gap-2 px-2"
          style={{
            fontStyle: "italic",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <div className="flex gap-0.5">
            <span className="typing-dot" />
            <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
            <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
          </div>
          <span>
            {typingUsers
              .map((t) => profiles[t.user_id]?.display_name ?? profiles[t.user_id]?.email ?? "Someone")
              .join(", ")}{" "}
            {typingUsers.length === 1 ? "is" : "are"} typing…
          </span>
        </div>
      )}
      <div ref={endRef} />
      <style>{`
        .typing-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--text-muted);
          display: inline-block;
          animation: typing-bounce 1s infinite;
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
