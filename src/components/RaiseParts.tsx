import { Desc, Eyebrow, Tag } from "@/components/primitives";
import { Opportunity, RUNWAY, StageRoll, TIER, money, moneyLong } from "@/data/raise";

/**
 * The ladder. Segment width is money in play; the label carries the count
 * so the two never get confused for one another.
 */
export const Ladder = ({
  rolls,
  colorOf,
  selected,
  onSelect,
}: {
  rolls: StageRoll[];
  colorOf: (org: string) => string;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const total = rolls.reduce((s, r) => s + r.amount, 0);
  const top = Math.max(...rolls.map((r) => r.amount), 1);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-ladder" role="list">
        {rolls.map((r) => (
          <button
            key={r.stage.id}
            type="button"
            role="listitem"
            className="vo-rung"
            style={{ width: `${r.width}%` }}
            data-empty={r.amount === 0 ? "true" : undefined}
            data-active={selected === r.stage.id ? "true" : undefined}
            onClick={() => onSelect(selected === r.stage.id ? null : r.stage.id)}
            title={`${r.stage.label} — ${moneyLong(r.amount)} across ${r.count} ${
              r.count === 1 ? "opportunity" : "opportunities"
            }. Leaves when: ${r.stage.exit}.`}
          >
            <span
              className="vo-rung-fill"
              style={{ height: `${Math.max(8, (r.amount / top) * 100)}%` }}
            />
            <span className="vo-rung-money">{r.amount ? money(r.amount) : "—"}</span>
            <span className="vo-rung-label">{r.stage.label}</span>
            <span className="vo-rung-count">
              {r.count === 0 ? "empty" : `${r.count} deal${r.count === 1 ? "" : "s"}`}
            </span>
          </button>
        ))}
      </div>
      <Desc>
        Width is money in play, not deal count — {money(total)} across the board. Empty
        stages hold a 4% floor so a rung with nothing on it stays visible; an empty
        Diligence is a finding, not an absence.
      </Desc>
    </div>
  );
};

export const OppRow = ({
  opp,
  color,
}: {
  opp: Opportunity;
  color: string;
}) => (
  <div className="vo-opp" style={{ borderLeftColor: color }}>
    <div className="vo-stack" style={{ gap: 2 }}>
      <span className="vo-opp-name">{opp.name}</span>
      <span className="vo-meta">
        {opp.kind} · {opp.next}
      </span>
    </div>
    <div className="vo-row" style={{ gap: "var(--s-2)" }}>
      {opp.quiet >= 14 ? <Tag tone="warn">{opp.quiet}d quiet</Tag> : null}
      <span className="vo-opp-amt">{money(opp.amount)}</span>
    </div>
  </div>
);

/**
 * Ten dots, not a percentage bar. You cannot half-open an opportunity, and
 * a bar at 90% does not tell you that one slot is left.
 */
export const CapGauge = ({ used }: { used: number }) => {
  const atCap = used >= TIER.cap;
  const lastOne = used === TIER.cap - 1;

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-between">
        <Eyebrow>Opportunities · {TIER.name} tier</Eyebrow>
        <span className="vo-meta">
          {used} of {TIER.cap}
        </span>
      </div>
      <div className="vo-dots" role="img" aria-label={`${used} of ${TIER.cap} opportunities used`}>
        {Array.from({ length: TIER.cap }, (_, i) => (
          <span
            key={i}
            className="vo-dot"
            data-filled={i < used ? "true" : undefined}
            data-edge={i === TIER.cap - 1 && (atCap || lastOne) ? "true" : undefined}
          />
        ))}
      </div>
      {atCap ? (
        <div className="vo-capnote" data-tone="cap">
          <strong>You are at the cap.</strong> The eleventh deal has nowhere to go — Kova will
          not silently drop it or quietly stop counting. {TIER.next} raises this to{" "}
          {TIER.nextCap} for {TIER.price}.
          <div className="vo-row" style={{ marginTop: "var(--s-2)" }}>
            <button type="button" className="vo-btn" data-variant="primary">
              Upgrade to {TIER.next}
            </button>
            <button type="button" className="vo-btn">
              Close one instead
            </button>
          </div>
        </div>
      ) : lastOne ? (
        <div className="vo-capnote" data-tone="warn">
          One slot left. The next deal you source fills it.
        </div>
      ) : (
        <Desc>
          {TIER.cap - used} slots left. Closed and lost deals keep their history but stop
          counting against this.
        </Desc>
      )}
    </div>
  );
};

/**
 * Runway as discrete months. A percentage bar reads as progress; months
 * read as things you can count down, which is what they are.
 */
export const RunwayCard = () => {
  const blocks = 12;
  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-between">
        <Eyebrow>Runway</Eyebrow>
        <span className="vo-meta">
          {moneyLong(RUNWAY.cash)} at {moneyLong(RUNWAY.burn)}/mo
        </span>
      </div>
      <div className="vo-stat">{RUNWAY.months} months</div>
      <div className="vo-months" role="img" aria-label={`${RUNWAY.months} months of cover`}>
        {Array.from({ length: blocks }, (_, i) => (
          <span
            key={i}
            className="vo-month"
            data-state={
              i < RUNWAY.months
                ? "covered"
                : i < RUNWAY.monthsWithCommitted
                  ? "committed"
                  : "gone"
            }
            title={
              i < RUNWAY.months
                ? "Covered by cash on hand"
                : i < RUNWAY.monthsWithCommitted
                  ? "Only if the committed money lands"
                  : "Past the cliff"
            }
          />
        ))}
      </div>
      <div className="vo-cliff">
        <span className="vo-cliff-mark" />
        <span>
          Cliff is <strong>{RUNWAY.cliff}</strong> — a date, not a fraction, because that is
          what you plan against.
        </span>
      </div>
      <Desc>
        The two lighter blocks are {money(RUNWAY.committedUnfunded)} committed and unfunded.
        They are drawn differently because a wire that has not arrived is not runway.
      </Desc>
    </div>
  );
};
