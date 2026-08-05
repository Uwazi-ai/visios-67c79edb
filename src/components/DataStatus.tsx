/**
 * Data mode strip.
 *
 * Two honest states, both stated in words:
 *
 *   "Sample data"          amber — generated fixtures, no key set
 *   "Live · 2 sources down" amber count — real reads, some of them failed
 *
 * The failures are named on hover. A count with no names tells you
 * something is wrong without telling you what, which is the same failure
 * as a bare red dot.
 */

import { useKovaData } from "@/data/live/KovaData";

const DataStatus = () => {
  const { mode, loading, sources, down, refresh } = useKovaData();

  if (loading) {
    return (
      <div className="vo-datamode" data-state="loading">
        <span className="vo-datamode-dot" />
        Checking sources
      </div>
    );
  }

  if (mode === "sample") {
    return (
      <div
        className="vo-datamode"
        data-state="sample"
        title="No key is set, so every number on screen is generated. Nothing here came from your workspace."
      >
        <span className="vo-datamode-dot" />
        Sample data
      </div>
    );
  }

  const live = sources.filter((s) => s.ok).length;

  if (down.length === 0) {
    return (
      <button className="vo-datamode" data-state="live" onClick={refresh} title={`${live} sources reading cleanly. Click to re-read.`}>
        <span className="vo-datamode-dot" />
        Live
      </button>
    );
  }

  return (
    <button
      className="vo-datamode"
      data-state="degraded"
      onClick={refresh}
      title={down.map((s) => `${s.label} — ${s.error}`).join("\n")}
    >
      <span className="vo-datamode-dot" />
      Live · {down.length} source{down.length === 1 ? "" : "s"} down
    </button>
  );
};

export default DataStatus;
