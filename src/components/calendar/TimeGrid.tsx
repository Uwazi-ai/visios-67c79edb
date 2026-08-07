import { useMemo } from "react";
import {
  END_HOUR, START_HOUR, addDays, allDayDate, fmt12, fmtRange, laneOut,
  sameDay, trackHeight, trackTop,
} from "@/lib/calendarTime";
import type { CalendarEvent, HoldProposal } from "@/hooks/useCalendar";

export interface Positioned {
  ev: CalendarEvent;
  start: Date;
  end: Date;
}

export interface GridProps {
  days: Date[];
  events: CalendarEvent[];
  holds: HoldProposal[];
  colorOf: (orgId: string) => string;
  nameOf: (orgId: string) => string;
  crossIds: Set<string>;
  sameIds: Set<string>;
  hasBrief: (id: string) => boolean;
  onOpen: (e: CalendarEvent) => void;
  onOpenHold: (h: HoldProposal) => void;
}

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

/**
 * Day / Week grid. All-day events sit in their own band above the track —
 * stretching a date across a time axis is how a date turns into 00:00.
 */
export const TimeGrid = ({
  days, events, holds, colorOf, nameOf, crossIds, sameIds, hasBrief, onOpen, onOpenHold,
}: GridProps) => {
  const today = new Date();

  const timed = useMemo(
    () => events.filter((e) => !e.all_day).map((ev) => ({
      ev, start: new Date(ev.starts_at), end: new Date(ev.ends_at),
    })),
    [events],
  );

  const allDay = useMemo(
    () => events.filter((e) => e.all_day).map((ev) => ({ ev, date: allDayDate(ev.starts_at) })),
    [events],
  );

  const positionedHolds = useMemo(
    () => holds
      .filter((h) => h.payload?.starts_at)
      .map((h) => ({
        h,
        start: new Date(h.payload.starts_at as string),
        end: new Date(
          h.payload.ends_at ??
          new Date(Date.parse(h.payload.starts_at as string) + (h.payload.duration_minutes ?? 30) * 60000).toISOString(),
        ),
      })),
    [holds],
  );

  return (
    <div
      className="cal-grid"
      style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
    >
      <div className="cal-gutter" style={{ gridTemplateRows: `30px 22px repeat(${HOURS.length}, 1fr)` }}>
        <div aria-hidden />
        <div aria-hidden />
        {HOURS.map((h) => (
          <div key={h} className="cal-hour">{fmt12(new Date(2020, 0, 1, h))}</div>
        ))}
      </div>

      {days.map((day) => {
        const dayTimed = timed.filter((t) => sameDay(t.start, day));
        const dayHolds = positionedHolds.filter((p) => sameDay(p.start, day));
        return (
          <div key={day.toISOString()} className="cal-col">
            <div className="cal-colhead" data-today={sameDay(day, today) ? "true" : undefined}>
              {day.toLocaleDateString(undefined, { weekday: "short" })} {day.getDate()}
            </div>

            <div className="cal-allday">
              {allDay
                .filter((a) => a.date >= day && a.date < addDays(day, 1))
                .map(({ ev }) => (
                  <button
                    key={ev.id}
                    type="button"
                    className="cal-allday-pill"
                    style={{ background: colorOf(ev.org_id) }}
                    onClick={() => onOpen(ev)}
                    title={`${ev.title ?? "(untitled)"} · all day`}
                  >
                    {ev.title ?? "(untitled)"}
                  </button>
                ))}
            </div>

            <div className="cal-track" style={{ gridTemplateRows: `repeat(${HOURS.length}, 1fr)` }}>
              {HOURS.map((h) => <div key={h} className="cal-slot" aria-hidden />)}

              {laneOut(dayTimed).map(({ item, lane, lanes }) => {
                const { ev, start, end } = item;
                const conflict = crossIds.has(ev.id) ? "cross" : sameIds.has(ev.id) ? "same" : undefined;
                const short = end.getTime() - start.getTime() <= 30 * 60000;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="cal-ev"
                    data-conflict={conflict}
                    data-short={short ? "true" : undefined}
                    data-declined={ev.self_response === "declined" ? "true" : undefined}
                    style={{
                      top: `${trackTop(start)}%`,
                      height: `${trackHeight(start, end)}%`,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                      background: colorOf(ev.org_id),
                      borderLeftColor: colorOf(ev.org_ids[ev.org_ids.length - 1]),
                    }}
                    onClick={() => onOpen(ev)}
                    title={`${ev.title ?? "(untitled)"} · ${fmtRange(start, end)} · ${ev.org_ids.map(nameOf).join(" + ")}`}
                  >
                    <span className="cal-ev-time">{fmtRange(start, end)}</span>
                    <span className="cal-ev-title">{ev.title ?? "(untitled)"}</span>
                    <span className="cal-ev-marks">
                      {ev.org_ids.length > 1 && ev.org_ids.map((id) => (
                        <span key={id} className="cal-swatch" style={{ background: colorOf(id) }} aria-hidden />
                      ))}
                      {conflict === "cross" && <span className="cal-conflict-mark" aria-label="cross-entity conflict">!</span>}
                      {hasBrief(ev.id) && <span className="ai-dot" aria-label="brief ready" />}
                    </span>
                  </button>
                );
              })}

              {dayHolds.map(({ h, start, end }) => (
                <button
                  key={h.id}
                  type="button"
                  className="cal-hold"
                  style={{
                    top: `${trackTop(start)}%`,
                    height: `${trackHeight(start, end)}%`,
                    left: "3px",
                    right: "3px",
                  }}
                  onClick={() => onOpenHold(h)}
                  title="Proposed hold — nothing is booked"
                >
                  <span className="cal-ev-time">{fmtRange(start, end)}</span>
                  <span className="cal-ev-title">{h.title}</span>
                  <span className="cal-ev-time">proposed</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
