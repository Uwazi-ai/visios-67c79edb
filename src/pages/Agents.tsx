import { useMemo, useState } from "react";
import { Sparkles, Settings as SettingsIcon, Plus, Bot } from "lucide-react";
import { useAgents, useSettings, useWeeklyRunCount, callMake } from "@/hooks/useAgents";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, LIME, type AgentCategory, type Agent } from "@/lib/agents";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentDetail } from "@/components/agents/AgentDetail";
import { BuildWithAIPanel } from "@/components/agents/BuildWithAIPanel";
import { AgentsSettings } from "@/components/agents/AgentsSettings";
import { toast } from "sonner";

export default function AgentsPage() {
  const { agents, loading, update } = useAgents();
  const { settings } = useSettings();
  const weeklyRuns = useWeeklyRunCount();
  const [activeCat, setActiveCat] = useState<"all" | AgentCategory>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [buildSeed, setBuildSeed] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hasKey = !!settings.make_api_key;
  const region = settings.make_region || "us1";

  const filtered = useMemo(() => {
    if (activeCat === "all") return agents;
    return agents.filter((a) => a.category === activeCat);
  }, [agents, activeCat]);

  const grouped = useMemo(() => {
    const g: Record<string, Agent[]> = {};
    filtered.forEach((a) => {
      const k = a.category || "general";
      (g[k] ||= []).push(a);
    });
    return g;
  }, [filtered]);

  const selected = agents.find((a) => a.id === selectedId) || agents[0] || null;

  const handleToggle = async (a: Agent, next: boolean) => {
    try {
      if (a.make_scenario_id) {
        await callMake(`/scenarios/${a.make_scenario_id}`, { method: "PATCH", body: { isActive: next } });
      }
      await update(a.id, { is_active: next });
      toast.success(next ? "Agent activated" : "Agent paused");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openBuildAI = (desc?: string) => { setBuildSeed(desc); setBuildOpen(true); };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <div className="flex items-center gap-2">
          <Bot size={18} style={{ color: LIME }} />
          <h1 className="t-section" style={{ fontSize: 18 }}>Agents</h1>
        </div>

        <div className="flex items-center gap-1 ml-6">
          {(["all", ...CATEGORIES] as const).map((c) => {
            const active = activeCat === c;
            const color = c === "all" ? "var(--text-primary)" : CATEGORY_COLORS[c as AgentCategory];
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className="px-3 py-1 rounded-md"
                style={{
                  fontSize: 11,
                  background: active ? (c === "all" ? "var(--bg-glass-2)" : `${color}1a`) : "transparent",
                  color: active ? color : "var(--text-muted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {c === "all" ? "All" : CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => openBuildAI()}
            className="btn-primary"
            style={{ background: LIME, color: "#000", fontSize: 12, fontWeight: 600 }}
          >
            <Sparkles size={12} /> Build with AI
          </button>
          <button onClick={() => setSettingsOpen(true)} className="btn-icon" title="Settings">
            <SettingsIcon size={14} />
          </button>
        </div>
      </div>

      {!hasKey ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Bot size={48} style={{ color: LIME, margin: "0 auto 16px" }} />
            <h2 className="t-section mb-2" style={{ fontSize: 20 }}>Connect Make.com to activate your agents</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Your agents are pre-built and ready. Add your Make.com API key in Settings to start running them.
            </p>
            <button onClick={() => setSettingsOpen(true)} className="btn-primary" style={{ background: LIME, color: "#000", fontWeight: 600 }}>
              Go to Settings →
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Library */}
          <aside
            className="overflow-y-auto p-3 flex flex-col"
            style={{ width: 300, borderRight: "1px solid var(--border-glass)" }}
          >
            <div className="flex-1">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass rounded-lg p-3 animate-pulse" style={{ height: 70 }} />
                  ))}
                </div>
              ) : (
                CATEGORIES.filter((c) => grouped[c]?.length).map((c) => (
                  <div key={c} className="mb-3">
                    <div
                      className="t-mono uppercase mb-1.5 px-1"
                      style={{ fontSize: 9, color: CATEGORY_COLORS[c], letterSpacing: "0.1em", fontWeight: 600 }}
                    >
                      {CATEGORY_LABELS[c]}
                    </div>
                    {grouped[c].map((a) => (
                      <AgentCard
                        key={a.id}
                        agent={a}
                        selected={selected?.id === a.id}
                        onSelect={() => setSelectedId(a.id)}
                        onToggle={(next) => handleToggle(a, next)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            <button onClick={() => openBuildAI()} className="btn-ghost w-full mt-2" style={{ fontSize: 12, justifyContent: "center" }}>
              <Plus size={12} /> New agent
            </button>

            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-glass)" }}>
              <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
                <span style={{ color: "var(--text-muted)" }}>Runs this week</span>
                <span style={{ fontWeight: 600, color: LIME }}>{weeklyRuns}</span>
              </div>
              <a
                href={`https://${region}.make.com/executions`} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: "var(--text-accent)" }}
              >
                View full history →
              </a>
            </div>
          </aside>

          {/* Detail */}
          {selected ? (
            <AgentDetail
              agent={selected}
              region={region}
              onToggle={(next) => handleToggle(selected, next)}
              onUpdate={(patch) => update(selected.id, patch)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              Select an agent to see its details
            </div>
          )}
        </div>
      )}

      <BuildWithAIPanel open={buildOpen} onClose={() => setBuildOpen(false)} initialDescription={buildSeed} region={region} />
      {settingsOpen && (
        <AgentsSettings onClose={() => setSettingsOpen(false)} onOpenBuildAI={(d) => openBuildAI(d)} />
      )}
    </div>
  );
}
