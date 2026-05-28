import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { BRANDS, PLATFORMS, type BrandKey, type SocialPlatform } from "./shared";
import { analyzeSocialMetrics } from "@/hooks/useSocialPosts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnalyticsView({ brand }: { brand: BrandKey }) {
  const cfg = BRANDS[brand];
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);

  const analyze = async () => {
    if (!input.trim()) { toast.error("Paste some metrics first"); return; }
    setLoading(true);
    try {
      const { parsed, raw } = await analyzeSocialMetrics({ brand: cfg.label, platform, input });
      if (parsed) setAnalysis(parsed);
      else { setAnalysis({ summary: raw }); toast.warning("AI output couldn't be parsed"); }
    } catch (e: any) { toast.error(e?.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("social_analytics").insert({
      brand,
      platform,
      date_range_start: start || null,
      date_range_end: end || null,
      raw_input: input,
      analysis,
      created_by: user?.id ?? null,
    });
    if (error) toast.error(error.message); else toast.success("Analysis saved");
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-4xl mx-auto w-full space-y-5">
      <div className="glass p-4 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)} className="input-glass" style={{ fontSize: 12 }}>
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-glass" style={{ fontSize: 12 }} />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input-glass" style={{ fontSize: 12 }} />
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder='TikTok last 7 days: 45K impressions, 3.2% engagement, top post: voter reg countdown (12K views)'
          className="input-glass w-full"
          style={{ resize: "vertical", fontSize: 13 }}
        />
        <div className="flex justify-end">
          <button onClick={analyze} disabled={loading} className="btn-primary" style={{ background: cfg.color, color: "#000" }}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : "Analyze with AI →"}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="space-y-4">
          <div className="glass p-4 rounded-xl">
            <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Performance Summary</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{analysis.summary}</div>
          </div>

          {Array.isArray(analysis.top_performers) && analysis.top_performers.length > 0 && (
            <Section title="Top Performers">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {analysis.top_performers.map((t: any, i: number) => (
                  <Card key={i} accent={cfg.color}>
                    <div className="font-semibold" style={{ fontSize: 13 }}>{t.type}</div>
                    <div className="t-mono" style={{ fontSize: 11, color: cfg.color }}>{t.metric}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{t.why}</div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {Array.isArray(analysis.low_performers) && analysis.low_performers.length > 0 && (
            <Section title="Low Performers">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.low_performers.map((t: any, i: number) => (
                  <Card key={i} accent="#EF4444">
                    <div className="font-semibold" style={{ fontSize: 13 }}>{t.type}</div>
                    <div className="t-mono" style={{ fontSize: 11, color: "#EF4444" }}>{t.metric}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{t.fix}</div>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 && (
            <Section title="Recommendations">
              <div className="space-y-2">
                {analysis.recommendations.map((r: string, i: number) => (
                  <div key={i} className="glass p-3 rounded-lg flex gap-3">
                    <div className="t-mono" style={{ fontSize: 16, color: cfg.color, fontWeight: 700 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.isArray(analysis.retire) && (
              <div className="glass p-4 rounded-xl">
                <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: "#EF4444", letterSpacing: "0.08em" }}>Content to retire</div>
                <ul className="space-y-1" style={{ fontSize: 12 }}>{analysis.retire.map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul>
              </div>
            )}
            {Array.isArray(analysis.expand) && (
              <div className="glass p-4 rounded-xl">
                <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: cfg.color, letterSpacing: "0.08em" }}>Double down on</div>
                <ul className="space-y-1" style={{ fontSize: 12 }}>{analysis.expand.map((x: string, i: number) => <li key={i}>• {x}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={save} className="btn-primary"><Save size={12} /> Save Analysis</button>
          </div>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{title}</div>
    {children}
  </div>
);

const Card = ({ accent, children }: { accent: string; children: React.ReactNode }) => (
  <div className="glass p-3 rounded-lg" style={{ borderLeft: `2px solid ${accent}` }}>{children}</div>
);
