import { useCallback, useEffect, useMemo, useState } from "react";
import { Video, Users, ExternalLink, Sparkles, Loader2, RefreshCw, ChevronDown, ChevronRight, Plus, CheckCircle2, AlertCircle, Calendar as CalendarIcon, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useTime } from "@/contexts/TimezoneContext";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ORG_COLORS } from "@/lib/orgs";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import ScheduleMeetingModal from "@/components/meetings/ScheduleMeetingModal";
import StartHuddleModal from "@/components/meetings/StartHuddleModal";

interface CalEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[];
  hangoutLink: string | null;
  htmlLink: string | null;
  location?: string;
  org_id: string | null;
  org_color: string;
}

const PERSONAL_COLOR = "#6366F1";

async function getFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!error) return null;
  if (error instanceof FunctionsHttpError) {
    try {
      const ctx = await error.context.json();
      return typeof ctx?.error === "string" ? ctx.error : error.message;
    } catch { return error.message; }
  }
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : null;
}

function detectOrgSlug(title: string, description: string): string | null {
  const t = `${title} ${description}`.toLowerCase();
  if (t.includes("uwazi")) return "uwazi";
  if (t.includes("culture club") || /\bcc\b/.test(t)) return "cc";
  if (t.includes("bin")) return "bin";
  return null;
}

type Bucket = { key: string; label: string; events: CalEvent[] };

function bucketEvents(events: CalEvent[], tz: string): { upcoming: Bucket[]; past: Bucket[] } {
  const now = new Date();
  const dayKey = (d: Date) => d.toLocaleDateString("en-US", { timeZone: tz });
  const todayKey = dayKey(now);
  const tmrwKey = dayKey(new Date(Date.now() + 86400000));
  const inWeek = (d: Date) => (d.getTime() - now.getTime()) / 86400000 <= 7 && d.getTime() >= now.getTime();
  const longLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });

  const upcomingBuckets = new Map<string, Bucket>();
  const pastBuckets = new Map<string, Bucket>();
  const ensure = (map: Map<string, Bucket>, key: string, label: string) => {
    if (!map.has(key)) map.set(key, { key, label, events: [] });
    return map.get(key)!;
  };

  // Sort once (asc for processing)
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  for (const ev of sorted) {
    const start = new Date(ev.start);
    const k = dayKey(start);
    if (start.getTime() >= now.getTime() || k === todayKey) {
      // upcoming or today
      let bucketKey: string;
      let label: string;
      if (k === todayKey) { bucketKey = "today"; label = "Today"; }
      else if (k === tmrwKey) { bucketKey = "tomorrow"; label = "Tomorrow"; }
      else if (inWeek(start)) { bucketKey = `wk-${k}`; label = longLabel(start); }
      else { bucketKey = `later-${k}`; label = longLabel(start); }
      ensure(upcomingBuckets, bucketKey, label).events.push(ev);
    } else {
      const bucketKey = `past-${k}`;
      ensure(pastBuckets, bucketKey, longLabel(start)).events.push(ev);
    }
  }

  const upcoming = Array.from(upcomingBuckets.values());
  // past: most recent first
  const past = Array.from(pastBuckets.values()).reverse();
  // also reverse events within each past bucket so newest at top
  past.forEach((b) => b.events.reverse());
  return { upcoming, past };
}

interface BriefState { brief: string; action_items: string[]; loading: boolean; error?: string }

function isInProgress(ev: CalEvent, now: number) {
  return new Date(ev.start).getTime() <= now && new Date(ev.end).getTime() > now;
}

function relativeLabel(startMs: number, nowMs: number): string {
  const diff = startMs - nowMs;
  if (diff <= 0) return "Now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `In ${hrs}h`;
  const days = Math.round(hrs / 24);
  return `In ${days}d`;
}

function elapsedLabel(startMs: number, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - startMs) / 60000));
  if (mins < 60) return `${mins}m elapsed`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m elapsed`;
}

const FATHOM_RE = /(https?:\/\/(?:[a-z0-9-]+\.)?fathom\.video\/[^\s)<>"']+)/i;
function fathomUrl(ev: CalEvent): string | null {
  const m = `${ev.description ?? ""} ${ev.location ?? ""}`.match(FATHOM_RE);
  return m ? m[1] : null;
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const { orgs, activeOrgId } = useOrg();
  const { tz, formatTime } = useTime();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const orgBySlug = useMemo(() => {
    const m = new Map<string, { id: string; color: string }>();
    orgs.forEach((o) => m.set(o.slug, { id: o.id, color: o.color || ORG_COLORS[o.slug] || PERSONAL_COLOR }));
    return m;
  }, [orgs]);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // window: 30 days back, 60 days forward
      const from = new Date(Date.now() - 30 * 86400000);
      const to = new Date(Date.now() + 60 * 86400000);
      const { data, error } = await supabase.functions.invoke("calendar-list-events", {
        body: { timeMin: from.toISOString(), timeMax: to.toISOString() },
      });
      const errMsg = (await getFunctionErrorMessage(error)) ?? data?.error ?? null;
      if (data?.fallback || (errMsg && /refresh token|GOOGLE_AUTH_REQUIRED/i.test(errMsg))) {
        setNeedsReconnect(true);
        setEvents([]);
        return;
      }
      if (error) throw new Error(errMsg ?? "Failed to load meetings");
      if (data?.error) throw new Error(data.error);
      setNeedsReconnect(false);
      const mapped: CalEvent[] = (data.events ?? []).map((e: { id: string; summary: string; description: string; location?: string; start: string; end: string; allDay: boolean; attendees: string[]; hangoutLink: string | null; htmlLink: string | null }) => {
        const slug = detectOrgSlug(e.summary, e.description);
        const orgInfo = slug ? orgBySlug.get(slug) : null;
        return { ...e, org_id: orgInfo?.id ?? null, org_color: orgInfo?.color ?? PERSONAL_COLOR };
      });
      setEvents(mapped);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [user, orgBySlug]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Filter by active org (treat "all" or null as no filter)
  const filtered = useMemo(() => {
    if (!activeOrgId || activeOrgId === "all") return events.filter((e) => !e.allDay);
    return events.filter((e) => !e.allDay && e.org_id === activeOrgId);
  }, [events, activeOrgId]);

  const { upcoming, past } = useMemo(() => bucketEvents(filtered, tz), [filtered, tz]);
  const buckets = tab === "upcoming" ? upcoming : past;
  const inProgress = useMemo(
    () => filtered.filter((e) => isInProgress(e, now)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [filtered, now],
  );
  const inProgressIds = useMemo(() => new Set(inProgress.map((e) => e.id)), [inProgress]);

  const selectedEvent = useMemo(
    () => (selectedId ? filtered.find((e) => e.id === selectedId) ?? null : null),
    [selectedId, filtered],
  );
  const selectedMode: "upcoming" | "past" = useMemo(() => {
    if (!selectedEvent) return tab;
    return new Date(selectedEvent.end).getTime() < Date.now() ? "past" : "upcoming";
  }, [selectedEvent, tab]);


  const reconnectGoogle = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/meetings",
        extraParams: {
          scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid",
          access_type: "offline",
          prompt: "consent",
        },
      });
      if (result.error) toast.error("Failed to start Google sign-in");
    } catch {
      toast.error("Failed to start Google sign-in");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="glass flex items-center gap-3 p-4">
        <div className="flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-glass-2)", color: "var(--text-primary)" }}>
          <Video size={18} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="t-section">Meetings</h1>
          <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {filtered.length} meeting{filtered.length === 1 ? "" : "s"} · last 30d & next 60d
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedId(null); }}
              className="t-nav"
              style={{
                padding: "6px 14px", borderRadius: 6, textTransform: "capitalize",
                background: tab === t ? "var(--bg-glass-active)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                border: tab === t ? "1px solid var(--border-active)" : "1px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={() => setHuddleOpen(true)}
          className="flex items-center gap-1.5"
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            background: "#22C55E",
            color: "#0A0A0A",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: 11,
            boxShadow: "0 0 14px rgba(34,197,94,0.45)",
          }}
        >
          <Zap size={12} /> Start Huddle
        </button>

        <button
          onClick={() => setScheduleOpen(true)}
          className="btn-primary flex items-center gap-1.5"
          style={{ height: 32, padding: "0 12px", fontSize: 11 }}
        >
          <Plus size={12} /> Schedule
        </button>

        <button onClick={loadEvents} className="btn-icon" aria-label="Refresh" disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* Reconnect banner */}
      {needsReconnect && (
        <div className="glass p-4 flex items-center gap-3" style={{ borderColor: "rgba(245,158,11,0.3)" }}>
          <AlertCircle size={18} style={{ color: "#F59E0B" }} />
          <div className="flex-1 min-w-0">
            <div className="t-card-title">Google Calendar not connected</div>
            <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              Sign in with Google to see your meetings.
            </div>
          </div>
          <button onClick={reconnectGoogle} className="btn-primary">Connect Google</button>
        </div>
      )}

      {/* Empty state */}
      {!needsReconnect && !loading && buckets.length === 0 && (
        <div className="glass p-12 flex flex-col items-center text-center gap-3">
          <CalendarIcon size={32} style={{ color: "var(--text-muted)" }} />
          <div className="t-card-title">No {tab} meetings</div>
          <div className="t-mono" style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 360 }}>
            {tab === "upcoming"
              ? "Nothing on the calendar in the next 60 days for this organization."
              : "No meetings in the last 30 days for this organization."}
          </div>
        </div>
      )}

      {/* In progress / Now */}
      {tab === "upcoming" && inProgress.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span
              className="inline-block"
              style={{
                width: 8, height: 8, borderRadius: 999,
                background: "#22C55E",
                boxShadow: "0 0 0 0 rgba(34,197,94,0.7)",
                animation: "visi-pulse 1.6s ease-out infinite",
              }}
            />
            <div className="t-section" style={{ fontSize: 14 }}>Now</div>
            <div style={{ flex: 1, height: 1, background: "var(--border-glass)" }} />
            <div className="t-mono" style={{ fontSize: 10, color: "#22C55E" }}>
              {inProgress.length} live
            </div>
          </div>
          <style>{`@keyframes visi-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6);} 70% { box-shadow: 0 0 0 10px rgba(34,197,94,0);} 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);} }`}</style>
          <div className="flex flex-col gap-2">
            {inProgress.map((ev) => {
              const start = new Date(ev.start).getTime();
              const org = ev.org_id ? orgs.find((o) => o.id === ev.org_id) : null;
              return (
                <div key={`now-${ev.id}`} className="glass overflow-hidden flex items-center gap-3 p-3" style={{ borderLeft: `3px solid #22C55E`, boxShadow: "0 0 24px rgba(34,197,94,0.15)" }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: 999, background: "#22C55E",
                      animation: "visi-pulse 1.6s ease-out infinite",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="t-card-title truncate">{ev.summary}</div>
                    <div className="t-mono truncate" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {elapsedLabel(start, now)}
                      {ev.attendees.length > 0 && <> · {ev.attendees.length} in call</>}
                      {org && <> · <span style={{ color: ev.org_color }}>{org.name}</span></>}
                    </div>
                  </div>
                  {ev.hangoutLink ? (
                    <a
                      href={ev.hangoutLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5"
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 8,
                        background: "#22C55E", color: "#0A0A0A",
                        fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                        boxShadow: "0 0 16px rgba(34,197,94,0.5)",
                      }}
                    >
                      <Video size={12} /> Join
                    </a>
                  ) : (
                    <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>No link</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Timeline */}
      <div className="flex flex-col gap-5">
        {buckets.map((bucket) => (
          <section key={bucket.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-1">
              <div className="t-section" style={{ fontSize: 14 }}>{bucket.label}</div>
              <div style={{ flex: 1, height: 1, background: "var(--border-glass)" }} />
              <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {bucket.events.length}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {bucket.events.map((ev) => {
                if (tab === "upcoming" && inProgressIds.has(ev.id)) return null;
                const isOpen = expanded === ev.id;
                const start = new Date(ev.start);
                const end = new Date(ev.end);
                const startMs = start.getTime();
                const endMs = end.getTime();
                const durationMins = Math.max(1, Math.round((endMs - startMs) / 60000));
                const brief = briefs[ev.id];
                const org = ev.org_id ? orgs.find((o) => o.id === ev.org_id) : null;
                const transcript = fathomUrl(ev);
                const showRelative = tab === "upcoming" && startMs > now && (startMs - now) <= 8 * 3600 * 1000;
                return (
                  <div key={ev.id} className="glass overflow-hidden" style={{ borderLeft: `3px solid ${ev.org_color}` }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : ev.id)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--bg-glass-2)] transition-colors"
                    >
                      <div className="t-mono shrink-0 flex flex-col" style={{ fontSize: 11, width: 110, color: "var(--text-secondary)" }}>
                        <span>{formatTime(start)} – {formatTime(end)}</span>
                        <span style={{ fontSize: 9, color: showRelative ? "var(--accent, #60A5FA)" : "var(--text-muted)", marginTop: 2 }}>
                          {showRelative ? relativeLabel(startMs, now) : `${durationMins} min`}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="t-card-title truncate">{ev.summary}</div>
                          {transcript && (
                            <a
                              href={transcript}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="t-mono shrink-0"
                              style={{
                                padding: "2px 8px", borderRadius: 999, fontSize: 9,
                                background: "rgba(139,92,246,0.12)",
                                color: "#A78BFA",
                                border: "1px solid rgba(139,92,246,0.3)",
                              }}
                              title="Open Fathom transcript"
                            >
                              📝 Transcript
                            </a>
                          )}
                        </div>
                        {ev.attendees.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users size={10} style={{ color: "var(--text-muted)" }} />
                            <div className="t-mono truncate" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {ev.attendees.length} attendee{ev.attendees.length === 1 ? "" : "s"}
                              {org && <> · <span style={{ color: ev.org_color }}>{org.name}</span></>}
                            </div>
                          </div>
                        )}
                      </div>
                      {tab === "upcoming" && !brief?.brief && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(ev.id);
                            if (!brief?.loading) generateBrief(ev, "upcoming");
                          }}
                          disabled={brief?.loading}
                          className="t-mono shrink-0 flex items-center gap-1"
                          style={{
                            height: 26, padding: "0 10px", borderRadius: 6,
                            background: "var(--bg-glass-1)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-glass)",
                            fontSize: 10,
                          }}
                          title="Generate AI prep brief"
                        >
                          {brief?.loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          Prep
                        </button>
                      )}
                      {ev.hangoutLink && (
                        <a
                          href={ev.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn-icon shrink-0"
                          title="Join meeting"
                        >
                          <Video size={14} />
                        </a>
                      )}
                      {isOpen ? <ChevronDown size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border-glass)" }}>
                        {ev.attendees.length > 0 && (
                          <div>
                            <div className="t-mono mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Attendees</div>
                            <div className="flex flex-wrap gap-1.5">
                              {ev.attendees.map((a) => (
                                <span key={a} className="badge" style={{ fontSize: 10 }}>{a}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ev.description && (
                          <div>
                            <div className="t-mono mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</div>
                            <div className="whitespace-pre-wrap" style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                              {ev.description}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.htmlLink && (
                            <a href={ev.htmlLink} target="_blank" rel="noreferrer" className="btn-ghost flex items-center gap-1.5" style={{ height: 30, padding: "0 12px", fontSize: 11 }}>
                              <ExternalLink size={12} /> Open in Google Calendar
                            </a>
                          )}
                          {!brief?.brief && !brief?.loading && (
                            <button
                              onClick={() => generateBrief(ev, tab)}
                              className="btn-primary flex items-center gap-1.5"
                              style={{ height: 30, padding: "0 12px", fontSize: 11 }}
                            >
                              <Sparkles size={12} />
                              {tab === "upcoming" ? "Generate prep brief" : "Extract action items"}
                            </button>
                          )}
                          {brief?.loading && (
                            <span className="flex items-center gap-1.5 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              <Loader2 size={12} className="animate-spin" /> Thinking…
                            </span>
                          )}
                        </div>

                        {brief?.brief && (
                          <div className="rounded-lg p-3" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Sparkles size={11} style={{ color: "var(--accent)" }} />
                              <span className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {tab === "upcoming" ? "Prep brief" : "Recap"}
                              </span>
                            </div>
                            <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6 }}>{brief.brief}</div>
                          </div>
                        )}

                        {brief?.action_items && brief.action_items.length > 0 && (
                          <div>
                            <div className="t-mono mb-2" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Action items</div>
                            <div className="flex flex-col gap-1.5">
                              {brief.action_items.map((item, i) => {
                                const k = `${ev.id}:${i}`;
                                const created = createdTasks.has(k);
                                const busy = creatingTask === k;
                                return (
                                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
                                    <div className="flex-1" style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-primary)" }}>{item}</div>
                                    {created ? (
                                      <span className="flex items-center gap-1 t-mono" style={{ fontSize: 10, color: "#22C55E" }}>
                                        <CheckCircle2 size={12} /> Task
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => convertToTask(ev, item, i)}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <ScheduleMeetingModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={loadEvents}
      />
      <StartHuddleModal
        open={huddleOpen}
        onClose={() => setHuddleOpen(false)}
        onStarted={loadEvents}
      />
    </div>
  );
}
