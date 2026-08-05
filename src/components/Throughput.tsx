import { comb, throughput, velocity, RECORDED_DAYS, PROJECTED_DAYS } from "@/data/ledger";
import { Card, Eyebrow, Stat, Face, Title } from "@/components/primitives";
import { useKovaData } from "@/data/live/KovaData";

/**
 * Throughput and velocity.
 *
 * Everything here derives from the task ledger at render time, never
 * precomputed — that is what lets the workspace scope filter it. Change
 * scope and the same rows produce a different comb.
 */

/** 46 bars: 30 recorded bright, 16 projected dim. */
export const BarComb = ({
  recorded,
  projected,
}: {
  recorded: number[];
  projected: number[];
}) => {
  const max = Math.max(...recorded, ...projected, 1);
  return (
    <div
      className="vo-comb"
      role="img"
      aria-label={`${recorded.length} recorded days of closes, then ${projected.length} projected days held flat at ${projected[0]?.toFixed(1) ?? 0} per day.`}
    >
      {recorded.map((v, i) => (
        <div key={`r${i}`} className="vo-comb-bar" style={{ height: `${(v / max) * 100}%` }} />
      ))}
      {projected.map((v, i) => (
        <div
          key={`p${i}`}
          className="vo-comb-bar"
          data-projected="true"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
};

export const ThroughputCard = ({ scope }: { scope: string }) => {
  const { ledger } = useKovaData();
  const c = comb(scope, ledger);
  const t = throughput(scope, ledger);

  return (
    <Card span={12}>
      <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
        <Title>Closed tasks per day</Title>
        <span className="vo-meta">
          {RECORDED_DAYS} days recorded · {PROJECTED_DAYS} projected
        </span>
      </div>

      <BarComb recorded={c.recorded} projected={c.projected} />

      <p className="vo-meta" style={{ marginTop: "var(--s-3)" }}>
        Projection is a flat trailing 10-day mean. No trend is baked in — a
        projection with growth in it reads as a forecast nobody approved.
      </p>

      <div className="vo-row vo-throughput-stats">
        <Stat value={c.closes} label={`Closed, ${RECORDED_DAYS}d`} />
        <Stat
          value={c.mean.toFixed(1)}
          label="Projected per day"
          note="Flat trailing 10-day mean"
        />
        <Stat
          value={t.deltaPct === null ? "—" : `${t.deltaPct > 0 ? "+" : ""}${t.deltaPct}%`}
          label="Week over week"
          note={t.deltaPct === null ? "Sample too thin to quote" : "vs previous week"}
        />
      </div>

      {/* Small orgs always produce dramatic percentages. A founder acting on
          a fake +36% is worse served than one told the sample is thin. */}
      {c.thin ? (
        <p className="vo-note" data-tone="warn">
          Only {c.closes} closes in scope — treat the percentage as noise.
        </p>
      ) : null}
    </Card>
  );
};

/**
 * Velocity — 40 days, area chart, floating peak and low markers on dashed
 * stems. The marker indices are found in the data. Hardcode a position and
 * swapping the data leaves the annotation pointing at the wrong day.
 */
export const VelocityChart = ({ scope }: { scope: string }) => {
  const { ledger } = useKovaData();
  const v = velocity(scope, ledger);
  const W = 720;
  const H = 180;
  const PAD_T = 28;
  const PAD_B = 18;
  const max = Math.max(...v.days, 1);

  const x = (i: number) => (i / (v.days.length - 1)) * W;
  const y = (n: number) => PAD_T + (1 - n / max) * (H - PAD_T - PAD_B);

  const line = v.days.map((n, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H - PAD_B} L0,${H - PAD_B} Z`;

  const Marker = ({ idx, kind }: { idx: number; kind: "peak" | "low" }) => {
    const px = x(idx);
    const py = y(v.days[idx]);
    const stemTop = kind === "peak" ? PAD_T - 20 : Math.min(py + 26, H - 2);
    const anchor = px < 70 ? "start" : px > W - 70 ? "end" : "middle";
    return (
      <g className="vo-marker" data-kind={kind}>
        <line x1={px} y1={py} x2={px} y2={stemTop} strokeDasharray="3 3" />
        <circle cx={px} cy={py} r={3.5} />
        <text x={px} y={kind === "peak" ? stemTop - 4 : stemTop + 10} textAnchor={anchor}>
          {kind === "peak" ? "Peak" : "Low"} {v.days[idx]} · {v.labels[idx]}
        </text>
      </g>
    );
  };

  return (
    <Card span={12}>
      <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
        <Title>Daily closes, peak and low</Title>
        <Eyebrow>40 days</Eyebrow>
      </div>
      <svg
        className="vo-area"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily closes over 40 days. Peak ${v.peak} on ${v.labels[v.peakIdx]}, low ${v.low} on ${v.labels[v.lowIdx]}.`}
      >
        <defs>
          <linearGradient id="kova-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--a-500)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--a-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="vo-area-fill" d={area} />
        <path className="vo-area-line" d={line} />
        <Marker idx={v.peakIdx} kind="peak" />
        <Marker idx={v.lowIdx} kind="low" />
      </svg>
      <p className="vo-meta" style={{ marginTop: "var(--s-2)" }}>
        Markers are the real max and min indices in the current scope, not fixed positions.
      </p>
    </Card>
  );
};

export const WhoClosed = ({ scope }: { scope: string }) => {
  const { ledger } = useKovaData();
  const t = throughput(scope, ledger);
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
                <span className="vo-desc" style={{ color: "var(--text)" }}>
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
