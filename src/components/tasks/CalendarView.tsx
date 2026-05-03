import { useState } from "react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Task } from "@/hooks/useTasks";

const PRI_COLOR: Record<string, string> = {
  urgent: "#EF4444", high: "#EF4444", medium: "#F59E0B", normal: "#3B82F6", low: "#6B7280",
};

interface Props {
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
}

export const CalendarView = ({ tasks, onTaskClick, onUpdate }: Props) => {
  const [month, setMonth] = useState(new Date());
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const tasksOn = (day: Date) =>
    tasks.filter((t) => t.due_at && isSameDay(new Date(t.due_at), day));

  const onDrop = (day: Date, taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const newDue = new Date(day);
    if (t.due_at) {
      const old = new Date(t.due_at);
      newDue.setHours(old.getHours(), old.getMinutes());
    } else {
      newDue.setHours(9, 0, 0, 0);
    }
    onUpdate(taskId, { due_at: newDue.toISOString() });
  };

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="t-card-title">{format(month, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <button className="btn-ghost" style={{ height: 28, padding: "0 8px" }} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft size={14} />
          </button>
          <button className="btn-ghost" style={{ height: 28, padding: "0 8px" }} onClick={() => setMonth(new Date())}>Today</button>
          <button className="btn-ghost" style={{ height: 28, padding: "0 8px" }} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="t-mono text-[10px] py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px" style={{ background: "var(--border-glass)" }}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const today = isSameDay(day, new Date());
          const dayTasks = tasksOn(day);
          return (
            <div
              key={day.toISOString()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(day, e.dataTransfer.getData("text/plain"))}
              className="min-h-[90px] p-1.5"
              style={{
                background: today ? "rgba(59,130,246,0.08)" : "var(--bg-glass-1)",
                opacity: inMonth ? 1 : 0.4,
              }}
            >
              <div className="t-mono text-[10px] mb-1" style={{ color: today ? "#3B82F6" : "var(--text-muted)" }}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    onClick={() => onTaskClick(t)}
                    className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate"
                    style={{
                      background: PRI_COLOR[t.priority ?? "normal"] + "30",
                      borderLeft: `2px solid ${PRI_COLOR[t.priority ?? "normal"]}`,
                      color: "var(--text-primary)",
                      textDecoration: t.status === "done" ? "line-through" : undefined,
                    }}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 4 && (
                  <div className="t-mono text-[9px]" style={{ color: "var(--text-muted)" }}>+{dayTasks.length - 4}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
