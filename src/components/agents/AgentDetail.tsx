import { useState } from "react";
import { ExternalLink, Play, Loader2, Clock, Webhook, MousePointerClick, ChevronDown } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS, TEAM_MEMBERS, BRAND_OPTIONS, timeAgo, type Agent, type AgentCategory } from "@/lib/agents";
import { Toggle, categoryIcon } from "./AgentCard";
import { useAgentRuns, callMake } from "@/hooks/useAgents";
import { toast } from "sonner";

const TRIGGER_ICONS: Record<string, any> = { schedule: Clock, webhook: Webhook, manual: MousePointerClick };
const STATUS_STYLES: Record<string, { bg: string; fg: string; pulse?: boolean }> = {
  success: { bg: "rgba(34,197,94,0.15)", fg: "#22C55E" },
  failed: { bg: "rgba(239,68,68,0.15)", fg: "#EF4444" },
  warning: { bg: "rgba(245,158,11,0.15)", fg: "#F59E0B" },
  running: { bg: "rgba(59,130,246,0.15)", fg: "#3B82F6", pulse: true },
};

export function AgentDetail({
  agent,
  region,
  onToggle,
  onUpdate,
}: {
  agent: Agent;
  region: string;
  onToggle: (next: boolean) => Promise<void>;
  onUpdate: (patch: Partial<Agent>) => Promise<void>;
}) {
  const cat = (agent.category || "general") as AgentCategory;
  const color = CATEGORY_COLORS[cat];
  const Icon = categoryIcon(cat);
  const TIcon = TRIGGER_ICONS[agent.trigger_type || "manual"] || MousePointerClick;
  const { runs } = useAgentRuns(agent.id);
  const [running, setRunning] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [scenarioInput, setScenarioInput] = useState("");

  const runNow = async () => {
    if (!agent.make_scenario_id) { toast.error("Set up scenario in Make first"); return; }
    setRunning(true);
    try {
      await callMake(`/scenarios/${agent.make_scenario_id}/run`, { method: "POST" });
      toast.success("Run triggered in Make.com");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const saveScenarioId = async () => {
    if (!scenarioInput.trim()) return;
    const id = scenarioInput.trim();
    const url = `https://${region || "us1"}.make.com/scenario/${id}`;
    await onUpdate({ make_scenario_id: id, make_scenario_url: url });
    setScenarioInput("");
    toast.success("Scenario linked");
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 44, height: 44, borderRadius: 22, background: `${color}1a`, color }}
          >
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="t-section" style={{ fontSize: 20 }}>{agent.name}</h2>
              <span className="badge" style={{ fontSize: 10, color, borderColor: color }}>{CATEGORY_LABELS[cat]}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, maxWidth: 600 }}>
              {agent.description}
            </div>
            {agent.make_scenario_url && (
              <a
                href={agent.make_scenario_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2"
                style={{ fontSize: 11, color: "var(--text-accent)" }}
              >
                Open in Make.com <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {agent.make_scenario_id && (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{agent.is_active ? "Active" : "Inactive"}</span>
              <Toggle on={agent.is_active} onChange={onToggle} />
            </div>
          )}
          <button onClick={runNow} disabled={running || !agent.make_scenario_id} className="btn-primary" style={{ fontSize: 12 }}>
            {running ? <><Loader2 size={12} className="animate-spin" /> Running...</> : <><Play size={12} /> Run now</>}
          </button>
        </div>
      </div>

      {/* Setup required banner */}
      {!agent.make_scenario_id && (
        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}
        >
          <div className="t-card-title mb-1" style={{ fontSize: 13, color: "#F59E0B" }}>
            This agent needs to be set up in Make.com before it can run.
          </div>
          <ol style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Build this scenario in Make.com</li>
            <li>Copy the scenario ID from the URL</li>
            <li>Paste it below</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <input
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
              placeholder="Scenario ID (e.g. 1234567)"
              className="input-glass flex-1"
              style={{ fontSize: 12 }}
            />
            <button onClick={saveScenarioId} className="btn-primary" style={{ fontSize: 12 }}>Link scenario</button>
            <a
              href="https://www.make.com/en/scenarios" target="_blank" rel="noreferrer"
              className="btn-ghost" style={{ fontSize: 12 }}
            >
              Set up in Make.com <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      {/* Config section */}
      <div className="glass rounded-xl mb-5">
        <button
          onClick={() => setConfigOpen((o) => !o)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="t-card-title" style={{ fontSize: 13 }}>Configuration</div>
          <ChevronDown size={14} style={{ transform: configOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>
        {configOpen && (
          <div className="px-4 pb-4 space-y-4">
            <Row label="Trigger">
              <div className="flex items-center gap-2">
                <TIcon size={12} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 12 }}>
                  {agent.trigger_config?.description || agent.trigger_type || "Manual"}
                </span>
              </div>
            </Row>
            <Row label="Assigned to">
              <div className="flex gap-1.5">
                {(agent.assigned_to || []).map((k) => {
                  const m = TEAM_MEMBERS.find((x) => x.key === k);
                  if (!m) return null;
                  return (
                    <span
                      key={k}
                      title={m.label}
                      className="flex items-center justify-center font-display"
                      style={{ width: 26, height: 26, borderRadius: 13, background: `${m.color}33`, color: m.color, fontSize: 10, fontWeight: 700 }}
                    >
                      {m.label[0]}
                    </span>
                  );
                })}
              </div>
            </Row>
            <Row label="Brand scope">
              <div className="flex flex-wrap gap-1.5">
                {(agent.brand || []).map((b) => {
                  const bc = BRAND_OPTIONS.find((x) => x.key === b);
                  return (
                    <span
                      key={b}
                      className="badge"
                      style={{ fontSize: 10, color: bc?.color, borderColor: bc?.color }}
                    >
                      {bc?.label || b}
                    </span>
                  );
                })}
              </div>
            </Row>
            <Row label="Make scenario ID">
              <span className="t-mono" style={{ fontSize: 11, color: agent.make_scenario_id ? "var(--text-primary)" : "var(--text-muted)" }}>
                {agent.make_scenario_id || "Not connected yet"}
              </span>
            </Row>
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="t-mono uppercase mb-2" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
        Run history
      </div>
      <div className="glass rounded-xl overflow-hidden">
        {runs.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "var(--text-muted)", fontSize: 12 }}>
            No runs yet. Toggle the agent on or click Run now.
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                {["Date/time", "Status", "Triggered by", "Duration", "Summary", ""].map((h) => (
                  <th key={h} className="text-left p-2 t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const st = STATUS_STYLES[r.status || "success"] || STATUS_STYLES.success;
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                    <td className="p-2 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {r.started_at ? new Date(r.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="p-2">
                      <span className={`t-mono uppercase ${st.pulse ? "animate-pulse" : ""}`} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: st.bg, color: st.fg }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2" style={{ color: "var(--text-secondary)" }}>{r.triggered_by || "—"}</td>
                    <td className="p-2 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="p-2" style={{ color: "var(--text-secondary)", maxWidth: 320 }}>
                      <div className="truncate">{r.output_summary || r.error_message || "—"}</div>
                    </td>
                    <td className="p-2">
                      {r.make_execution_id && agent.make_scenario_id && (
                        <a
                          href={`https://${region || "us1"}.make.com/scenario/${agent.make_scenario_id}/edit#execution-${r.make_execution_id}`}
                          target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: "var(--text-accent)" }}
                        >
                          View in Make
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
    <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{label}</div>
    <div>{children}</div>
  </div>
);
