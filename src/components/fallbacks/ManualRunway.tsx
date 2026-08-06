import { useState } from "react";
import { Desc } from "@/components/primitives";
import { EnteredBadge, FallbackFrame } from "@/components/Fallback";
import {
  clearManualRunway,
  fallbackFor,
  runwayMonths,
  setManualRunway,
  useEntered,
} from "@/lib/fallbacks";
import { money, moneyLong } from "@/data/raise";

/**
 * Runway → manual.
 *
 * Cash, burn and revenue are three numbers a founder already knows. An
 * empty card teaches them Kova can't help; a form that computes runway
 * from what they type teaches them it can — and gives Stripe a reason to
 * be connected later rather than a barrier to entry.
 */
export const ManualRunway = () => {
  const entered = useEntered();
  const saved = entered.runway;
  const [editing, setEditing] = useState(!saved);
  const [cash, setCash] = useState(saved ? String(saved.cash) : "");
  const [burn, setBurn] = useState(saved ? String(saved.burn) : "");
  const [revenue, setRevenue] = useState(saved ? String(saved.revenue) : "");

  const fb = fallbackFor("runway")!;
  const num = (s: string) => Number(s.replace(/[^0-9.\-]/g, ""));
  const valid = num(cash) > 0 && num(burn) > 0;

  const save = () => {
    setManualRunway({ cash: num(cash), burn: num(burn), revenue: num(revenue) || 0 });
    setEditing(false);
  };

  const months = saved ? runwayMonths(saved.cash, saved.burn, saved.revenue) : null;

  return (
    <FallbackFrame title="Runway" fallback={fb} missing="Stripe">
      {saved && !editing ? (
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <div className="vo-between">
            <span className="vo-stat">
              {months === null ? "No burn" : `${months} months`}
            </span>
            <EnteredBadge />
          </div>
          <Desc>
            {moneyLong(saved.cash)} cash, {money(saved.burn)}/mo out, {money(saved.revenue)}/mo
            in.{" "}
            {months === null
              ? "Revenue covers burn, so there is no cliff to count down to."
              : "cash ÷ (burn − revenue) — the same formula Stripe would be fed into."}
          </Desc>
          <div className="vo-row" style={{ gap: "var(--s-2)" }}>
            <button type="button" className="vo-btn" onClick={() => setEditing(true)}>
              Change these figures
            </button>
            <button
              type="button"
              className="vo-btn"
              onClick={() => {
                clearManualRunway();
                setEditing(true);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <label className="vo-field">
            <span className="vo-meta">Cash in the account</span>
            <input
              className="vo-input"
              inputMode="numeric"
              placeholder="412000"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </label>
          <label className="vo-field">
            <span className="vo-meta">Burn per month</span>
            <input
              className="vo-input"
              inputMode="numeric"
              placeholder="47500"
              value={burn}
              onChange={(e) => setBurn(e.target.value)}
            />
          </label>
          <label className="vo-field">
            <span className="vo-meta">Revenue per month</span>
            <input
              className="vo-input"
              inputMode="numeric"
              placeholder="0"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </label>
          <div className="vo-row" style={{ gap: "var(--s-2)" }}>
            <button
              type="button"
              className="vo-btn"
              data-variant="primary"
              disabled={!valid}
              onClick={save}
            >
              Compute runway
            </button>
            {saved ? (
              <button type="button" className="vo-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}
    </FallbackFrame>
  );
};

export default ManualRunway;
