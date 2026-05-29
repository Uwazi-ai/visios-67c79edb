import { Bot, FileText, Megaphone, BarChart3, CheckCircle2, FileBarChart, Settings as SettingsIcon } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, timeAgo, LIME, type Agent, type AgentCategory } from "@/lib/agents";

const ICONS: Record<AgentCategory, any> = {
  content: FileText,
  campaigns: Megaphone,
  analytics: BarChart3,
  approvals: CheckCircle2,
  reports: FileBarChart,
  general: SettingsIcon,
};

export function categoryIcon(cat: AgentCategory | null) {
  return ICONS[cat || "general"] || Bot;
}

export function AgentCard({
  agent,
  selected,
  onSelect,
  onToggle,
}: {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const cat = (agent.category || "general") as AgentCategory;
  const color = CATEGORY_COLORS[cat];
  const Icon = ICONS[cat];
  const hasScenario = !!agent.make_scenario_id;
  const statusBadge = !hasScenario
    ? { label: "Setup", bg: "rgba(245,158,11,0.15)", fg: "#F59E0B" }
    : agent.last_run_status === "failed"
      ? { label: "Error", bg: "rgba(239,68,68,0.15)", fg: "#EF4444" }
      : agent.is_active
        ? { label: "Active", bg: "rgba(34,197,94,0.15)", fg: "#22C55E" }
        : agent.last_run_at
          ? { label: "Paused", bg: "rgba(120,120,120,0.15)", fg: "var(--text-muted)" }
          : { label: "Never run", bg: "transparent", fg: "var(--text-muted)" };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg p-3 transition-colors ${selected ? "glass-active" : "glass"}`}
      style={{
        borderLeft: `2px solid ${selected ? color : "transparent"}`,
        marginBottom: 6,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 28, height: 28, borderRadius: 14, background: `${color}1a`, color }}
        >
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
              {agent.name}
            </div>
            {hasScenario ? (
              <Toggle on={agent.is_active} onChange={onToggle} />
            ) : (
              <span style={{ fontSize: 9, color: "#F59E0B", whiteSpace: "nowrap" }}>Setup required</span>
            )}
          </div>
          <div className="truncate" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            {agent.description}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="t-mono uppercase"
              style={{
                fontSize: 8, padding: "1px 5px", borderRadius: 3,
                background: statusBadge.bg, color: statusBadge.fg,
                border: statusBadge.label === "Never run" ? "1px dashed var(--border-glass)" : "none",
              }}
            >
              {statusBadge.label}
            </span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{timeAgo(agent.last_run_at)}</span>
            <span style={{ fontSize: 9, color: color, marginLeft: "auto" }}>{CATEGORY_LABELS[cat]}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!on); }}
      disabled={disabled}
      style={{
        width: 30, height: 16, borderRadius: 8, position: "relative",
        background: on ? LIME : "rgba(120,120,120,0.3)",
        transition: "background 150ms",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: on ? 16 : 2,
          width: 12, height: 12, borderRadius: 6,
          background: on ? "#000" : "#fff",
          transition: "left 150ms",
        }}
      />
    </button>
  );
}
