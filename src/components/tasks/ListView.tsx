import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Task, Project } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { blocked: 0, in_progress: 1, todo: 2, done: 3 };

type SortKey = "priority" | "title" | "project" | "due_at" | "status" | "org";

interface Props {
  tasks: Task[];
  orgs: Org[];
  projects: Project[];
  onTaskClick: (t: Task) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  selectedProjectId: string | null;
}

export const ListView = ({ tasks, orgs, projects, onTaskClick, onUpdate, selectedProjectId }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [asc, setAsc] = useState(true);

  const filtered = selectedProjectId ? tasks.filter((t) => t.project_id === selectedProjectId) : tasks;

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = "", bv: string | number = "";
    switch (sortKey) {
      case "priority":
        av = PRIORITY_ORDER[a.priority ?? "normal"] ?? 99;
        bv = PRIORITY_ORDER[b.priority ?? "normal"] ?? 99;
        break;
      case "status":
        av = STATUS_ORDER[a.status ?? "todo"] ?? 99;
        bv = STATUS_ORDER[b.status ?? "todo"] ?? 99;
        break;
      case "title":
        av = a.title.toLowerCase();
        bv = b.title.toLowerCase();
        break;
      case "project":
        av = projects.find((p) => p.id === a.project_id)?.name?.toLowerCase() ?? "";
        bv = projects.find((p) => p.id === b.project_id)?.name?.toLowerCase() ?? "";
        break;
      case "due_at":
        av = a.due_at ? new Date(a.due_at).getTime() : Infinity;
        bv = b.due_at ? new Date(b.due_at).getTime() : Infinity;
        break;
      case "org":
        av = orgs.find((o) => o.id === a.org_id)?.name ?? "";
        bv = orgs.find((o) => o.id === b.org_id)?.name ?? "";
        break;
    }
    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(true);
    }
  };

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead onClick={() => toggleSort(k)} className="cursor-pointer select-none">
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </TableHead>
  );

  return (
    <div className="glass overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead k="priority">Priority</SortHead>
            <SortHead k="title">Title</SortHead>
            <SortHead k="project">Project</SortHead>
            <SortHead k="due_at">Due</SortHead>
            <SortHead k="status">Status</SortHead>
            <SortHead k="org">Org</SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t) => {
            const org = orgs.find((o) => o.id === t.org_id);
            const proj = projects.find((p) => p.id === t.project_id);
            return (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => onTaskClick(t)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={t.priority ?? "normal"} onValueChange={(v) => onUpdate(t.id, { priority: v })}>
                    <SelectTrigger className="h-8 w-[100px] bg-transparent border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell style={{ color: "var(--text-secondary)" }}>{proj?.name ?? "—"}</TableCell>
                <TableCell className="t-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  {t.due_at ? format(new Date(t.due_at), "MMM d") : "—"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select value={t.status ?? "todo"} onValueChange={(v) => onUpdate(t.id, { status: v })}>
                    <SelectTrigger className="h-8 w-[130px] bg-transparent border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">Todo</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {org && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: org.color }} />
                      {org.name}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                No tasks
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
