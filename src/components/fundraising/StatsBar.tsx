import { Opportunity } from "@/hooks/useFundraising";

export function StatsBar({ opps }: { opps: Opportunity[] }) {
  const target = 2_750_000;
  const pipeline = opps.length;
  const active = opps.filter((o) => o.status === "applied" || o.status === "in review" || o.status === "drafting").length;
  const committed = opps.reduce((s, o) => s + Number(o.committed_amount ?? 0), 0);

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${Math.round(n / 1000)}K` : `$${n}`;

  const tiles = [
    { label: "Capital Target", value: fmt(target), accent: "#9bd34b" },
    { label: "Pipeline", value: pipeline.toString(), accent: "#fff" },
    { label: "Active Applications", value: active.toString(), accent: "#e5b84a" },
    { label: "Committed", value: fmt(committed), accent: "#9bd34b" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl p-4"
          style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}
        >
          <div className="t-mono uppercase" style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.label}</div>
          <div className="font-display mt-2" style={{ fontSize: 28, fontWeight: 700, color: t.accent, letterSpacing: "-0.02em" }}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  );
}
