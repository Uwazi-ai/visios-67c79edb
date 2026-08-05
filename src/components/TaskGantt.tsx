import { Fragment } from "react";
import {
  AXIS_DAYS,
  PEOPLE,
  Task,
  TODAY_INDEX,
  criticalPath,
  dateForOffset,
  isOverdue,
} from "@/data/tasks";

/**
 * Gantt — bars read the same `start` and `len` integers the list reads.
 *
 * Horizontal geometry is percentages of the 14-day axis; vertical geometry
 * is pixels of a fixed row height. Connectors are positioned divs rather
 * than one stretched SVG: an SVG scaled with preserveAspectRatio="none"
 * would squash the dash pattern and stroke width along one axis, and a
 * dependency line that renders as a smear reads as a bug.
 */

const ROW_H = 40;
const BAR_H = 18;

const pct = (days: number) => `${(days / AXIS_DAYS) * 100}%`;

export const Gantt = ({
  tasks,
  colorOf,
  orgOf,
  projectName,
}: {
  tasks: Task[];
  colorOf: (org: string) => string;
  orgOf: (project: string) => string;
  projectName: (id: string) => string;
}) => {
  const critical = criticalPath(tasks);
  const rowOf = new Map(tasks.map((t, i) => [t.id, i]));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const axis = Array.from({ length: AXIS_DAYS }, (_, i) => dateForOffset(i));

  /* Only links whose predecessor is also on screen. Drawing a connector to
     a row that scope filtered out would point at empty space. */
  const links = tasks.flatMap((t) =>
    (t.deps ?? [])
      .filter((d) => byId.has(d) && rowOf.has(d))
      .map((d) => ({ from: byId.get(d)!, to: t })),
  );

  if (tasks.length === 0) {
    return <p className="vo-meta">No tasks in scope.</p>;
  }

  return (
    <div className="vo-gantt">
      <div className="vo-gantt-labels">
        <div className="vo-gantt-corner vo-eyebrow">Task</div>
        {tasks.map((t) => (
          <div key={t.id} className="vo-gantt-label" style={{ height: ROW_H }}>
            <span className="vo-gantt-name" data-done={t.done ? "true" : undefined}>
              {t.title}
            </span>
            <span className="vo-meta vo-nowrap">{projectName(t.project)}</span>
          </div>
        ))}
      </div>

      <div className="vo-gantt-track">
        <div className="vo-gantt-axis">
          {axis.map((d, i) => {
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className="vo-gantt-day"
                data-weekend={weekend ? "true" : undefined}
                data-today={i === TODAY_INDEX ? "true" : undefined}
              >
                <span>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                <strong>{d.getDate()}</strong>
              </div>
            );
          })}
        </div>

        <div className="vo-gantt-rows" style={{ height: tasks.length * ROW_H }}>
          {axis.map((d, i) => (
            <div
              key={i}
              className="vo-gantt-grid"
              data-weekend={d.getDay() === 0 || d.getDay() === 6 ? "true" : undefined}
              style={{ left: pct(i), width: pct(1) }}
            />
          ))}

          {links.map(({ from, to }, i) => {
            const fromRow = rowOf.get(from.id)!;
            const toRow = rowOf.get(to.id)!;
            const fromEnd = from.start + from.len;
            /* Elbow: out of the predecessor's end, down (or up) to the
               successor's row, then across to where it starts. */
            const turn = Math.min(fromEnd + 0.35, to.start);
            const y1 = fromRow * ROW_H + ROW_H / 2;
            const y2 = toRow * ROW_H + ROW_H / 2;
            const top = Math.min(y1, y2);
            const height = Math.abs(y2 - y1);
            return (
              <Fragment key={`${from.id}-${to.id}-${i}`}>
                <div
                  className="vo-link-h"
                  style={{ top: y1, left: pct(fromEnd), width: pct(Math.max(turn - fromEnd, 0)) }}
                />
                {height > 0 && (
                  <div className="vo-link-v" style={{ top, left: pct(turn), height }} />
                )}
                <div
                  className="vo-link-h"
                  style={{ top: y2, left: pct(turn), width: pct(Math.max(to.start - turn, 0)) }}
                />
                <div className="vo-link-cap" style={{ top: y2, left: pct(to.start) }} />
              </Fragment>
            );
          })}

          {tasks.map((t, i) => {
            const color = colorOf(orgOf(t.project));
            const crit = critical.has(t.id) && !t.done;
            const person = PEOPLE[t.assignee];
            return (
              <div
                key={t.id}
                className="vo-gbar"
                data-done={t.done ? "true" : undefined}
                data-critical={crit ? "true" : undefined}
                data-late={isOverdue(t) ? "true" : undefined}
                title={`${t.title} · ${t.len} day${t.len === 1 ? "" : "s"} · ${t.assignee}${
                  crit ? " · critical path" : ""
                }`}
                style={{
                  top: i * ROW_H + (ROW_H - BAR_H) / 2,
                  height: BAR_H,
                  left: pct(t.start),
                  width: pct(t.len),
                  background: crit ? "var(--err-txt)" : color,
                }}
              >
                <span className="vo-gbar-text">{person?.initials ?? t.assignee}</span>
              </div>
            );
          })}

          <div className="vo-today" style={{ left: pct(TODAY_INDEX) }} />
        </div>

        <div className="vo-today-flag" style={{ left: pct(TODAY_INDEX) }}>
          Today
        </div>
      </div>
    </div>
  );
};

export const GanttKey = () => (
  <div className="vo-row vo-gantt-key">
    <span className="vo-key">
      <i className="vo-key-swatch" data-critical="true" /> critical path
    </span>
    <span className="vo-key">
      <i className="vo-key-swatch" style={{ background: "var(--ws-uwazi)" }} /> org colour
    </span>
    <span className="vo-key">
      <i className="vo-key-dash" /> depends on
    </span>
  </div>
);
