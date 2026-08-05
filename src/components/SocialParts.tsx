import { Desc, Eyebrow, Tag } from "@/components/primitives";
import {
  Gap, MONTH, Platform, Post, REACH, Verdict, WeekReach, daysInMonth, iso, isWeekend,
  leadingBlanks, platformDef,
} from "@/data/social";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MonthGrid = ({ posts, gap }: { posts: Post[]; gap: Gap | null }) => {
  const { year, month } = MONTH;
  const total = daysInMonth(year, month);
  const blanks = leadingBlanks(year, month);
  const byDate = new Map<string, Post[]>();
  posts.forEach((p) => byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]));

  return (
    <div className="vo-month-grid">
      {DOW.map((d) => (
        <div key={d} className="vo-month-dow">
          {d}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        <div key={`b${i}`} className="vo-month-cell" data-outside="true" aria-hidden />
      ))}
      {Array.from({ length: total }, (_, i) => {
        const day = i + 1;
        const date = iso(year, month, day);
        const list = byDate.get(date) ?? [];
        const weekend = isWeekend(year, month, day);
        const inGap = !!gap && day >= gap.fromDay && day <= gap.toDay && !weekend;
        return (
          <div
            key={date}
            className="vo-month-cell"
            data-weekend={weekend ? "true" : undefined}
            data-gap={inGap ? "true" : undefined}
          >
            <span className="vo-month-num">{day}</span>
            {list.map((p) => {
              const def = platformDef(p.platform);
              return (
                <span
                  key={p.id}
                  className="vo-chip"
                  data-draft={p.status === "draft" ? "true" : undefined}
                  style={{ borderColor: def.color, color: def.color }}
                  title={`${def.label} · ${p.status} · ${p.title}`}
                >
                  <span className="vo-chip-dot" style={{ background: def.color }} />
                  {p.title}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const PlatformFilter = ({
  active,
  onToggle,
  counts,
}: {
  active: Platform[];
  onToggle: (p: Platform | "all") => void;
  counts: Record<string, number>;
}) => (
  <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
    <button
      type="button"
      className="vo-pill"
      data-active={active.length === 0 ? "true" : undefined}
      onClick={() => onToggle("all")}
    >
      All platforms
    </button>
    {(Object.keys(counts) as Platform[]).map((id) => {
      const def = platformDef(id);
      return (
        <button
          key={id}
          type="button"
          className="vo-pill"
          data-active={active.includes(id) ? "true" : undefined}
          onClick={() => onToggle(id)}
          style={{ borderColor: active.includes(id) ? def.color : undefined }}
        >
          <span className="vo-chip-dot" style={{ background: def.color }} />
          {def.label} · {counts[id]}
        </button>
      );
    })}
  </div>
);

/**
 * The mirror. Organic above the axis, paid below, one shared scale so the
 * two halves are comparable by eye. Two separate lines let substitution
 * and amplification draw the same picture.
 */
export const Mirror = ({ rows, verdict }: { rows: WeekReach[]; verdict: Verdict }) => {
  const max = Math.max(...rows.flatMap((r) => [r.organic, r.paid]));
  const h = (v: number) => `${(v / max) * 100}%`;

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-mirror">
        {rows.map((r) => (
          <div key={r.week} className="vo-mirror-col" title={`${r.week} — organic ${Math.round(r.organic / 1000)}K, paid ${Math.round(r.paid / 1000)}K`}>
            <div className="vo-mirror-half" data-side="up">
              <span className="vo-mirror-bar" data-side="up" style={{ height: h(r.organic) }} />
            </div>
            <div className="vo-mirror-axis" />
            <div className="vo-mirror-half" data-side="down">
              <span className="vo-mirror-bar" data-side="down" style={{ height: h(r.paid) }} />
            </div>
            <span className="vo-mirror-label">{r.week}</span>
          </div>
        ))}
      </div>
      <div className="vo-row" style={{ gap: "var(--s-3)" }}>
        <span className="vo-legend">
          <span className="vo-legend-swatch" data-side="up" /> Organic — reach earned
        </span>
        <span className="vo-legend">
          <span className="vo-legend-swatch" data-side="down" /> Paid — reach bought
        </span>
      </div>
      <div className="vo-verdict" data-tone={verdict.tone}>
        <strong>{verdict.headline}</strong>
        <p className="vo-desc" style={{ margin: 0 }}>{verdict.body}</p>
        <span className="vo-meta">
          First three weeks against the last three. One week is noise; three against three
          survives a single bad post.
        </span>
      </div>
    </div>
  );
};

export const QueueHealth = ({
  scheduled,
  drafts,
  published,
  gap,
}: {
  scheduled: number;
  drafts: number;
  published: number;
  gap: Gap | null;
}) => {
  const soft = drafts > scheduled;
  const total = Math.max(scheduled + drafts, 1);
  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div className="vo-between">
        <Eyebrow>Queue health</Eyebrow>
        <Tag tone={soft ? "warn" : "ok"}>{soft ? "Soft" : "Committed"}</Tag>
      </div>
      <div className="vo-split">
        <span className="vo-split-fill" data-kind="sched" style={{ width: `${(scheduled / total) * 100}%` }} />
        <span className="vo-split-fill" data-kind="draft" style={{ width: `${(drafts / total) * 100}%` }} />
      </div>
      <div className="vo-row" style={{ gap: "var(--s-4)" }}>
        <span className="vo-legend"><span className="vo-legend-swatch" data-kind="sched" /> {scheduled} scheduled</span>
        <span className="vo-legend"><span className="vo-legend-swatch" data-kind="draft" /> {drafts} draft</span>
        <span className="vo-meta">{published} already out</span>
      </div>
      <Desc>
        {soft
          ? "The calendar looks full but most of it isn't going anywhere yet — drafts outnumber scheduled posts, and a draft has no date attached to it."
          : "More scheduled than drafted. What you see on the calendar is what will actually go out."}
      </Desc>
      {gap ? (
        <div className="vo-verdict" data-tone="warn">
          <strong>Longest silence: {gap.days} working days — {gap.label}.</strong>
          <p className="vo-desc" style={{ margin: 0 }}>
            Weekends are excluded. Counting them would add two days to every gap and make
            them all look the same.
          </p>
        </div>
      ) : null}
    </div>
  );
};

export const reachTotals = (rows = REACH) => ({
  organic: rows.reduce((s, r) => s + r.organic, 0),
  paid: rows.reduce((s, r) => s + r.paid, 0),
  spend: rows.reduce((s, r) => s + r.spend, 0),
});
