import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Pencil, Check, X, History } from "lucide-react";
import type { MentionUser } from "./MessageInput";

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
                  </div>
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
                    {renderContent(m.content, handles, meHandle)}
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
