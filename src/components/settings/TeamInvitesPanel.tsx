import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Mail, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SectionCard from "./SectionCard";
import { toast } from "sonner";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useUpgrade } from "@/contexts/UpgradeContext";

interface Invite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
}

export default function TeamInvitesPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("org_invites" as any)
      .select("id,email,status,created_at,accepted_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);

  const seatsAccess = useFeatureAccess("seats");
  const { open: openUpgrade } = useUpgrade();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value || !user) return;
    if (seatsAccess.isAtLimit && seatsAccess.upgradeRequired) {
      openUpgrade({ feature: "seats", requiredTier: seatsAccess.requiredTier });
      return;
    }
    setBusy(true);
    const { data: inserted, error } = await supabase.from("org_invites" as any).insert({
      org_id: orgId,
      email: value,
      role: "member",
      restricted: true,
      invited_by: user.id,
    } as any).select("id").single();
    if (error) { setBusy(false); toast.error(error.message); return; }

    // Fire transactional email (best effort)
    const inviteId = (inserted as any)?.id ?? crypto.randomUUID();
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const signupUrl = `${window.location.origin}/login?invited=${encodeURIComponent(value)}`;
    const { error: emailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "org-invite",
        recipientEmail: value,
        idempotencyKey: `org-invite-${inviteId}`,
        templateData: {
          orgName,
          inviterName: (profile as any)?.display_name ?? user.email,
          signupUrl,
        },
      },
    });
    setBusy(false);
    if (emailErr) {
      toast.warning(`Invite saved, but email failed: ${emailErr.message}`);
    } else {
      toast.success(`Invited ${value} — email sent`);
    }
    setEmail("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("org_invites" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <SectionCard
      title="Team members"
      subtitle="Invite employees by email. They'll auto-join this org with limited access on first sign-in (no admin, no finance, no notifications, no capital raise)."
    >
      <form onSubmit={add} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="employee@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-glass flex-1"
          style={{ height: 38, padding: "0 12px", fontSize: 13 }}
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Invite
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-4"><Loader2 size={14} className="animate-spin" /></div>
        ) : invites.length === 0 ? (
          <div className="t-mono py-3 text-center" style={{ fontSize: 11 }}>No invites yet</div>
        ) : (
          invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-[10px] px-3 py-2"
              style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
              <Mail size={14} style={{ color: "var(--text-muted)" }} />
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>{inv.email}</div>
                <div className="t-mono" style={{ fontSize: 9 }}>
                  {inv.status === "accepted" ? (
                    <span style={{ color: "#22C55E" }}><Check size={10} className="inline" /> Joined</span>
                  ) : (
                    <span style={{ color: "#F59E0B" }}>Pending sign-in</span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(inv.id)} className="btn-icon" title="Revoke invite" style={{ width: 28, height: 28 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
