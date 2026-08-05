import { useState } from "react";
import { X, Sparkles, Loader2, ArrowRight, ExternalLink, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, TEAM_MEMBERS, BRAND_OPTIONS, LIME, type AgentCategory } from "@/lib/agents";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";

interface Blueprint {
  name: string;
  category: AgentCategory;
  trigger_type: "schedule" | "webhook" | "manual";
  trigger_config: { description?: string; cron?: string };
  steps: { app: string; action: string; description: string }[];
  output: { app: string; destination: string };
  explanation: string[];
  assigned_to: string[];
}

export function BuildWithAIPanel({
  open,
  onClose,
  initialDescription,
  region,
}: {
  open: boolean;
  onClose: () => void;
  initialDescription?: string;
  region: string;
}) {
  const { create } = useAgents();
  const [step, setStep] = useState<1 | 2>(1);
  const [description, setDescription] = useState(initialDescription || "");
  const [category, setCategory] = useState<AgentCategory>("content");
  const [brands, setBrands] = useState<string[]>(["uwazi"]);
  const [assigned, setAssigned] = useState<string[]>(["myke"]);
  const [thinking, setThinking] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);

  if (!open) return null;

  const toggleArr = (arr: string[], v: string, set: (n: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const understand = async () => {
    if (!description.trim()) { toast.error("Describe your workflow first"); return; }
    setThinking(true);
    try {
      const system = `You are parsing a workflow description to create a Make.com automation for Kova.
Extract: trigger type (schedule/webhook/manual), trigger config (cron/event), steps (app + action), output (Slack/email/Supabase), and a plain-English explanation.

Return STRICT JSON only with this shape:
{
  "name": "short agent name",
  "category": "content|campaigns|analytics|approvals|reports|general",
  "trigger_type": "schedule|webhook|manual",
  "trigger_config": {"description": "...", "cron": "..."},
  "steps": [{"app": "...", "action": "...", "description": "..."}],
  "output": {"app": "...", "destination": "..."},
  "explanation": ["step 1 plain English", "step 2 plain English"],
  "assigned_to": ["anna","alexis","myke"]
}`;
      const { data, error } = await supabase.functions.invoke("claude-proxy", {
        body: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system,
          messages: [{ role: "user", content: description }],
        },
      });
      if (error) throw error;
      const text = data?.content?.[0]?.text || "";
      const json = extractJson(text);
      const parsed = JSON.parse(json) as Blueprint;
      setBlueprint(parsed);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.assigned_to) setAssigned(parsed.assigned_to);
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Vision couldn't parse this. Try rewording.");
    } finally {
      setThinking(false);
    }
  };

  const saveAndOpen = async () => {
    if (!blueprint) return;
    try {
      await create({
        name: blueprint.name,
        description: blueprint.explanation.join(" "),
        category,
        trigger_type: blueprint.trigger_type,
        trigger_config: blueprint.trigger_config as any,
        ai_prompt: description,
        is_active: false,
        is_prebuilt: false,
        make_scenario_id: null,
        assigned_to: assigned,
        brand: brands,
      } as any);
      toast.success("Agent saved. Build it in Make.com next.");
      window.open(`https://${region || "us1"}.make.com/scenarios`, "_blank");
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} style={{ background: "rgba(0,0,0,0.5)" }}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full overflow-y-auto"
        style={{ width: 420, maxWidth: "100%", background: "rgba(10,10,18,0.97)", backdropFilter: "blur(20px)", borderLeft: "1px solid var(--border-glass)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: LIME }} />
            <div className="t-section" style={{ fontSize: 14 }}>Build with AI</div>
            <span className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>STEP {step}/2</span>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        {step === 1 ? (
          <div className="p-4 space-y-4">
            <div>
              <label className="t-mono uppercase mb-1.5 block" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                Describe
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={`Describe what you want to automate in plain English.\n\nExample: Every Monday morning, send Anna and Alexis a Slack message with the top 3 performing posts from last week and 2 content ideas for the coming week.`}
                className="input-glass w-full"
                style={{ fontSize: 12, lineHeight: 1.5 }}
              />
            </div>

            <div>
              <label className="t-mono uppercase mb-1.5 block" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="px-2.5 py-1 rounded-md"
                    style={{
                      fontSize: 11,
                      background: category === c ? CATEGORY_COLORS[c] : "var(--bg-glass-1)",
                      color: category === c ? "#fff" : "var(--text-secondary)",
                    }}
                  >{CATEGORY_LABELS[c]}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="t-mono uppercase mb-1.5 block" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Brand scope</label>
              <div className="flex flex-wrap gap-1.5">
                {BRAND_OPTIONS.map((b) => {
                  const on = brands.includes(b.key);
                  return (
                    <button key={b.key} onClick={() => toggleArr(brands, b.key, setBrands)}
                      className="px-2.5 py-1 rounded-full"
                      style={{ fontSize: 11, background: on ? b.color : "var(--bg-glass-1)", color: on ? "#000" : "var(--text-secondary)", fontWeight: on ? 600 : 400 }}>
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="t-mono uppercase mb-1.5 block" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Assigned to</label>
              <div className="space-y-1.5">
                {TEAM_MEMBERS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assigned.includes(m.key)}
                      onChange={() => toggleArr(assigned, m.key, setAssigned)}
                    />
                    <span style={{ fontSize: 12 }}>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={understand}
              disabled={thinking || !description.trim()}
              className="btn-primary w-full"
              style={{ background: LIME, color: "#000", justifyContent: "center", fontWeight: 600 }}
            >
              {thinking ? <><Loader2 size={12} className="animate-spin" /> Vision is thinking...</> : <>Understand my workflow <ArrowRight size={12} /></>}
            </button>
            {thinking && (
              <div className="text-center" style={{ fontSize: 11, color: "var(--text-muted)" }}>Parsing trigger, steps, and output...</div>
            )}
          </div>
        ) : blueprint ? (
          <div className="p-4 space-y-4">
            <div className="t-card-title" style={{ fontSize: 14 }}>{blueprint.name}</div>

            {/* Blueprint chain */}
            <div className="glass rounded-xl p-3 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                <BlueprintBlock app={blueprint.trigger_type} action="Trigger" color={CATEGORY_COLORS[category]} />
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                {blueprint.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <BlueprintBlock app={s.app} action={s.action} color="#6B7280" />
                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                  </div>
                ))}
                <BlueprintBlock app={blueprint.output.app} action={blueprint.output.destination} color={LIME} />
              </div>
            </div>

            <div>
              <div className="t-mono uppercase mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                Here's what this agent will do
              </div>
              <ol style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", paddingLeft: 18 }}>
                {blueprint.explanation.map((e, i) => <li key={i} style={{ marginBottom: 4 }}>{e}</li>)}
              </ol>
            </div>

            {blueprint.trigger_config?.description && (
              <div>
                <label className="t-mono uppercase mb-1 block" style={{ fontSize: 9, color: "var(--text-muted)" }}>Trigger</label>
                <input
                  value={blueprint.trigger_config.description}
                  onChange={(e) => setBlueprint({ ...blueprint, trigger_config: { ...blueprint.trigger_config, description: e.target.value } })}
                  className="input-glass w-full" style={{ fontSize: 12 }}
                />
              </div>
            )}
            {blueprint.output?.destination && (
              <div>
                <label className="t-mono uppercase mb-1 block" style={{ fontSize: 9, color: "var(--text-muted)" }}>Output destination</label>
                <input
                  value={blueprint.output.destination}
                  onChange={(e) => setBlueprint({ ...blueprint, output: { ...blueprint.output, destination: e.target.value } })}
                  className="input-glass w-full" style={{ fontSize: 12 }}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-ghost flex-1" style={{ justifyContent: "center" }}>
                ← Revise
              </button>
              <button
                onClick={saveAndOpen}
                className="btn-primary flex-1"
                style={{ background: LIME, color: "#000", justifyContent: "center", fontWeight: 600 }}
              >
                Save + Open in Make <ExternalLink size={12} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              After building this scenario in Make.com, copy the scenario ID and paste it in the agent's Setup panel.
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function BlueprintBlock({ app, action, color }: { app: string; action: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ minWidth: 70 }}>
      <div
        className="flex items-center justify-center text-white font-display"
        style={{ width: 36, height: 36, borderRadius: 18, background: color, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}
        title={app}
      >
        {(app || "?").slice(0, 2)}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "center", maxWidth: 80, lineHeight: 1.2 }} className="truncate w-full">
        {action}
      </div>
    </div>
  );
}

function extractJson(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body;
}
