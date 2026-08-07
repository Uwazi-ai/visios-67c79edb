import { useMemo } from "react";
import { addDays, allDayDate, fmt12, fmtRange, sameDay, startOfWeek } from "@/lib/calendarTime";
import type { CalendarEvent, HoldProposal } from "@/hooks/useCalendar";

/**
 * Agenda — the mobile default. A week grid at 380px is unreadable, and a
 * squeezed grid is worse than a list because it looks like it works.
 */
export const AgendaView = ({
  days, events, holds, colorOf, crossIds, hasBrief, onOpen, onOpenHold,
}: {
  days: Date[];
  events: CalendarEvent[];
  holds: HoldProposal[];
  colorOf: (orgId: string) => string;
  crossIds: Set<string>;
  hasBrief: (id: string) => boolean;
  onOpen: (e: CalendarEvent) => void;
  onOpenHold: (h: HoldProposal) => void;
}) => (
  <div className="cal-agenda">
    {days.map((day) => {
      const dayEvents = events
        .filter((e) => sameDay(e.all_day ? allDayDate(e.starts_at) : new Date(e.starts_at), day))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const dayHolds = holds.filter(
        (h) => h.payload?.starts_at && sameDay(new Date(h.payload.starts_at), day),
      );
      if (!dayEvents.length && !dayHolds.length) return null;
      return (
        <div key={day.toISOString()} className="cal-agenda-day">
          <span className="cal-agenda-h">
            {day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </span>
          {dayEvents.map((ev) => (
            <button
              key={ev.id}
              type="button"
              className="cal-agenda-row"
              style={{ borderLeftColor: colorOf(ev.org_id) }}
              onClick={() => onOpen(ev)}
            >
              <span className="cal-agenda-time">
                {ev.all_day ? "All day" : fmtRange(new Date(ev.starts_at), new Date(ev.ends_at))}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.title ?? "(untitled)"}</span>
                <span className="vo-meta">
                  {ev.location || ev.conference_url ? (ev.location || "Video call") : "No location"}
                  {crossIds.has(ev.id) ? " · conflict across entities" : ""}
                  {hasBrief(ev.id) ? " · brief ready" : ""}
                </span>
              </span>
            </button>
          ))}
          {dayHolds.map((h) => (
            <button
              key={h.id}
              type="button"
              className="cal-agenda-row"
              style={{ borderLeftColor: "var(--ai-txt)", borderLeftStyle: "dashed" }}
              onClick={() => onOpenHold(h)}
            >
              <span className="cal-agenda-time">
                {h.payload.starts_at ? fmt12(new Date(h.payload.starts_at)) : "—"}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ai-txt)" }}>{h.title}</span>
                <span className="vo-meta" style={{ color: "var(--ai-txt)" }}>proposed — nothing is booked</span>
              </span>
            </button>
          ))}
        </div>
      );
    })}
  </div>
);

/** Month — density over detail; clicking a chip opens the same detail pane. */
export const MonthView = ({
  anchor, events, colorOf, onOpen,
}: {
  anchor: Date;
  events: CalendarEvent[];
  colorOf: (orgId: string) => string;
  onOpen: (e: CalendarEvent) => void;
}) => {
  const cells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const today = new Date();

  return (
    <div className="cal-month">
      {cells.map((day) => {
        const list = events
          .filter((e) => sameDay(e.all_day ? allDayDate(e.starts_at) : new Date(e.starts_at), day))
          .slice(0, 4);
        return (
          <div key={day.toISOString()} className="cal-month-cell" style={{ opacity: day.getMonth() === anchor.getMonth() ? 1 : 0.45 }}>
            <span className="cal-month-n" data-today={sameDay(day, today) ? "true" : undefined}>
              {day.getDate()}
            </span>
            {list.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className="cal-chip"
                style={{ background: colorOf(ev.org_id) }}
                onClick={() => onOpen(ev)}
              >
                {ev.all_day ? "" : `${fmt12(new Date(ev.starts_at))} `}{ev.title ?? "(untitled)"}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};
