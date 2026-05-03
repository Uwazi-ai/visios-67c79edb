import { useState, useMemo, useEffect } from "react";
import { CheckSquare, Plus, List as ListIcon, LayoutGrid, GanttChart, Calendar as CalIcon, Sparkles, Search } from "lucide-react";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useOrg } from "@/contexts/OrgContext";
import { ProjectsSidebar, type QuickFilter } from "@/components/tasks/ProjectsSidebar";
import { SectionedListView } from "@/components/tasks/SectionedListView";
import { BoardView } from "@/components/tasks/BoardView";
import { TimelineView } from "@/components/tasks/TimelineView";
import { CalendarView } from "@/components/tasks/CalendarView";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { GenerateTasksModal } from "@/components/tasks/GenerateTasksModal";
import { Input } from "@/components/ui/input";
import { isPast, isToday } from "date-fns";

type View = "list" | "board" | "timeline" | "calendar";

const Tasks = () => {
  const { activeOrgId } = useOrg();
  const {
    tasks, projects, sections, orgs, loading,
    updateTask, createTask, deleteTask,
    createProject, updateProject, archiveProject, deleteProject,
    createSection, updateSection, deleteSection,
  } = useTasks();
  const [view, setView] = useState<View>("list");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [showGen, setShowGen] = useState(false);

  // Re-sync openTask when tasks reload
  useEffect(() => {
    if (openTask) {
      const fresh = tasks.find((t) => t.id === openTask.id);
      if (fresh && fresh !== openTask) setOpenTask(fresh);
    }
  }, [tasks, openTask]);

  // Apply project / quick filter / search
  const filtered = useMemo(() => {
    let out = tasks;
    if (activeProjectId) {
      out = out.filter((t) => t.project_id === activeProjectId);
    } else {
      switch (quickFilter) {
        case "due_today":
          out = out.filter((t) => t.due_at && isToday(new Date(t.due_at)) && t.status !== "done");
          break;
        case "overdue":
          out = out.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)) && t.status !== "done");
          break;
        case "high_priority":
          out = out.filter((t) => ["urgent", "high"].includes(t.priority ?? ""));
          break;
        case "completed":
          out = out.filter((t) => t.status === "done");
          break;
        case "all":
        default:
          out = out.filter((t) => t.status !== "done");
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((t) => t.title.toLowerCase().includes(q));
    }
    return out;
  }, [tasks, activeProjectId, quickFilter, search]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const projectTasks = activeProjectId ? tasks.filter((t) => t.project_id === activeProjectId && !t.parent_task_id) : [];
  const projectDone = projectTasks.filter((t) => t.status === "done").length;
  const projectOverdue = projectTasks.filter((t) => t.due_at && isPast(new Date(t.due_at)) && t.status !== "done").length;
  const pct = projectTasks.length > 0 ? Math.round((projectDone / projectTasks.length) * 100) : 0;

  const tabs: { id: View; label: string; icon: typeof ListIcon }[] = [
    { id: "list", label: "List", icon: ListIcon },
    { id: "board", label: "Board", icon: LayoutGrid },
    { id: "timeline", label: "Timeline", icon: GanttChart },
    { id: "calendar", label: "Calendar", icon: CalIcon },
  ];

  const newTaskOrgId = activeProject?.org_id ?? (activeOrgId && activeOrgId !== "all" ? activeOrgId : orgs[0]?.id);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CheckSquare size={20} strokeWidth={1.25} style={{ color: "var(--text-accent)" }} />
          <h1 className="t-section truncate">
            {activeProject ? `${activeProject.emoji ?? "📋"} ${activeProject.name}` : "Tasks"}
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-md" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`px-2.5 py-1 text-xs rounded inline-flex items-center gap-1.5 ${active ? "glass-active" : ""}`}
                style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>

        <button className="btn-ghost" style={{ height: 36 }} onClick={() => setShowGen(true)}>
          <Sparkles size={14} strokeWidth={1.5} /> Generate from Notes
        </button>

        <button
          className="btn-primary"
          style={{ height: 36, padding: "0 14px" }}
          onClick={async () => {
            if (!newTaskOrgId) return;
            const t = await createTask({ title: "New task", org_id: newTaskOrgId, project_id: activeProjectId });
            if (t) setOpenTask(t);
          }}
          disabled={!newTaskOrgId}
        >
          <Plus size={14} strokeWidth={1.5} /> New Task
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 input-glass"
        />
      </div>

      {/* Project progress */}
      {activeProject && projectTasks.length > 0 && (
        <div className="glass p-3">
          <div className="flex items-center gap-3 text-[12px] mb-1.5">
            <span style={{ color: "var(--text-secondary)" }}>{projectDone} / {projectTasks.length} tasks</span>
            {projectOverdue > 0 && (
              <span style={{ color: "#EF4444" }}>🔴 {projectOverdue} overdue</span>
            )}
            <span className="ml-auto t-mono" style={{ color: "var(--text-muted)" }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-glass-2)" }}>
            <div className="h-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #3B82F6, #8B5CF6)" }} />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex gap-6">
        <ProjectsSidebar
          projects={projects}
          sections={sections}
          tasks={tasks}
          orgs={orgs}
          selectedProjectId={activeProjectId}
          quickFilter={quickFilter}
          onSelectProject={setActiveProjectId}
          onSelectQuickFilter={setQuickFilter}
          onCreateProject={createProject}
          onArchiveProject={archiveProject}
          onDeleteProject={deleteProject}
          onUpdateProject={updateProject}
        />

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="t-mono" style={{ color: "var(--text-muted)" }}>LOADING<span className="slash">/</span>TASKS</div>
          ) : view === "list" ? (
            <SectionedListView
              tasks={filtered}
              sections={sections}
              projects={projects}
              orgs={orgs}
              activeProjectId={activeProjectId}
              onTaskClick={setOpenTask}
              onUpdate={updateTask}
              onCreate={createTask}
              onDelete={deleteTask}
              onCreateSection={createSection}
              onUpdateSection={updateSection}
              onDeleteSection={deleteSection}
            />
          ) : view === "board" ? (
            <BoardView
              tasks={filtered}
              orgs={orgs}
              projects={projects}
              activeOrgId={activeOrgId}
              onTaskClick={setOpenTask}
              onUpdate={updateTask}
              onCreate={(input) =>
                void createTask({
                  title: input.title,
                  status: input.status,
                  org_id: input.org_id,
                  project_id: input.project_id,
                })
              }
              selectedProjectId={activeProjectId}
            />
          ) : view === "timeline" ? (
            <TimelineView
              tasks={filtered}
              sections={sections}
              activeProjectId={activeProjectId}
              onTaskClick={setOpenTask}
              onUpdate={updateTask}
            />
          ) : (
            <CalendarView tasks={filtered} onTaskClick={setOpenTask} onUpdate={updateTask} />
          )}
        </div>
      </div>

      <TaskDetailPanel
        task={openTask}
        open={!!openTask}
        onClose={() => setOpenTask(null)}
        orgs={orgs}
        projects={projects}
        allTasks={tasks}
        onUpdate={updateTask}
        onDelete={deleteTask}
        onCreate={createTask}
      />

      <GenerateTasksModal
        open={showGen}
        onClose={() => setShowGen(false)}
        orgs={orgs}
        projects={projects}
        defaultOrgId={newTaskOrgId ?? null}
        defaultProjectId={activeProjectId}
        onCreate={createTask}
      />
    </div>
  );
};

export default Tasks;
