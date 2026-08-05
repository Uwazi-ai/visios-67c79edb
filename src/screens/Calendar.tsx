import { useMemo, useState } from "react";
import { Bento, Card, Col, Desc, Eyebrow, SectionHead, Tag } from "@/components/primitives";
import { ConflictCard, WeekGrid } from "@/components/CalendarParts";
import {
  CALENDARS,
  EVENTS,
  conflicts,
  crossCalendarOverlaps,
} from "@/data/calendar";
import { useAppState } from "@/lib/AppState";

/**
 * Calendar — Mon–Fri, 9 AM to 4 PM, coloured by venture.
 *
 * The stored times stay 24-hour throughout; every label you can read went
 * through fmt12 on the way out. Conflicts are named below the grid rather
 * than left as two blocks that happen to touch.
 */
const Calendar = () => {
  const { orgs, inScope } = useAppState();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const scoped = useMemo(
    () => EVENTS.filter((e) => inScope(e.org) && !hidden[e.calendar]),
    [inScope, hidden],
  );

  const found = useMemo(() => conflicts(scoped), [scoped]);
  const cross = useMemo(() => crossCalendarOverlaps(scoped), [scoped]);
  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    found.forEach((c) => {
      s.add(c.a.id);
      s.add(c.b.id);
    });
    return s;
  }, [found]);

  const colorOf = (org: string) => orgs.find((o) => o.id === org)?.color ?? "var(--ws-all)";

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Calendar"
        action={<span className="vo-meta">{scoped.length} events · Mon–Fri, 9 AM to 4 PM</span>}
      />

      <Card>
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <div className="vo-between" style={{ flexWrap: "wrap" }}>
            <div className="vo-row" style={{ gap: "var(--s-3)", flexWrap: "wrap" }}>
              {orgs
                .filter((o) => o.id !== "all")
                .map((o) => (
                  <span key={o.id} className="vo-row" style={{ gap: 6 }}>
                    <span className="vo-orgdot" style={{ background: o.color }} />
                    <span className="vo-meta">{o.name}</span>
                  </span>
                ))}
            </div>
            <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
              {CALENDARS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="vo-calchip"
                  data-off={hidden[c.id] ? "true" : undefined}
                  onClick={() => setHidden((h) => ({ ...h, [c.id]: !h[c.id] }))}
                  title={hidden[c.id] ? `Show ${c.label}` : `Hide ${c.label}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <WeekGrid events={scoped} colorOf={colorOf} conflictIds={conflictIds} />
        </div>
      </Card>

      <Bento>
        <Col span={8}>
          <Card ungated={found.length > 0}>
            <ConflictCard list={found} crossCount={cross} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <Eyebrow>How this reads time</Eyebrow>
              <Desc>
                Every time on this screen is stored as a 24-hour string — "09:30", "14:00" —
                because sorting and slot matching both rely on those comparing correctly as
                text. Only the labels convert, and a flat hour drops its minutes: 9 AM, 2 PM,
                but 9:30 AM.
              </Desc>
              <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
                <Tag>09:00 → 9 AM</Tag>
                <Tag>09:30 → 9:30 AM</Tag>
                <Tag>14:00 → 2 PM</Tag>
              </div>
            </div>
          </Card>
        </Col>
      </Bento>
    </div>
  );
};

export default Calendar;
