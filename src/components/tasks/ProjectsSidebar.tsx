import { useState } from "react";
import { Plus, Inbox, AlertCircle, Star, CheckCircle2, Calendar as CalIcon, Archive, MoreHorizontal, Trash2, Edit2 } from "lucide-react";
import type { Project, Task, TaskSection } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";
import { isPast, isToday } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewProjectModal } from "./NewProjectModal";

export type QuickFilter = "all" | "due_today" | "overdue" | "high_priority" | "completed" | null;

interface Props {
  projects: Project[];
  sections: TaskSection[];
  tasks: Task[];
  orgs: Org[];
  selectedProjectId: string | null;
  quickFilter: QuickFilter;
  onSelectProject: (id: string | null) => void;
  onSelectQuickFilter: (f: QuickFilter) => void;
  onCreateProject: (input: { name: string; org_id: string; emoji?: string; description?: string; template?: string }) => Promise<Project | null>;
  onArchiveProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
}

export const ProjectsSidebar = ({
  projects, tasks, orgs, selectedProjectId, quickFilter,
  onSelectProject, onSelectQuickFilter, onCreateProject, onArchiveProject, onDeleteProject, onUpdateProject,
}: Props) => {
  const [showNew, setShowNew] = useState(false);

  const dueTodayCount = tasks.filter((t) => t.due_at && isToday(new Date(t.due_at)) && t.status !== "done").length;
  const overdueCount = tasks.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)) && t.status !== "done").length;
  const taskCount = (pid: string) => tasks.filter((t) => t.project_id === pid && t.status !== "done" && !t.parent_task_id).length;

  const QF = ({ id, icon: Icon, label, count, color }: { id: QuickFilter; icon: typeof Inbox; label: string; count?: number; color?: string }) => (
    <button
      onClick={() => { onSelectProject(null); onSelectQuickFilter(id); }}
      className={`nav-item w-full ${quickFilter === id && !selectedProjectId ? "glass-active" : ""}`}
    >
      <Icon size={14} strokeWidth={1.5} style={{ color: color ?? "var(--text-secondary)" }} />
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="t-mono text-[10px]" style={{ color: color ?? "var(--text-muted)" }}>{count}</span>
      )}
    </button>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col gap-1 w-[240px] shrink-0 h-[calc(100vh-140px)] overflow-y-auto pr-2">
        {/* Projects grouped by org */}
        {orgs.map((org) => {
          const orgProjects = projects.filter((p) => p.org_id === org.id);
          if (orgProjects.length === 0) return null;
          return (
            <div key={org.id} className="mb-3">
              <div
                className="text-[10px] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5"
                style={{ color: org.color, fontFamily: "Monument Grotesk, sans-serif", fontWeight: 700 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: org.color }} />
                {org.name}
              </div>
              {orgProjects.map((p) => {
                const active = selectedProjectId === p.id;
                return (
                  <div key={p.id} className="group flex items-center">
                    <button
                      onClick={() => { onSelectProject(p.id); onSelectQuickFilter(null); }}
                      className={`nav-item flex-1 ${active ? "glass-active" : ""}`}
                      style={active ? { borderLeft: `3px solid ${org.color}`, paddingLeft: 7 } : undefined}
                    >
                      <span className="text-[14px]">{p.emoji ?? "📋"}</span>
                      <span className="flex-1 text-left truncate">{p.name}</span>
                      <span className="t-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {taskCount(p.id) || ""}
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 px-1 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal size={12} style={{ color: "var(--text-muted)" }} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const name = prompt("Rename project", p.name);
                          if (name && name.trim()) onUpdateProject(p.id, { name: name.trim() });
                        }}>
                          <Edit2 size={12} className="mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchiveProject(p.id)}>
                          <Archive size={12} className="mr-2" /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { if (confirm(`Delete "${p.name}"? This will delete all its tasks.`)) onDeleteProject(p.id); }}
                          className="text-destructive"
                        >
                          <Trash2 size={12} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Quick filters */}
        <div className="border-t pt-3 mt-2 mb-2" style={{ borderColor: "var(--border-glass)" }}>
          <div
            className="text-[10px] uppercase tracking-wider px-2 mb-1"
            style={{ color: "var(--text-secondary)", fontFamily: "Monument Grotesk, sans-serif", fontWeight: 700 }}
          >
            Quick Filters
          </div>
          <QF id="all" icon={Inbox} label="All My Tasks" />
          <QF id="due_today" icon={CalIcon} label="Due Today" count={dueTodayCount} color="#F59E0B" />
          <QF id="overdue" icon={AlertCircle} label="Overdue" count={overdueCount} color="#EF4444" />
          <QF id="high_priority" icon={Star} label="High Priority" />
          <QF id="completed" icon={CheckCircle2} label="Completed" />
        </div>

        <button
          onClick={() => setShowNew(true)}
          className="btn-ghost mt-2 justify-start"
          style={{ height: 32 }}
        >
          <Plus size={14} strokeWidth={1.5} />
          <span className="text-[13px]">New Project</span>
        </button>
      </aside>

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        orgs={orgs}
        onCreate={async (input) => {
          const p = await onCreateProject(input);
          if (p) { onSelectProject(p.id); onSelectQuickFilter(null); }
          setShowNew(false);
        }}
      />
    </>
  );
};
