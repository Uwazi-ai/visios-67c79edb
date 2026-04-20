import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";

export const QuickCaptureModal = () => {
  const { orgs, activeOrgId } = useOrg();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [due, setDue] = useState<"today" | "tomorrow" | "none">("none");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
      if (typing) return;
      if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setOrgId(activeOrgId && activeOrgId !== "all" ? activeOrgId : orgs[0]?.id ?? "");
    }
  }, [open, activeOrgId, orgs]);

  const submit = async () => {
    if (!title.trim() || !orgId) return;
    let due_at: string | null = null;
    if (due === "today") due_at = new Date().toISOString();
    if (due === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      due_at = d.toISOString();
    }
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      org_id: orgId,
      priority,
      due_at,
      status: "todo",
      assignee_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Task added" });
    setTitle("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <Input
          autoFocus
          placeholder="Task title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="text-base"
        />
        <div className="grid grid-cols-3 gap-2">
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger><SelectValue placeholder="Org" /></SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={due} onValueChange={(v: typeof due) => setDue(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No date</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Esc</Button>
          <Button onClick={submit}>Add Task ↵</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
