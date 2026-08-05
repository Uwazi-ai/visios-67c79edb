import { Desc, Eyebrow, Tag } from "@/components/primitives";
import {
  BANDS, BAND_LABEL, Campaign, Creative, FUNNEL, bandOf, deviation, usd,
} from "@/data/campaigns";

/**
 * CPM as deviation from each platform's own benchmark. Left and green when
 * under, right and amber when over. LinkedIn at $28.50 is the widest green
 * bar on the board; on an absolute chart it is the tallest bar and reads
 * as the worst buy.
 */
export const CpmDeviation = ({ rows }: { rows: Campaign[] }) => {
  const worst = Math.max(...rows.map((c) => Math.abs(deviation(c))), 25);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-devgrid">
        {rows.map((c) => {
          const d = deviation(c);
          const under = d < 0;
          const w = (Math.abs(d) / worst) * 50;
          return (
            <div key={c.id} className="vo-devrow">
              <div className="vo-devname">
                <span className="vo-chip-dot" style={{ background: c.color }} />
                <span>{c.platform}</span>
                <span className="vo-meta">{usd(c.cpm)} CPM</span>
              </div>
              <div className="vo-devtrack">
                <span className="vo-devcentre" />
                <span
                  className="vo-devbar"
                  data-under={under ? "true" : undefined}
                  style={
                    under
                      ? { right: "50%", width: `${w}%` }
                      : { left: "50%", width: `${w}%` }
                  }
                />
              </div>
              <div className="vo-devnum" data-under={under ? "true" : undefined}>
                {under ? "−" : "+"}
                {Math.abs(Math.round(d))}%
              </div>
            </div>
          );
        })}
      </div>
      <div className="vo-row" style={{ gap: "var(--s-3)" }}>
        <span className="vo-legend"><span className="vo-legend-swatch" data-kind="under" /> Under its own benchmark</span>
        <span className="vo-legend"><span className="vo-legend-swatch" data-kind="over" /> Over it</span>
      </div>
      <Desc>
        The centre line is each platform's own benchmark, not a shared price. LinkedIn's{" "}
        {usd(28.5)} looks expensive next to X at {usd(6.1)} and is the best buy here,
        because LinkedIn normally costs {usd(35)}. A plain bar chart says the opposite.
      </Desc>
    </div>
  );
};

export const Funnel = () => {
    const fmt = (n: number) =>
    n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  return (
    <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
      {FUNNEL.map((s, i) => {
        const prev = i === 0 ? null : FUNNEL[i - 1];
        const rate = prev ? (s.value / prev.value) * 100 : 100;
        return (
          <div key={s.label} className="vo-funnel-step">
            <div className="vo-between">
              <span className="vo-funnel-label">{s.label}</span>
              <span className="vo-funnel-value">{fmt(s.value)}</span>
            </div>
            {/* The bar is the step-over-step rate, not the share of impressions.
                Against 1.84M served, every stage below Clicks draws as a
                hairline and the funnel stops saying anything. */}
            <div className="vo-funnel-track">
              <span className="vo-funnel-fill" style={{ width: `${rate}%` }} />
            </div>
            <span className="vo-meta">
              {prev ? `${rate.toFixed(1)}% of ${prev.label.toLowerCase()} · ` : ""}
              {s.note}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Scores with the bands drawn on the track. A 74 and a 76 sit one point
 * apart in a ranked list and on opposite sides of a decision — without the
 * thresholds marked, the list invites you to treat them the same.
 */
export const Leaderboard = ({ rows }: { rows: Creative[] }) => (
  <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
    {[...rows]
      .sort((a, b) => b.score - a.score)
      .map((c) => {
        const band = bandOf(c.score);
        return (
          <div key={c.id} className="vo-lead">
            <div className="vo-between">
              <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                <span className="vo-chip-dot" style={{ background: c.color }} />
                <span className="vo-opp-name">{c.name}</span>
              </div>
              <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                <Tag tone={band === "scale" ? "ok" : band === "kill" ? "risk" : "warn"}>
                  {BAND_LABEL[band]}
                </Tag>
                <span className="vo-lead-score">{c.score}</span>
              </div>
            </div>
            <div className="vo-lead-track">
              <span className="vo-lead-fill" data-band={band} style={{ width: `${c.score}%` }} />
              <span className="vo-lead-mark" style={{ left: `${BANDS.kill}%` }} data-label="50" />
              <span className="vo-lead-mark" style={{ left: `${BANDS.scale}%` }} data-label="75" />
            </div>
            <span className="vo-meta">
              {c.campaign} · {usd(c.spend)} spent · ${c.cpl} per lead
            </span>
          </div>
        );
      })}
    <Desc>
      The two ticks are 50 and 75. Everything below 50 gets cut, everything above 75 gets
      more money, and the band between them is the one you rewrite rather than fund.
    </Desc>
  </div>
);

export const SpendSummary = ({ rows }: { rows: Campaign[] }) => {
  const spend = rows.reduce((s, c) => s + c.spend, 0);
  const under = rows.filter((c) => deviation(c) < 0).length;
  return (
    <div className="vo-row" style={{ gap: "var(--s-4)" }}>
      <div>
        <Eyebrow>Spend this month</Eyebrow>
        <div className="vo-stat">{usd(spend)}</div>
      </div>
      <div>
        <Eyebrow>Under benchmark</Eyebrow>
        <div className="vo-stat">
          {under}/{rows.length}
        </div>
      </div>
    </div>
  );
};
