import { Lock } from "lucide-react";
import { Eyebrow } from "@/components/primitives";
import { DAYS, Day } from "@/data/calendar";
import { BookingLink, HOUR_LABELS, readHeat } from "@/data/bookings";

/**
 * GuestPreview — permanently beside the config, dressed as somebody
 * else's browser. Burying this behind a preview button is exactly where
 * the mistakes hide: the wrong host name on a link only looks wrong when
 * you are looking at it.
 */
export const GuestPreview = ({ link, accent }: { link: BookingLink; accent: string }) => (
  <div className="vo-browser" aria-label="Guest preview">
    <div className="vo-browser-bar">
      <span className="vo-browser-dots" aria-hidden>
        <i /> <i /> <i />
      </span>
      <span className="vo-browser-url">
        <Lock size={10} aria-hidden /> kova.link/{link.slug}
      </span>
      <span className="vo-browser-tag">What the guest sees</span>
    </div>

    <div className="vo-browser-page">
      <div className="vo-guest-strip" style={{ background: accent }} aria-hidden />
      <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
        <span className="vo-guest-host">{link.hostName}</span>
        <h4 className="vo-guest-title">{link.title}</h4>
        <span className="vo-guest-meta">
          {link.duration} min · {link.where}
        </span>
        <p className="vo-guest-blurb">{link.blurb}</p>
      </div>

      <div className="vo-guest-slots">
        {["9:00 AM", "9:45 AM", "11:30 AM", "1:15 PM", "2:00 PM", "3:30 PM"].map((s) => (
          <span key={s} className="vo-guest-slot" style={{ borderColor: accent }}>
            {s}
          </span>
        ))}
      </div>

      <div className="vo-guest-cta" style={{ background: accent }}>
        Confirm {link.duration} minutes
      </div>
      <span className="vo-guest-foot">
        Earliest booking is {link.noticeDays === 0 ? "today" : `in ${link.noticeDays} day${link.noticeDays === 1 ? "" : "s"}`} ·{" "}
        {link.maxPerDay} per day
      </span>
    </div>
  </div>
);

/**
 * Heatmap — week by hour, shaded by open slots, with the finding written
 * out underneath. The shading is the evidence; the caption is the point.
 */
export const Heatmap = ({ link, accent }: { link: BookingLink; accent: string }) => {
  const heat = readHeat(link);
  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-heat">
        <div className="vo-heat-corner" />
        {HOUR_LABELS.map((h) => (
          <div key={h} className="vo-heat-hour">
            {h}
          </div>
        ))}
        {DAYS.map((day: Day) => (
          <div key={day} className="vo-heat-row" style={{ display: "contents" }}>
            <div className="vo-heat-day">{day}</div>
            {link.open[day].map((n, i) => (
              <div
                key={i}
                className="vo-heat-cell"
                data-empty={n === 0 ? "true" : undefined}
                title={`${day} ${HOUR_LABELS[i]} — ${n} open slot${n === 1 ? "" : "s"}`}
                style={{
                  background:
                    n === 0
                      ? undefined
                      : `color-mix(in srgb, ${accent} ${Math.round((n / Math.max(1, heat.peak)) * 78) + 12}%, transparent)`,
                }}
              >
                <span className="vo-heat-n">{n === 0 ? "" : n}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="vo-stack" style={{ gap: 2 }}>
        <Eyebrow>What the rules actually produce</Eyebrow>
        <p className="vo-heat-caption">{heat.caption}</p>
        <span className="vo-meta">
          Blank cells are closed, not merely booked — the noon row is closed by rule on every
          link here.
        </span>
      </div>
    </div>
  );
};
