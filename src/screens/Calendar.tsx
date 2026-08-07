import { useEffect, useMemo, useState } from "react";
import "@/design/calendar.css";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { Bento, Button, Card, Col, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { AgendaView, MonthView } from "@/components/calendar/AgendaMonth";
import { EventDetail, HoldDetail } from "@/components/calendar/EventDetail";
import { AllHidden, EmptyWindow, NotConnected, SyncBanner } from "@/components/calendar/CalendarEmptyStates";
import { useCalendar, type CalendarEvent, type HoldProposal } from "@/hooks/useCalendar";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { useIsMobile } from "@/hooks/use-mobile";
import { addDays, startOfDay, startOfWeek } from "@/lib/calendarTime";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type View = "day" | "week" | "month" | "agenda";

/**
 * Calendar — a mirror of every connected account, in one grid, coloured by
 * entity. Kova never becomes the system of record: it writes only when a
 * person commits, and everything else is a read of Google.
 */
const CalendarScreen = ({ navigate }: { navigate: (id: string) => void }) => {
  const { orgs, scopeOrgId } = useWorkspaceScope();
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [selectedHold, setSelectedHold] = useState<HoldProposal | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Mobile defaults to Agenda: a seven-column grid at 390px is unreadable,
  // and a squeezed grid is worse than a list because it still looks correct.
  useEffect(() => { if (isMobile) setView("agenda"); }, [isMobile]);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "agenda") return Array.from({ length: 14 }, (_, i) => addDays(anchor, i));
    if (view === "month") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      return Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(first), i));
    }
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor, view]);

  const from = days[0];
  const to = addDays(days[days.length - 1], 1);

  const {
    loading, accounts, events, conflicts, conflictIds, holds, briefs,
    orgsWithAccounts, reload, rsvp, requestBrief, dismissHold,
  } = useCalendar(scopeOrgId, from, to);

  const visibleEvents = useMemo(
    () => events.filter((e) => !hidden[e.calendar_account_id]),
    [events, hidden],
  );

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? "Unassigned";
  const orgColor = (id: string) =>
    orgs.find((o) => o.id === id)?.identity_color ?? "var(--ws-all)";

  const label = useMemo(() => {
    if (view === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (view === "month") return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const end = days[days.length - 1];
    return `${from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }, [anchor, view, days, from]);

  const step = (dir: 1 | -1) => {
    if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, dir * (view === "day" ? 1 : view === "agenda" ? 14 : 7)));
  };

  const sync = async () => {
    setSyncing(true);
    await supabase.functions.invoke("calendar-sync", { body: { org_id: scopeOrgId } });
    await reload();
    setSyncing(false);
  };

  const conflictsFor = (id: string) =>
    conflicts
      .filter((c) => c.event_a_id === id || c.event_b_id === id)
      .map((c) => events.find((e) => e.id === (c.event_a_id === id ? c.event_b_id : c.event_a_id)))
      .filter((e): e is CalendarEvent => Boolean(e));

  /** Committing a hold is the only write path — and it is a person's click. */
  const commitHold = async (h: HoldProposal) => {
    const { error } = await supabase.functions.invoke("calendar-create-event", {
      body: {
        summary: h.title,
        start: h.payload.starts_at,
        end: h.payload.ends_at,
        description: h.rationale ?? "",
        attendees: h.payload.attendees ?? [],
        addMeet: true,
      },
    });
    if (error) {
      toast({ title: "Could not create the event", description: "Nothing was written to your calendar." });
      return;
    }
    await supabase.from("proposals").update({ status: "committed" }).eq("id", h.id);
    setSelectedHold(null);
    await reload();
    toast({ title: "On the calendar", description: `${h.title} was created and invites went out.` });
  };

  const brokenAccounts = accounts.filter((a) => a.status === "error" || a.status === "expired");
  const allHidden = accounts.length > 0 && accounts.every((a) => hidden[a.id]);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Calendar"
        action={
          <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
            <div className="cal-views">
              {(["day", "week", "month", "agenda"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="cal-viewbtn"
                  data-on={view === v ? "true" : undefined}
                  onClick={() => setView(v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <Button size="sm" variant="quiet" onClick={sync} title="Re-read every connected calendar">
              <RefreshCw size={13} aria-hidden style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Sync
            </Button>
            <Button size="sm" variant="primary" onClick={() => navigate("bookings")}>
              <Plus size={13} aria-hidden style={{ verticalAlign: "-2px", marginRight: 5 }} />
              New event
            </Button>
          </div>
        }
      />

      <div className="vo-between" style={{ flexWrap: "wrap", gap: "var(--s-2)" }}>
        <div className="vo-row" style={{ gap: "var(--s-2)" }}>
          <Button size="sm" variant="quiet" onClick={() => step(-1)} title="Previous"><ChevronLeft size={14} /></Button>
          <Button size="sm" variant="quiet" onClick={() => setAnchor(startOfDay(new Date()))}>Today</Button>
          <Button size="sm" variant="quiet" onClick={() => step(1)} title="Next"><ChevronRight size={14} /></Button>
          <span className="vo-meta">{label}</span>
        </div>
        <SyncBanner broken={brokenAccounts} syncing={syncing || loading} onReconnect={() => navigate("connect")} />
      </div>

      {accounts.length === 0 && !loading ? (
        <NotConnected
          orgNames={orgs.filter((o) => !o.is_demo).map((o) => o.name)}
          onConnect={() => navigate("connect")}
        />
      ) : (
        <Bento>
          <Col span={3}>
            <CalendarSidebar
              anchor={anchor}
              onPick={(d) => { setAnchor(d); if (view === "month") setView("day"); }}
              accounts={accounts}
              orgs={orgs}
              orgsWithAccounts={orgsWithAccounts}
              hidden={hidden}
              onToggle={(id) => setHidden((h) => ({ ...h, [id]: !h[id] }))}
              crossCount={conflicts.filter((c) => c.is_cross_org).length}
              sameCount={conflicts.filter((c) => !c.is_cross_org).length}
              onConnect={() => navigate("connect")}
            />
          </Col>

          <Col span={selected || selectedHold ? 6 : 9}>
            {allHidden ? (
              <AllHidden onRestore={() => setHidden({})} />
            ) : visibleEvents.length === 0 && holds.length === 0 && !loading ? (
              <EmptyWindow label={view === "day" ? "This day" : view === "month" ? "This month" : "This week"} />
            ) : (
              <Card>
                {view === "agenda" ? (
                  <AgendaView
                    days={days}
                    events={visibleEvents}
                    holds={holds}
                    colorOf={orgColor}
                    crossIds={conflictIds.cross}
                    hasBrief={(id) => briefs[id]?.status === "ready"}
                    onOpen={(e) => { setSelectedHold(null); setSelected(e); }}
                    onOpenHold={(h) => { setSelected(null); setSelectedHold(h); }}
                  />
                ) : view === "month" ? (
                  <MonthView
                    anchor={anchor}
                    events={visibleEvents}
                    colorOf={orgColor}
                    onOpen={(e) => { setSelectedHold(null); setSelected(e); }}
                  />
                ) : (
                  <TimeGrid
                    days={days}
                    events={visibleEvents}
                    holds={holds}
                    colorOf={orgColor}
                    nameOf={orgName}
                    crossIds={conflictIds.cross}
                    sameIds={conflictIds.same}
                    hasBrief={(id) => briefs[id]?.status === "ready"}
                    onOpen={(e) => { setSelectedHold(null); setSelected(e); }}
                    onOpenHold={(h) => { setSelected(null); setSelectedHold(h); }}
                  />
                )}
              </Card>
            )}
          </Col>

          {(selected || selectedHold) && (
            <Col span={3}>
              {selected ? (
                <EventDetail
                  event={selected}
                  orgName={orgName}
                  orgColor={orgColor}
                  brief={briefs[selected.id]}
                  onBrief={() => requestBrief(selected.id)}
                  onRsvp={(r) => rsvp(selected.id, r)}
                  onClose={() => setSelected(null)}
                  conflictWith={conflictsFor(selected.id)}
                />
              ) : selectedHold ? (
                <HoldDetail
                  hold={selectedHold}
                  orgName={orgName}
                  resolvedAttendees={selectedHold.payload.attendees ?? []}
                  onCommit={() => commitHold(selectedHold)}
                  onDismiss={() => { dismissHold(selectedHold.id); setSelectedHold(null); }}
                  onClose={() => setSelectedHold(null)}
                />
              ) : null}
            </Col>
          )}
        </Bento>
      )}

      {accounts.length > 0 && (
        <Card>
          <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
            <Eyebrow>Why this is a mirror</Eyebrow>
            <Desc>
              Kova reads every connected calendar and never becomes the system of record. Times
              stay in UTC underneath and are drawn in {Intl.DateTimeFormat().resolvedOptions().timeZone};
              a meeting invited to two of your accounts is drawn once, carrying both entity
              markers, so it can never conflict with itself. Anything Vision suggests renders
              dashed until you commit it — only then does it reach Google.
            </Desc>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CalendarScreen;
