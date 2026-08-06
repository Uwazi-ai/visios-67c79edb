import { Desc } from "@/components/primitives";
import { FallbackFrame } from "@/components/Fallback";
import { fallbackFor } from "@/lib/fallbacks";
import { WeekReach } from "@/data/social";

/**
 * Organic vs paid → degrade.
 *
 * Without Meta there is no paid half, and organic alone cannot distinguish
 * amplification from substitution — the two look identical until you can
 * see both. So the organic line renders, the card labels itself half the
 * picture, and the verdict is withheld rather than guessed at.
 */
export const OrganicOnly = ({ rows }: { rows: WeekReach[] }) => {
  const fb = fallbackFor("organic-vs-paid")!;
  const max = Math.max(...rows.map((r) => r.organic), 1);

  return (
    <FallbackFrame title="Organic vs paid" fallback={fb} missing="Meta">
      <div className="vo-mirror" data-half="true">
        {rows.map((r) => (
          <div
            key={r.week}
            className="vo-mirror-col"
            title={`${r.week} — organic ${Math.round(r.organic / 1000)}K. Paid is not visible without Meta.`}
          >
            <div className="vo-mirror-half" data-side="up">
              <span
                className="vo-mirror-bar"
                data-side="up"
                style={{ height: `${(r.organic / max) * 100}%` }}
              />
            </div>
            <div className="vo-mirror-axis" />
            <div className="vo-mirror-half" data-side="down">
              <span className="vo-mirror-missing" aria-hidden />
            </div>
            <span className="vo-mirror-label">{r.week}</span>
          </div>
        ))}
      </div>
      <Desc>
        The space below the axis is empty because it is unknown, not because it is zero.
        Organic falling could mean spend is replacing it or that reach simply fell — the two
        draw the same line, so no verdict is given here.
      </Desc>
    </FallbackFrame>
  );
};

export default OrganicOnly;
