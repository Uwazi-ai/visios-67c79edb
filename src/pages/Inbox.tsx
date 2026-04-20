import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Inbox as InboxIcon,
  Search,
  RefreshCw,
  Sparkles,
  Plus,
  MoreHorizontal,
  CornerUpLeft,
  ArrowRight,
  ArrowLeft,
  Send,
  X,
  RotateCw,
  AlertTriangle,
  Paperclip,
} from "lucide-react";

type Urgency = "urgent" | "action" | "fyi" | "newsletter";

interface ThreadSummary {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  urgency: Urgency;
  messageCount: number;
}

interface ThreadMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  date: string;
  messageId?: string;
  references?: string;
  snippet: string;
  body: string;
  bodyText?: string;
  bodyHtml?: string;
  labelIds: string[];
}

const FILTERS: { key: "all" | Urgency; label: string }[] = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs Reply" },
  { key: "urgent", label: "Urgent" },
  { key: "fyi", label: "FYI" },
  { key: "newsletter", label: "Newsletter" },
];

const URGENCY_STYLES: Record<Urgency, { bg: string; color: string; border: string; label: string }> = {
  urgent: { bg: "rgba(239,68,68,0.12)", color: "#FCA5A5", border: "rgba(239,68,68,0.30)", label: "URGENT" },
  action: { bg: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "rgba(59,130,246,0.30)", label: "ACTION" },
  fyi: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", border: "rgba(255,255,255,0.10)", label: "FYI" },
  newsletter: { bg: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.40)", border: "rgba(255,255,255,0.06)", label: "NEWS" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function colorFromName(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

function formatTime(date: string) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const s = URGENCY_STYLES[urgency];
  return (
    <span
      className="t-mono"
      style={{
        fontSize: 9,
        padding: "2px 6px",
        borderRadius: 4,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        letterSpacing: "0.08em",
      }}
    >
      {s.label}
    </span>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorFromName(name || "?"),
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials(name || "?")}
    </div>
  );
}

function EmailListItem({
  t,
  selected,
  onClick,
}: {
  t: ThreadSummary;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 transition-all"
      style={{
        borderRadius: 10,
        background: selected ? "var(--bg-glass-active)" : "transparent",
        borderLeft: selected ? "2px solid hsl(var(--primary))" : "2px solid transparent",
        boxShadow: selected ? `0 0 24px ${"var(--glow-blue)"}` : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <div className="flex gap-3">
        <Avatar name={t.fromName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: t.isUnread ? 600 : 400,
                fontSize: 12.5,
                color: "var(--text-primary)",
              }}
            >
              {t.fromName}
            </span>
            <span
              className="t-mono"
              style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}
            >
              {formatTime(t.date)}
            </span>
          </div>
          <div
            className="truncate mt-0.5"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: t.isUnread ? 600 : 400,
              fontSize: 12,
              color: t.isUnread ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {t.subject}
          </div>
          <div
            className="truncate mt-0.5"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 300,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {t.snippet}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <UrgencyBadge urgency={t.urgency} />
            {t.isUnread && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "hsl(var(--primary))",
                  boxShadow: "0 0 8px var(--glow-blue-strong)",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ m, isMe }: { m: ThreadMessage; isMe: boolean }) {
  return (
    <div
      className="p-4"
      style={{
        background: isMe ? "rgba(37,99,235,0.08)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isMe ? "rgba(37,99,235,0.25)" : "var(--border-glass)"}`,
        borderRadius: 12,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar name={m.fromName || m.from} size={22} />
        <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>
          {m.fromName || m.from}
        </span>
        {isMe && (
          <span className="t-mono" style={{ fontSize: 9, color: "var(--text-accent)" }}>
            YOU
          </span>
        )}
        <span className="t-mono ml-auto" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {formatTime(m.date)}
        </span>
      </div>
      {m.bodyHtml ? (
        <div
          className="email-html"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(m.bodyHtml, {
              FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
              FORBID_ATTR: ["onerror", "onload", "onclick"],
            }),
          }}
        />
      ) : (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 300,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
          }}
        >
          {m.bodyText || m.body || m.snippet}
        </div>
      )}
    </div>
  );
}

const InboxPage = () => {
  const { session, user } = useAuth();
  const { orgs, activeOrgId } = useOrg();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Urgency>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<{ id: string; messages: ThreadMessage[]; subject: string } | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  const googleToken = (session as any)?.provider_token as string | undefined;

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (googleToken) h["x-google-token"] = googleToken;
    return h;
  }, [googleToken]);

  const activeOrgName = useMemo(() => {
    if (!activeOrgId || activeOrgId === "all") return "All Orgs";
    return orgs.find((o) => o.id === activeOrgId)?.name ?? "Inbox";
  }, [orgs, activeOrgId]);

  async function loadThreads() {
    if (!googleToken) {
      setLoading(false);
      setError("Gmail access not granted. Sign out and sign in again to grant Gmail scopes.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-list-threads", {
        headers,
        body: undefined,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setThreads((data as any).threads ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleToken]);

  async function openThread(id: string) {
    setSelectedId(id);
    setMobileView("thread");
    setDraftOpen(false);
    setDraft("");
    setSummary(null);
    setThread(null);
    setThreadLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(`gmail-get-thread?id=${id}`, { headers });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setThread({ id: d.id, subject: d.subject, messages: d.parsed ?? [] });
      // mark read locally
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, isUnread: false } : t)));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load thread");
    } finally {
      setThreadLoading(false);
    }
  }

  async function generateDraft() {
    if (!thread) return;
    setDraftOpen(true);
    setDraftLoading(true);
    setDraft("");
    try {
      const payload = {
        thread: thread.messages.map((m) => ({ from: m.from, body: m.body || m.snippet, timestamp: m.date })),
        user_name: user?.user_metadata?.full_name ?? user?.email ?? "Myke Shaw",
        user_org: activeOrgName,
      };
      const { data, error } = await supabase.functions.invoke("ai-draft-email", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDraft((data as any).draft ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Draft failed");
      setDraftOpen(false);
    } finally {
      setDraftLoading(false);
    }
  }

  async function summarizeThread() {
    if (!thread) return;
    setSummaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-summarize-thread", {
        body: { thread: thread.messages.map((m) => ({ from: m.from, body: m.body || m.snippet })) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSummary((data as any).summary);
    } catch (e: any) {
      setError(e?.message ?? "Summary failed");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function sendDraft() {
    if (!thread || !draft.trim()) return;
    const last = thread.messages[thread.messages.length - 1];
    setSending(true);
    try {
      const subject = thread.subject?.startsWith("Re:") ? thread.subject : `Re: ${thread.subject ?? ""}`;
      const lastMsgId = last.messageId || `<${last.id}@mail.gmail.com>`;
      const refs = [last.references, lastMsgId].filter(Boolean).join(" ").trim();
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        headers,
        body: {
          to: last.fromEmail || last.from,
          subject,
          body: draft,
          threadId: thread.id,
          inReplyTo: lastMsgId,
          references: refs,
          fromName: user?.user_metadata?.full_name ?? undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDraftOpen(false);
      setDraft("");
      // refresh thread
      openThread(thread.id);
    } catch (e: any) {
      setError(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    return threads.filter((t) => {
      if (filter !== "all" && t.urgency !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${t.fromName} ${t.subject} ${t.snippet}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [threads, filter, search]);

  const unreadCount = useMemo(() => threads.filter((t) => t.isUnread).length, [threads]);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div
      className="flex h-[calc(100vh-7rem)] md:h-[calc(100vh-6rem)] gap-0 md:gap-4"
      style={{ minHeight: 500 }}
    >
      {/* LEFT PANEL */}
      <aside
        className={`${
          mobileView === "list" ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-[320px] flex-shrink-0`}
      >
        <div className="glass-elevated flex flex-col h-full overflow-hidden" style={{ borderRadius: 16 }}>
          {/* header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                INBOX
              </span>
              {unreadCount > 0 && (
                <span
                  className="t-mono"
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(37,99,235,0.18)",
                    color: "#93C5FD",
                    border: "1px solid rgba(37,99,235,0.30)",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={loadThreads}
              disabled={loading}
              className="opacity-70 hover:opacity-100 transition-opacity"
              title="Sync"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* filters */}
          <div className="px-3 pb-2 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="t-mono whitespace-nowrap px-2.5 py-1 transition-all"
                style={{
                  fontSize: 10,
                  borderRadius: 6,
                  background: filter === f.key ? "var(--bg-glass-active)" : "transparent",
                  border: `1px solid ${filter === f.key ? "var(--border-active)" : "transparent"}`,
                  color: filter === f.key ? "var(--text-accent)" : "var(--text-secondary)",
                }}
              >
                {f.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* search */}
          <div className="px-3 pb-3 relative">
            <Search
              size={13}
              className="absolute left-5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeOrgName} inbox…`}
              className="w-full px-3 py-2 outline-none"
              style={{
                background: "var(--bg-glass-1)",
                border: "1px solid var(--border-glass)",
                borderRadius: 8,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--text-primary)",
                paddingLeft: 30,
              }}
            />
          </div>

          {/* list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse mx-1 my-1 p-3"
                  style={{ background: "var(--bg-glass-1)", borderRadius: 10, height: 76 }}
                />
              ))
            ) : error ? (
              <div className="p-6 text-center">
                <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: "var(--sev-critical)" }} />
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }}>
                  {error}
                </p>
                <button onClick={loadThreads} className="btn-ghost mt-3" style={{ fontSize: 11 }}>
                  RETRY
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <InboxIcon size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }}>
                  No {filter === "all" ? "" : FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} emails
                </p>
              </div>
            ) : (
              filtered.map((t) => (
                <EmailListItem
                  key={t.id}
                  t={t}
                  selected={selectedId === t.id}
                  onClick={() => openThread(t.id)}
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <section
        className={`${
          mobileView === "thread" ? "flex" : "hidden"
        } md:flex flex-col flex-1 min-w-0`}
      >
        <div className="glass-elevated flex flex-col h-full overflow-hidden" style={{ borderRadius: 16 }}>
          {!thread && !threadLoading ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <InboxIcon size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p
                  className="t-mono"
                  style={{ fontSize: 11, color: "var(--text-secondary)" }}
                >
                  SELECT <span className="slash">/</span> A THREAD
                </p>
              </div>
            </div>
          ) : threadLoading ? (
            <div className="flex-1 p-6 space-y-3">
              <div className="animate-pulse" style={{ background: "var(--bg-glass-1)", borderRadius: 10, height: 60 }} />
              <div className="animate-pulse" style={{ background: "var(--bg-glass-1)", borderRadius: 12, height: 120 }} />
              <div className="animate-pulse" style={{ background: "var(--bg-glass-1)", borderRadius: 12, height: 120 }} />
            </div>
          ) : (
            <>
              {/* thread header */}
              <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: "var(--border-glass)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <button
                      onClick={() => setMobileView("list")}
                      className="md:hidden mt-1 opacity-70"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="min-w-0">
                      <h2
                        className="truncate"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 15,
                          color: "var(--text-primary)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {thread!.subject || "(no subject)"}
                      </h2>
                      {(() => {
                        const last = thread!.messages[thread!.messages.length - 1];
                        const name = last?.fromName || last?.from || "";
                        const email = last?.fromEmail && last.fromEmail !== name ? last.fromEmail : "";
                        const dateStr = last?.date ? (() => {
                          const d = new Date(last.date);
                          return isNaN(d.getTime()) ? last.date : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                        })() : "";
                        return (
                          <p
                            className="truncate mt-0.5"
                            style={{
                              fontFamily: "var(--font-body)",
                              fontSize: 11,
                              color: "var(--text-secondary)",
                            }}
                          >
                            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{name}</span>
                            {email && <span> &lt;{email}&gt;</span>}
                            {dateStr && <span> · {dateStr}</span>}
                            <span> · {thread!.messages.length} message{thread!.messages.length === 1 ? "" : "s"}</span>
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={summarizeThread}
                      disabled={summaryLoading}
                      className="btn-ghost"
                      style={{ fontSize: 10, padding: "6px 10px" }}
                    >
                      <Sparkles size={11} />
                      {summaryLoading ? "…" : "Summarize"}
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 10, padding: "6px 10px" }}>
                      <Plus size={11} /> Task
                    </button>
                    <button className="btn-ghost" style={{ padding: "6px 8px" }}>
                      <MoreHorizontal size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* AI summary banner */}
              {summary && (
                <div
                  className="mx-5 mt-3 p-3"
                  style={{
                    background: "rgba(99,102,241,0.10)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    borderRadius: 10,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={10} style={{ color: "#A5B4FC" }} />
                    <span
                      className="t-mono"
                      style={{ fontSize: 9, color: "#A5B4FC", letterSpacing: "0.1em" }}
                    >
                      AI SUMMARY
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontWeight: 400,
                      fontSize: 11.5,
                      lineHeight: 1.55,
                      color: "var(--text-primary)",
                    }}
                  >
                    {summary}
                  </p>
                </div>
              )}

              {/* messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {thread!.messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    isMe={m.fromEmail?.toLowerCase() === user?.email?.toLowerCase()}
                  />
                ))}
              </div>

              {/* reply area */}
              <div className="border-t p-4" style={{ borderColor: "var(--border-glass)" }}>
                {!draftOpen ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={generateDraft}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 transition-all"
                      style={{
                        background: "linear-gradient(135deg, rgba(37,99,235,0.20), rgba(99,102,241,0.18))",
                        border: "1px solid rgba(37,99,235,0.40)",
                        borderRadius: 10,
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-display)",
                        fontWeight: 500,
                        fontSize: 12,
                        letterSpacing: "0.02em",
                        boxShadow: "0 0 24px var(--glow-blue)",
                      }}
                    >
                      <Sparkles size={13} />
                      Draft Reply in My Voice
                    </button>
                    <button className="btn-ghost" style={{ padding: "10px 14px" }}>
                      <CornerUpLeft size={12} /> Reply
                    </button>
                    <button className="btn-ghost" style={{ padding: "10px 14px" }}>
                      <ArrowRight size={12} /> Forward
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      background: "rgba(37,99,235,0.06)",
                      border: "1px solid rgba(37,99,235,0.25)",
                      borderRadius: 12,
                      boxShadow: "0 -8px 32px var(--glow-blue), inset 0 1px 0 rgba(99,102,241,0.4)",
                    }}
                    className="p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#60A5FA",
                            boxShadow: "0 0 8px var(--glow-blue-strong)",
                          }}
                        />
                        <span
                          className="t-mono"
                          style={{ fontSize: 10, color: "var(--text-accent)", letterSpacing: "0.1em" }}
                        >
                          AI DRAFT <span className="slash">/</span> YOUR VOICE
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={generateDraft}
                          disabled={draftLoading}
                          className="opacity-70 hover:opacity-100"
                          title="Regenerate"
                        >
                          <RotateCw size={12} className={draftLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                          onClick={() => setDraftOpen(false)}
                          className="opacity-70 hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={draftLoading}
                      rows={6}
                      placeholder={draftLoading ? "Drafting…" : "Your reply…"}
                      className="w-full p-3 outline-none resize-y"
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid var(--border-glass)",
                        borderRadius: 8,
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--text-primary)",
                        minHeight: 120,
                      }}
                    />
                    <div className="flex items-center justify-between mt-2.5">
                      <span
                        className="truncate"
                        style={{ fontFamily: "var(--font-body)", fontSize: 10.5, color: "var(--text-muted)" }}
                      >
                        Drafting as {user?.user_metadata?.full_name ?? user?.email} · {user?.email}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setDraftOpen(false)}
                          className="t-mono"
                          style={{ fontSize: 10, color: "var(--text-secondary)" }}
                        >
                          DISCARD
                        </button>
                        <button
                          onClick={sendDraft}
                          disabled={sending || draftLoading || !draft.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5"
                          style={{
                            background: "hsl(var(--primary))",
                            borderRadius: 8,
                            color: "white",
                            fontFamily: "var(--font-display)",
                            fontWeight: 500,
                            fontSize: 11,
                            opacity: sending || draftLoading || !draft.trim() ? 0.5 : 1,
                          }}
                        >
                          {sending ? "Sending…" : "Send"}
                          <Send size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default InboxPage;
