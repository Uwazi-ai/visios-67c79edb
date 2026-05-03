import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Org } from "@/lib/orgs";
import type { Project, Task } from "@/hooks/useTasks";

interface Props {
  open: boolean;
  onClose: () => void;
  orgs: Org[];
  projects: Project[];
  defaultOrgId: string | null;
  defaultProjectId: string | null;
  onCreate: (input: Partial<Task> & { title: string; org_id: string }) => Promise<Task | null>;
}

interface Extracted { title: string; priority?: string; due_at?: string | null }

export const GenerateTasksModal = ({ open, onClose, orgs, projects, defaultOrgId, defaultProjectId, onCreate }: Props) => {
  const [notes, setNotes] = useState("");
  const [orgId, setOrgId] = useState(defaultOrgId ?? orgs[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string | "none">(defaultProjectId ?? "none");
  const [busy, setBusy] = useState(false);
  const [extracted, setExtracted] = useState<Extracted[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => { if (open) { setOrgId(defaultOrgId ?? orgs[0]?.id ?? ""); setProjectId(defaultProjectId ?? "none"); } }, [open, defaultOrgId, defaultProjectId, orgs]);

  const orgProjects = projects.filter((p) => p.org_id === orgId);

  const extract = async () => {
    if (!notes.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-extract-tasks", { body: { notes } });
      if (error) throw error;
      const items: Extracted[] = data?.tasks ?? [];
      setExtracted(items);
      setSelected(new Set(items.map((_, i) => i)));
      if (items.length === 0) toast({ title: "No tasks found in notes" });
    } catch (e) {
      toast({ title: "AI failed", description: String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const addAll = async () => {
    if (!orgId) return;
    setBusy(true);
    let count = 0;
    for (let i = 0; i < extracted.length; i++) {
      if (!selected.has(i)) continue;
      const e = extracted[i];
      const r = await onCreate({
        title: e.title,
        org_id: orgId,
        project_id: projectId === "none" ? null : projectId,
        priority: e.priority ?? "normal",
        due_at: e.due_at ?? null,
      });
      if (r) count++;
    }
    setBusy(false);
    toast({ title: `Added ${count} tasks` });
    setNotes(""); setExtracted([]); setSelected(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Generate Tasks from Notes</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Org</label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Project</label>
              <Select value={projectId} onValueChange={(v) => setProjectId(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {orgProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.emoji ?? "📋"} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Meeting notes / brain dump</label>
            <Textarea
              rows={6}
              placeholder="Paste meeting notes or jot down what needs doing…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {extracted.length === 0 ? (
            <Button onClick={extract} disabled={!notes.trim() || busy} className="w-full">
              <Sparkles size={14} className="mr-2" />
              {busy ? "Extracting…" : "Extract Tasks"}
            </Button>
          ) : (
            <>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {extracted.map((e, i) => (
                  <label key={i} className="flex items-start gap-2 p-2 hover:bg-white/[0.04] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={(ev) => {
                        const next = new Set(selected);
                        if (ev.target.checked) next.add(i); else next.delete(i);
                        setSelected(next);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 text-sm">
                      {e.title}
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {e.priority && <span>priority: {e.priority}</span>}
                        {e.due_at && <span> · due: {new Date(e.due_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setExtracted([]); setSelected(new Set()); }}>Re-extract</Button>
                <Button onClick={addAll} disabled={selected.size === 0 || busy}>
                  Add {selected.size} task{selected.size === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
