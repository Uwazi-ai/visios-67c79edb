import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export default function WorkspaceTab() {
  const { orgs, activeOrgId, memberships, refreshOrgs } = useOrg();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [saving, setSaving] = useState(false);

  const active = orgs.find((o) => o.id === activeOrgId) as
    | (typeof orgs[number] & { description?: string | null; timezone?: string })
    | undefined;
  const myRole = active ? memberships.find((m) => m.org_id === active.id)?.role : null;
  const canEdit = myRole === "owner" || myRole === "admin";

  useEffect(() => {
    if (!active) return;
    setName(active.name);
    setDescription(active.description ?? "");
    setTimezone(active.timezone ?? "America/Chicago");
  }, [active]);

  const save = async () => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("orgs")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        timezone,
      })
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workspace updated" });
      void refreshOrgs();
    }
  };

  if (!active) return <div className="t-mono">No active workspace.</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="t-section">Workspace</h2>
        <p className="t-mono" style={{ color: "var(--text-muted)" }}>
          Organization profile and regional settings
        </p>
      </div>

      <div className="glass p-6 rounded-2xl space-y-4" style={{ border: "1px solid #1a1a2e" }}>
        <div className="space-y-2">
          <Label htmlFor="ws-name">Organization name</Label>
          <Input
            id="ws-name"
            className="input-glass"
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-desc">Description</Label>
          <Textarea
            id="ws-desc"
            value={description}
            disabled={!canEdit}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your team do?"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Affects Vision daily brief delivery time and dashboard "today" boundaries.
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={save}
            disabled={!canEdit || saving || !name.trim()}
            style={{ background: "#2563EB", color: "white" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
