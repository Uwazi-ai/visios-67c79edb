import { useEffect, useMemo, useState } from "react";
import { Search, X, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";
import { toast } from "sonner";

interface MemberRow {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  org_ids: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (channelId: string) => void;
}

export const NewDmModal = ({ open, onClose, onCreated }: Props) => {
  const { user } = useAuth();
  const { orgs, activeOrgId } = useOrg();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Get my org memberships
      const { data: myMs } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id);
      const myOrgIds = (myMs ?? []).map((m) => m.org_id);
      const scopedOrgIds =
        activeOrgId && activeOrgId !== "all"
          ? myOrgIds.filter((id) => id === activeOrgId)
          : myOrgIds;
      if (scopedOrgIds.length === 0) {
        if (!cancelled) {
          setMembers([]);
          setLoading(false);
        }
        return;
      }
      // Get all memberships in those orgs
      const { data: ms } = await supabase
        .from("org_memberships")
        .select("user_id, org_id")
        .in("org_id", scopedOrgIds);
      const byUser = new Map<string, Set<string>>();
      for (const row of ms ?? []) {
        if (row.user_id === user.id) continue;
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Set());
        byUser.get(row.user_id)!.add(row.org_id);
      }
      const userIds = Array.from(byUser.keys());
      if (userIds.length === 0) {
        if (!cancelled) {
          setMembers([]);
          setLoading(false);
        }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", userIds);
      if (cancelled) return;
      const list: MemberRow[] = (profs ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        avatar_url: p.avatar_url,
        org_ids: Array.from(byUser.get(p.id) ?? []),
      }));
      list.sort((a, b) =>
        (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email),
      );
      setMembers(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, activeOrgId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.display_name ?? "").toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  async function startDm(other: MemberRow) {
    if (!user) return;
    setCreatingId(other.id);
    try {
      // Pick an org both users share — prefer active, else first shared
      const preferred =
        activeOrgId && activeOrgId !== "all" && other.org_ids.includes(activeOrgId)
          ? activeOrgId
          : other.org_ids[0];
      if (!preferred) {
        toast.error("No shared org with this user");
        return;
      }
      // Look for existing DM in that org with exactly these two participants
      const { data: existing, error: exErr } = await supabase
        .from("channels")
        .select("id, dm_participants, org_id, is_dm")
        .eq("org_id", preferred)
        .eq("is_dm", true);
      if (exErr) throw exErr;
      const match = (existing ?? []).find((c) => {
        const ps = c.dm_participants ?? [];
        return (
          ps.length === 2 && ps.includes(user.id) && ps.includes(other.id)
        );
      });
      if (match) {
        onCreated(match.id);
        onClose();
        return;
      }
      const handle = (other.display_name ?? other.email.split("@")[0])
        .toLowerCase()
        .replace(/\s+/g, "");
      const { data: created, error: insErr } = await supabase
        .from("channels")
        .insert({
          org_id: preferred,
          name: handle,
          type: "dm",
          is_dm: true,
          is_system: false,
          dm_participants: [user.id, other.id],
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      toast.success(`DM with ${other.display_name ?? other.email} started`);
      onCreated(created.id);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start DM");
    } finally {
      setCreatingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[14px] overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,10,20,0.95)",
          border: "1px solid var(--border-glass-hover)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          maxHeight: "70vh",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-glass)" }}
        >
          <MessageSquare size={14} strokeWidth={1.5} style={{ color: "#60A5FA" }} />
          <div className="t-card-title flex-1">New direct message</div>
          <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={onClose} title="Close">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teammates by name or email"
              className="input-glass"
              style={{ padding: "8px 8px 8px 26px", fontSize: 13 }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="t-mono px-3 py-6 text-center" style={{ fontSize: 10 }}>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="t-mono px-3 py-6 text-center" style={{ fontSize: 10 }}>
              {search ? "No matches" : "No teammates available"}
            </div>
          ) : (
            filtered.map((m) => {
              const sharedOrg = orgs.find((o) => m.org_ids.includes(o.id));
              const initials = (m.display_name ?? m.email)
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <button
                  key={m.id}
                  onClick={() => startDm(m)}
                  disabled={creatingId === m.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition-colors"
                  style={{
                    background:
                      creatingId === m.id ? "var(--bg-glass-active)" : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-glass-1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      creatingId === m.id ? "var(--bg-glass-active)" : "transparent")
                  }
                >
                  <div
                    className="flex items-center justify-center font-display flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(96,165,250,0.15)",
                      color: "#60A5FA",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {m.display_name ?? m.email}
                    </div>
                    <div className="t-mono truncate" style={{ fontSize: 9 }}>
                      {m.email}
                    </div>
                  </div>
                  {sharedOrg && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        className="org-dot"
                        style={{
                          background:
                            ORG_COLORS[sharedOrg.slug] ?? sharedOrg.color,
                        }}
                      />
                      <span className="t-mono" style={{ fontSize: 9 }}>
                        {sharedOrg.name}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
