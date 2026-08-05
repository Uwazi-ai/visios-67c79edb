import { throughput } from "@/data/ledger";
import { Card, Eyebrow, Stat, Face, Title } from "@/components/primitives";

/**
 * Throughput is derived at render time from the ledger, never precomputed —
 * that is what lets the workspace scope filter it.
 */

export const BarComb = ({ weeks, projection }: { weeks: number[]; projection: number }) => {
  const max = Math.max(...weeks, projection, 1);
  return (
    <div className="vo-bars" role="img" aria-label={`Weekly closes: ${weeks.join(", ")}. Projection ${projection}.`}>
      {weeks.map((v, i) => (
        <div key={i} className="vo-bar" style={{ height: `${(v / max) * 100}%` }} />
      ))}
      <div className="vo-bar" data-projected="true" style={{ height: `${(projection / max) * 100}%` }} />
    </div>
  );
};

export const VelocityChart = ({ scope }: { scope: string }) => {
  const t = throughput(scope);
  return (
    <Card span={7}>
      <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
        <Title>Throughput</Title>
        <span className="vo-meta">8 weeks · closed tasks</span>
      </div>
      <BarComb weeks={t.weeks} projection={t.projection} />
      <div className="vo-row" style={{ marginTop: "var(--s-4)", gap: "var(--s-6)" }}>
        <Stat value={t.total} label="Closed, 56d" />
        <Stat
          value={t.deltaPct === null ? "—" : `${t.deltaPct > 0 ? "+" : ""}${t.deltaPct}%`}
          label="Week over week"
          note={
            t.noisy
              ? "Under 40 closes — this percentage is noise"
              : "vs previous week"
          }
        />
        <Stat value={t.projection} label="Next week" note="Flat trailing mean, not a trend" />
      </div>
    </Card>
  );
};

export const WhoClosed = ({ scope }: { scope: string }) => {
  const t = throughput(scope);
  const top = t.byPerson.slice(0, 5);
  const max = Math.max(...top.map((p) => p.closes), 1);
  return (
    <Card span={5}>
      <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
        <Title>Who closed it</Title>
        <Eyebrow>56 days</Eyebrow>
      </div>
      <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
        {top.map((p) => (
          <div className="vo-row" key={p.name}>
            <Face initials={p.name.slice(0, 2).toUpperCase()} title={p.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vo-between">
                <span className="vo-desc" style={{ color: "var(--ink)" }}>
                  {p.name}
                </span>
                <span className="vo-meta">{p.closes}</span>
              </div>
              <div className="vo-track" style={{ marginTop: 4 }}>
                <i style={{ width: `${(p.closes / max) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
