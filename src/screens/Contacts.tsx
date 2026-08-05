import { useMemo, useState } from "react";
import { Bento, Button, Card, Col, Desc, Eyebrow, Face, SectionHead, Tag, Title } from "@/components/primitives";
import { Found, ProvenanceCard, Track } from "@/components/ContactsParts";
import { CONTACTS, ENRICHMENT_RULE, verdict } from "@/data/contacts";
import { useAppState } from "@/lib/AppState";

/**
 * Contacts — a scanned card is a timestamp and a location, nothing more.
 * Everything else on this screen is derived, and the screen says which is
 * which. The provenance block is the argument: three independent signals,
 * shown apart, and a claim only when two of them agree.
 */
const Contacts = ({ navigate }: { navigate: (id: string) => void }) => {
  const { orgs, inScope } = useAppState();
  const scoped = useMemo(() => CONTACTS.filter((c) => inScope(c.org)), [inScope]);
  const [selectedId, setSelectedId] = useState(scoped[0]?.id ?? CONTACTS[0].id);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const contact = scoped.find((c) => c.id === selectedId) ?? scoped[0];
  const colorOf = (org: string) => orgs.find((o) => o.id === org)?.color ?? "var(--ws-all)";

  if (!contact) {
    return (
      <div>
        <SectionHead title="Contacts" />
        <Card ungated>
          <div className="vo-empty">
            <Eyebrow>Nothing in this scope</Eyebrow>
            <Desc>No cards have been scanned under the current workspace.</Desc>
          </div>
        </Card>
      </div>
    );
  }

  const v = verdict(contact.provenance);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Contacts"
        action={<span className="vo-meta">{scoped.length} scanned cards</span>}
      />

      {/* ---- Roster ---- */}
      <div className="vo-roster">
        {scoped.map((c) => {
          const cv = verdict(c.provenance);
          return (
            <button
              key={c.id}
              type="button"
              className="vo-rostercard"
              data-active={c.id === contact.id ? "true" : undefined}
              data-stated={cv.stated ? "true" : "false"}
              onClick={() => setSelectedId(c.id)}
            >
              <Face initials={c.initials} color={colorOf(c.org)} title={c.name} />
              <span className="vo-stack" style={{ gap: 2, alignItems: "flex-start" }}>
                <span className="vo-rostername">{c.name}</span>
                <span className="vo-meta">{c.role}</span>
              </span>
              <span className="vo-rosterpct" data-stated={cv.stated ? "true" : "false"}>
                {cv.pct}%
              </span>
            </button>
          );
        })}
      </div>

      <Bento>
        {/* ---- Provenance ---- */}
        <Col span={8}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-row" style={{ gap: "var(--s-3)", alignItems: "center" }}>
                <Face initials={contact.initials} color={colorOf(contact.org)} size="lg" title={contact.name} />
                <div className="vo-stack" style={{ gap: 2 }}>
                  <Title>{contact.name}</Title>
                  <span className="vo-meta">
                    {contact.role} · card scanned {contact.scannedOn}
                  </span>
                </div>
              </div>

              <Desc>
                Three signals are captured at scan time and kept separate. A claim is
                only a statement when two or more agree; otherwise it stays a question.
              </Desc>

              <ProvenanceCard contact={contact} onAsk={() => navigate("vision")} />
            </div>
          </Card>
        </Col>

        {/* ---- What Kova found ---- */}
        <Col span={4}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-stack" style={{ gap: 4 }}>
                <Eyebrow>What Kova found</Eyebrow>
                <Desc>{ENRICHMENT_RULE}</Desc>
              </div>
              <Found contact={contact} />
            </div>
          </Card>
        </Col>

        {/* ---- Relationship track ---- */}
        <Col span={7}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-stack" style={{ gap: 4 }}>
                <Eyebrow>Relationship track</Eyebrow>
                <Desc>
                  Touchpoints on a real time axis, so the gaps take up the space they
                  actually occupy.
                </Desc>
              </div>
              <Track points={contact.track} crossRef={contact.crossRef} />
            </div>
          </Card>
        </Col>

        {/* ---- Outreach draft ---- */}
        <Col span={5}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
                <Eyebrow>Outreach draft</Eyebrow>
                <Tag tone={v.stated ? "ok" : "warn"}>
                  {v.stated ? "Specific" : "Deliberately vague"}
                </Tag>
              </div>
              <Desc>
                The opener is written from the provenance, so the draft can never claim
                more than the signals support.
              </Desc>

              <div className="vo-draft" data-stated={v.stated ? "true" : "false"}>
                <p className="vo-draft-open">{contact.draftOpener}</p>
                <p className="vo-draft-body">{contact.draftBody}</p>
              </div>

              <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  disabled={!!sent[contact.id]}
                  onClick={() => setSent((s) => ({ ...s, [contact.id]: true }))}
                >
                  {sent[contact.id] ? "Queued for review" : "Send"}
                </Button>
                <span className="vo-meta">
                  {sent[contact.id]
                    ? "Held for your approval. Nothing has left the account."
                    : "Sending stops at a review gate — Kova drafts, you send."}
                </span>
              </div>
            </div>
          </Card>
        </Col>
      </Bento>
    </div>
  );
};

export default Contacts;
