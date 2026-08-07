import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { Card, Desc, Title, Tag, Eyebrow } from "@/components/primitives";
import { toast } from "sonner";

/**
 * MembersPanel — people in an organisation, and invitations out to it.
 *
 * The invite token is generated here and only its hash is stored, so an admin
 * reading the table cannot accept someone else's invite.
 */

interface Member { user_id: string; role: string; email: string | null; display_name: string | null }
interface Invite { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const MembersPanel = () => {
  const { orgs, scopeOrgId } = useWorkspaceScope();
  const [orgId, setOrgId] = useState<string | null>(scopeOrgId ?? null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);

  const active = orgId ?? orgs[0]?.id ?? null;
  const org = orgs.find((o) => o.id === active);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const [m, i] = await Promise.allSettled([
        supabase.rpc("get_org_members", { _org_id: active }),
        (supabase as any)
          .from("org_invitations")
          .select("id,email,role,expires_at,accepted_at,revoked_at")
          .eq("org_id", active)
          .order("created_at", { ascending: false }),
      ]);
      if (m.status === "fulfilled") setMembers(((m.value as any).data ?? []) as Member[]);
      if (i.status === "fulfilled") setInvites((((i.value as any).data ?? []) as Invite[]));
    })();
  }, [active]);

  const invite = async () => {
    if (!active || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("org_invitations").insert({
      org_id: active,
      email: email.trim().toLowerCase(),
      role,
      invited_by: auth?.user?.id ?? null,
      token_hash: await sha256(token),
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
    if (error) { setBusy(false); toast.error(error.message); return; }

    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "org-invite",
        recipientEmail: email.trim().toLowerCase(),
        idempotencyKey: `org-invite-${active}-${email.trim().toLowerCase()}-${Date.now()}`,
        templateData: {
          orgName: org?.name ?? "an organisation",
          signupUrl: `${window.location.origin}/login?invite=${token}`,
        },
      },
    });

    setBusy(false);
    setEmail("");
    toast.success("Invite sent");
    const { data } = await (supabase as any)
      .from("org_invitations")
      .select("id,email,role,expires_at,accepted_at,revoked_at")
      .eq("org_id", active)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  };

  const revoke = async (id: string) => {
    await (supabase as any)
      .from("org_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i)));
  };

  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>People</Title>
          <Desc>
            Membership is per organisation, not per account. Removing the last owner
            is refused by the database, not by this screen.
          </Desc>
        </div>

        <div className="vo-row" style={{ flexWrap: "wrap", gap: "var(--s-2)" }}>
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              className="b-ghost b-sm"
              data-active={active === o.id ? "true" : undefined}
              onClick={() => setOrgId(o.id)}
            >
              <span className="vo-dot" style={{ background: o.identity_color }} aria-hidden /> {o.name}
            </button>
          ))}
        </div>

        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <Eyebrow>Members</Eyebrow>
          {members.length === 0 ? (
            <Desc>No members loaded for {org?.name ?? "this organisation"}.</Desc>
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="vo-toggle-row">
                <div className="vo-stack" style={{ gap: 2 }}>
                  <span className="vo-toggle-label">{m.display_name ?? m.email ?? "Member"}</span>
                  <span className="vo-meta">{m.email}</span>
                </div>
                <Tag tone={m.role === "owner" ? "accent" : undefined}>{m.role}</Tag>
              </div>
            ))
          )}
        </div>

        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <Eyebrow>Invite someone</Eyebrow>
          <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
            <input
              className="input-glass"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select className="input-glass" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button type="button" className="b-pri b-sm" disabled={busy} onClick={invite}>
              Send invite
            </button>
          </div>

          {invites.filter((i) => !i.accepted_at && !i.revoked_at).map((i) => (
            <div key={i.id} className="vo-toggle-row">
              <div className="vo-stack" style={{ gap: 2 }}>
                <span className="vo-toggle-label">{i.email}</span>
                <span className="vo-meta">
                  {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                </span>
              </div>
              <button type="button" className="vo-link" onClick={() => revoke(i.id)}>Revoke</button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default MembersPanel;
