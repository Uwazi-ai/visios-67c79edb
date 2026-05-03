import { useState } from "react";
import { AlertTriangle, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";

interface Props {
  orgId: string;
  orgName: string;
  onArchived: () => void;
}

export function ArchiveOrgPanel({ orgId, orgName, onArchived }: Props) {
  const { refreshOrgs } = useOrg();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const archive = async () => {
    if (confirm !== orgName) { toast.error("Type the org name exactly to confirm"); return; }
    setBusy(true);
    const { error } = await supabase.from("orgs").update({ is_active: false } as never).eq("id", orgId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${orgName} archived`);
    setConfirm("");
    await refreshOrgs();
    onArchived();
  };

  return (
    <div className="glass p-5" style={{ borderLeft: "3px solid #EF4444" }}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} style={{ color: "#EF4444" }} />
        <div className="t-card-title" style={{ fontSize: 13, color: "var(--text-primary)" }}>Archive Organization</div>
      </div>
      <div className="t-mono mb-3" style={{ fontSize: 10 }}>
        Archiving hides this org from the switcher. Your data is preserved and can be restored at any time.
      </div>
      <div className="flex gap-2">
        <input
          className="input-glass"
          placeholder={`Type "${orgName}" to confirm`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          onClick={archive}
          disabled={busy || confirm !== orgName}
          className="btn-ghost"
          style={{ borderColor: "#EF4444", color: "#FCA5A5", whiteSpace: "nowrap" }}
        >
          <Archive size={12} /> Archive
        </button>
      </div>
    </div>
  );
}
