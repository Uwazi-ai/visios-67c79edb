import { AlertTriangle, Layers } from "lucide-react";
import { Eyebrow, Tag } from "@/components/primitives";
import {
  CalEvent,
  Conflict,
  DAYS,
  END_HOUR,
  START_HOUR,
  calendarLabel,
  fmt12,
  fmtRange,
  mins,
} from "@/data/calendar";

/**
 * WeekGrid — Mon–Fri, 9 AM to 4 PM. Positions come from the stored
 * 24-hour strings; only the labels are converted for humans.
 */
export const WeekGrid = ({
  events,
  colorOf,
  conflictIds,
}: {
  events: CalEvent[];
  colorOf: (org: string) => string;
  conflictIds: Set<string>;
}) => {
  const span = (END_HOUR - START_HOUR) * 60;
  const top = (t: string) => ((mins(t) - START_HOUR * 60) / span) * 100;
  const height = (a: string, b: string) => ((mins(b) - mins(a)) / span) * 100;

  return (
    <div className="vo-week">
      <div className="vo-week-gutter" aria-hidden>
        <div className="vo-week-corner" />
        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
          <div key={i} className="vo-week-hour">
            {fmt12(`${String(START_HOUR + i).padStart(2, "0")}:00`)}
          </div>
        ))}
      </div>

      {DAYS.map((day) => (
        <div key={day} className="vo-week-col">
          <div className="vo-week-day">{day}</div>
          <div className="vo-week-track">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div key={i} className="vo-week-slot" aria-hidden />
            ))}
            {events
              .filter((e) => e.day === day)
              .map((e) => (
                <div
                  key={e.id}
                  className="vo-ev"
                  data-conflict={conflictIds.has(e.id) ? "true" : undefined}
                  style={{
                    top: `${top(e.start)}%`,
                    height: `${height(e.start, e.end)}%`,
                    borderLeftColor: colorOf(e.org),
                  }}
                  title={`${e.title} · ${fmtRange(e.start, e.end)} · ${calendarLabel(e.calendar)}`}
                >
                  <span className="vo-ev-time">{fmtRange(e.start, e.end)}</span>
                  <span className="vo-ev-title">{e.title}</span>
                  {e.where ? <span className="vo-ev-where">{e.where}</span> : null}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * ConflictCard — names the collision in a sentence. Leaving the user to
 * spot two overlapping blocks is how a double booking survives until the
 * morning of.
 */
export const ConflictCard = ({
  list,
  crossCount,
}: {
  list: Conflict[];
  crossCount: number;
}) => (
  <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
    <div className="vo-between">
      <div className="vo-row" style={{ gap: "var(--s-2)" }}>
        <AlertTriangle size={15} aria-hidden style={{ color: "var(--warn-txt)" }} />
        <h3 className="vo-title">
          {list.length === 0 ? "No double bookings this week" : `${list.length} double booking${list.length === 1 ? "" : "s"}`}
        </h3>
      </div>
      <Tag tone={list.length === 0 ? "ok" : "warn"}>{list.length === 0 ? "clear" : "same calendar"}</Tag>
    </div>

    {list.length === 0 ? (
      <p className="vo-desc">
        Nothing on a single calendar overlaps itself. You can stop scanning the grid for it.
      </p>
    ) : (
      <div className="vo-conflicts">
        {list.map((c, i) => (
          <div key={i} className="vo-conflict">
            <div className="vo-conflict-when">
              {c.day} · {fmtRange(c.a.start, c.a.end)} against {fmtRange(c.b.start, c.b.end)}
            </div>
            <p className="vo-conflict-body">
              <strong>{c.a.title}</strong> and <strong>{c.b.title}</strong> are both on{" "}
              <strong>{calendarLabel(c.calendar)}</strong>, overlapping by {c.overlap} minutes.
              One of them has to move.
            </p>
          </div>
        ))}
      </div>
    )}

    <div className="vo-row" style={{ gap: "var(--s-2)", alignItems: "flex-start" }}>
      <Layers size={13} aria-hidden style={{ color: "var(--ink-dim)", marginTop: 2 }} />
      <div className="vo-stack" style={{ gap: 2 }}>
        <Eyebrow>Not counted</Eyebrow>
        <span className="vo-meta">
          {crossCount} overlap{crossCount === 1 ? "" : "s"} across different calendars. That is
          a work account and a personal one running at the same hour, which is normal, so it is
          not flagged here.
        </span>
      </div>
    </div>
  </div>
);
