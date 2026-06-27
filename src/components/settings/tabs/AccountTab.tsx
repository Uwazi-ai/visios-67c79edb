import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SectionCard, { Field } from "../SectionCard";
import { toast } from "sonner";

export default function AccountTab({ dangerOnly }: { dangerOnly?: boolean }) {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({ convos: 0, msgs: 0, kb: 0 });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: cc }, { count: mc }, { count: kb }, { data: privateRows }] = await Promise.all([
        supabase.from("vision_conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("vision_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("kb_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.rpc("get_my_profile_private"),
      ]);
      const p = (Array.isArray(privateRows) ? privateRows[0] : null) as any;
      setStats({ convos: cc ?? 0, msgs: mc ?? 0, kb: kb ?? 0 });
      setHasGoogle(!!p?.google_refresh_token);
    })();
  }, [user]);

  const updatePassword = async () => {
    if (pwd.next !== pwd.confirm) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setPwd({ current: "", next: "", confirm: "" }); }
  };

  const resetSettings = async () => {
    if (!user) return;
    const txt = prompt('Type "RESET" to revert all preferences to defaults.');
    if (txt !== "RESET") return;
    await supabase.from("profiles").update({ preferences: {} } as never).eq("id", user.id);
    toast.success("Settings reset");
  };

  const clearContacts = async () => {
    const txt = prompt('Type "DELETE CONTACTS" to permanently delete all contacts.');
    if (txt !== "DELETE CONTACTS") return;
    const { error } = await supabase.from("contacts").delete().not("id", "is", null);
    if (error) toast.error(error.message);
    else toast.success("Contacts cleared");
  };

  const deleteAccount = async () => {
    const txt = prompt('Type "DELETE MY ACCOUNT" to permanently delete your account and all data.');
    if (txt !== "DELETE MY ACCOUNT" || !user) return;
    await supabase.from("profiles").delete().eq("id", user.id);
    await signOut();
    toast.success("Account deleted");
  };

  const danger = (
    <SectionCard title="Danger Zone" subtitle="These actions cannot be undone." accent="danger">
      <div className="flex items-center justify-between gap-4 py-2">
        <div><div style={{ fontSize: 13 }}>Reset all settings</div><div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>Reverts preferences to defaults.</div></div>
        <button onClick={resetSettings} className="btn-ghost" style={{ color: "#FCA5A5" }}>Reset Settings</button>
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <div><div style={{ fontSize: 13 }}>Clear all contacts</div><div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>Deletes every contact in your orgs.</div></div>
        <button onClick={clearContacts} className="btn-ghost" style={{ color: "#FCA5A5" }}>Clear Contacts</button>
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <div><div style={{ fontSize: 13 }}>Delete account</div><div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>Permanently removes your account and all data.</div></div>
        <button onClick={deleteAccount} className="btn-primary" style={{ background: "#EF4444" }}><AlertTriangle size={12} /> Delete Account</button>
      </div>
    </SectionCard>
  );

  if (dangerOnly) return danger;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Plan" subtitle="Your Visi OS subscription.">
        <div className="grid grid-cols-3 gap-3 t-mono" style={{ fontSize: 11 }}>
          <div><div style={{ color: "var(--text-muted)" }}>Plan</div><div style={{ color: "var(--text-primary)", fontSize: 14, marginTop: 2 }}>Founder</div></div>
          <div><div style={{ color: "var(--text-muted)" }}>Status</div><div style={{ color: "#86efac", fontSize: 14, marginTop: 2 }}>Active</div></div>
          <div><div style={{ color: "var(--text-muted)" }}>Member since</div><div style={{ color: "var(--text-primary)", fontSize: 14, marginTop: 2 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</div></div>
        </div>
      </SectionCard>

      <SectionCard title="Usage (this month)">
        <div className="grid grid-cols-3 gap-3 t-mono" style={{ fontSize: 11 }}>
          <div><div style={{ color: "var(--text-muted)" }}>Vision conversations</div><div style={{ fontSize: 18, color: "var(--text-primary)" }}>{stats.convos}</div></div>
          <div><div style={{ color: "var(--text-muted)" }}>Vision messages</div><div style={{ fontSize: 18, color: "var(--text-primary)" }}>{stats.msgs}</div></div>
          <div><div style={{ color: "var(--text-muted)" }}>KB documents</div><div style={{ fontSize: 18, color: "var(--text-primary)" }}>{stats.kb}</div></div>
        </div>
      </SectionCard>

      <SectionCard title="Connected Google Account">
        <div className="flex items-center justify-between">
          <div className="t-mono" style={{ fontSize: 11 }}>{hasGoogle ? user?.email : "Not connected"}</div>
          {hasGoogle && (
            <button onClick={async () => { if (!user) return; await supabase.from("profiles").update({ google_refresh_token: null, google_access_token: null }).eq("id", user.id); toast.success("Disconnected"); }} className="btn-ghost" style={{ color: "#FCA5A5" }}>Disconnect</button>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Change Password">
        <Field label="New password"><input type="password" className="input-glass" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} /></Field>
        <Field label="Confirm new password"><input type="password" className="input-glass" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} /></Field>
        <div className="flex justify-end pt-2">
          <button onClick={updatePassword} disabled={busy || !pwd.next} className="btn-primary">
            {busy ? <Loader2 size={12} className="animate-spin" /> : null} Update Password
          </button>
        </div>
      </SectionCard>

      {danger}
    </div>
  );
}
