import { useEffect, useState } from "react";
import { Activity, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DashCard, EmptyHint } from "./DashCard";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { ORG_COLORS } from "@/lib/orgs";

interface MemberRow {
  user_id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  org_ids: string[];
  tasks_completed: number;
  tasks_created: number;
  meetings_added: number;
}

export function TeamActivityCard() {
  const { user } = useAuth();
  const { orgs, memberships, isOwner, activeOrgId } = useOrg();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Only founders viewing "All Orgs" see this
  const ownedOrgIds = memberships.filter((m) => m.role === "owner").map((m) => m.org_id);
  const visible = isOwner && activeOrgId === "all" && ownedOrgIds.length > 0;

  const load = async () => {
    if (!visible || !user) return;
    setLoading(true);
    try {
      // Fetch members of all owned orgs in parallel
      const memberLists = await Promise.all(
        ownedOrgIds.map((orgId) =>
          supabase.rpc("get_org_members" as any, { _org_id: orgId })
            .then(({ data }) => ({ orgId, members: (data ?? []) as any[] }))
        )
      );

      // Aggregate unique members → org_ids
      const byUser = new Map<string, MemberRow>();
      for (const { orgId, members } of memberLists) {
        for (const m of members) {
          if (m.user_id === user.id) continue; // skip self
          const cur = byUser.get(m.user_id);
          if (cur) {
            cur.org_ids.push(orgId);
          } else {
            byUser.set(m.user_id, {
              user_id: m.user_id,
              display_name: m.display_name,
              email: m.email,
              avatar_url: m.avatar_url,
              org_ids: [orgId],
              tasks_completed: 0,
              tasks_created: 0,
              meetings_added: 0,
            });
          }
        }
      }

      const userIds = [...byUser.keys()];
      if (userIds.length === 0) {
        setRows([]);
        return;
      }

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const iso = dayStart.toISOString();

      const [{ data: doneTasks }, { data: newTasks }, { data: newEvents }] = await Promise.all([
        supabase.from("tasks")
          .select("assignee_id, created_by, completed_at")
          .gte("completed_at", iso)
          .in("org_id", ownedOrgIds),
        supabase.from("tasks")
          .select("created_by, created_at")
          .gte("created_at", iso)
          .in("org_id", ownedOrgIds),
        supabase.from("events")
          .select("user_id, created_at")
          .gte("created_at", iso)
          .in("org_id", ownedOrgIds),
      ]);

      for (const t of doneTasks ?? []) {
        const uid = (t as any).assignee_id ?? (t as any).created_by;
        const r = uid && byUser.get(uid);
        if (r) r.tasks_completed++;
      }
      for (const t of newTasks ?? []) {
        const r = (t as any).created_by && byUser.get((t as any).created_by);
        if (r) r.tasks_created++;
      }
      for (const e of newEvents ?? []) {
        const r = (e as any).user_id && byUser.get((e as any).user_id);
        if (r) r.meetings_added++;
      }

      setRows([...byUser.values()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [visible, ownedOrgIds.join(",")]);

  if (!visible) return null;

  return (
    <DashCard
      title="Team Activity Today"
      icon={Activity}
      delay={240}
      action={
        <button onClick={load} className="btn-icon" title="Refresh" style={{ width: 26, height: 26 }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      }
    >
      {rows.length === 0 ? (
        <EmptyHint>
          <div className="mb-2">No team members yet.</div>
          <Link to="/settings" className="inline-flex items-center gap-1 t-mono"
            style={{ fontSize: 11, color: "hsl(var(--primary))" }}>
            Invite your team <ArrowRight size={10} />
          </Link>
        </EmptyHint>
      ) : (
        rows.map((r) => {
          const initials = (r.display_name ?? r.email).slice(0, 2).toUpperCase();
          const orgPills = r.org_ids
            .map((id) => orgs.find((o) => o.id === id))
            .filter(Boolean) as { name: string; slug: string; color: string }[];
          const total = r.tasks_completed + r.tasks_created + r.meetings_added;
          return (
            <div key={r.user_id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-white/[0.04]"
              style={{ background: "var(--bg-glass-1)" }}>
              <div className="flex-shrink-0 flex items-center justify-center font-display rounded-full overflow-hidden"
                style={{
                  width: 30, height: 30,
                  background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)",
                  color: "var(--text-accent)", fontSize: 11, fontWeight: 700,
                }}>
                {r.avatar_url
                  ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                  : initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate"
                  style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                  <span className="truncate">{r.display_name ?? r.email}</span>
                  {orgPills.map((o) => {
                    const c = ORG_COLORS[o.slug] ?? o.color ?? "#6366F1";
                    return (
                      <span key={o.slug}
                        className="inline-block rounded-full"
                        style={{ width: 6, height: 6, background: c, boxShadow: `0 0 6px ${c}` }}
                        title={o.name}
                      />
                    );
                  })}
                </div>
                <div className="t-mono truncate" style={{ fontSize: 10, color: total === 0 ? "#F59E0B" : "var(--text-secondary)" }}>
                  {total === 0 ? (
                    <>⚠ No activity today</>
                  ) : (
                    [
                      r.tasks_completed && `${r.tasks_completed} task${r.tasks_completed > 1 ? "s" : ""} completed`,
                      r.tasks_created && `${r.tasks_created} created`,
                      r.meetings_added && `${r.meetings_added} meeting${r.meetings_added > 1 ? "s" : ""}`,
                    ].filter(Boolean).join(" · ")
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </DashCard>
  );
}
