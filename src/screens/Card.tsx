import { useMemo, useState } from "react";
import { Bento, Card, Col, Desc, Eyebrow, SectionHead, Tag } from "@/components/primitives";
import { FlipCard, ScanAnalytics } from "@/components/CardParts";
import { CARDS, SCANS } from "@/data/cards";
import { useAppState } from "@/lib/AppState";

/**
 * Card — three cards, one per venture. Switching changes the name, role,
 * accent, email and domain, which is why they are three records rather
 * than one card wearing a dropdown.
 */
const CardScreen = () => {
  const { orgs, inScope, scope } = useAppState();
  const scopeName = orgs.find((o) => o.id === scope)?.name ?? "All organizations";
  const scoped = useMemo(() => CARDS.filter((c) => inScope(c.org)), [inScope]);
  const [selectedId, setSelectedId] = useState(scoped[0]?.id ?? CARDS[0].id);
  const [flipped, setFlipped] = useState(false);
  const card = scoped.find((c) => c.id === selectedId) ?? scoped[0];

  if (!card) {
    return (
      <div>
        <SectionHead title="Card" />
        <Card ungated>
          <div className="vo-empty">
            <Eyebrow>{scopeName}</Eyebrow>
            <Desc>No card for {scopeName}. Switch scope in the rail to see the rest.</Desc>
          </div>
        </Card>
      </div>
    );
  }

  const accent = orgs.find((o) => o.id === card.org)?.color ?? "var(--ws-all)";
  const rows = SCANS[card.id] ?? [];

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Card"
        action={<span className="vo-meta">{scoped.length} cards · one per venture</span>}
      />

      <div className="vo-linkbar">
        {scoped.map((c) => {
          const col = orgs.find((o) => o.id === c.org)?.color ?? "var(--ws-all)";
          return (
            <button
              key={c.id}
              type="button"
              className="vo-linkchip"
              data-active={c.id === card.id ? "true" : undefined}
              onClick={() => {
                setSelectedId(c.id);
                setFlipped(false);
              }}
              style={{ borderLeft: `3px solid ${col}` }}
            >
              <span className="vo-linkchip-title">{c.role.split(" — ")[1] ?? c.role}</span>
              <span className="vo-meta">{c.domain}</span>
            </button>
          );
        })}
      </div>

      <Bento>
        <Col span={5}>
          <FlipCard card={card} accent={accent} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          <Desc>
            The QR on the back resolves to {card.url} — the same address whether it was tapped,
            scanned or pasted, so the analytics below are one number rather than three.
          </Desc>
        </Col>

        <Col span={7}>
          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <h3 className="vo-title">Where this card travelled</h3>
                <Tag>{card.domain}</Tag>
              </div>
              <ScanAnalytics rows={rows} accent={accent} />
            </div>
          </Card>
        </Col>
      </Bento>
    </div>
  );
};

export default CardScreen;
