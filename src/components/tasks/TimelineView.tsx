import { useMemo, useState } from "react";
import { addDays, differenceInDays, format, startOfDay, isSameDay } from "date-fns";
import type { Task, TaskSection } from "@/hooks/useTasks";

interface Props {
  tasks: Task[];
  sections: TaskSection[];
  activeProjectId: string | null;
  onTaskClick: (t: Task) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
}

const PRI_COLOR: Record<string, string> = {
  urgent: "#EF4444", high: "#EF4444", medium: "#F59E0B", normal: "#3B82F6", low: "#6B7280",
};

const ZOOM_DAYS: Record<string, number> = { week: 7, month: 30, quarter: 90 };
const PX_PER_DAY: Record<string, number> = { week: 80, month: 28, quarter: 14 };

export const TimelineView = ({ tasks, sections, activeProjectId, onTaskClick, onUpdate }: Props) => {
  const [zoom, setZoom] = useState<"week" | "month" | "quarter">("month");
  const days = ZOOM_DAYS[zoom];
  const px = PX_PER_DAY[zoom];

  const today = startOfDay(new Date());
  const start = addDays(today, -Math.floor(days / 4));
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);

  const scheduled = tasks.filter((t) => t.due_at && !t.parent_task_id);
  const unscheduled = tasks.filter((t) => !t.due_at && !t.parent_task_id);

  const groups = activeProjectId
    ? sections.filter((s) => s.project_id === activeProjectId).map((s) => ({
        id: s.id, name: s.name, tasks: scheduled.filter((t) => t.section_id === s.id),
      })).concat([{ id: "none", name: "No section", tasks: scheduled.filter((t) => t.project_id === activeProjectId && !t.section_id) }])
    : [{ id: "all", name: "All", tasks: scheduled }];

  const totalWidth = days * px;

  const taskBar = (t: Task) => {
    const due = startOfDay(new Date(t.due_at!));
    const taskStart = t.start_date ? startOfDay(new Date(t.start_date)) : due;
    const left = Math.max(0, differenceInDays(taskStart, start)) * px;
    const width = Math.max(px, (differenceInDays(due, taskStart) + 1) * px);
    return (
      <div
        key={t.id}
        onClick={() => onTaskClick(t)}
        className="absolute h-6 rounded cursor-pointer flex items-center px-2 text-[10px] truncate hover:ring-2 hover:ring-white/30"
        style={{
          left, width,
          background: PRI_COLOR[t.priority ?? "normal"] + "40",
          borderLeft: `2px solid ${PRI_COLOR[t.priority ?? "normal"]}`,
          color: "var(--text-primary)",
          textDecoration: t.status === "done" ? "line-through" : undefined,
        }}
      >
        {t.title}
      </div>
    );
  };

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border-glass)" }}>
        <div className="t-card-title">Timeline</div>
        <div className="flex gap-1 p-1 rounded-md" style={{ background: "var(--bg-glass-1)" }}>
          {(["week", "month", "quarter"] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2 py-0.5 text-[10px] rounded ${zoom === z ? "glass-active" : ""}`}
              style={{ color: zoom === z ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              {z[0].toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ width: totalWidth + 200 }}>
          {/* Header */}
          <div className="flex border-b sticky top-0 z-10" style={{ borderColor: "var(--border-glass)", background: "var(--bg-glass-1)" }}>
            <div style={{ width: 200 }} className="px-3 py-1.5 t-mono text-[10px]" />
            <div className="relative flex" style={{ width: totalWidth }}>
              {dates.map((d) => (
                <div
                  key={d.toISOString()}
                  className="border-l flex flex-col items-center justify-center text-[9px]"
                  style={{
                    width: px, borderColor: "var(--border-glass)",
                    color: isSameDay(d, today) ? "#3B82F6" : "var(--text-muted)",
                    fontWeight: isSameDay(d, today) ? 700 : 400,
                  }}
                >
                  <span>{format(d, zoom === "quarter" ? "M/d" : "MMM d")}</span>
                </div>
              ))}
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 border-l-2 border-dashed pointer-events-none"
                style={{ left: differenceInDays(today, start) * px, borderColor: "#3B82F6" }}
              />
            </div>
          </div>

          {/* Rows */}
          {groups.map((g) => (
            <div key={g.id} className="border-b" style={{ borderColor: "var(--border-glass)" }}>
              <div
                className="flex items-center px-3 py-1 t-mono text-[10px]"
                style={{ color: "var(--text-secondary)", background: "rgba(255,255,255,0.02)" }}
              >
                {g.name}
              </div>
              {g.tasks.map((t) => (
                <div key={t.id} className="flex relative" style={{ minHeight: 32 }}>
                  <div
                    style={{ width: 200 }}
                    className="px-3 py-1.5 text-[12px] truncate flex items-center cursor-pointer hover:bg-white/[0.04]"
                    onClick={() => onTaskClick(t)}
                  >
                    {t.title}
                  </div>
                  <div className="relative flex-1 py-1" style={{ width: totalWidth }}>
                    {taskBar(t)}
                  </div>
                </div>
              ))}
              {g.tasks.length === 0 && (
                <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-muted)" }}>No scheduled tasks</div>
              )}
            </div>
          ))}

          {/* Unscheduled tray */}
          {unscheduled.length > 0 && (
            <div className="p-3 border-t" style={{ borderColor: "var(--border-glass)" }}>
              <div className="t-mono text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>UNSCHEDULED ({unscheduled.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {unscheduled.slice(0, 20).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTaskClick(t)}
                    className="text-[11px] px-2 py-1 rounded hover:bg-white/10"
                    style={{ background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)" }}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
