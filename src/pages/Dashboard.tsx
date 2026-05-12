import { Clock, Inbox, CheckSquare, Zap, GitBranch, Lock } from "lucide-react";
import { MorningBrief } from "@/components/dashboard/MorningBrief";
import { DashCard, EmptyHint } from "@/components/dashboard/DashCard";
import { ScheduleToday } from "@/components/dashboard/ScheduleToday";
import { TeamActivityCard } from "@/components/dashboard/TeamActivityCard";

const Dashboard = () => {
  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <MorningBrief />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SCHEDULE */}
        <DashCard title="Schedule" icon={Clock} delay={60}>
          <ScheduleToday />
        </DashCard>

        {/* INBOX */}
        <DashCard title="Needs Attention" icon={Inbox} delay={120}>
          <EmailRow initials="AS" name="Alex Sutter" subject="Re: Q2 partnership terms" badge="urgent" />
          <EmailRow initials="MK" name="Mira Khan" subject="Notes from Tuesday's product sync" badge="info" />
          <EmailRow initials="DR" name="Devon Rios" subject="Updated deck — your review please" badge="warn" />
        </DashCard>

        {/* TASKS */}
        <DashCard title="My Tasks" icon={CheckSquare} delay={180}>
          <TaskRow priority="urgent" title="Sign UWAZI funding doc" project="UWAZI" due="Today" />
          <TaskRow priority="high" title="Draft BIN newsletter" project="BIN" due="Tomorrow" />
          <TaskRow priority="normal" title="Book Culture Club venue" project="CC" due="Fri" />
          <TaskRow priority="low" title="Refactor onboarding copy" project="UWAZI" due="Next week" />
        </DashCard>

        {/* ACTIVITY */}
        <DashCard title="Team Activity" icon={Activity} delay={240}>
          <ActivityRow initials="JT" name="Jay T" action="closed deal" target="Acme — $40k" time="2h" />
          <ActivityRow initials="RM" name="Rae M" action="merged" target="design-system / v2" time="3h" />
          <ActivityRow initials="SO" name="Sam O" action="published" target="BIN April update" time="5h" />
        </DashCard>

        {/* SYSTEM PULSE */}
        <DashCard title="System Pulse" icon={Zap} delay={300}>
          <PulseRow app="Gmail Sync" status="ok" last="2m ago" />
          <PulseRow app="Calendar" status="ok" last="just now" />
          <PulseRow app="AI Brief" status="ok" last="6m ago" />
          <PulseRow app="Drive Crawler" status="warn" last="42m ago" />
        </DashCard>

        {/* DECISIONS */}
        <DashCard title="Upcoming Decisions" icon={GitBranch} delay={360}>
          <EmptyHint>
            <Lock size={20} strokeWidth={1.25} className="mx-auto mb-3 opacity-50" />
            No pending decisions
          </EmptyHint>
        </DashCard>
      </div>
    </div>
  );
};

/* ============ Row components ============ */

const EmailRow = ({ initials, name, subject, badge }: { initials: string; name: string; subject: string; badge: "urgent" | "warn" | "info" }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[0.04]" style={{ background: "var(--bg-glass-1)" }}>
    <div
      className="flex items-center justify-center font-display"
      style={{
        width: 30, height: 30, borderRadius: "50%",
        background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)",
        color: "var(--text-accent)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      }}
    >
      {initials}
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate" style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{name}</div>
      <div className="truncate t-body" style={{ fontSize: 12, color: "var(--text-secondary)" }}>{subject}</div>
    </div>
    <span className={`badge badge-${badge === "urgent" ? "critical" : badge}`}>{badge}</span>
  </div>
);

const PRIORITY_COLOR: Record<string, string> = { urgent: "#EF4444", high: "#F59E0B", normal: "#3B82F6", low: "#6B7280" };

const TaskRow = ({ priority, title, project, due }: { priority: keyof typeof PRIORITY_COLOR; title: string; project: string; due: string }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-white/[0.04]" style={{ background: "var(--bg-glass-1)" }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[priority], boxShadow: `0 0 6px ${PRIORITY_COLOR[priority]}` }} />
    <span className="flex-1 truncate" style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-primary)" }}>{title}</span>
    <span className="badge badge-muted">{project}</span>
    <span className="t-mono">{due}</span>
  </div>
);

const ActivityRow = ({ initials, name, action, target, time }: { initials: string; name: string; action: string; target: string; time: string }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-white/[0.04]" style={{ background: "var(--bg-glass-1)" }}>
    <div
      className="flex items-center justify-center font-display"
      style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)",
        color: "var(--text-accent)", fontSize: 10, fontWeight: 700,
      }}
    >
      {initials}
    </div>
    <div className="min-w-0 flex-1 truncate t-body" style={{ fontSize: 12 }}>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{name}</span>{" "}
      <span style={{ color: "var(--text-muted)" }}>{action}</span>{" "}
      <span style={{ color: "var(--text-secondary)" }}>{target}</span>
    </div>
    <span className="t-mono">{time}</span>
  </div>
);

const PulseRow = ({ app, status, last }: { app: string; status: "ok" | "warn" | "critical"; last: string }) => {
  const color = status === "ok" ? "#22C55E" : status === "warn" ? "#F59E0B" : "#EF4444";
  const dotClass = status === "critical" ? "dot-critical" : status === "ok" ? "dot-ok" : "";
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-white/[0.04]" style={{ background: "var(--bg-glass-1)" }}>
      <span className={dotClass} style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="flex-1" style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-primary)" }}>{app}</span>
      <span className="t-mono">{last}</span>
    </div>
  );
};

export default Dashboard;
