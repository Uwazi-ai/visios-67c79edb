import { useMemo, useState } from "react";
import { Bento, Card, Col, Desc, Eyebrow, SectionHead, Tag } from "@/components/primitives";
import { GuestPreview, Heatmap } from "@/components/BookingsParts";
import { LINKS } from "@/data/bookings";
import { useAppState } from "@/lib/AppState";

/**
 * Bookings — one link per venture, each with its own duration, branding
 * and rules, and the guest view sitting permanently next to the config.
 */
const Bookings = () => {
  const { orgs, inScope, scope } = useAppState();
  const scopeName = orgs.find((o) => o.id === scope)?.name ?? "All organizations";
  const scoped = useMemo(() => LINKS.filter((l) => inScope(l.org)), [inScope]);
  const [selectedId, setSelectedId] = useState(scoped[0]?.id ?? LINKS[0].id);
  const link = scoped.find((l) => l.id === selectedId) ?? scoped[0];

  if (!link) {
    return (
      <div>
        <SectionHead title="Bookings" />
        <Card ungated>
          <div className="vo-empty">
            <Eyebrow>{scopeName}</Eyebrow>
            <Desc>No booking links for {scopeName}. Switch scope in the rail to see the rest.</Desc>
          </div>
        </Card>
      </div>
    );
  }

  const accent = orgs.find((o) => o.id === link.org)?.color ?? "var(--ws-all)";

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Bookings"
        action={<span className="vo-meta">{scoped.length} links · one per venture</span>}
      />

      <div className="vo-linkbar">
        {scoped.map((l) => {
          const c = orgs.find((o) => o.id === l.org)?.color ?? "var(--ws-all)";
          return (
            <button
              key={l.id}
              type="button"
              className="vo-linkchip"
              data-active={l.id === link.id ? "true" : undefined}
              onClick={() => setSelectedId(l.id)}
              style={{ borderLeft: `3px solid ${c}` }}
            >
              <span className="vo-linkchip-title">{l.title}</span>
              <span className="vo-meta">
                {l.hostName} · {l.duration} min
              </span>
            </button>
          );
        })}
      </div>

      <Bento>
        <Col span={7}>
          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <h3 className="vo-title">{link.title}</h3>
                <Tag>kova.link/{link.slug}</Tag>
              </div>

              <div className="vo-cfggrid">
                <Cfg label="Duration" value={`${link.duration} min`} />
                <Cfg label="Buffer" value={`${link.bufferMin} min`} />
                <Cfg label="Notice" value={link.noticeDays === 0 ? "Same day" : `${link.noticeDays} day${link.noticeDays === 1 ? "" : "s"}`} />
                <Cfg label="Cap" value={`${link.maxPerDay}/day`} />
                <Cfg label="Where" value={link.where} />
                <Cfg label="Host shown" value={link.hostName} />
              </div>

              <div className="vo-stack" style={{ gap: 4 }}>
                <Eyebrow>What the rules mean for a guest</Eyebrow>
                <ul className="vo-rules">
                  {link.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <h3 className="vo-title">Availability next week</h3>
                <Tag>open slots</Tag>
              </div>
              <Heatmap link={link} accent={accent} />
            </div>
          </Card>
        </Col>

        <Col span={5}>
          <GuestPreview link={link} accent={accent} />
          <Desc>
            The preview is not behind a button. A link that says the wrong venture on it only
            looks wrong when somebody is looking at it, and nobody clicks preview on the link
            they already believe is fine.
          </Desc>
        </Col>
      </Bento>
    </div>
  );
};

const Cfg = ({ label, value }: { label: string; value: string }) => (
  <div className="vo-cfg">
    <Eyebrow>{label}</Eyebrow>
    <span className="vo-cfg-value">{value}</span>
  </div>
);

export default Bookings;
