import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Props {
  onComplete: (orgId: string) => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || `org-${Math.random().toString(36).slice(2, 8)}`;

export const Step1Workspace = ({ onComplete }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const baseSlug = slugify(name);
      let slug = baseSlug;
      // Ensure unique slug
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase
          .from("orgs")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!data) break;
        slug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;
      }
      const { data: org, error } = await supabase
        .from("orgs")
        .insert({
          name: name.trim(),
          slug,
          color: "#2563EB",
          description: description.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Default channels (trigger creates the owner membership automatically)
      const defaults = ["general", "announcements", "vision-briefs"];
      await supabase.from("channels").insert(
        defaults.map((n) => ({
          org_id: org.id,
          name: n,
          type: "channel",
          is_system: n === "vision-briefs",
        })),
      );

      onComplete(org.id);
    } catch (e: any) {
      toast({
        title: "Couldn't create workspace",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-section mb-1">Name your workspace</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          This is what your team will see when they join.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          className="input-glass"
          value={name}
          placeholder="Acme Inc."
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-desc">What do you do? (optional)</Label>
        <Input
          id="org-desc"
          className="input-glass"
          value={description}
          placeholder="A short one-liner"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button
          onClick={submit}
          disabled={!name.trim() || busy}
          style={{ background: "#2563EB", color: "white" }}
        >
          {busy ? "Creating…" : "Continue"}
        </Button>
      </div>
    </div>
  );
};
