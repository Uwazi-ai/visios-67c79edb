import { useState } from "react";
import { Desc } from "@/components/primitives";
import { EnteredBadge, FallbackFrame } from "@/components/Fallback";
import {
  clearImportedCampaigns,
  fallbackFor,
  parseCampaignCsv,
  setImportedCampaigns,
  useEntered,
} from "@/lib/fallbacks";
import { usd } from "@/data/campaigns";

const SAMPLE_HEADER = "campaign,platform,spend,cpm,benchmark";

/**
 * Campaign metrics → import.
 *
 * An export exists; only the API isn't wired. A CSV from Ads Manager is
 * parsed into the same shape the API would have returned, so the card
 * downstream does not learn where the numbers came from — only the badge
 * says.
 */
export const CampaignImport = () => {
  const entered = useEntered();
  const saved = entered.campaigns;
  const [text, setText] = useState("");
  const [skipped, setSkipped] = useState<number | null>(null);
  const fb = fallbackFor("cpm")!;

  const load = () => {
    const { rows, skipped: bad } = parseCampaignCsv(text);
    setSkipped(bad);
    if (rows.length) {
      setImportedCampaigns(rows);
      setText("");
    }
  };

  return (
    <FallbackFrame title="Campaign metrics" fallback={fb} missing="Meta">
      {saved?.rows.length ? (
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <div className="vo-between">
            <span className="vo-meta">{saved.rows.length} campaigns imported</span>
            <EnteredBadge what="Imported by you" />
          </div>
          <div className="vo-stack" style={{ gap: 4 }}>
            {saved.rows.map((r) => {
              const dev = ((r.cpm - r.benchmark) / r.benchmark) * 100;
              return (
                <div key={`${r.name}-${r.platform}`} className="vo-between">
                  <span className="vo-title" style={{ fontSize: 13 }}>
                    {r.name} · {r.platform}
                  </span>
                  <span className="vo-meta">
                    {usd(r.spend)} · CPM {usd(r.cpm)} ·{" "}
                    {dev > 0 ? `${dev.toFixed(0)}% over` : `${Math.abs(dev).toFixed(0)}% under`}{" "}
                    benchmark
                  </span>
                </div>
              );
            })}
          </div>
          <Desc>
            Read from a file, not from the ad account — nothing here updates until you paste
            a newer export or connect Meta.
          </Desc>
          <button type="button" className="vo-btn" onClick={clearImportedCampaigns}>
            Clear import
          </button>
        </div>
      ) : (
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <label className="vo-field">
            <span className="vo-meta">Paste the CSV — header row included</span>
            <textarea
              className="vo-input"
              rows={5}
              placeholder={`${SAMPLE_HEADER}\nCivic pilot,LinkedIn,6400,28.5,35`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {skipped ? (
            <span className="vo-meta">
              {skipped} {skipped === 1 ? "row" : "rows"} had no usable CPM and were left out
              rather than counted as zero.
            </span>
          ) : null}
          <button
            type="button"
            className="vo-btn"
            data-variant="primary"
            disabled={!text.trim()}
            onClick={load}
          >
            Read the export
          </button>
        </div>
      )}
    </FallbackFrame>
  );
};

export default CampaignImport;
