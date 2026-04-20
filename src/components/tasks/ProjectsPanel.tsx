import { useState } from "react";
import { Plus, Inbox } from "lucide-react";
import type { Project, Task } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";

interface Props {
  projects: Project[];
  tasks: Task[];
  orgs: Org[];
  selectedProjectId: string | null;
  onSelect: (id: string | null) => void;
  onCreateProject: (name: string, org_id: string) => void;
  activeOrgId: string | "all" | null;
}

export const ProjectsPanel = ({
  projects,
  tasks,
  orgs,
  selectedProjectId,
  onSelect,
  onCreateProject,
  activeOrgId,
}: Props) => {
  const [adding, setAdding] = useState<string | null>(null); // org_id
  const [val, setVal] = useState("");

  const orgsToShow =
    activeOrgId && activeOrgId !== "all" ? orgs.filter((o) => o.id === activeOrgId) : orgs;

  const taskCount = (projectId: string) =>
    tasks.filter((t) => t.project_id === projectId && t.status !== "done").length;

  const allOpen = tasks.filter((t) => t.status !== "done").length;

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-[200px] shrink-0">
      <div className="flex items-center justify-between px-1">
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ fontFamily: "Monument Grotesk, sans-serif", fontWeight: 700, color: "var(--text-secondary)" }}
        >
          Projects
        </span>
      </div>

      <button
        onClick={() => onSelect(null)}
        className={`nav-item ${selectedProjectId === null ? "glass-active" : ""}`}
      >
        <Inbox size={14} strokeWidth={1.5} />
        <span className="flex-1 text-left">All Tasks</span>
        <span className="t-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {allOpen}
        </span>
      </button>

      {orgsToShow.map((org) => (
        <div key={org.id} className="space-y-1">
          <div
            className="text-[10px] uppercase tracking-wider px-1 flex items-center gap-1.5"
            style={{ color: org.color, fontFamily: "Monument Grotesk, sans-serif", fontWeight: 700 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: org.color }} />
            {org.name}
          </div>
          {projects
            .filter((p) => p.org_id === org.id)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`nav-item ${selectedProjectId === p.id ? "glass-active" : ""}`}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: org.color }} />
                <span className="flex-1 text-left truncate">{p.name}</span>
                <span className="t-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {taskCount(p.id)}
                </span>
              </button>
            ))}

          {adding === org.id ? (
            <input
              autoFocus
              className="input-glass text-xs"
              placeholder="Project name…"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={() => {
                if (val.trim()) onCreateProject(val.trim(), org.id);
                setVal("");
                setAdding(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && val.trim()) {
                  onCreateProject(val.trim(), org.id);
                  setVal("");
                  setAdding(null);
                } else if (e.key === "Escape") {
                  setVal("");
                  setAdding(null);
                }
              }}
            />
          ) : (
            <button
              onClick={() => setAdding(org.id)}
              className="nav-item"
              style={{ color: "var(--text-muted)" }}
            >
              <Plus size={12} strokeWidth={1.5} />
              <span className="text-[12px]">New project</span>
            </button>
          )}
        </div>
      ))}
    </aside>
  );
};
