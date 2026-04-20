import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isToday, isThisWeek, isPast } from "date-fns";
import type { Task, Project } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";
import { TaskCard } from "./TaskCard";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";

interface Props {
  tasks: Task[];
  orgs: Org[];
  projects: Project[];
  onTaskClick: (t: Task) => void;
}

export const MyTasksView = ({ tasks, orgs, projects, onTaskClick }: Props) => {
  const { user } = useAuth();
  const mine = tasks.filter((t) => t.assignee_id === user?.id);

  const groups = {
    today: mine.filter((t) => t.due_at && isToday(new Date(t.due_at)) && t.status !== "done"),
    week: mine.filter(
      (t) =>
        t.due_at &&
        !isToday(new Date(t.due_at)) &&
        isThisWeek(new Date(t.due_at)) &&
        t.status !== "done",
    ),
    later: mine.filter(
      (t) => t.due_at && !isThisWeek(new Date(t.due_at)) && !isPast(new Date(t.due_at)) && t.status !== "done",
    ),
    none: mine.filter((t) => !t.due_at && t.status !== "done"),
  };

  const completedThisWeek = mine.filter(
    (t) => t.status === "done" && isThisWeek(new Date(t.created_at)),
  ).length;
  const totalThisWeek = mine.filter((t) => isThisWeek(new Date(t.created_at))).length;
  const pct = totalThisWeek > 0 ? (completedThisWeek / totalThisWeek) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="t-card-title">This week's progress</span>
          <span className="t-mono text-xs" style={{ color: "var(--text-secondary)" }}>
            {completedThisWeek}/{totalThisWeek}
          </span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <Group title="Due Today" tasks={groups.today} orgs={orgs} projects={projects} onTaskClick={onTaskClick} />
      <Group title="This Week" tasks={groups.week} orgs={orgs} projects={projects} onTaskClick={onTaskClick} />
      <Group title="Later" tasks={groups.later} orgs={orgs} projects={projects} onTaskClick={onTaskClick} />
      <Group title="No Due Date" tasks={groups.none} orgs={orgs} projects={projects} onTaskClick={onTaskClick} />
    </div>
  );
};

const Group = ({
  title,
  tasks,
  orgs,
  projects,
  onTaskClick,
}: {
  title: string;
  tasks: Task[];
  orgs: Org[];
  projects: Project[];
  onTaskClick: (t: Task) => void;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-3 text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
        <span className="t-mono text-xs" style={{ color: "var(--text-muted)" }}>
          {tasks.length}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              org={orgs.find((o) => o.id === t.org_id)}
              projectName={projects.find((p) => p.id === t.project_id)?.name}
              onClick={() => onTaskClick(t)}
              draggable={false}
            />
          ))}
          {tasks.length === 0 && (
            <div className="t-body text-sm" style={{ color: "var(--text-muted)" }}>
              Nothing here.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
