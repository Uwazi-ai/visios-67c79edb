import { useEffect, useState } from "react";
import { X, Video, ExternalLink, Sparkles, Loader2, Plus, CheckCircle2, Calendar as CalendarIcon, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";

export interface PanelEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  hangoutLink: string | null;
  htmlLink: string | null;
  org_id: string | null;
  org_color: string;
}

interface BriefState {
  brief: string;
  action_items: string[];
  loading: boolean;
}
interface SummaryState {
  summary: string;
  action_items: string[];
  loading: boolean;
  source?: string;
}

interface Props {
  event: PanelEvent | null;
  mode: "upcoming" | "past";
  transcriptUrl: string | null;
  formatTime: (d: Date) => string;
  onClose: () => void;
}

const INDIGO = "#6366F1";

function durationLabel(start: Date, end: Date) {
  const mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function initialsOf(email: string) {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? local[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function MeetingDetailPanel({ event, mode, transcriptUrl, formatTime, onClose }: Props) {
  const { user } = useAuth();
  const { activeOrgId, orgs } = useOrg();
  const [brief, setBrief] = useState<BriefState | null>(null);
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [creatingTask, setCreatingTask] = useState<number | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Set<number>>(new Set());

  // Reset when event changes
  useEffect(() => {
    setBrief(null);
    setSummary(null);
    setCreatingTask(null);
    setCreatedTasks(new Set());
  }, [event?.id]);

  // Close on Escape
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;
  const start = new Date(event.start);
  const end = new Date(event.end);
  const org = event.org_id ? orgs.find((o) => o.id === event.org_id) : null;

  const generateBrief = async () => {
    setBrief({ brief: "", action_items: [], loading: true });
    try {
      const { data, error } = await supabase.functions.invoke("ai-meeting-brief", {
        body: {
          title: event.summary,
          description: event.description,
          attendees: event.attendees,
          start: event.start,
          end: event.end,
          mode,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setBrief({ brief: data.brief ?? "", action_items: data.action_items ?? [], loading: false });
    } catch (e) {
      setBrief(null);
      toast.error(e instanceof Error ? e.message : "Failed to generate brief");
    }
  };

  const generateSummary = async () => {
    setSummary({ summary: "", action_items: [], loading: true });
    try {
      const { data, error } = await supabase.functions.invoke("ai-summarize-transcript", {
        body: {
          title: event.summary,
          transcriptUrl,
          attendees: event.attendees,
          start: event.start,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSummary({
        summary: data.summary ?? "",
        action_items: data.action_items ?? [],
        loading: false,
        source: data.source,
      });
    } catch (e) {
      setSummary(null);
      toast.error(e instanceof Error ? e.message : "Failed to summarize");
    }
  };

  const convertToTask = async (item: string, idx: number) => {
    if (!user) return;
    const orgIdForTask = event.org_id ?? (activeOrgId && activeOrgId !== "all" ? activeOrgId : null);
    if (!orgIdForTask) {
      toast.error("Pick an organization to create tasks");
      return;
    }
    setCreatingTask(idx);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: item,
        description: `From meeting: ${event.summary}`,
        org_id: orgIdForTask,
        created_by: user.id,
        assignee_id: user.id,
        status: "todo",
        priority: "normal",
      });
      if (error) throw error;
      setCreatedTasks((s) => new Set(s).add(idx));
      toast.success("Task created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreatingTask(null);
    }
  };

  const actionItems = summary?.action_items.length ? summary.action_items : brief?.action_items ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 420,
          maxWidth: "100vw",
          background: "var(--bg-panel, #0F0F12)",
          borderLeft: "1px solid var(--border-glass)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
          animation: "visi-slide-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
      >
        <style>{`@keyframes visi-slide-in { from { transform: translateX(100%);} to { transform: translateX(0);} }`}</style>

        {/* Header */}
        <div className="flex items-start gap-3 p-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div
            className="shrink-0 mt-1"
            style={{ width: 4, height: 28, borderRadius: 2, background: event.org_color }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="t-card-title" style={{ fontSize: 15, lineHeight: 1.3 }}>{event.summary}</h2>
            <div className="flex items-center gap-2 mt-1.5 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {org && <span style={{ color: event.org_color }}>{org.name}</span>}
              {org && <span>·</span>}
              <span>{mode === "upcoming" ? "Upcoming" : "Past"}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon shrink-0" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Time + duration */}
          <div className="grid grid-cols-2 gap-2">
            <div className="glass p-3 flex items-start gap-2">
              <CalendarIcon size={13} className="mt-0.5" style={{ color: "var(--text-muted)" }} />
              <div className="min-w-0">
                <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>When</div>
                <div className="t-mono" style={{ fontSize: 11, color: "var(--text-primary)", marginTop: 2 }}>
                  {formatTime(start)} – {formatTime(end)}
                </div>
                <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
            <div className="glass p-3 flex items-start gap-2">
              <Clock size={13} className="mt-0.5" style={{ color: "var(--text-muted)" }} />
              <div className="min-w-0">
                <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Duration</div>
                <div className="t-mono" style={{ fontSize: 11, color: "var(--text-primary)", marginTop: 2 }}>
                  {durationLabel(start, end)}
                </div>
              </div>
            </div>
          </div>

          {/* Join bar */}
          {event.hangoutLink && (
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noreferrer"
              className="glass flex items-center gap-3 p-3 hover:bg-[var(--bg-glass-2)] transition-colors"
              style={{ borderColor: "rgba(34,197,94,0.3)" }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.15)", color: "#22C55E" }}
              >
                <Video size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="t-card-title" style={{ fontSize: 12 }}>Google Meet</div>
                <div className="t-mono truncate" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {event.hangoutLink.replace(/^https?:\/\//, "")}
                </div>
              </div>
              <span
                className="t-mono flex items-center gap-1 shrink-0"
                style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11,
                  background: "#22C55E", color: "#0A0A0A", fontWeight: 600,
                }}
              >
                Join <ExternalLink size={10} />
              </span>
            </a>
          )}

          {/* Attendees */}
          {event.attendees.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={11} style={{ color: "var(--text-muted)" }} />
                <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {event.attendees.length} attendee{event.attendees.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {event.attendees.map((a) => (
                  <div key={a} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
                    <div
                      className="shrink-0 flex items-center justify-center t-mono"
                      style={{
                        width: 26, height: 26, borderRadius: 999,
                        background: "var(--bg-glass-2)",
                        color: "var(--text-secondary)",
                        fontSize: 9, fontWeight: 600,
                      }}
                    >
                      {initialsOf(a)}
                    </div>
                    <div className="t-mono truncate flex-1" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <div className="t-mono mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</div>
              <div className="whitespace-pre-wrap rounded-lg p-3" style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55, background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
                {event.description}
              </div>
            </div>
          )}

          {/* Transcript link */}
          {transcriptUrl && (
            <a
              href={transcriptUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg"
              style={{
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              <span style={{ fontSize: 13 }}>📝</span>
              <div className="flex-1 min-w-0">
                <div className="t-card-title" style={{ fontSize: 12, color: "#A78BFA" }}>Fathom transcript</div>
                <div className="t-mono truncate" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {transcriptUrl.replace(/^https?:\/\//, "")}
                </div>
              </div>
              <ExternalLink size={11} style={{ color: "#A78BFA" }} />
            </a>
          )}

          {/* AI Prep Brief (indigo glass) */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{
              background: `linear-gradient(135deg, ${INDIGO}14, ${INDIGO}05)`,
              border: `1px solid ${INDIGO}40`,
              boxShadow: `0 0 24px ${INDIGO}1A`,
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: INDIGO }} />
              <div className="t-mono flex-1" style={{ fontSize: 9, color: INDIGO, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                {mode === "upcoming" ? "AI Prep Brief" : "AI Recap"}
              </div>
              {!brief && (
                <button
                  onClick={generateBrief}
                  className="t-mono flex items-center gap-1"
                  style={{
                    height: 24, padding: "0 10px", borderRadius: 6, fontSize: 10,
                    background: INDIGO, color: "#0A0A0A", fontWeight: 600,
                  }}
                >
                  <Sparkles size={10} /> Generate
                </button>
              )}
            </div>
            {brief?.loading && (
              <div className="flex items-center gap-1.5 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                <Loader2 size={12} className="animate-spin" /> Thinking…
              </div>
            )}
            {brief?.brief && (
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6 }}>
                {brief.brief}
              </div>
            )}
            {!brief && (
              <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                Get a sharp {mode === "upcoming" ? "prep brief and talking points" : "recap and likely follow-ups"} for this meeting.
              </div>
            )}
          </div>

          {/* Summary (past only, when transcript exists) */}
          {mode === "past" && transcriptUrl && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: "rgba(139,92,246,0.06)",
                border: "1px solid rgba(139,92,246,0.3)",
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} style={{ color: "#A78BFA" }} />
                <div className="t-mono flex-1" style={{ fontSize: 9, color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                  Transcript Summary
                </div>
                {!summary && (
                  <button
                    onClick={generateSummary}
                    className="t-mono flex items-center gap-1"
                    style={{
                      height: 24, padding: "0 10px", borderRadius: 6, fontSize: 10,
                      background: "#8B5CF6", color: "#0A0A0A", fontWeight: 600,
                    }}
                  >
                    <Sparkles size={10} /> Summarize
                  </button>
                )}
              </div>
              {summary?.loading && (
                <div className="flex items-center gap-1.5 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  <Loader2 size={12} className="animate-spin" /> Reading transcript…
                </div>
              )}
              {summary?.summary && (
                <>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6 }}>
                    {summary.summary}
                  </div>
                  {summary.source === "metadata" && (
                    <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>
                      Couldn't fetch the transcript directly — recap is inferred from meeting metadata.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action items */}
          {actionItems.length > 0 && (
            <div>
              <div className="t-mono mb-2" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Action items
              </div>
              <div className="flex flex-col gap-1.5">
                {actionItems.map((item, i) => {
                  const created = createdTasks.has(i);
                  const busy = creatingTask === i;
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
                      <div className="flex-1" style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-primary)" }}>{item}</div>
                      {created ? (
                        <span className="flex items-center gap-1 t-mono" style={{ fontSize: 10, color: "#22C55E" }}>
                          <CheckCircle2 size={12} /> Task
                        </span>
                      ) : (
                        <button
                          onClick={() => convertToTask(item, i)}
                          disabled={busy}
                          className="btn-ghost flex items-center gap-1"
                          style={{ height: 26, padding: "0 10px", fontSize: 10 }}
                        >
                          {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          Make task
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open in Google Calendar */}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost flex items-center justify-center gap-1.5"
              style={{ height: 32, fontSize: 11 }}
            >
              <ExternalLink size={11} /> Open in Google Calendar
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
