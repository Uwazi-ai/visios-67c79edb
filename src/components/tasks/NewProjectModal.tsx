import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Org } from "@/lib/orgs";

const EMOJIS = ["📋", "🚀", "🎯", "🤝", "💡", "🎨", "📣", "🎤", "📊", "🛠", "🌱", "🔥", "📅", "⭐"];
const TEMPLATES = [
  { value: "blank", label: "Blank" },
  { value: "sprint", label: "Sprint" },
  { value: "launch", label: "Launch Checklist" },
  { value: "client", label: "Client Project" },
  { value: "personal", label: "Personal" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  orgs: Org[];
  onCreate: (input: { name: string; org_id: string; emoji?: string; description?: string; template?: string }) => Promise<void> | void;
}

export const NewProjectModal = ({ open, onClose, orgs, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [emoji, setEmoji] = useState("📋");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("blank");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !orgId) return;
    setBusy(true);
    await onCreate({ name: name.trim(), org_id: orgId, emoji, description: description.trim() || undefined, template });
    setBusy(false);
    setName(""); setDescription(""); setEmoji("📋"); setTemplate("blank");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Emoji</label>
              <Select value={emoji} onValueChange={setEmoji}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMOJIS.map((e) => <SelectItem key={e} value={e}><span className="text-lg">{e}</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2 Pilot Launch" autoFocus />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Org *</label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue placeholder="Pick an org" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <span className="inline-flex items-center gap-2">
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.color, display: "inline-block" }} />
                      {o.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Template</label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={!name.trim() || !orgId || busy}>
              {busy ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
