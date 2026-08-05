import { useMemo, useState } from "react";
import { List, Columns3, GanttChartSquare } from "lucide-react";
import { Card, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import { Segmented } from "@/components/SettingsParts";
import { BoardView, ListView, ProjectCard } from "@/components/TaskViews";
import { Gantt, GanttKey } from "@/components/TaskGantt";
import { PROJECTS, isOverdue } from "@/data/tasks";
import { toggleTask, useTaskRecords } from "@/data/taskStore";
import { useAppState } from "@/lib/AppState";

type View = "list" | "board" | "timeline";

/**
 * Tasks — a project layer over one set of day offsets.
 *
 * The three views are three readings of the same records: no view holds
 * its own copy, and none of them can show a task the others cannot.
 */
const Tasks = () => {
  const { orgs, inScope, scope } = useAppState();
  const records = useTaskRecords();
  const [view, setView] = useState<View>("list");
  const [picked, setPicked] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const colorOf = useMemo(
    () => (org: string) => orgs.find((o) => o.id === org)?.color ?? "var(--ws-all)",
    [orgs],
  );
  const orgOf = useMemo(
    () => (project: string) => PROJECTS.find((p) => p.id === project)?.org ?? "all",
    [],
  );
  const projectName = useMemo(
    () => (id: string) => PROJECTS.find((p) => p.id === id)?.name ?? id,
    [],
  );

  /* Workspace scope first, then the optional project pick. Scoping down
     must never leave a selected card from a venture you can no longer see. */
  const visibleProjects = PROJECTS.filter((p) => inScope(p.org));
  const activePick = picked && visibleProjects.some((p) => p.id === picked) ? picked : null;

  const tasks = records.filter(
    (t) => inScope(orgOf(t.project)) && (!activePick || t.project === activePick),
  );

  const groups = visibleProjects
    .filter((p) => !activePick || p.id === activePick)
    .map((p) => ({ project: p, tasks: tasks.filter((t) => t.project === p.id) }))
    .filter((g) => g.tasks.length > 0);

  const open = tasks.filter((t) => !t.done).length;
  const late = tasks.filter(isOverdue).length;
  const scopeName = orgs.find((o) => o.id === scope)?.name ?? "All organizations";

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Tasks"
        action={
          <Segmented<View>
            name="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List", icon: <List size={14} /> },
              { value: "board", label: "Board", icon: <Columns3 size={14} /> },
              { value: "timeline", label: "Timeline", icon: <GanttChartSquare size={14} /> },
            ]}
          />
        }
      />

      <div className="vo-projrow">
        {visibleProjects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            color={colorOf(p.org)}
            tasks={records.filter((t) => t.project === p.id)}
            selected={activePick === p.id}
            onSelect={() => setPicked(activePick === p.id ? null : p.id)}
          />
        ))}
      </div>

      <Card ungated>
        <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
          <div className="vo-stack" style={{ gap: 2 }}>
            <Eyebrow>{activePick ? projectName(activePick) : scopeName}</Eyebrow>
            <div className="vo-meta">
              {open} open · {late} overdue
              {activePick ? " · filtered to one project" : ""}
            </div>
          </div>
          {view === "timeline" ? <GanttKey /> : null}
        </div>

        {tasks.length === 0 ? (
          <div className="vo-empty">
            <Eyebrow>Nothing in scope</Eyebrow>
            <Desc>No project in {scopeName} has tasks. Switch workspace in the rail.</Desc>
          </div>
        ) : view === "list" ? (
          <ListView
            groups={groups}
            collapsed={collapsed}
            onToggleSection={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
            onToggleTask={toggleTask}
            colorOf={colorOf}
          />
        ) : view === "board" ? (
          <BoardView
            tasks={tasks}
            projectName={projectName}
            colorOf={colorOf}
            orgOf={orgOf}
            onToggleTask={toggleTask}
          />
        ) : (
          <Gantt tasks={tasks} colorOf={colorOf} orgOf={orgOf} projectName={projectName} />
        )}
      </Card>
    </div>
  );
};

export default Tasks;
