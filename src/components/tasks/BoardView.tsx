import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { Task, TaskStatus, Project } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";
import type { MemberInfo } from "@/hooks/useOrgMembersMap";
import { TaskCard } from "./TaskCard";
import { toast } from "@/hooks/use-toast";

const COLUMNS: { id: TaskStatus; label: string; tint: string }[] = [
  { id: "todo", label: "TODO", tint: "transparent" },
  { id: "in_progress", label: "IN PROGRESS", tint: "rgba(37,99,235,0.05)" },
  { id: "done", label: "DONE", tint: "rgba(34,197,94,0.05)" },
  { id: "blocked", label: "BLOCKED", tint: "rgba(239,68,68,0.05)" },
];

interface Props {
  tasks: Task[];
  orgs: Org[];
  projects: Project[];
  activeOrgId: string | "all" | null;
  members?: Record<string, MemberInfo>;
  onTaskClick: (t: Task) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onCreate: (input: { title: string; status: TaskStatus; org_id: string; project_id: string | null }) => void;
  selectedProjectId: string | null;
}

const Column = ({
  col,
  tasks,
  orgs,
  projects,
  members,
  onTaskClick,
  onAdd,
}: {
  col: typeof COLUMNS[number];
  tasks: Task[];
  orgs: Org[];
  projects: Project[];
  members?: Record<string, MemberInfo>;
  onTaskClick: (t: Task) => void;
  onAdd: (title: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");

  return (
    <div
      ref={setNodeRef}
      className="glass p-3 flex flex-col gap-2 min-w-[280px] md:min-w-0 snap-center"
      style={{
        background: isOver ? "rgba(37,99,235,0.08)" : col.tint,
        minHeight: 400,
        transition: "background 0.15s",
      }}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "Monument Grotesk, sans-serif", fontWeight: 700, color: "var(--text-secondary)" }}
        >
          {col.label}
        </span>
        <span className="t-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            org={orgs.find((o) => o.id === t.org_id)}
            projectName={projects.find((p) => p.id === t.project_id)?.name}
            assignee={t.assignee_id ? members?.[t.assignee_id] : undefined}
            onClick={() => onTaskClick(t)}
          />
        ))}
      </div>

      {adding ? (
        <input
          autoFocus
          className="input-glass text-[13px]"
          placeholder="Task title…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            if (val.trim()) onAdd(val.trim());
            setVal("");
            setAdding(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) {
              onAdd(val.trim());
              setVal("");
              setAdding(false);
            } else if (e.key === "Escape") {
              setVal("");
              setAdding(false);
            }
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="btn-ghost text-[12px] justify-start"
          style={{ height: 32, padding: "0 10px" }}
        >
          <Plus size={12} strokeWidth={1.5} /> Add task
        </button>
      )}
    </div>
  );
};

export const BoardView = ({
  tasks,
  orgs,
  projects,
  activeOrgId,
  members,
  onTaskClick,
  onUpdate,
  onCreate,
  selectedProjectId,
}: Props) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;
    onUpdate(task.id, { status: newStatus });
    toast({ title: `Moved to ${newStatus.replace("_", " ")}` });
  };

  const filtered = selectedProjectId ? tasks.filter((t) => t.project_id === selectedProjectId) : tasks;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none">
        {COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => (t.status ?? "todo") === col.id);
          const orgIdForAdd =
            activeOrgId && activeOrgId !== "all"
              ? activeOrgId
              : selectedProjectId
              ? projects.find((p) => p.id === selectedProjectId)?.org_id ?? orgs[0]?.id
              : orgs[0]?.id;
          return (
            <Column
              key={col.id}
              col={col}
              tasks={colTasks}
              orgs={orgs}
              projects={projects}
              members={members}
              onTaskClick={onTaskClick}
              onAdd={(title) => {
                if (!orgIdForAdd) {
                  toast({ title: "Pick an org first", variant: "destructive" });
                  return;
                }
                onCreate({ title, status: col.id, org_id: orgIdForAdd, project_id: selectedProjectId });
              }}
            />
          );
        })}
      </div>
    </DndContext>
  );
};
