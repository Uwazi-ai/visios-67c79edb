import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Mail, Check, Crown, ShieldCheck, User as UserIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import SectionCard from "../SectionCard";
import { ORG_COLORS } from "@/lib/orgs";
import { toast } from "sonner";

type Role = "owner" | "admin" | "member";

interface Member {
  user_id: string;
  role: Role;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  is_restricted: boolean;
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  status: string;
  restricted: boolean;
  org_id: string;
  created_at: string;
}

const ROLE_META: Record<Role, { label: string; color: string; icon: any }> = {
  owner: { label: "Owner", color: "#A78BFA", icon: Crown },
  admin: { label: "Admin", color: "#2563EB", icon: ShieldCheck },
  member: { label: "Member", color: "#9CA3AF", icon: UserIcon },
};

function RoleBadge({ role, restricted }: { role: Role; restricted?: boolean }) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  const label = restricted && role === "member" ? "Read-only" : meta.label;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{
        background: `${meta.color}1A`,
        color: meta.color,
        fontSize: 10,
        fontFamily: "JetBrains Mono, monospace",
        border: `1px solid ${meta.color}33`,
      }}
    >
      <Icon size={9} />
      {label}
    </span>
  );
}

export default function TeamTab() {
  const { user } = useAuth();
  const { orgs, memberships, isOwner } = useOrg();
  const ownedOrgs = useMemo(
    () => orgs.filter((o) => memberships.some((m) => m.org_id === o.id && m.role === "owner")),
    [orgs, memberships]
  );

  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!activeOrgId && ownedOrgs.length > 0) setActiveOrgId(ownedOrgs[0].id);
  }, [ownedOrgs, activeOrgId]);

  const load = async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const [{ data: mems, error: memErr }, { data: invs }] = await Promise.all([
      supabase.rpc("get_org_members" as any, { _org_id: activeOrgId }),
      supabase.from("org_invites" as any).select("id,email,role,status,restricted,org_id,created_at")
        .eq("org_id", activeOrgId).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    if (memErr) toast.error(memErr.message);
    setMembers((mems ?? []) as any);
    setInvites((invs ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeOrgId]);

  const updateRole = async (userId: string, role: Role) => {
    const { error } = await supabase.from("org_memberships")
      .update({ role: role as any })
      .eq("org_id", activeOrgId!)
      .eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    load();
  };

  const removeMember = async (m: Member) => {
    if (!confirm(`Remove ${m.display_name ?? m.email} from this org? They will lose access immediately.`)) return;
    const { error } = await supabase.from("org_memberships").delete()
      .eq("org_id", activeOrgId!).eq("user_id", m.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    load();
  };

  const cancelInvite = async (id: string) => {
    const { error } = await supabase.from("org_invites" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const resendInvite = async (inv: Invite) => {
    const org = orgs.find((o) => o.id === inv.org_id);
    if (!org || !user) return;
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const signupUrl = `${window.location.origin}/login?invited=${encodeURIComponent(inv.email)}`;
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "org-invite",
        recipientEmail: inv.email,
        idempotencyKey: `org-invite-${inv.id}-${Date.now()}`,
        templateData: {
          orgName: org.name,
          inviterName: (profile as any)?.display_name ?? user.email,
          signupUrl,
        },
      },
    });
    if (error) toast.error(error.message); else toast.success("Invite re-sent");
  };

  if (!isOwner) {
    return (
      <SectionCard title="Team" subtitle="Only org owners can manage team members.">
        <div className="t-mono py-6 text-center" style={{ fontSize: 11 }}>
          You are not an owner of any organization.
        </div>
      </SectionCard>
    );
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const orgColor = activeOrg ? (ORG_COLORS[activeOrg.slug] ?? activeOrg.color ?? "#6366F1") : "#6366F1";

  return (
    <div className="flex flex-col gap-4">
      {/* Org tabs */}
      {ownedOrgs.length > 1 && (
        <div className="glass p-2 flex flex-wrap gap-1.5">
          {ownedOrgs.map((o) => {
            const c = ORG_COLORS[o.slug] ?? o.color ?? "#6366F1";
            const active = o.id === activeOrgId;
            return (
              <button
                key={o.id}
                onClick={() => setActiveOrgId(o.id)}
                className="org-pill"
                style={{
                  background: active ? `${c}26` : "transparent",
                  border: `1px solid ${active ? c : "var(--border-glass)"}`,
                  color: active ? c : "var(--text-secondary)",
                  fontSize: 11,
                }}
              >
                <span className="inline-block rounded-full mr-1.5" style={{ width: 8, height: 8, background: c }} />
                {o.name}
              </button>
            );
          })}
        </div>
      )}

      <SectionCard
        title={activeOrg ? `Team — ${activeOrg.name}` : "Team"}
        subtitle="Members of this organization. Owners can change roles or remove members."
      >
        <div className="flex justify-end -mt-2">
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            <Plus size={12} /> Invite Member
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={14} className="animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {members.length === 0 && invites.length === 0 && (
              <div className="t-mono py-6 text-center" style={{ fontSize: 11 }}>No members yet</div>
            )}

            {members.map((m) => {
              const isMe = m.user_id === user?.id;
              return (
                <div key={m.user_id}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-2"
                  style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
                  <div
                    className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                    style={{ width: 32, height: 32, background: `${orgColor}26`, color: orgColor, fontSize: 12, fontWeight: 600 }}
                  >
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (m.display_name ?? m.email).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {m.display_name ?? m.email}
                      </span>
                      {isMe && (
                        <span className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>you</span>
                      )}
                    </div>
                    <div className="t-mono truncate" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {m.email}
                    </div>
                  </div>
                  <RoleBadge role={m.role} restricted={m.is_restricted} />
                  {!isMe && (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => updateRole(m.user_id, e.target.value as Role)}
                        className="input-glass"
                        style={{ height: 28, padding: "0 8px", fontSize: 11 }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button onClick={() => removeMember(m)} className="btn-icon" title="Remove" style={{ width: 28, height: 28 }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {invites.map((inv) => (
              <div key={inv.id}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2"
                style={{ background: "var(--bg-glass-1)", border: "1px dashed var(--border-glass)" }}>
                <div className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{ width: 32, height: 32, background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                  <Mail size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>{inv.email}</div>
                  <div className="t-mono" style={{ fontSize: 10, color: "#F59E0B" }}>Pending sign-in</div>
                </div>
                <RoleBadge role={inv.role} restricted={inv.restricted} />
                <button onClick={() => resendInvite(inv)} className="btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 11 }}>
                  Resend
                </button>
                <button onClick={() => cancelInvite(inv.id)} className="btn-icon" title="Cancel invite" style={{ width: 28, height: 28 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {showInvite && activeOrgId && (
        <InviteModal
          orgs={ownedOrgs}
          defaultOrgIds={[activeOrgId]}
          onClose={() => setShowInvite(false)}
          onDone={() => { setShowInvite(false); load(); }}
        />
      )}
    </div>
  );
}

function InviteModal({
  orgs, defaultOrgIds, onClose, onDone,
}: {
  orgs: { id: string; name: string; slug: string; color: string }[];
  defaultOrgIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [orgIds, setOrgIds] = useState<string[]>(defaultOrgIds);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [restricted, setRestricted] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggleOrg = (id: string) =>
    setOrgIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value || !user || orgIds.length === 0) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const orgId of orgIds) {
      const { data, error } = await supabase.from("org_invites" as any).insert({
        org_id: orgId, email: value, role, restricted: role === "member" ? restricted : false,
        invited_by: user.id,
      } as any).select("id").single();
      if (error) { fail++; continue; }
      const org = orgs.find((o) => o.id === orgId);
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "org-invite",
          recipientEmail: value,
          idempotencyKey: `org-invite-${(data as any).id}`,
          templateData: {
            orgName: org?.name ?? "your team",
            inviterName: (profile as any)?.display_name ?? user.email,
            signupUrl: `${window.location.origin}/login?invited=${encodeURIComponent(value)}`,
          },
        },
      });
      ok++;
    }
    setBusy(false);
    if (ok > 0) toast.success(`Invited ${value} to ${ok} org${ok > 1 ? "s" : ""}`);
    if (fail > 0) toast.warning(`${fail} invite${fail > 1 ? "s" : ""} failed`);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="glass w-full max-w-md p-6" style={{ background: "var(--background)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="t-card-title" style={{ fontSize: 16, fontWeight: 600 }}>Invite team member</div>
          <button onClick={onClose} className="btn-icon" style={{ width: 28, height: 28 }}><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="t-mono block mb-1.5" style={{ fontSize: 10 }}>EMAIL</label>
            <input
              type="email" required autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="input-glass w-full" style={{ height: 38, padding: "0 12px", fontSize: 13 }}
            />
          </div>

          <div>
            <label className="t-mono block mb-1.5" style={{ fontSize: 10 }}>ORGANIZATIONS</label>
            <div className="flex flex-wrap gap-1.5">
              {orgs.map((o) => {
                const c = ORG_COLORS[o.slug] ?? o.color ?? "#6366F1";
                const active = orgIds.includes(o.id);
                return (
                  <button key={o.id} type="button" onClick={() => toggleOrg(o.id)}
                    className="org-pill"
                    style={{
                      background: active ? `${c}26` : "transparent",
                      border: `1px solid ${active ? c : "var(--border-glass)"}`,
                      color: active ? c : "var(--text-secondary)",
                      fontSize: 11,
                    }}>
                    {active && <Check size={10} />}
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="t-mono block mb-1.5" style={{ fontSize: 10 }}>ROLE</label>
            <select value={role} onChange={(e) => setRole(e.target.value as any)}
              className="input-glass w-full" style={{ height: 38, padding: "0 12px", fontSize: 13 }}>
              <option value="member">Team member</option>
              <option value="admin">Org admin</option>
            </select>
          </div>

          {role === "member" && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="mt-1" />
              <div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>Read-only / restricted access</div>
                <div className="t-mono mt-0.5" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  No admin, finance, notifications, or capital-raise access
                </div>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={busy || orgIds.length === 0} className="btn-primary">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
