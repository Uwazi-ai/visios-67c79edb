import { useMemo } from "react";
import { Bento, Card, Col, SectionHead, Tag } from "@/components/primitives";
import { CpmDeviation, Funnel, Leaderboard, SpendSummary } from "@/components/CampaignsParts";
import { CAMPAIGNS, CREATIVES } from "@/data/campaigns";
import { useAppState } from "@/lib/AppState";
import { SourceGate } from "@/components/SourceGate";
import { CampaignImport } from "@/components/fallbacks/CampaignImport";

/**
 * Campaigns — CPM against each platform's own benchmark, the funnel, and
 * creatives scored with the decision bands drawn on the track.
 */
const Campaigns = () => {
  const { inScope } = useAppState();
  const rows = useMemo(() => CAMPAIGNS.filter((c) => inScope(c.org)), [inScope]);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Campaigns"
        action={<span className="vo-meta">{rows.length} campaigns · {rows.filter((r) => r.status === "live").length} live</span>}
      />

      <Bento>
        <Col span={7}>
          <SourceGate capability="cpm" fallback={<CampaignImport />}>
          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <h3 className="vo-title">CPM against benchmark</h3>
                <Tag>Centre line = its own benchmark</Tag>
              </div>
              <SpendSummary rows={rows} />
              <CpmDeviation rows={rows} />
            </div>
          </Card>
          </SourceGate>
        </Col>
        <Col span={5}>
          <SourceGate capability="funnel" fallback={<CampaignImport />}>
            <Card>
              <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
                <h3 className="vo-title">Performance funnel</h3>
                <Funnel />
              </div>
            </Card>
          </SourceGate>
        </Col>
      </Bento>

      <SourceGate capability="creative-leaderboard" fallback={<CampaignImport />}>
      <Card>
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <div className="vo-between">
            <h3 className="vo-title">Creative leaderboard</h3>
            <Tag>Scored 0–100 · bands at 50 and 75</Tag>
          </div>
          <Leaderboard rows={CREATIVES} />
        </div>
      </Card>
      </SourceGate>
    </div>
  );
};

export default Campaigns;
