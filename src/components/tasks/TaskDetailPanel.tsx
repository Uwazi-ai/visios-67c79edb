import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Sparkles, Plus, Clock, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Task, Project } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";
import { TaskActivityPanel } from "./TaskActivityPanel";
import { RichTextEditor } from "./RichTextEditor";
import { VisionSuggestion } from "./VisionSuggestion";

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  orgs: Org[];
  projects: Project[];
  allTasks: Task[];
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onCreate: (input: Partial<Task> & { title: string; org_id: string }) => Promise<Task | null>;
  embedded?: boolean;
}

export const TaskDetailBody = ({
  task, orgs: _orgs, projects, allTasks, onUpdate, onDelete, onCreate, onClose,
}: {
  task: Task; orgs: Org[]; projects: Project[]; allTasks: Task[];
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onCreate: (input: Partial<Task> & { title: string; org_id: string }) => Promise<Task | null>;
  onClose?: () => void;
}) => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Task>(task);
  const [subVal, setSubVal] = useState("");
  const [aiBusy, setAiBusy] = useState<"sub" | "est" | null>(null);
  const [members, setMembers] = useState<{ user_id: string; display_name: string | null; email: string; avatar_url: string | null }[]>([]);

  useEffect(() => setDraft(task), [task]);

  useEffect(() => {
    if (!draft.org_id) { setMembers([]); return; }
    let cancelled = false;
    supabase.rpc("get_org_members" as any, { _org_id: draft.org_id }).then(({ data }) => {
      if (!cancelled) setMembers((data ?? []) as any);
    });
    return () => { cancelled = true; };
  }, [draft.org_id]);

  const subtasks = allTasks.filter((t) => t.parent_task_id === task.id);
  const orgProjects = projects.filter((p) => p.org_id === draft.org_id);

  const commit = (patch: Partial<Task>) => {
    setDraft({ ...draft, ...patch });
    onUpdate(task.id, patch);
  };

  const addSubtask = async () => {
    if (!subVal.trim() || !draft.org_id) return;
    await onCreate({
      title: subVal.trim(),
      org_id: draft.org_id,
      project_id: draft.project_id,
      parent_task_id: task.id,
    });
    setSubVal("");
  };

  const aiSuggest = async () => {
    setAiBusy("sub");
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-subtasks", {
        body: { title: draft.title, description: draft.description ?? "" },
      });
      if (error) throw error;
      const items: string[] = data?.subtasks ?? [];
      for (const s of items) {
        if (draft.org_id) {
          await onCreate({
            title: s, org_id: draft.org_id, project_id: draft.project_id, parent_task_id: task.id,
          });
        }
      }
      toast({ title: `Added ${items.length} subtasks` });
    } catch (e) {
      toast({ title: "AI failed", description: String(e), variant: "destructive" });
    } finally { setAiBusy(null); }
  };

  const aiEstimate = async () => {
    setAiBusy("est");
    try {
      const { data, error } = await supabase.functions.invoke("ai-estimate-task", {
        body: { title: draft.title, description: draft.description ?? "" },
      });
      if (error) throw error;
      const mins: number = data?.estimate_mins ?? 0;
      commit({ estimate_mins: mins });
      toast({ title: `Estimated ${mins} mins`, description: data?.reasoning });
    } catch (e) {
      toast({ title: "AI failed", description: String(e), variant: "destructive" });
    } finally { setAiBusy(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/tasks/${task.id}`)}>
          <ExternalLink size={14} className="mr-1" /> Open
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={() => {
            if (confirm("Delete this task?")) {
              onDelete(task.id);
              onClose?.();
            }
          }}
        >
          <Trash2 size={14} className="mr-1" /> Delete
        </Button>
      </div>

      <Input
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        onBlur={() => draft.title !== task.title && commit({ title: draft.title })}
        className="text-base font-bold border-0 bg-transparent px-0 mb-4"
        style={{ fontFamily: "Monument Grotesk, sans-serif" }}
      />

      <VisionSuggestion taskTitle={draft.title} taskDescription={draft.description} />

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Select value={draft.status ?? "todo"} onValueChange={(v) => commit({ status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={draft.priority ?? "normal"} onValueChange={(v) => commit({ priority: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Due date</label>
          <Input
            type="date"
            value={draft.due_at ? draft.due_at.slice(0, 10) : ""}
            onChange={(e) => commit({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Estimate (mins)</label>
          <Input
            type="number"
            value={draft.estimate_mins ?? ""}
            onChange={(e) => setDraft({ ...draft, estimate_mins: e.target.value ? Number(e.target.value) : null })}
            onBlur={() => commit({ estimate_mins: draft.estimate_mins })}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Project</label>
        <Select
          value={draft.project_id ?? "none"}
          onValueChange={(v) => commit({ project_id: v === "none" ? null : v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {orgProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4">
        <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Assignee</label>
        <Select
          value={draft.assignee_id ?? "none"}
          onValueChange={(v) => commit({ assignee_id: v === "none" ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.display_name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4">
        <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
        <RichTextEditor
          value={draft.description ?? ""}
          onChange={(html) => setDraft({ ...draft, description: html })}
        />
        {draft.description !== task.description && (
          <Button size="sm" variant="outline" className="mt-2 h-7 text-[11px]"
            onClick={() => commit({ description: draft.description })}>
            Save description
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={aiSuggest} disabled={aiBusy !== null}>
          <Sparkles size={12} className="mr-1" />
          {aiBusy === "sub" ? "Thinking…" : "Suggest subtasks"}
        </Button>
        <Button size="sm" variant="outline" onClick={aiEstimate} disabled={aiBusy !== null}>
          <Clock size={12} className="mr-1" />
          {aiBusy === "est" ? "…" : "Estimate"}
        </Button>
      </div>

      <div className="mb-4">
        <label className="text-xs mb-2 block" style={{ color: "var(--text-muted)" }}>Subtasks</label>
        <div className="space-y-1.5 mb-2">
          {subtasks.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.status === "done"}
                onChange={(e) => onUpdate(s.id, { status: e.target.checked ? "done" : "todo" })}
              />
              <span style={{ textDecoration: s.status === "done" ? "line-through" : undefined }}>
                {s.title}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            placeholder="Add subtask…"
            value={subVal}
            onChange={(e) => setSubVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubtask()}
          />
          <Button size="sm" variant="outline" onClick={addSubtask}><Plus size={14} /></Button>
        </div>
      </div>

      <TaskActivityPanel taskId={task.id} orgId={task.org_id} />
    </div>
  );
};

export const TaskDetailPanel = ({
  task, open, onClose, orgs, projects, allTasks, onUpdate, onDelete, onCreate,
}: Props) => {
  const isMobile = useIsMobile();
  if (!task) return null;

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} fullHeight>
        <TaskDetailBody
          task={task} orgs={orgs} projects={projects} allTasks={allTasks}
          onUpdate={onUpdate} onDelete={onDelete} onCreate={onCreate} onClose={onClose}
        />
      </BottomSheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" style={{ background: "var(--background)" }}>
        <TaskDetailBody
          task={task} orgs={orgs} projects={projects} allTasks={allTasks}
          onUpdate={onUpdate} onDelete={onDelete} onCreate={onCreate} onClose={onClose}
        />
      </SheetContent>
    </Sheet>
  );
};
