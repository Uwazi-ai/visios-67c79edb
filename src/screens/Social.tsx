import { useMemo, useState } from "react";
import { Bento, Card, Col, SectionHead, Tag } from "@/components/primitives";
import { Mirror, MonthGrid, PlatformFilter, QueueHealth } from "@/components/SocialParts";
import { MONTH, PLATFORMS, POSTS, Platform, REACH, longestWeekdayGap, readMirror } from "@/data/social";
import { useAppState } from "@/lib/AppState";
import { SourceGate } from "@/components/SourceGate";
import { OrganicOnly } from "@/components/fallbacks/OrganicOnly";

/**
 * Social — a month of posts, the gaps named, and organic against paid on
 * a mirror rather than as two lines.
 */
const Social = () => {
  const { inScope } = useAppState();
  const [active, setActive] = useState<Platform[]>([]);

  const scoped = useMemo(() => POSTS.filter((p) => inScope(p.org)), [inScope]);
  const posts = useMemo(
    () => (active.length ? scoped.filter((p) => active.includes(p.platform)) : scoped),
    [scoped, active],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    PLATFORMS.forEach((p) => {
      c[p.id] = scoped.filter((s) => s.platform === p.id).length;
    });
    return c;
  }, [scoped]);

  const gap = useMemo(() => longestWeekdayGap(posts), [posts]);
  const verdict = useMemo(() => readMirror(REACH), []);

  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const drafts = posts.filter((p) => p.status === "draft").length;
  const published = posts.filter((p) => p.status === "published").length;

  const toggle = (p: Platform | "all") => {
    if (p === "all") return setActive([]);
    setActive((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Social"
        action={<span className="vo-meta">{MONTH.label} · {posts.length} posts</span>}
      />

      <Card>
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <div className="vo-between">
            <h3 className="vo-title">{MONTH.label}</h3>
            <Tag tone={gap && gap.days >= 4 ? "warn" : undefined}>
              {gap ? `${gap.days} working days silent — ${gap.label}` : "No gap over a day"}
            </Tag>
          </div>
          <PlatformFilter active={active} onToggle={toggle} counts={counts} />
          <MonthGrid posts={posts} gap={gap} />
          <span className="vo-meta">
            Dashed chips are drafts — no date has been committed to them. The shaded run is
            the longest stretch of working days with nothing going out.
          </span>
        </div>
      </Card>

      <Bento>
        <Col span={8}>
          <SourceGate capability="organic-vs-paid" fallback={<OrganicOnly rows={REACH} />}>
            <Card>
              <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
                <div className="vo-between">
                  <h3 className="vo-title">Organic vs paid</h3>
                  <Tag tone={verdict.tone}>Mirror · 12 weeks</Tag>
                </div>
                <Mirror rows={REACH} verdict={verdict} />
              </div>
            </Card>
          </SourceGate>
        </Col>
        <Col span={4}>
          <Card>
            <QueueHealth
              scheduled={scheduled}
              drafts={drafts}
              published={published}
              gap={gap}
            />
          </Card>
        </Col>
      </Bento>
    </div>
  );
};

export default Social;
