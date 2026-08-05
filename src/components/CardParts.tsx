import { QRCodeSVG } from "qrcode.react";
import { Mail, Phone, Globe } from "lucide-react";
import { Eyebrow } from "@/components/primitives";
import { DigitalCard, Scan, VIA_LABEL, totals } from "@/data/cards";

/**
 * FlipCard — front is the identity, back is the QR. Tap flips it, and it
 * flips on Enter and Space too, because it is a button and behaving like
 * one is free.
 */
export const FlipCard = ({
  card,
  accent,
  flipped,
  onFlip,
}: {
  card: DigitalCard;
  accent: string;
  flipped: boolean;
  onFlip: () => void;
}) => (
  <button
    type="button"
    className="vo-flip"
    data-flipped={flipped ? "true" : undefined}
    onClick={onFlip}
    aria-pressed={flipped}
    aria-label={flipped ? `${card.name} card, showing QR. Tap to flip back.` : `${card.name} card. Tap to show QR.`}
  >
    <span className="vo-flip-inner">
      <span className="vo-flip-face" style={{ borderTop: `3px solid ${accent}` }}>
        <span className="vo-card-name">{card.name}</span>
        <span className="vo-card-role" style={{ color: accent }}>
          {card.role}
        </span>
        <span className="vo-card-tag">{card.tagline}</span>
        <span className="vo-card-lines">
          <span>
            <Mail size={12} aria-hidden /> {card.email}
          </span>
          <span>
            <Phone size={12} aria-hidden /> {card.phone}
          </span>
          <span>
            <Globe size={12} aria-hidden /> {card.domain}
          </span>
        </span>
        <span className="vo-card-hint">Tap to flip</span>
      </span>

      <span className="vo-flip-face vo-flip-back" style={{ borderTop: `3px solid ${accent}` }}>
        <span className="vo-qr">
          <QRCodeSVG value={card.url} size={132} bgColor="var(--qr-paper)" fgColor="var(--qr-ink)" level="M" />
        </span>
        <span className="vo-card-url">{card.url}</span>
        <span className="vo-card-hint">Tap to flip back</span>
      </span>
    </span>
  </button>
);

/**
 * ScanAnalytics — which card people opened, and where you handed it over.
 * "Followed" is a saved contact or a reply; scans without it are a number
 * that flatters you.
 */
export const ScanAnalytics = ({ rows, accent }: { rows: Scan[]; accent: string }) => {
  const t = totals(rows);
  const peak = Math.max(...rows.map((r) => r.scans), 1);
  const best = [...rows].sort((a, b) => b.followed / b.scans - a.followed / a.scans)[0];

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-row" style={{ gap: "var(--s-5)" }}>
        <span className="vo-stack" style={{ gap: 2 }}>
          <Eyebrow>Opens</Eyebrow>
          <span className="vo-stat">{t.scans}</span>
        </span>
        <span className="vo-stack" style={{ gap: 2 }}>
          <Eyebrow>Went somewhere</Eyebrow>
          <span className="vo-stat">{t.followed}</span>
        </span>
        <span className="vo-stack" style={{ gap: 2 }}>
          <Eyebrow>Rate</Eyebrow>
          <span className="vo-stat">{t.rate}%</span>
        </span>
      </div>

      <div className="vo-scanlist">
        {rows.map((r) => {
          const rate = Math.round((r.followed / r.scans) * 100);
          return (
            <div key={r.place} className="vo-scan">
              <div className="vo-between">
                <span className="vo-scan-place">{r.place}</span>
                <span className="vo-meta">
                  {r.scans} opens · {r.followed} followed · {r.when}
                </span>
              </div>
              <div className="vo-scan-bar">
                <span
                  className="vo-scan-fill"
                  style={{ width: `${(r.scans / peak) * 100}%`, background: accent }}
                />
                <span className="vo-scan-follow" style={{ width: `${(r.followed / peak) * 100}%` }} />
              </div>
              <span className="vo-meta">
                {VIA_LABEL[r.via]} · {rate}% went somewhere
              </span>
            </div>
          );
        })}
      </div>

      {best ? (
        <p className="vo-desc">
          <strong>{best.place}</strong> converts best at{" "}
          {Math.round((best.followed / best.scans) * 100)}%. Volume and value are not the same
          row here — the widest bar is rarely the one worth repeating.
        </p>
      ) : null}
    </div>
  );
};
