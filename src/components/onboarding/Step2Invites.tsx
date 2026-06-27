import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

interface Props {
  orgId: string;
  onNext: () => void;
  onSkip: () => void;
}

export const Step2Invites = ({ orgId, onNext, onSkip }: Props) => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  const update = (i: number, v: string) => {
    const next = [...emails];
    next[i] = v;
    setEmails(next);
  };
  const remove = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));
  const add = () => emails.length < 8 && setEmails([...emails, ""]);

  const send = async () => {
    if (!user) return;
    const valid = emails.map((e) => e.trim()).filter((e) => /\S+@\S+\.\S+/.test(e));
    if (valid.length === 0) {
      onNext();
      return;
    }
    setBusy(true);
    try {
      const rows = valid.map((email) => ({
        org_id: orgId,
        email: email.toLowerCase(),
        role: "member" as const,
        invited_by: user.id,
        restricted: false,
      }));
      const { error } = await supabase.from("org_invites").insert(rows);
      if (error) throw error;
      toast({ title: `Invited ${valid.length} teammate${valid.length === 1 ? "" : "s"}` });
      onNext();
    } catch (e: any) {
      toast({
        title: "Couldn't send invites",
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
        <h1 className="t-section mb-1">Who's working with you?</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Add teammates by email. They'll get an invite to join your workspace.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Email addresses</Label>
        {emails.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="input-glass flex-1"
              value={e}
              type="email"
              placeholder="teammate@company.com"
              onChange={(ev) => update(i, ev.target.value)}
            />
            {emails.length > 1 && (
              <button
                onClick={() => remove(i)}
                className="btn-icon"
                style={{ width: 32, height: 32 }}
                title="Remove"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}
        {emails.length < 8 && (
          <button
            onClick={add}
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: "#2563EB" }}
          >
            <Plus size={14} /> Add another
          </button>
        )}
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
        <Button
          onClick={send}
          disabled={busy}
          style={{ background: "#2563EB", color: "white" }}
        >
          {busy ? "Sending…" : "Send invites"}
        </Button>
      </div>
    </div>
  );
};
