import { useEffect, useState } from "react";
import { Loader2, X, Copy, Save } from "lucide-react";
import { BRANDS, BRAND_ORDER, PLATFORM_CADENCE, type BrandKey } from "./shared";
import { supabase } from "@/integrations/supabase/client";
import { generate90DayStrategy } from "@/hooks/useSocialPosts";
import { toast } from "sonner";

export function StrategyView() {
  const [active, setActive] = useState<BrandKey>("uwazi");
  const [prompts, setPrompts] = useState<Record<string, { voice_notes: string; pillars: string[] }>>({});
  const [editingPillar, setEditingPillar] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [open90, setOpen90] = useState(false);
  const [loading90, setLoading90] = useState(false);
  const [strategy90, setStrategy90] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("social_ai_prompts").select("*");
      const map: any = {};
      (data || []).forEach((row: any) => { map[row.brand] = { voice_notes: row.voice_notes || "", pillars: row.pillars || [] }; });
      setPrompts(map);
    })();
  }, []);

  const cfg = BRANDS[active];
  const current = prompts[active] ?? { voice_notes: "", pillars: cfg.pillars };
  const pillars = current.pillars.length ? current.pillars : cfg.pillars;

  const savePillar = async (i: number, val: string) => {
    const updated = [...pillars];
    updated[i] = val;
    const { error } = await supabase.from("social_ai_prompts").update({ pillars: updated }).eq("brand", active);
    if (error) { toast.error(error.message); return; }
    setPrompts({ ...prompts, [active]: { ...current, pillars: updated } });
    setEditingPillar(null);
  };

  const gen90 = async () => {
    setOpen90(true); setLoading90(true); setStrategy90("");
    try {
      const text = await generate90DayStrategy({
        brand: cfg.label,
        voiceNotes: current.voice_notes,
        pillars,
      });
      setStrategy90(text);
    } catch (e: any) { toast.error(e?.message || "Generation failed"); }
    finally { setLoading90(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-5">
        {BRAND_ORDER.map((b) => (
          <button
            key={b}
            onClick={() => setActive(b)}
            className="px-3 py-1.5 rounded-md"
            style={{
              fontSize: 12,
              background: active === b ? BRANDS[b].color : "var(--bg-glass-1)",
              color: active === b ? "#000" : "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {BRANDS[b].label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          Content Pillars
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pillars.map((p, i) => (
            <div key={i} className="glass p-3 rounded-xl" style={{ borderLeft: `2px solid ${cfg.color}` }}>
              {editingPillar === i ? (
                <div className="flex gap-2">
                  <input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="input-glass flex-1"
                    style={{ fontSize: 13 }}
                  />
                  <button onClick={() => savePillar(i, editingValue)} className="btn-primary" style={{ fontSize: 11 }}>Save</button>
                  <button onClick={() => setEditingPillar(null)} className="btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold" style={{ fontSize: 13 }}>{p}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      Anchor for {cfg.label} content
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingPillar(i); setEditingValue(p); }}
                    className="btn-ghost"
                    style={{ fontSize: 10 }}
                  >Edit</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          Posting Cadence
        </div>
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full" style={{ fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                {["Platform","Frequency","Best time","Format priority"].map((h) => (
                  <th key={h} className="text-left p-2 t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLATFORM_CADENCE.map((row) => (
                <tr key={row.platform} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                  <td className="p-2 font-semibold">{row.platform}</td>
                  <td className="p-2" style={{ color: "var(--text-secondary)" }}>{row.frequency}</td>
                  <td className="p-2" style={{ color: "var(--text-secondary)" }}>{row.best_time}</td>
                  <td className="p-2" style={{ color: "var(--text-secondary)" }}>{row.format}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={gen90} className="btn-primary w-full" style={{ background: cfg.color, color: "#000", justifyContent: "center" }}>
        Generate 90-day strategy →
      </button>

      {open90 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="glass rounded-xl w-full max-h-[90vh] flex flex-col" style={{ maxWidth: 1100 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
              <div className="t-section" style={{ fontSize: 14 }}>90-Day Strategy — {cfg.label}</div>
              <button onClick={() => setOpen90(false)} className="btn-icon"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loading90 ? (
                <div className="flex flex-col items-center gap-3 justify-center py-16" style={{ color: "var(--text-muted)" }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: cfg.color }} />
                  <div style={{ fontSize: 13 }}>Vision is building your strategy...</div>
                </div>
              ) : (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.65, color: "var(--text-primary)" }}>
                  {strategy90}
                </pre>
              )}
            </div>
            <div className="flex gap-2 p-3 justify-end" style={{ borderTop: "1px solid var(--border-glass)" }}>
              <button onClick={() => { navigator.clipboard.writeText(strategy90); toast.success("Copied"); }} className="btn-ghost" disabled={!strategy90}>
                <Copy size={12} /> Copy
              </button>
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  const { error } = await supabase.from("kb_documents").insert({
                    user_id: user?.id, title: `90-Day Social Strategy — ${cfg.label} — ${new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}`,
                    full_text: strategy90, source_type: "manual", category: "Social Strategy", status: "ready",
                  });
                  if (error) toast.error(error.message); else toast.success("Saved to Knowledge Base");
                }}
                className="btn-primary"
                disabled={!strategy90}
              >
                <Save size={12} /> Save to Knowledge Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
