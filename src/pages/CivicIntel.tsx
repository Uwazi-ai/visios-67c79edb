import { useEffect, useState, useRef } from "react";
import { Play, PlayCircle, X, Plus, Calendar, History, Loader2, CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATES = ["MO", "KS", "IL", "TX", "CA", "NY", "FL", "PA", "GA", "AZ", "NC", "MI", "WI", "NV", "OH"];

const STATE_DEFAULT_CITY: Record<string, string> = {
  MO: "Kansas City",
  KS: "Kansas City",
  IL: "Chicago",
  TX: "Austin",
  CA: "Los Angeles",
  NY: "New York",
  FL: "Miami",
  PA: "Philadelphia",
  GA: "Atlanta",
  AZ: "Phoenix",
  NC: "Charlotte",
  MI: "Detroit",
  WI: "Milwaukee",
  NV: "Las Vegas",
  OH: "Columbus",
};

const SCRAPE_TYPES = [
  { id: "all", label: "All data" },
  { id: "candidates", label: "Candidates" },
  { id: "measures", label: "Measures" },
  { id: "officials", label: "Officials" },
  { id: "elections", label: "Elections" },
  { id: "enrich_bios", label: "Enrich bios" },
];

const DEFAULT_ZIPS = ["64108", "64110", "64111"];

const LIME = "#9BD34B";

type Status = "idle" | "running" | "error" | "success";

interface RunResults {
  candidates?: number;
  measures?: number;
  officials?: number;
  elections?: number;
  bios_enriched?: number;
}

interface RunHistoryItem {
  id: string;
  ts: Date;
  state: string;
  city: string;
  scrape_type: string;
  status: Status;
  results: RunResults;
}

export default function CivicIntelPage() {
  const [counts, setCounts] = useState({ candidates: 0, measures: 0, officials: 0, elections: 0 });
  const [state, setState] = useState("MO");
  const [city, setCity] = useState("Kansas City");
  const [zips, setZips] = useState<{ zip: string; active: boolean }[]>(
    DEFAULT_ZIPS.map((z) => ({ zip: z, active: true }))
  );
  const [newZip, setNewZip] = useState("");
  const [scrapeType, setScrapeType] = useState("all");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<RunResults>({});
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadCounts();
  }, []);

  useEffect(() => {
    setCity(STATE_DEFAULT_CITY[state] ?? "");
  }, [state]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const loadCounts = async () => {
    try {
      const [c, m, o, e] = await Promise.all([
        (supabase as any).from("ballotpedia_candidates").select("*", { count: "exact", head: true }).eq("election_year", 2026),
        (supabase as any).from("ballotpedia_ballot_measures").select("*", { count: "exact", head: true }).eq("election_year", 2026),
        (supabase as any).from("ballotpedia_officials").select("*", { count: "exact", head: true }),
        (supabase as any).from("ballotpedia_elections").select("*", { count: "exact", head: true }).eq("is_upcoming", true),
      ]);
      setCounts({
        candidates: c.count ?? 0,
        measures: m.count ?? 0,
        officials: o.count ?? 0,
        elections: e.count ?? 0,
      });
    } catch {
      // tables may not exist yet
    }
  };

  const appendLog = (line: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLog((prev) => [...prev, `[${ts}] ${line}`]);
  };

  const toggleZip = (zip: string) => {
    setZips((prev) => prev.map((z) => (z.zip === zip ? { ...z, active: !z.active } : z)));
  };

  const removeZip = (zip: string) => {
    setZips((prev) => prev.filter((z) => z.zip !== zip));
  };

  const addZip = () => {
    const z = newZip.trim();
    if (!/^\d{5}$/.test(z)) {
      toast.error("Enter a valid 5-digit zip");
      return;
    }
    if (zips.find((x) => x.zip === z)) {
      toast.error("Zip already added");
      return;
    }
    setZips((prev) => [...prev, { zip: z, active: true }]);
    setNewZip("");
  };

  const runScraper = async (overrideState?: string) => {
    const targetState = overrideState ?? state;
    const targetCity = overrideState ? STATE_DEFAULT_CITY[overrideState] ?? "" : city;
    const activeZips = zips.filter((z) => z.active).map((z) => z.zip);

    setStatus("running");
    setProgress(10);
    setResults({});
    appendLog(`▶ Starting scrape: ${targetState} / ${targetCity} / ${scrapeType}`);
    appendLog(`  Priority zips: ${activeZips.join(", ") || "(none)"}`);

    let prog = 10;
    const progTimer = setInterval(() => {
      prog = Math.min(prog + 7, 90);
      setProgress(prog);
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke("ballotpedia-scraper", {
        headers: { "x-scraper-secret": (import.meta.env.VITE_SCRAPER_SECRET as string) ?? "" },
        body: {
          state_code: targetState,
          city: targetCity,
          year: 2026,
          scrape_type: scrapeType,
          priority_zips: activeZips,
        },
      });

      clearInterval(progTimer);
      if (error) throw error;

      const r: RunResults = (data?.results ?? data) || {};
      setResults(r);
      setProgress(100);
      setStatus("success");
      appendLog(`✓ Done. C:${r.candidates ?? 0} M:${r.measures ?? 0} O:${r.officials ?? 0} E:${r.elections ?? 0} Bios:${r.bios_enriched ?? 0}`);
      setHistory((prev) => [
        { id: crypto.randomUUID(), ts: new Date(), state: targetState, city: targetCity, scrape_type: scrapeType, status: "success" as Status, results: r },
        ...prev,
      ].slice(0, 20));
      void loadCounts();
    } catch (err: any) {
      clearInterval(progTimer);
      setStatus("error");
      setProgress(0);
      appendLog(`✗ Error: ${err?.message ?? String(err)}`);
      setHistory((prev) => [
        { id: crypto.randomUUID(), ts: new Date(), state: targetState, city: targetCity, scrape_type: scrapeType, status: "error" as Status, results: {} },
        ...prev,
      ].slice(0, 20));
    }
  };

  const runAllActiveStates = async () => {
    appendLog(`▶▶ Running all ${STATES.length} states sequentially`);
    for (const s of STATES) {
      await runScraper(s);
    }
    appendLog(`▶▶ All states complete`);
  };

  const clearLog = () => {
    setLog([]);
    setResults({});
    setProgress(0);
    setStatus("idle");
  };

  const statusDot = {
    idle: "#6B7280",
    running: "#F59E0B",
    success: LIME,
    error: "#EF4444",
  }[status];

  const statusLabel = { idle: "Idle", running: "Running", success: "Idle", error: "Error" }[status];

  return (
    <div className="page-enter h-full flex flex-col gap-5 overflow-y-auto pr-1">
      <div>
        <h1 className="t-hero" style={{ fontSize: 36 }}>Civic Intel</h1>
        <div className="t-mono mt-1">Ballotpedia command panel · admin</div>
      </div>

      {/* Section 1 — Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Candidates", value: counts.candidates, sub: "2026" },
          { label: "Ballot Measures", value: counts.measures, sub: "2026" },
          { label: "Officials", value: counts.officials, sub: "all-time" },
          { label: "Elections", value: counts.elections, sub: "upcoming" },
        ].map((m) => (
          <div key={m.label} className="glass" style={{ padding: 16 }}>
            <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>{m.label}</div>
            <div className="font-display" style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginTop: 6, lineHeight: 1 }}>
              {m.value.toLocaleString()}
            </div>
            <div className="t-mono" style={{ fontSize: 10, marginTop: 6, color: "var(--text-muted)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Section 2 — Scrape configuration */}
      <div className="glass" style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="t-card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Scrape Configuration</div>
          <div className="flex items-center gap-2">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: statusDot }} />
            <span className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{statusLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="t-mono uppercase block mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)" }}>State</label>
            <select
              className="input-glass w-full"
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{ background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)", padding: "8px 10px", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }}
            >
              {STATES.map((s) => <option key={s} value={s} style={{ background: "#0a0a14" }}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="t-mono uppercase block mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)" }}>City</label>
            <input
              className="input-glass w-full"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)", padding: "8px 10px", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="t-mono uppercase block mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)" }}>Priority Zip Codes</label>
          <div className="flex flex-wrap gap-2 items-center">
            {zips.map((z) => (
              <button
                key={z.zip}
                onClick={() => toggleZip(z.zip)}
                className="t-mono inline-flex items-center gap-1.5 group"
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  border: `1px solid ${z.active ? LIME : "var(--border-glass)"}`,
                  background: z.active ? `${LIME}22` : "var(--bg-glass-1)",
                  color: z.active ? LIME : "var(--text-secondary)",
                }}
              >
                {z.zip}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); removeZip(z.zip); }}
                  className="opacity-50 hover:opacity-100"
                  style={{ marginLeft: 2 }}
                >
                  <X size={11} />
                </span>
              </button>
            ))}
            <div className="inline-flex items-center gap-1">
              <input
                value={newZip}
                onChange={(e) => setNewZip(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addZip()}
                placeholder="zip"
                className="t-mono"
                style={{
                  width: 60,
                  padding: "5px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  background: "var(--bg-glass-1)",
                  border: "1px solid var(--border-glass)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={addZip}
                className="inline-flex items-center justify-center"
                style={{ width: 24, height: 24, borderRadius: 999, background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)", color: "var(--text-secondary)" }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <label className="t-mono uppercase block mb-1.5" style={{ fontSize: 9, color: "var(--text-muted)" }}>Scrape Type</label>
          <div className="flex flex-wrap gap-1.5">
            {SCRAPE_TYPES.map((t) => {
              const active = scrapeType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setScrapeType(t.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    border: `1px solid ${active ? LIME : "var(--border-glass)"}`,
                    background: active ? `${LIME}1f` : "var(--bg-glass-1)",
                    color: active ? LIME : "var(--text-secondary)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runScraper()}
            disabled={status === "running"}
            className="inline-flex items-center gap-2"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: LIME,
              color: "#0a0a14",
              fontWeight: 600,
              fontSize: 13,
              opacity: status === "running" ? 0.6 : 1,
              cursor: status === "running" ? "not-allowed" : "pointer",
            }}
          >
            {status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run scraper
          </button>
          <button
            onClick={runAllActiveStates}
            disabled={status === "running"}
            className="inline-flex items-center gap-2"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "var(--bg-glass-2)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-glass)",
              fontWeight: 500,
              fontSize: 13,
              opacity: status === "running" ? 0.6 : 1,
            }}
          >
            <PlayCircle size={14} />
            Run all active states
          </button>
        </div>
      </div>

      {/* Section 3 — Activity log */}
      <div className="glass" style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="t-card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Activity Log</div>
          <button
            onClick={clearLog}
            className="t-mono"
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)", color: "var(--text-secondary)" }}
          >
            Clear
          </button>
        </div>

        <div
          ref={logRef}
          className="t-mono"
          style={{
            height: 220,
            overflowY: "auto",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--border-glass)",
            borderRadius: 8,
            padding: 12,
            fontSize: 11,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
          }}
        >
          {log.length === 0 ? (
            <span style={{ color: "var(--text-muted)" }}>No activity yet. Run a scrape to see output here.</span>
          ) : (
            log.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>

        <div className="mt-3">
          <div style={{ height: 4, background: "var(--bg-glass-1)", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: status === "error" ? "#EF4444" : LIME,
                transition: "width 300ms ease",
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { k: "candidates", label: "Candidates" },
            { k: "measures", label: "Measures" },
            { k: "officials", label: "Officials" },
            { k: "elections", label: "Elections" },
            { k: "bios_enriched", label: "Bios enriched" },
          ].map((r) => {
            const v = (results as any)[r.k] ?? 0;
            return (
              <div
                key={r.k}
                className="t-mono inline-flex items-center gap-1.5"
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: "var(--bg-glass-1)",
                  border: "1px solid var(--border-glass)",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                }}
              >
                <span>{r.label}</span>
                <span style={{ color: v > 0 ? LIME : "var(--text-muted)", fontWeight: 600 }}>{v}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4 — Schedule + History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass" style={{ padding: 20 }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: LIME }} />
            <div className="t-card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Schedule</div>
          </div>
          <div className="space-y-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <div className="flex justify-between"><span className="t-mono" style={{ color: "var(--text-muted)" }}>Daily incremental</span><span>03:00 UTC</span></div>
            <div className="flex justify-between"><span className="t-mono" style={{ color: "var(--text-muted)" }}>Weekly full refresh</span><span>Sun 04:00 UTC</span></div>
            <div className="flex justify-between"><span className="t-mono" style={{ color: "var(--text-muted)" }}>Bio enrichment</span><span>Every 6h</span></div>
            <div className="flex justify-between"><span className="t-mono" style={{ color: "var(--text-muted)" }}>Next run</span><span style={{ color: LIME }}>in ~4h</span></div>
          </div>
        </div>

        <div className="glass" style={{ padding: 20 }}>
          <div className="flex items-center gap-2 mb-3">
            <History size={14} style={{ color: LIME }} />
            <div className="t-card-title" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recent Runs</div>
          </div>
          {history.length === 0 ? (
            <div className="t-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>No runs yet this session.</div>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 t-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {h.status === "success" ? <CheckCircle2 size={12} style={{ color: LIME }} />
                    : h.status === "error" ? <AlertTriangle size={12} style={{ color: "#EF4444" }} />
                    : <Circle size={12} style={{ color: "var(--text-muted)" }} />}
                  <span style={{ color: "var(--text-muted)" }}>{h.ts.toLocaleTimeString("en-US", { hour12: false })}</span>
                  <span style={{ color: "var(--text-primary)" }}>{h.state}</span>
                  <span style={{ color: "var(--text-muted)" }}>·</span>
                  <span>{h.city}</span>
                  <span style={{ color: "var(--text-muted)" }}>·</span>
                  <span>{h.scrape_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
