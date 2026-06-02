import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X, Plus, RefreshCw, Calendar as CalendarIcon, Video, Users, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useTime } from "@/contexts/TimezoneContext";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ORG_COLORS } from "@/lib/orgs";
import { detectOrgSlugFromEmails } from "@/lib/orgDetect";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import ScheduleMeetingModal from "@/components/meetings/ScheduleMeetingModal";
import TeamCalendarsPanel, { type Teammate } from "@/components/calendar/TeamCalendarsPanel";
import { useCalendarPreferences } from "@/hooks/useCalendarPreferences";
import { colorForMember } from "@/lib/memberColors";

type View = "day" | "week" | "month";

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
  org_id: string | null;
  org_color: string;
  // Team layer
  owner_id?: string | null;
  owner_name?: string | null;
  owner_avatar?: string | null;
  is_team_event?: boolean;
  db_event_id?: string | null;
  my_rsvp?: "invited" | "accepted" | "declined" | "tentative" | null;
}

interface PlanBlock {
  start: string;
  end: string;
  title: string;
  type: "deep_work" | "meeting" | "admin" | "break" | "buffer";
  org_id?: string | null;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!error) return null;
  if (error instanceof FunctionsHttpError) {
    try {
      const context = await error.context.json();
      return typeof context?.error === "string" ? context.error : error.message;
    } catch {
      return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : null;
}

const PERSONAL_COLOR = "#6366F1";
const HOUR_START = 7;
const HOUR_END = 19; // exclusive (last row 18:00–19:00)
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_MIN = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------- date helpers ----------
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0, 0, 0, 0); return x; };
const endOfMonth = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); x.setHours(23, 59, 59, 999); return x; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtTime = (d: Date, tz: string) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
const fmtTimeShort = (d: Date, tz: string) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).replace(":00", "").toLowerCase();
const fmtRange = (s: Date, e: Date, tz: string) => `${fmtTime(s, tz)} – ${fmtTime(e, tz)}`;
const fmtDateLong = (d: Date, tz: string, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { ...opts, timeZone: tz });


export default function Calendar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { orgs, memberships } = useOrg();
  const { tz } = useTime();
  const [view, setView] = useState<View>(isMobile ? "day" : "week");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [googleEvents, setGoogleEvents] = useState<CalEvent[]>([]);
  const [teamEvents, setTeamEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  // Team layer
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [me, setMe] = useState<Teammate | null>(null);
  const { visibleMemberIds, toggleMember, setAll, loaded: prefsLoaded } = useCalendarPreferences();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Range for current view
  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(cursor), to: endOfDay(cursor) };
    if (view === "week") {
      const from = startOfWeek(cursor);
      return { from, to: endOfDay(addDays(from, 6)) };
    }
    return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
  }, [view, cursor]);

  const orgBySlug = useMemo(() => {
    const m = new Map<string, { id: string; color: string }>();
    orgs.forEach((o) => m.set(o.slug, { id: o.id, color: o.color || ORG_COLORS[o.slug] || PERSONAL_COLOR }));
    return m;
  }, [orgs]);

  const [needsReconnect, setNeedsReconnect] = useState(false);

  const loadGoogleEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("calendar-list-events", {
        body: { timeMin: range.from.toISOString(), timeMax: range.to.toISOString() },
      });
      const errMsg = (await getFunctionErrorMessage(error)) ?? data?.error ?? null;
      if (data?.fallback) {
        setNeedsReconnect(data.error === "GOOGLE_AUTH_REQUIRED" || Boolean(errMsg && /refresh token/i.test(errMsg)));
        setGoogleEvents([]);
        return;
      }
      if (errMsg && /refresh token/i.test(errMsg)) {
        setNeedsReconnect(true);
        setGoogleEvents([]);
        return;
      }
      if (error) throw new Error(errMsg ?? "Failed to load calendar");
      if (data?.error) throw new Error(data.error);
      setNeedsReconnect(false);
      const mapped: CalEvent[] = (data.events ?? []).map((e: { id: string; summary: string; description: string; start: string; end: string; allDay: boolean; attendees: string[]; hangoutLink: string | null; htmlLink: string | null }) => {
        const slug = detectOrgSlugFromEmails(e.attendees ?? [], orgs);
        const orgInfo = slug ? orgBySlug.get(slug) : null;
        return {
          ...e,
          org_id: orgInfo?.id ?? null,
          org_color: orgInfo?.color ?? PERSONAL_COLOR,
          owner_id: user.id,
          is_team_event: false,
        };
      });
      setGoogleEvents(mapped);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, user, orgBySlug, orgs]);

  // Load teammates (other members of orgs the user belongs to) + self
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const orgIds = memberships.map((m) => m.org_id);
      if (orgIds.length === 0) {
        if (!cancelled) { setTeammates([]); setMe(null); }
        return;
      }
      const { data: ms } = await supabase
        .from("org_memberships")
        .select("user_id")
        .in("org_id", orgIds);
      const allIds = Array.from(new Set([...((ms ?? []).map((r: any) => r.user_id) as string[]), user.id]));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", allIds);
      if (cancelled) return;
      const list: Teammate[] = (profs ?? []).map((p: any) => ({
        user_id: p.id, display_name: p.display_name, email: p.email, avatar_url: p.avatar_url,
      }));
      setMe(list.find((t) => t.user_id === user.id) ?? null);
      setTeammates(
        list.filter((t) => t.user_id !== user.id)
          .sort((a, b) => (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? ""))
      );
    })();
    return () => { cancelled = true; };
  }, [user, memberships]);

  // Default visible = all teammates if no pref saved yet
  useEffect(() => {
    if (!prefsLoaded || teammates.length === 0) return;
    if (visibleMemberIds.length === 0) {
      setAll(teammates.map((t) => t.user_id));
    }
  }, [prefsLoaded, teammates, visibleMemberIds.length, setAll]);

  // Load DB team events + my own DB events for the range
  const loadTeamEvents = useCallback(async () => {
    if (!user) return;
    const visibleIds = Array.from(new Set([user.id, ...visibleMemberIds]));
    const { data, error } = await (supabase as any)
      .from("events")
      .select("id, title, description, start_at, end_at, attendees, meet_link, org_id, color, created_by, visibility, event_attendees(user_id, status)")
      .gte("start_at", range.from.toISOString())
      .lte("start_at", range.to.toISOString())
      .in("created_by", visibleIds);
    if (error) {
      console.error("team events", error);
      return;
    }
    const teamMap = new Map(teammates.map((t) => [t.user_id, t]));
    if (me) teamMap.set(me.user_id, me);
    const mapped: CalEvent[] = (data ?? []).map((e: any) => {
      const owner = teamMap.get(e.created_by);
      const ownerColor = colorForMember(e.created_by);
      const orgInfo = orgs.find((o) => o.id === e.org_id);
      const myAttendee = (e.event_attendees ?? []).find((a: any) => a.user_id === user.id);
      return {
        id: `db:${e.id}`,
        db_event_id: e.id,
        summary: e.title ?? "(no title)",
        description: e.description ?? "",
        start: e.start_at,
        end: e.end_at ?? e.start_at,
        allDay: false,
        attendees: Array.isArray(e.attendees) ? e.attendees.map((a: any) => typeof a === "string" ? a : a?.email).filter(Boolean) : [],
        hangoutLink: e.meet_link ?? null,
        htmlLink: null,
        org_id: e.org_id ?? null,
        org_color: e.color ?? ownerColor ?? orgInfo?.color ?? PERSONAL_COLOR,
        owner_id: e.created_by,
        owner_name: owner?.display_name ?? owner?.email ?? null,
        owner_avatar: owner?.avatar_url ?? null,
        is_team_event: true,
        my_rsvp: myAttendee?.status ?? null,
      };
    });

    // Also fetch teammates' Google primary calendar events (server-side, uses each
    // teammate's stored refresh token; private events are skipped).
    let googleTeam: CalEvent[] = [];
    const teammateIds = visibleMemberIds.filter((id) => id !== user.id);
    if (teammateIds.length > 0) {
      try {
        const { data: gt } = await supabase.functions.invoke("calendar-list-team-events", {
          body: { memberIds: teammateIds, timeMin: range.from.toISOString(), timeMax: range.to.toISOString() },
        });
        if (gt?.events) {
          googleTeam = (gt.events as Array<{
            id: string; owner_id: string; summary: string; start: string; end: string;
            allDay: boolean; hangoutLink: string | null; htmlLink: string | null; attendees: string[];
          }>).map((e) => {
            const owner = teamMap.get(e.owner_id);
            return {
              id: e.id,
              summary: e.summary,
              description: "",
              start: e.start,
              end: e.end,
              allDay: e.allDay,
              attendees: e.attendees ?? [],
              hangoutLink: e.hangoutLink,
              htmlLink: e.htmlLink,
              org_id: null,
              org_color: colorForMember(e.owner_id),
              owner_id: e.owner_id,
              owner_name: owner?.display_name ?? owner?.email ?? null,
              owner_avatar: owner?.avatar_url ?? null,
              is_team_event: true,
            } as CalEvent;
          });
        }
      } catch (err) {
        console.error("team google events", err);
      }
    }

    setTeamEvents([...mapped, ...googleTeam]);
  }, [user, range.from, range.to, visibleMemberIds, teammates, me, orgs]);


  const loadEvents = useCallback(async () => {
    await Promise.all([loadGoogleEvents(), loadTeamEvents()]);
  }, [loadGoogleEvents, loadTeamEvents]);

  useEffect(() => { loadGoogleEvents(); }, [loadGoogleEvents]);
  useEffect(() => { loadTeamEvents(); }, [loadTeamEvents]);

  // Realtime: refresh team events when attendees change for me
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`cal-events-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadTeamEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendees" }, () => loadTeamEvents())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadTeamEvents]);

  // Merged event list passed to views
  const events = useMemo(() => {
    const visible = new Set([user?.id, ...visibleMemberIds].filter(Boolean) as string[]);
    const team = teamEvents.filter((e) => !e.owner_id || visible.has(e.owner_id));
    return [...googleEvents, ...team];
  }, [googleEvents, teamEvents, visibleMemberIds, user]);

  // ---------- nav ----------
  const goToday = () => setCursor(new Date());
  const goPrev = () => setCursor(view === "day" ? addDays(cursor, -1) : view === "week" ? addDays(cursor, -7) : new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(view === "day" ? addDays(cursor, 1) : view === "week" ? addDays(cursor, 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  const headerLabel = useMemo(() => {
    if (view === "day") return fmtDateLong(cursor, tz, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    return `${MONTHS[ws.getMonth()].slice(0, 3)} ${ws.getDate()} – ${MONTHS[we.getMonth()].slice(0, 3)} ${we.getDate()}, ${we.getFullYear()}`;
  }, [view, cursor]);

  return (
    <div className="flex gap-4 min-h-[calc(100vh-120px)]">
      {/* Sidebar mini calendar (desktop only) */}
      {!isMobile && (
        <MiniSidebar
          cursor={cursor}
          setCursor={setCursor}
          events={events}
          orgs={orgs}
          me={me}
          teammates={teammates}
          visibleMemberIds={visibleMemberIds}
          onToggleMember={toggleMember}
          onSelectSolo={(id) => setAll([id])}
          onShowAll={() => setAll(teammates.map((t) => t.user_id))}
        />
      )}


      {/* Main calendar */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Toolbar */}
        <div className="glass flex items-center gap-2 p-3 flex-wrap">
          <div className="flex items-center gap-1 mr-auto">
            <button onClick={goPrev} className="btn-icon" aria-label="Previous"><ChevronLeft size={16} /></button>
            <button onClick={goToday} className="btn-ghost" style={{ height: 32, padding: "0 12px" }}>Today</button>
            <button onClick={goNext} className="btn-icon" aria-label="Next"><ChevronRight size={16} /></button>
            <span className="t-section ml-3 truncate">{headerLabel}</span>
            {loading && <Loader2 size={14} className="animate-spin ml-2" style={{ color: "var(--text-muted)" }} />}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="t-nav"
                style={{
                  padding: "6px 12px", borderRadius: 6,
                  background: view === v ? "var(--bg-glass-active)" : "transparent",
                  color: view === v ? "var(--text-primary)" : "var(--text-secondary)",
                  border: view === v ? "1px solid var(--border-active)" : "1px solid transparent",
                }}
              >{v}</button>
            ))}
          </div>

          <button onClick={() => setCreateOpen(true)} className="btn-ghost flex items-center gap-1.5" style={{ height: 36 }}>
            <Plus size={14} /> New event
          </button>
          <button onClick={() => setPlanOpen(true)} className="btn-primary" style={{ height: 36 }}>
            <Sparkles size={14} /> Plan My Day
          </button>
        </div>

        {needsReconnect && <ReconnectBanner />}

        {/* View body */}
        <div className="glass flex-1 overflow-hidden flex flex-col">
          {view === "week" && <WeekView events={events} cursor={cursor} now={now} onSelect={setSelectedEvent} />}
          {view === "day" && <DayView events={events} cursor={cursor} now={now} onSelect={setSelectedEvent} />}
          {view === "month" && <MonthView events={events} cursor={cursor} onSelect={setSelectedEvent} setCursor={setCursor} setView={setView} />}
        </div>
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} orgs={orgs} />
      )}

      {/* Plan My Day panel */}
      {planOpen && (
        <PlanMyDayPanel
          date={cursor}
          events={events.filter((e) => sameDay(new Date(e.start), cursor))}
          orgs={orgs}
          onClose={() => setPlanOpen(false)}
          onApplied={loadEvents}
        />
      )}

      {/* Create event modal */}
      <ScheduleMeetingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadEvents}
      />
    </div>
  );
}

// =================== RECONNECT BANNER ===================
function ReconnectBanner() {
  const [busy, setBusy] = useState(false);
  const reconnect = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/calendar",
        extraParams: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      });
      if (result.error) toast.error(result.error.message ?? "Reconnect failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reconnect failed");
    } finally {
      setBusy(false);
    }
  };
  return (
      <div className="glass p-3 flex items-center gap-3" style={{ borderColor: "var(--border-active)" }}>
      <CalendarIcon size={16} style={{ color: "var(--sev-warn)" }} />
      <div className="flex-1 min-w-0">
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: 0.08 }}>
          Reconnect Google
        </div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Your Google session is missing a refresh token. Reconnect to load your calendar.
        </div>
      </div>
      <button onClick={reconnect} disabled={busy} className="btn-primary" style={{ height: 32 }}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : null}
        Reconnect
      </button>
    </div>
  );
}

// =================== MINI SIDEBAR ===================
function MiniSidebar({ cursor, setCursor, events, orgs, me, teammates, visibleMemberIds, onToggleMember }: {
  cursor: Date; setCursor: (d: Date) => void; events: CalEvent[];
  orgs: { id: string; name: string; slug: string; color: string }[];
  me: Teammate | null; teammates: Teammate[];
  visibleMemberIds: string[];
  onToggleMember: (id: string, on: boolean) => void;
}) {
  const [miniMonth, setMiniMonth] = useState(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  useEffect(() => { setMiniMonth(new Date(cursor.getFullYear(), cursor.getMonth(), 1)); }, [cursor]);

  const monthStart = startOfMonth(miniMonth);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  const eventDays = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => s.add(startOfDay(new Date(e.start)).toDateString()));
    return s;
  }, [events]);

  return (
    <aside className="glass flex-shrink-0 p-4 flex flex-col gap-4" style={{ width: 260 }}>
      <div className="flex items-center justify-between">
        <span className="t-card-title">{MONTHS[miniMonth.getMonth()]} {miniMonth.getFullYear()}</span>
        <div className="flex gap-1">
          <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}><ChevronLeft size={12} /></button>
          <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}><ChevronRight size={12} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_MIN.map((d, i) => (
          <div key={i} className="t-mono text-center" style={{ fontSize: 9 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          const isCurMonth = d.getMonth() === miniMonth.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = sameDay(d, cursor);
          const hasEvents = eventDays.has(d.toDateString());
          return (
            <button
              key={i}
              onClick={() => setCursor(d)}
              className="relative flex items-center justify-center text-xs"
              style={{
                aspectRatio: "1",
                borderRadius: 6,
                background: isSelected ? "var(--bg-glass-active)" : isToday ? "rgba(37,99,235,0.05)" : "transparent",
                border: isSelected ? "1px solid var(--border-active)" : isToday ? "1px solid var(--border-active)" : "1px solid transparent",
                color: !isCurMonth ? "var(--text-muted)" : isToday ? "var(--text-accent)" : "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: isToday ? 600 : 400,
                boxShadow: isToday ? "0 0 8px var(--glow-blue)" : "none",
              }}
            >
              {d.getDate()}
              {hasEvents && (
                <span style={{
                  position: "absolute", bottom: 2, width: 3, height: 3, borderRadius: "50%",
                  background: "var(--text-accent)",
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <span className="t-card-title">Orgs</span>
        {orgs.map((o) => (
          <div key={o.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="org-dot" style={{ background: o.color || ORG_COLORS[o.slug] || PERSONAL_COLOR }} />
            {o.name}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span className="org-dot" style={{ background: PERSONAL_COLOR }} />
          Personal / Other
        </div>
      </div>

      <TeamCalendarsPanel
        me={me}
        teammates={teammates}
        visibleMemberIds={visibleMemberIds}
        onToggle={onToggleMember}
      />
    </aside>
  );
}

// =================== WEEK VIEW ===================
function WeekView({ events, cursor, now, onSelect }: { events: CalEvent[]; cursor: Date; now: Date; onSelect: (e: CalEvent) => void }) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b" style={{ gridTemplateColumns: "60px repeat(7, 1fr)", borderColor: "var(--border-glass)" }}>
        <div />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div key={d.toDateString()} className="p-2 text-center border-l" style={{ borderColor: "var(--border-glass)" }}>
              <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>{DAYS_SHORT[d.getDay()].toUpperCase()}</div>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18,
                color: isToday ? "var(--text-accent)" : "var(--text-primary)",
                textShadow: isToday ? "0 0 12px var(--glow-blue-strong)" : "none",
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto relative">
        <div className="grid relative" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
          {/* Hour labels column */}
          <div>
            {HOURS.map((h) => (
              <div key={h} className="border-b border-r flex items-start justify-end pr-2 pt-1" style={{ height: 56, borderColor: "rgba(255,255,255,0.04)" }}>
                <span className="t-mono" style={{ fontSize: 9 }}>{h % 12 || 12}{h < 12 ? "AM" : "PM"}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const isToday = sameDay(day, today);
            const dayEvents = events.filter((e) => sameDay(new Date(e.start), day) && !e.allDay);
            return (
              <div
                key={day.toDateString()}
                className="relative border-l"
                style={{ borderColor: "var(--border-glass)", background: isToday ? "rgba(37,99,235,0.025)" : "transparent" }}
              >
                {HOURS.map((h) => (
                  <div key={h} className="border-b" style={{ height: 56, borderColor: "rgba(255,255,255,0.04)" }} />
                ))}
                {dayEvents.map((e) => (
                  <EventBlock key={e.id} event={e} onSelect={onSelect} columnHeight={56 * HOURS.length} />
                ))}
                {isToday && now.getHours() >= HOUR_START && now.getHours() < HOUR_END && (
                  <NowIndicator now={now} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventBlock({ event, onSelect, columnHeight }: { event: CalEvent; onSelect: (e: CalEvent) => void; columnHeight: number }) {
  const { tz } = useTime();
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinutes = (start.getHours() - HOUR_START) * 60 + start.getMinutes();
  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const top = Math.max(0, (startMinutes / totalMinutes) * columnHeight);
  const durationMin = (end.getTime() - start.getTime()) / 60000;
  const height = Math.max(20, (durationMin / totalMinutes) * columnHeight - 2);
  if (top >= columnHeight) return null;

  const c = event.org_color;
  const isInvited = event.is_team_event && event.my_rsvp === "invited";
  return (
    <button
      onClick={() => onSelect(event)}
      title={event.owner_name ? `${event.summary} — ${event.owner_name}` : event.summary}
      className="absolute text-left overflow-hidden hover:brightness-125 transition-all"
      style={{
        top, left: 2, right: 2, height,
        borderRadius: 5,
        padding: "3px 6px",
        borderLeft: `2px solid ${c}`,
        background: `${c}26`,
        border: isInvited ? `1px dashed ${c}` : `1px solid ${c}47`,
        cursor: "pointer",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 9, color: c, textTransform: "uppercase", letterSpacing: 0.04, lineHeight: 1.2 }}>
        {event.summary}
      </div>
      {height > 28 && (
        <div className="t-mono flex items-center gap-1" style={{ fontSize: 8 }}>
          <span>{fmtTimeShort(start, tz)}–{fmtTimeShort(end, tz)}</span>
          {event.is_team_event && event.owner_name && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, opacity: 0.85 }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: c }} />
              {event.owner_name.split(" ")[0]}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function NowIndicator({ now }: { now: Date }) {
  const minutes = (now.getHours() - HOUR_START) * 60 + now.getMinutes();
  const total = (HOUR_END - HOUR_START) * 60;
  const top = (minutes / total) * 100;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: `${top}%`, zIndex: 10, pointerEvents: "none" }}>
      <div style={{ position: "relative", height: 1, background: "var(--text-accent)", boxShadow: "0 0 6px var(--glow-blue-strong)" }}>
        <div style={{ position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%", background: "var(--text-accent)", boxShadow: "0 0 8px var(--glow-blue-strong)" }} />
      </div>
    </div>
  );
}

// =================== DAY VIEW ===================
function DayView({ events, cursor, now, onSelect }: { events: CalEvent[]; cursor: Date; now: Date; onSelect: (e: CalEvent) => void }) {
  const dayEvents = events.filter((e) => sameDay(new Date(e.start), cursor) && !e.allDay);
  const isToday = sameDay(cursor, new Date());

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: "60px 1fr" }}>
        <div>
          {HOURS.map((h) => (
            <div key={h} className="border-b border-r flex items-start justify-end pr-2 pt-1" style={{ height: 80, borderColor: "rgba(255,255,255,0.04)" }}>
              <span className="t-mono" style={{ fontSize: 10 }}>{h % 12 || 12}{h < 12 ? "AM" : "PM"}</span>
            </div>
          ))}
        </div>
        <div className="relative" style={{ background: isToday ? "rgba(37,99,235,0.025)" : "transparent" }}>
          {HOURS.map((h) => (
            <div key={h} className="border-b" style={{ height: 80, borderColor: "rgba(255,255,255,0.04)" }} />
          ))}
          {dayEvents.map((e) => (
            <EventBlock key={e.id} event={e} onSelect={onSelect} columnHeight={80 * HOURS.length} />
          ))}
          {isToday && now.getHours() >= HOUR_START && now.getHours() < HOUR_END && <NowIndicator now={now} />}
        </div>
      </div>
    </div>
  );
}

// =================== MONTH VIEW ===================
function MonthView({ events, cursor, onSelect, setCursor, setView }: { events: CalEvent[]; cursor: Date; onSelect: (e: CalEvent) => void; setCursor: (d: Date) => void; setView: (v: View) => void }) {
  const monthStart = startOfMonth(cursor);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border-glass)" }}>
        {DAYS_SHORT.map((d) => (
          <div key={d} className="p-2 text-center border-l t-mono" style={{ borderColor: "var(--border-glass)", fontSize: 10 }}>{d.toUpperCase()}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(110px, 1fr)" }}>
        {cells.map((d, i) => {
          const isCurMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const dayEvents = events.filter((e) => sameDay(new Date(e.start), d));
          return (
            <div
              key={i}
              className="border-l border-b p-1.5 flex flex-col gap-1 overflow-hidden"
              style={{
                borderColor: "var(--border-glass)",
                background: isToday ? "rgba(37,99,235,0.04)" : "transparent",
                opacity: isCurMonth ? 1 : 0.4,
                boxShadow: isToday ? "inset 0 0 0 1px var(--border-active-glow)" : "none",
              }}
            >
              <button
                onClick={() => { setCursor(d); setView("day"); }}
                className="self-start text-left"
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: isToday ? 600 : 400,
                  color: isToday ? "var(--text-accent)" : "var(--text-primary)",
                }}
              >{d.getDate()}</button>
              {dayEvents.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className="text-left truncate text-[10px] px-1 rounded"
                  style={{
                    background: `${e.org_color}26`,
                    color: e.org_color,
                    borderLeft: `2px solid ${e.org_color}`,
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.04,
                  }}
                >{e.summary}</button>
              ))}
              {dayEvents.length > 3 && (
                <span className="t-mono" style={{ fontSize: 9 }}>+{dayEvents.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== EVENT DETAIL PANEL ===================
function EventDetailPanel({ event, onClose, orgs }: { event: CalEvent; onClose: () => void; orgs: { id: string; name: string; color: string; slug: string }[] }) {
  const { tz } = useTime();
  const { user } = useAuth();
  const start = new Date(event.start);
  const end = new Date(event.end);
  const org = event.org_id ? orgs.find((o) => o.id === event.org_id) : null;
  const isMyEvent = event.is_team_event && event.owner_id === user?.id;
  const canRsvp = event.is_team_event && !isMyEvent && event.db_event_id && event.my_rsvp;

  const rsvp = async (status: "accepted" | "declined" | "tentative") => {
    if (!event.db_event_id || !user) return;
    const { error } = await (supabase as any)
      .from("event_attendees")
      .update({ status })
      .eq("event_id", event.db_event_id)
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success(`Marked ${status}`);
  };

  return (
    <aside className="glass-elevated flex-shrink-0 p-4 flex flex-col gap-3 card-enter" style={{ width: 280, alignSelf: "flex-start", position: "sticky", top: 72 }}>
      <div className="flex items-start justify-between">
        <span className="t-card-title">Event</span>
        <button onClick={onClose} className="btn-icon" style={{ width: 24, height: 24 }}><X size={12} /></button>
      </div>
      <h3 className="t-section">{event.summary}</h3>
      <div className="t-mono">{fmtDateLong(start, tz, { weekday: "short", month: "short", day: "numeric" })} · {fmtRange(start, end, tz)}</div>

      {event.is_team_event && event.owner_name && (
        <div className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: event.org_color }} />
          Organizer: {isMyEvent ? "You" : event.owner_name}
        </div>
      )}

      {canRsvp && (
        <div className="flex flex-col gap-1.5 p-2 rounded" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
          <span className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>
            {event.owner_name?.split(" ")[0]} invited you · Currently: {event.my_rsvp}
          </span>
          <div className="flex gap-1.5">
            <button onClick={() => rsvp("accepted")} className="btn-primary flex-1 justify-center" style={{ height: 28, fontSize: 11 }}>Accept</button>
            <button onClick={() => rsvp("tentative")} className="btn-ghost flex-1 justify-center" style={{ height: 28, fontSize: 11 }}>Maybe</button>
            <button onClick={() => rsvp("declined")} className="btn-ghost flex-1 justify-center" style={{ height: 28, fontSize: 11 }}>Decline</button>
          </div>
        </div>
      )}

      {org ? (
        <div className="org-pill self-start active">
          <span className="org-dot" style={{ background: org.color }} />
          {org.name}
        </div>
      ) : (
        <div className="org-pill self-start">
          <span className="org-dot" style={{ background: PERSONAL_COLOR }} />
          Personal
        </div>
      )}

      {event.attendees.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="t-card-title flex items-center gap-1.5"><Users size={11} /> Attendees</span>
          <div className="flex flex-wrap gap-1.5">
            {event.attendees.map((a) => (
              <div key={a} className="badge badge-muted" title={a}>
                {a.split("@")[0].slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {event.hangoutLink && (
        <a href={event.hangoutLink} target="_blank" rel="noreferrer" className="btn-primary justify-center" style={{ height: 36 }}>
          <Video size={14} /> Join Meet
        </a>
      )}

      {event.description && (
        <div className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)", maxHeight: 200, overflow: "auto" }}>
          {event.description}
        </div>
      )}

      {event.htmlLink && (
        <a href={event.htmlLink} target="_blank" rel="noreferrer" className="btn-ghost justify-center" style={{ height: 32 }}>
          Open in Google Calendar
        </a>
      )}
    </aside>
  );
}

// =================== PLAN MY DAY PANEL ===================
function PlanMyDayPanel({ date, events, orgs, onClose, onApplied }: {
  date: Date;
  events: CalEvent[];
  orgs: { id: string; name: string; slug: string; color: string }[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const { user } = useAuth();
  const { tz } = useTime();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [blocks, setBlocks] = useState<PlanBlock[] | null>(null);
  const [stats, setStats] = useState<{ tasks: number; meetings: number } | null>(null);

  const generate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // load user's open tasks with due dates
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("title, priority, estimate_mins, due_at, org_id")
        .or(`assignee_id.eq.${user.id},created_by.eq.${user.id}`)
        .neq("status", "done")
        .limit(30);

      const { data: profile } = await supabase
        .from("profiles")
        .select("scheduling_prefs")
        .eq("id", user.id)
        .maybeSingle();

      const tasks = tasksData ?? [];
      setStats({ tasks: tasks.length, meetings: events.length });

      const { data, error } = await supabase.functions.invoke("ai-schedule-day", {
        body: {
          date: date.toISOString().slice(0, 10),
          tasks,
          events: events.map((e) => ({ start: e.start, end: e.end, title: e.summary })),
          preferences: profile?.scheduling_prefs ?? {},
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBlocks(data.blocks ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to plan day");
    } finally {
      setLoading(false);
    }
  }, [user, date, events]);

  useEffect(() => { generate(); }, [generate]);

  const apply = async () => {
    if (!blocks) return;
    setApplying(true);
    try {
      // only write deep_work / admin / break — meetings already exist
      const toWrite = blocks.filter((b) => b.type !== "meeting");
      let written = 0;
      for (const b of toWrite) {
        const { error } = await supabase.functions.invoke("calendar-create-event", {
          body: {
            summary: `[Visi OS] ${b.title}`,
            start: b.start,
            end: b.end,
            description: `Auto-scheduled by Visi OS · type=${b.type}`,
            colorId: b.type === "deep_work" ? "9" : b.type === "break" ? "8" : "7",
          },
        });
        if (!error) written++;
      }
      toast.success(`Added ${written} blocks to your calendar`);
      onApplied();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const blockColor = (b: PlanBlock) => {
    if (b.type === "break") return "#9CA3AF";
    if (b.type === "buffer") return "#6B7280";
    if (b.org_id) {
      const o = orgs.find((x) => x.id === b.org_id);
      if (o) return o.color || ORG_COLORS[o.slug] || PERSONAL_COLOR;
    }
    return PERSONAL_COLOR;
  };

  return (
    <aside className="glass-elevated flex-shrink-0 p-4 flex flex-col gap-3 card-enter" style={{ width: 300, alignSelf: "flex-start", position: "sticky", top: 72, maxHeight: "calc(100vh - 100px)", overflow: "auto" }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "var(--text-accent)" }} />
          <span className="t-card-title">Plan My Day</span>
        </div>
        <button onClick={onClose} className="btn-icon" style={{ width: 24, height: 24 }}><X size={12} /></button>
      </div>

      <div className="t-mono">{fmtDateLong(date, tz, { weekday: "short", month: "short", day: "numeric" })}</div>

      {stats && (
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Analyzed {stats.tasks} tasks · {stats.meetings} meetings
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-accent)" }} />
          <span className="t-mono">Generating plan…</span>
        </div>
      )}

      {!loading && blocks && (
        <div className="flex flex-col gap-1.5">
          {blocks.map((b, i) => {
            const c = blockColor(b);
            const s = new Date(b.start);
            const e = new Date(b.end);
            return (
              <div key={i} className="rounded-md p-2 flex flex-col gap-0.5" style={{ background: `${c}1A`, borderLeft: `2px solid ${c}` }}>
                <div className="t-mono" style={{ fontSize: 10 }}>{fmtTimeShort(s, tz)}–{fmtTimeShort(e, tz)}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: c, textTransform: "uppercase", letterSpacing: 0.04 }}>
                  {b.title}
                </div>
                <div className="t-mono" style={{ fontSize: 9 }}>{b.type.replace("_", " ")}</div>
              </div>
            );
          })}
          {blocks.length === 0 && <div className="t-mono">No blocks proposed.</div>}
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button onClick={apply} disabled={!blocks || applying || loading} className="btn-primary flex-1 justify-center" style={{ height: 34 }}>
          {applying ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Apply
        </button>
        <button onClick={generate} disabled={loading} className="btn-ghost" style={{ height: 34 }}>
          <RefreshCw size={12} />
        </button>
      </div>
    </aside>
  );
}
