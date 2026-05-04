import { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { FundraisingTask, Opportunity } from "@/hooks/useFundraising";

export function TasksPanel({
  tasks, opps, onUpdate, onDelete,
}: {
  tasks: FundraisingTask[];
  opps: Opportunity[];
  onUpdate: (id: string, patch: Partial<FundraisingTask>) => void;
  onDelete: (id: string) => void;
}) {
  const [assignee, setAssignee] = useState("all");
  const [showDone, setShowDone] = useState(false);

  const oppById = useMemo(() => Object.fromEntries(opps.map((o) => [o.id, o])), [opps]);
  const assignees = useMemo(() => Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean) as string[])), [tasks]);

  const filtered = tasks
    .filter((t) => (assignee === "all" || t.assigned_to === assignee))
    .filter((t) => (showDone ? true : t.status !== "done"));

  return (
    <div className="rounded-xl p-4" style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
          Fundraising Tasks
        </div>
        <div className="flex gap-2">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded px-2 py-1 text-xs"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff" }}
          >
            <option value="all">All assignees</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={() => setShowDone(!showDone)}
            className="rounded px-2 py-1 text-xs"
            style={{ background: showDone ? "#9bd34b22" : "#1a1a1a", color: showDone ? "#9bd34b" : "#fff", border: "1px solid #2a2a2a" }}
          >
            {showDone ? "Hide done" : "Show done"}
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-6" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No tasks yet. Click "+ Task" on any opportunity.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {filtered.map((t) => {
          const opp = t.opportunity_id ? oppById[t.opportunity_id] : null;
          const overdue = t.due_at && new Date(t.due_at) < new Date() && t.status !== "done";
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-md px-2 py-2"
              style={{ background: "#141414", border: "1px solid #1e1e1e", opacity: t.status === "done" ? 0.5 : 1 }}
            >
              <button
                onClick={() => onUpdate(t.id, { status: t.status === "done" ? "open" : "done" })}
                className="rounded flex items-center justify-center"
                style={{
                  width: 18, height: 18,
                  background: t.status === "done" ? "#9bd34b" : "transparent",
                  border: `1px solid ${t.status === "done" ? "#9bd34b" : "#3a3a3a"}`,
                }}
              >
                {t.status === "done" && <Check size={12} color="#000" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: "#fff", textDecoration: t.status === "done" ? "line-through" : undefined }}>
                  {t.title}
                </div>
                <div className="flex gap-2 items-center" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {opp && <span style={{ color: "#5b9cf6" }}>{opp.name}</span>}
                  {t.assigned_to && <span>· {t.assigned_to}</span>}
                  {t.due_at && (
                    <span style={{ color: overdue ? "#e05252" : undefined }}>
                      · Due {new Date(t.due_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => onDelete(t.id)} className="opacity-50 hover:opacity-100" title="Delete">
                <Trash2 size={14} color="#e05252" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
