import { Face, Tag } from "@/components/primitives";
import {
  COLUMN_LABEL,
  Column,
  PEOPLE,
  Priority,
  Project,
  Task,
  TODAY_INDEX,
  columnOf,
  dateForOffset,
  dueOffset,
  isOverdue,
} from "@/data/tasks";
import { ChevronDown, ChevronRight } from "lucide-react";

/** One formatter for every surface, reading the same offset the bar uses. */
export function dueLabel(t: Task): string {
  const offset = dueOffset(t);
  if (offset === TODAY_INDEX) return "Today";
  if (offset === TODAY_INDEX + 1) return "Tomorrow";
  if (offset === TODAY_INDEX - 1) return "Yesterday";
  const d = dateForOffset(offset);
  /* Weekday then number. toLocaleDateString with both parts orders them by
     locale and reads as "3 Mon" in en-US, which nobody writes. */
  return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.getDate()}`;
}

const PRIORITY_TONE: Record<Priority, "risk" | "warn" | undefined> = {
  high: "risk",
  medium: "warn",
  low: undefined,
};

export const Assignee = ({ name }: { name: string }) => {
  const person = PEOPLE[name];
  return (
    <Face
      initials={person?.initials ?? name.slice(0, 2).toUpperCase()}
      title={name}
      color={person?.color}
    />
  );
};

/**
 * Project card — count and bar read the live records, so completing a row
 * anywhere moves this bar. The bar takes the org's colour because the same
 * colour identifies that venture in the rail, the switcher and every dot.
 */
export const ProjectCard = ({
  project,
  color,
  tasks,
  selected,
  onSelect,
}: {
  project: Project;
  color: string;
  tasks: Task[];
  selected: boolean;
  onSelect: () => void;
}) => {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const late = tasks.filter(isOverdue).length;

  return (
    <button
      type="button"
      className="vo-proj"
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected}
      onClick={onSelect}
      style={{ borderTopColor: color }}
    >
      <div className="vo-row" style={{ gap: "var(--s-2)" }}>
        <span className="vo-dot" style={{ background: color }} />
        <span className="vo-meta">{project.lead}</span>
      </div>
      <div className="vo-proj-name">{project.name}</div>
      <div className="vo-between">
        <span className="vo-meta">
          {done} of {total} done
        </span>
        {late > 0 ? <span className="vo-late">{late} late</span> : <span className="vo-meta">{pct}%</span>}
      </div>
      <div
        className="vo-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${project.name} progress`}
      >
        <div className="vo-track-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </button>
  );
};

export const TaskRow = ({
  task,
  color,
  onToggle,
}: {
  task: Task;
  color: string;
  onToggle: () => void;
}) => {
  const late = isOverdue(task);
  return (
    <div className="vo-task" data-done={task.done ? "true" : undefined}>
      <label className="vo-task-main">
        <input type="checkbox" className="vo-box" checked={!!task.done} onChange={onToggle} />
        <span className="vo-task-title">{task.title}</span>
      </label>
      <div className="vo-task-meta">
        <Assignee name={task.assignee} />
        <span className="vo-due" data-late={late ? "true" : undefined}>
          {late ? "Overdue · " : ""}
          {dueLabel(task)}
        </span>
        <Tag tone={PRIORITY_TONE[task.priority]}>{task.priority}</Tag>
        <span className="vo-dot vo-dot-sm" style={{ background: color }} />
      </div>
    </div>
  );
};

/** Sections collapse; the header keeps the count so a closed section still
 *  tells you what is inside it. */
export const ListView = ({
  groups,
  collapsed,
  onToggleSection,
  onToggleTask,
  colorOf,
}: {
  groups: { project: Project; tasks: Task[] }[];
  collapsed: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  onToggleTask: (id: string) => void;
  colorOf: (org: string) => string;
}) => (
  <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
    {groups.map(({ project, tasks }) => {
      const color = colorOf(project.org);
      const shut = !!collapsed[project.id];
      const done = tasks.filter((t) => t.done).length;
      return (
        <section key={project.id} className="vo-section">
          <button
            type="button"
            className="vo-section-head"
            aria-expanded={!shut}
            onClick={() => onToggleSection(project.id)}
          >
            {shut ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span className="vo-dot" style={{ background: color }} />
            <span className="vo-section-name">{project.name}</span>
            <span className="vo-meta">
              {done}/{tasks.length}
            </span>
          </button>
          {!shut && (
            <div className="vo-task-list">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} color={color} onToggle={() => onToggleTask(t.id)} />
              ))}
            </div>
          )}
        </section>
      );
    })}
  </div>
);

export const BoardView = ({
  tasks,
  projectName,
  colorOf,
  orgOf,
  onToggleTask,
}: {
  tasks: Task[];
  projectName: (id: string) => string;
  colorOf: (org: string) => string;
  orgOf: (project: string) => string;
  onToggleTask: (id: string) => void;
}) => {
  const columns: Column[] = ["todo", "doing", "done"];
  return (
    <div className="vo-board">
      {columns.map((col) => {
        const rows = tasks.filter((t) => columnOf(t) === col);
        return (
          <div key={col} className="vo-board-col">
            <div className="vo-between vo-board-head">
              <span className="vo-eyebrow">{COLUMN_LABEL[col]}</span>
              <span className="vo-meta">{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <p className="vo-meta">Nothing here.</p>
            ) : (
              rows.map((t) => {
                const color = colorOf(orgOf(t.project));
                const late = isOverdue(t);
                return (
                  <article
                    key={t.id}
                    className="vo-tcard"
                    data-done={t.done ? "true" : undefined}
                    style={{ borderLeftColor: color }}
                  >
                    <label className="vo-task-main">
                      <input
                        type="checkbox"
                        className="vo-box"
                        checked={!!t.done}
                        onChange={() => onToggleTask(t.id)}
                      />
                      <span className="vo-task-title">{t.title}</span>
                    </label>
                    <div className="vo-between">
                      <span className="vo-meta">{projectName(t.project)}</span>
                      <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                        <span className="vo-due" data-late={late ? "true" : undefined}>
                          {dueLabel(t)}
                        </span>
                        <Assignee name={t.assignee} />
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        );
      })}
      <p className="vo-note vo-board-note">
        Columns are read from the dates — a task moves to In progress when its start day
        arrives and to Done when it is checked. There is no status field to fall out of
        step with the schedule.
      </p>
    </div>
  );
};
