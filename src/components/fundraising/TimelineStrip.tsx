import { Opportunity } from "@/hooks/useFundraising";
import { TIMELINE_BUCKETS, TYPE_COLOR } from "./constants";

export function TimelineStrip({ opps }: { opps: Opportunity[] }) {
  return (
    <div
      className="rounded-xl p-4 overflow-x-auto"
      style={{ background: "#0e0e0e", border: "1px solid #1e1e1e" }}
    >
      <div className="t-mono uppercase mb-3" style={{ fontSize: 10, color: "var(--text-secondary)" }}>Timeline</div>
      <div className="flex gap-3 min-w-max">
        {TIMELINE_BUCKETS.map((b) => {
          const items = opps.filter((o) => b.match(o.deadline));
          return (
            <div key={b.label} className="flex flex-col gap-2 min-w-[140px]">
              <div className="font-display" style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{b.label}</div>
              <div className="flex flex-col gap-1.5">
                {items.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>—</div>
                )}
                {items.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-md px-2 py-1 truncate"
                    style={{
                      background: `${TYPE_COLOR[o.type] ?? "#5b9cf6"}22`,
                      border: `1px solid ${TYPE_COLOR[o.type] ?? "#5b9cf6"}55`,
                      color: TYPE_COLOR[o.type] ?? "#5b9cf6",
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                    title={o.name}
                  >
                    {o.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
