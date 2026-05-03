import { useState, useMemo } from "react";
import { motion, type PanInfo } from "framer-motion";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import type { Task, Project, TaskSection } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  tasks: Task[];
  sections: TaskSection[];
  projects: Project[];
  orgs: Org[];
  activeProjectId: string | null;
  onTaskClick: (t: Task) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onCreate: (input: { title: string; section_id: string | null; project_id: string | null; org_id: string; parent_task_id?: string | null }) => Promise<Task | null>;
  onDelete: (id: string) => void;
  onCreateSection: (input: { project_id: string; org_id: string; name: string }) => Promise<TaskSection | null>;
  onUpdateSection: (id: string, patch: Partial<TaskSection>) => void;
  onDeleteSection: (id: string) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#EF4444", high: "#EF4444", medium: "#F59E0B", normal: "#3B82F6", low: "#6B7280", none: "#6B7280",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "Todo", in_progress: "In Progress", review: "Review", done: "Done", blocked: "Blocked",
};

function dueColor(due: string | null, status: string | null) {
  if (!due) return "var(--text-muted)";
  const d = new Date(due);
  if (status === "done") return "var(--text-muted)";
  if (isToday(d)) return "#F59E0B";
  if (isPast(d)) return "#EF4444";
  return "var(--text-secondary)";
}

const TaskRow = ({
  task, depth, org, onClick, onUpdate, onAddSubtask, onDelete,
}: {
  task: Task; depth: number; org?: Org;
  onClick: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onAddSubtask: () => void;
  onDelete: () => void;
}) => {
  const isMobile = useIsMobile();
  const done = task.status === "done";
  const pri = task.priority ?? "normal";

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -120) {
      if (confirm("Delete this task?")) onDelete();
    } else if (info.offset.x > 120) {
      onUpdate({ status: done ? "todo" : "done" });
    }
  };

  const Row = (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.04] cursor-pointer border-b"
      style={{ borderColor: "var(--border-glass)", paddingLeft: 8 + depth * 24, background: "var(--background)" }}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={done}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onUpdate({ status: e.target.checked ? "done" : "todo" })}
        className="cursor-pointer"
        style={{ accentColor: "#3B82F6" }}
      />
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: PRIORITY_COLOR[pri] ?? "#3B82F6",
          opacity: done ? 0.4 : 1,
          flexShrink: 0,
        }}
      />
      <span
        className="flex-1 text-[13px] truncate"
        style={{
          color: done ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: done ? "line-through" : undefined,
          fontFamily: "Satoshi, sans-serif",
        }}
      >
        {task.title}
      </span>

      {/* Due date */}
      {task.due_at && (
        <span className="t-mono text-[10px] hidden md:inline" style={{ color: dueColor(task.due_at, task.status ?? null) }}>
          {format(new Date(task.due_at), "MMM d")}
        </span>
      )}

      {/* Priority dropdown */}
      <div onClick={(e) => e.stopPropagation()} className="hidden md:block">
        <Select value={pri} onValueChange={(v) => onUpdate({ priority: v })}>
          <SelectTrigger className="h-6 w-[80px] text-[10px] border-white/10 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div onClick={(e) => e.stopPropagation()} className="hidden lg:block">
        <Select value={task.status ?? "todo"} onValueChange={(v) => onUpdate({ status: v })}>
          <SelectTrigger className="h-6 w-[110px] text-[10px] border-white/10 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Org dot */}
      {org && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: org.color, flexShrink: 0 }} />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={12} style={{ color: "var(--text-muted)" }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAddSubtask}><Plus size={12} className="mr-2" /> Add subtask</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 size={12} className="mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (!isMobile) return Row;

  return (
    <div className="relative overflow-hidden" style={{ background: "linear-gradient(90deg, rgba(34,197,94,0.25), transparent 50%, rgba(239,68,68,0.25))" }}>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="touch-pan-y"
      >
        {Row}
      </motion.div>
    </div>
  );
};

export const SectionedListView = ({
  tasks, sections, projects, orgs, activeProjectId,
  onTaskClick, onUpdate, onCreate, onDelete,
  onCreateSection, onUpdateSection, onDeleteSection,
}: Props) => {
  const [adding, setAdding] = useState<string | "no-section" | null>(null); // section id
  const [val, setVal] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionVal, setSectionVal] = useState("");

  const project = projects.find((p) => p.id === activeProjectId);
  const orgId = project?.org_id ?? orgs[0]?.id ?? "";

  // Build top-level + subtask map
  const topLevel = useMemo(() => tasks.filter((t) => !t.parent_task_id), [tasks]);
  const subtaskMap = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_task_id) {
        if (!m.has(t.parent_task_id)) m.set(t.parent_task_id, []);
        m.get(t.parent_task_id)!.push(t);
      }
    }
    return m;
  }, [tasks]);

  const sectionsForProject = activeProjectId
    ? sections.filter((s) => s.project_id === activeProjectId)
    : [];

  // Group: if active project, group by section. Otherwise, group by project
  const groups: { id: string; label: string; tint?: string; tasks: Task[]; section?: TaskSection }[] = [];

  if (activeProjectId) {
    for (const s of sectionsForProject) {
      groups.push({
        id: s.id,
        label: s.name,
        tasks: topLevel.filter((t) => t.section_id === s.id && t.project_id === activeProjectId),
        section: s,
      });
    }
    const noSection = topLevel.filter((t) => t.project_id === activeProjectId && !t.section_id);
    if (noSection.length > 0 || sectionsForProject.length === 0) {
      groups.push({ id: "no-section", label: "No section", tasks: noSection });
    }
  } else {
    // group by project
    for (const p of projects) {
      const t = topLevel.filter((x) => x.project_id === p.id);
      if (t.length > 0) {
        const org = orgs.find((o) => o.id === p.org_id);
        groups.push({ id: p.id, label: `${p.emoji ?? "📋"} ${p.name}`, tint: org?.color, tasks: t });
      }
    }
    const orphan = topLevel.filter((t) => !t.project_id);
    if (orphan.length > 0) groups.push({ id: "orphan", label: "Inbox", tasks: orphan });
  }

  const renderTask = (t: Task, depth = 0) => (
    <div key={t.id}>
      <TaskRow
        task={t}
        depth={depth}
        org={orgs.find((o) => o.id === t.org_id)}
        onClick={() => onTaskClick(t)}
        onUpdate={(patch) => onUpdate(t.id, patch)}
        onAddSubtask={async () => {
          if (!t.org_id) return;
          const created = await onCreate({
            title: "New subtask",
            section_id: t.section_id,
            project_id: t.project_id,
            org_id: t.org_id,
            parent_task_id: t.id,
          });
          if (created) onTaskClick(created);
        }}
        onDelete={() => { if (confirm("Delete this task?")) onDelete(t.id); }}
      />
      {(subtaskMap.get(t.id) ?? []).map((sub) => renderTask(sub, depth + 1))}
    </div>
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const isCollapsed = collapsed[g.id];
        return (
          <div key={g.id} className="glass overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer border-b"
              style={{ borderColor: "var(--border-glass)", background: g.tint ? `${g.tint}15` : "transparent" }}
              onClick={() => setCollapsed({ ...collapsed, [g.id]: !isCollapsed })}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span
                className="text-[11px] uppercase tracking-wider flex-1"
                style={{ color: g.tint ?? "var(--text-secondary)", fontFamily: "Monument Grotesk, sans-serif", fontWeight: 700 }}
              >
                {g.label}
              </span>
              <span className="t-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                {g.tasks.filter((t) => t.status !== "done").length} / {g.tasks.length}
              </span>
              {g.section && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal size={12} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      const name = prompt("Rename section", g.section!.name);
                      if (name && name.trim()) onUpdateSection(g.section!.id, { name: name.trim() });
                    }}>Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { if (confirm("Delete section? Tasks stay.")) onDeleteSection(g.section!.id); }} className="text-destructive">
                      Delete section
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {!isCollapsed && (
              <div>
                {g.tasks.map((t) => renderTask(t))}

                {/* Add task row */}
                {adding === g.id ? (
                  <div className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border-glass)" }}>
                    <input
                      autoFocus
                      className="input-glass text-[13px] w-full"
                      placeholder="Task title — press Enter"
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      onBlur={async () => {
                        if (val.trim()) {
                          const sectionId = g.section?.id ?? null;
                          const projectId = activeProjectId ?? (g.id !== "orphan" ? g.id : null);
                          const orgIdForRow = activeProjectId ? orgId : (projects.find((p) => p.id === projectId)?.org_id ?? orgs[0]?.id ?? "");
                          if (orgIdForRow) {
                            await onCreate({ title: val.trim(), section_id: sectionId, project_id: projectId, org_id: orgIdForRow });
                          }
                        }
                        setVal(""); setAdding(null);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Escape") { setVal(""); setAdding(null); }
                        else if (e.key === "Enter" && val.trim()) {
                          const sectionId = g.section?.id ?? null;
                          const projectId = activeProjectId ?? (g.id !== "orphan" ? g.id : null);
                          const orgIdForRow = activeProjectId ? orgId : (projects.find((p) => p.id === projectId)?.org_id ?? orgs[0]?.id ?? "");
                          if (orgIdForRow) {
                            await onCreate({ title: val.trim(), section_id: sectionId, project_id: projectId, org_id: orgIdForRow });
                          }
                          setVal("");
                        }
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAdding(g.id)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] w-full hover:bg-white/[0.04]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Plus size={12} /> Add task
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Section button (project view only) */}
      {activeProjectId && (
        addingSection ? (
          <input
            autoFocus
            className="input-glass text-[13px] w-full max-w-sm"
            placeholder="Section name…"
            value={sectionVal}
            onChange={(e) => setSectionVal(e.target.value)}
            onBlur={async () => {
              if (sectionVal.trim() && orgId && activeProjectId) {
                await onCreateSection({ project_id: activeProjectId, org_id: orgId, name: sectionVal.trim() });
              }
              setSectionVal(""); setAddingSection(false);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Escape") { setSectionVal(""); setAddingSection(false); }
              else if (e.key === "Enter" && sectionVal.trim() && orgId && activeProjectId) {
                await onCreateSection({ project_id: activeProjectId, org_id: orgId, name: sectionVal.trim() });
                setSectionVal(""); setAddingSection(false);
              }
            }}
          />
        ) : (
          <button onClick={() => setAddingSection(true)} className="btn-ghost" style={{ height: 32 }}>
            <Plus size={12} /> Add Section
          </button>
        )
      )}

      {groups.length === 0 && (
        <div className="glass p-12 text-center" style={{ color: "var(--text-muted)" }}>
          No tasks yet — add one above.
        </div>
      )}
    </div>
  );
};
