import { useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { useTasks, type Task, type TaskStatus } from "@/hooks/useTasks";
import { useOrg } from "@/contexts/OrgContext";
import { ProjectsPanel } from "@/components/tasks/ProjectsPanel";
import { BoardView } from "@/components/tasks/BoardView";
import { ListView } from "@/components/tasks/ListView";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { useIsMobile } from "@/hooks/use-mobile";

type View = "board" | "list" | "my";

const Tasks = () => {
  const isMobile = useIsMobile();
  const { activeOrgId } = useOrg();
  const { tasks, projects, orgs, loading, updateTask, createTask, deleteTask, createProject } = useTasks();
  const [view, setView] = useState<View>(isMobile ? "my" : "board");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const handleCreate = async (input: Parameters<typeof createTask>[0]) => {
    return await createTask(input);
  };

  return (
    <div className="space-y-4">
      {/* Topbar row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <CheckSquare size={20} strokeWidth={1.25} style={{ color: "var(--text-accent)" }} />
          <h1 className="t-section">Tasks</h1>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-md" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
          {(["board", "list", "my"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded ${view === v ? "glass-active" : ""}`}
              style={{ color: view === v ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              {v === "board" ? "Board" : v === "list" ? "List" : "My Tasks"}
            </button>
          ))}
        </div>

        <button
          className="btn-primary"
          style={{ height: 36, padding: "0 14px" }}
          onClick={() => {
            const orgId = activeOrgId && activeOrgId !== "all" ? activeOrgId : orgs[0]?.id;
            if (!orgId) return;
            void createTask({ title: "New task", org_id: orgId, project_id: selectedProjectId }).then((t) => {
              if (t) setOpenTask(t);
            });
          }}
        >
          <Plus size={14} strokeWidth={1.5} /> New Task
        </button>
      </div>

      <div className="flex gap-6">
        <ProjectsPanel
          projects={projects}
          tasks={tasks}
          orgs={orgs}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onCreateProject={(name, org_id) => void createProject(name, org_id)}
          activeOrgId={activeOrgId}
        />

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="t-mono" style={{ color: "var(--text-muted)" }}>LOADING<span className="slash">/</span>TASKS</div>
          ) : view === "board" ? (
            <BoardView
              tasks={tasks}
              orgs={orgs}
              projects={projects}
              activeOrgId={activeOrgId}
              onTaskClick={setOpenTask}
              onUpdate={updateTask}
              onCreate={(input) =>
                void createTask({
                  title: input.title,
                  status: input.status as TaskStatus,
                  org_id: input.org_id,
                  project_id: input.project_id,
                })
              }
              selectedProjectId={selectedProjectId}
            />
          ) : view === "list" ? (
            <ListView
              tasks={tasks}
              orgs={orgs}
              projects={projects}
              onTaskClick={setOpenTask}
              onUpdate={updateTask}
              selectedProjectId={selectedProjectId}
            />
          ) : (
            <MyTasksView tasks={tasks} orgs={orgs} projects={projects} onTaskClick={setOpenTask} />
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
        onCreate={handleCreate}
      />
    </div>
  );
};

export default Tasks;
