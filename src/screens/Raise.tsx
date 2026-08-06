import { useMemo, useState } from "react";
import { Bento, Card, Col, Desc, Eyebrow, SectionHead, Tag } from "@/components/primitives";
import { CapGauge, Ladder, OppRow, RunwayCard } from "@/components/RaiseParts";
import { OPPS, STAGES, money, rollUp } from "@/data/raise";
import { useAppState } from "@/lib/AppState";
import { SourceGate } from "@/components/SourceGate";
import { ManualRunway } from "@/components/fallbacks/ManualRunway";

/**
 * Raise — money in play, a hard cap you can count, and runway in months
 * rather than a percentage.
 */
const Raise = () => {
  const { orgs, inScope } = useAppState();
  const scoped = useMemo(() => OPPS.filter((o) => inScope(o.org)), [inScope]);
  const [stage, setStage] = useState<string | null>(null);

  const rolls = useMemo(() => rollUp(scoped), [scoped]);
  const colorOf = (id: string) => orgs.find((o) => o.id === id)?.color ?? "var(--ws-all)";
  const total = scoped.reduce((s, o) => s + o.amount, 0);
  const shown = stage ? scoped.filter((o) => o.stage === stage) : scoped;
  const stageLabel = STAGES.find((s) => s.id === stage)?.label;

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Raise"
        action={
          <span className="vo-meta">
            {money(total)} in play · {scoped.length} open
          </span>
        }
      />

      <Card>
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <div className="vo-between">
            <h3 className="vo-title">Pipeline</h3>
            <Tag>Sized by money</Tag>
          </div>
          <Ladder rolls={rolls} colorOf={colorOf} selected={stage} onSelect={setStage} />
        </div>
      </Card>

      <Bento>
        <Col span={7}>
          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <h3 className="vo-title">{stageLabel ?? "Every opportunity"}</h3>
                {stage ? (
                  <button type="button" className="vo-btn" onClick={() => setStage(null)}>
                    Show all
                  </button>
                ) : (
                  <span className="vo-meta">Click a rung to filter</span>
                )}
              </div>
              {stage ? (
                <Desc>Leaves this stage when: {STAGES.find((s) => s.id === stage)?.exit}.</Desc>
              ) : null}
              <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
                {shown.length ? (
                  [...shown]
                    .sort((a, b) => b.amount - a.amount)
                    .map((o) => <OppRow key={o.id} opp={o} color={colorOf(o.org)} />)
                ) : (
                  <div className="vo-empty">
                    <Eyebrow>Nothing at this stage</Eyebrow>
                    <Desc>
                      The rung still has width because an empty stage is a finding. This one
                      is where deals should be arriving from {STAGES[Math.max(0, STAGES.findIndex((s) => s.id === stage) - 1)]?.label}.
                    </Desc>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col span={5}>
          <Card>
            <CapGauge used={scoped.length} />
          </Card>
          <SourceGate capability="runway" fallback={<ManualRunway />}>
            <Card>
              <RunwayCard />
            </Card>
          </SourceGate>
        </Col>
      </Bento>
    </div>
  );
};

export default Raise;
