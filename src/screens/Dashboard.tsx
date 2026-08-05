import { useState } from "react";
import { useAppState } from "@/lib/AppState";
import { PROPOSALS, EVENTS, EMAIL, DUE, byScope } from "@/data/mock";
import {
  Bento, Card, Col, Desc, Eyebrow, Face, GatedButton, ProposalCard, SectionHead, Tag, Title,
} from "@/components/primitives";
import { VelocityChart, WhoClosed } from "@/components/Throughput";

/**
 * Dashboard — reference implementation for every other screen.
 * Layout: 12-col bento, primitives only, all data from mock/ledger,
 * all colour from tokens.css.
 */
export const Dashboard = () => {
  const { scope, scopeOrg, me } = useAppState();
  const workspace = scopeOrg();
  const [approved, setApproved] = useState<string[]>(
    PROPOSALS.filter((p) => p.approved).map((p) => p.id),
  );
  const [dismissed, setDismissed] = useState<string[]>([]);

  const proposals = byScope(PROPOSALS, scope).filter((p) => !dismissed.includes(p.id));
  const events = byScope(EVENTS, scope);
  const email = byScope(EMAIL, scope);
  const due = byScope(DUE, scope);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <div>
        <Eyebrow>{workspace.name}</Eyebrow>
        <h1 className="vo-head" style={{ fontSize: 26, marginTop: 4 }}>
          Good morning, {me.name}
        </h1>
        <Desc>
          {proposals.filter((p) => !approved.includes(p.id)).length} proposals waiting on you ·{" "}
          {events.length} events today · {due.length} due this week
        </Desc>
      </div>

      <section>
        <SectionHead
          title="Waiting on you"
          action={
            <GatedButton
              blockedCount={proposals.filter((p) => !approved.includes(p.id)).length}
              variant="primary"
              onClick={() => setApproved(proposals.map((p) => p.id))}
            >
              Clear the queue
            </GatedButton>
          }
        />
        <Bento>
          {proposals.map((p) => (
            <Col span={4} key={p.id}>
              <Card ungated={!approved.includes(p.id)}>
                <Eyebrow>{p.agent}</Eyebrow>
                <div style={{ height: "var(--s-2)" }} />
                <ProposalCard
                  title={p.title}
                  body={p.body}
                  signals={p.signals}
                  approved={approved.includes(p.id)}
                  onApprove={() => setApproved((a) => [...a, p.id])}
                  onDismiss={() => setDismissed((d) => [...d, p.id])}
                />
              </Card>
            </Col>
          ))}
          {proposals.length === 0 && (
            <Col span={12}>
              <Card>
                <Desc>Nothing waiting. Agents will surface work here as it appears.</Desc>
              </Card>
            </Col>
          )}
        </Bento>
      </section>

      <section>
        <SectionHead title="Momentum" />
        <Bento>
          <VelocityChart scope={scope} />
          <WhoClosed scope={scope} />
        </Bento>
      </section>

      <section>
        <SectionHead title="Today" />
        <Bento>
          <Col span={4}>
            <Card>
              <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
                <Title>Schedule</Title>
                <Eyebrow>{events.length} events</Eyebrow>
              </div>
              <div className="vo-stack">
                {events.map((e) => (
                  <div className="vo-inset vo-row" key={e.id}>
                    <span className="vo-meta" style={{ width: 44 }}>{e.at}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="vo-desc" style={{ color: "var(--text)" }}>{e.title}</div>
                      <div className="vo-meta">{e.who}</div>
                    </div>
                    {e.conflict ? <Tag tone="risk">overlap</Tag> : null}
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          <Col span={4}>
            <Card>
              <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
                <Title>Needs attention</Title>
                <Eyebrow>Inbox</Eyebrow>
              </div>
              <div className="vo-stack">
                {email.map((m) => (
                  <div className="vo-inset vo-row" key={m.id}>
                    <Face initials={m.initials} title={m.from} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="vo-desc" style={{ color: "var(--text)" }}>{m.from}</div>
                      <div className="vo-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.subject}
                      </div>
                    </div>
                    <Tag tone={m.tone}>{m.tone === "risk" ? "urgent" : m.tone === "warn" ? "review" : "fyi"}</Tag>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          <Col span={4}>
            <Card>
              <div className="vo-between" style={{ marginBottom: "var(--s-3)" }}>
                <Title>Due soon</Title>
                <Eyebrow>7 days</Eyebrow>
              </div>
              <div className="vo-stack">
                {due.map((t) => (
                  <div className="vo-inset vo-row" key={t.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="vo-desc" style={{ color: "var(--text)" }}>{t.title}</div>
                      <div className="vo-meta">{t.project}</div>
                    </div>
                    <Tag tone={t.tone}>{t.due}</Tag>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Bento>
      </section>
    </div>
  );
};

export default Dashboard;
