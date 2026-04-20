import { Zap, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";

export const MorningBrief = () => {
  const { user } = useAuth();
  const { orgs, activeOrgId } = useOrg();
  const today = format(new Date(), "EEE, MMM d · yyyy").toUpperCase();
  const name = ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Builder").split(" ")[0];
  const orgName = activeOrgId === "all" ? "all three companies" : orgs.find((o) => o.id === activeOrgId)?.name ?? "your company";

  return (
    <div
      className="glass-elevated card-enter p-6 relative overflow-hidden"
      style={{ borderLeft: "3px solid transparent" }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: "linear-gradient(180deg, var(--primary-bright), hsl(var(--primary)))",
          boxShadow: "0 0 18px var(--glow-blue-strong)",
        }}
      />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Zap size={18} strokeWidth={1.5} style={{ color: "var(--text-accent)" }} />
          <span className="t-card-title">DAILY BRIEF</span>
          <span className="slash">/</span>
          <span className="t-mono">{today}</span>
        </div>
        <button className="btn-ghost" style={{ height: 32, padding: "0 12px", fontSize: 11 }}>
          <RefreshCw size={12} strokeWidth={1.5} /> Regenerate
        </button>
      </div>
      <div className="t-body" style={{ color: "var(--text-primary)", fontSize: 15, lineHeight: 1.65 }}>
        Good morning, <span style={{ color: "var(--text-accent)" }}>{name}</span>. You're operating on{" "}
        <span style={{ color: "var(--text-primary)" }}>{orgName}</span> today. Inbox is quiet, calendar has room
        to think. Your unfinished thread from yesterday is queued at the top of Tasks.
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <span className="badge badge-info">3 EVENTS</span>
        <span className="badge badge-warn">2 DUE TODAY</span>
        <span className="badge badge-muted">0 BLOCKERS</span>
      </div>
    </div>
  );
};
