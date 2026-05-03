import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { TaskDetailBody } from "@/components/tasks/TaskDetailPanel";

const TaskFullPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, projects, orgs, loading, updateTask, deleteTask, createTask } = useTasks();

  const task = tasks.find((t) => t.id === id);

  if (loading) {
    return (
      <div className="t-mono" style={{ color: "var(--text-muted)" }}>
        LOADING<span className="slash">/</span>TASK
      </div>
    );
  }
  if (!task) {
    return (
      <div className="space-y-3">
        <button onClick={() => navigate("/tasks")} className="btn-ghost">
          <ArrowLeft size={14} /> Back to Tasks
        </button>
        <div className="glass p-12 text-center" style={{ color: "var(--text-muted)" }}>
          Task not found.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate("/tasks")} className="btn-ghost inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Tasks
      </button>
      <div className="glass p-6">
        <TaskDetailBody
          task={task}
          orgs={orgs}
          projects={projects}
          allTasks={tasks}
          onUpdate={updateTask}
          onDelete={(tid) => { deleteTask(tid); navigate("/tasks"); }}
          onCreate={createTask}
          onClose={() => navigate("/tasks")}
        />
      </div>
    </div>
  );
};

export default TaskFullPage;
