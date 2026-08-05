import { useMemo, useState } from "react";
import { Bento, Card, Col, Desc, Eyebrow, Face, SectionHead, Tag } from "@/components/primitives";
import { DraftBox, SendRule } from "@/components/InboxParts";
import { THREADS } from "@/data/inbox";
import { setSend, useSends } from "@/data/inboxStore";
import { useAppState } from "@/lib/AppState";

/**
 * Inbox — thread list plus a reader in which the draft, not the last
 * message, is the thing you came for. The messages above it are context
 * for a decision that lives in a dashed box.
 */
const Inbox = () => {
  const { orgs, inScope, scope } = useAppState();
  const scopeName = orgs.find((o) => o.id === scope)?.name ?? "All organizations";
  const sends = useSends();
  const scoped = useMemo(() => THREADS.filter((t) => inScope(t.org)), [inScope]);
  const [selectedId, setSelectedId] = useState(scoped[0]?.id ?? THREADS[0].id);
  const thread = scoped.find((t) => t.id === selectedId) ?? scoped[0];

  const colorOf = (org: string) => orgs.find((o) => o.id === org)?.color ?? "var(--ws-all)";
  const pending = scoped.filter((t) => !sends[t.id]).length;

  if (!thread) {
    return (
      <div>
        <SectionHead title="Inbox" />
        <Card ungated>
          <div className="vo-empty">
            <Eyebrow>{scopeName}</Eyebrow>
            <Desc>No threads for {scopeName}. Switch scope in the rail to see the rest.</Desc>
          </div>
        </Card>
      </div>
    );
  }

  const state = sends[thread.id] ?? "draft";

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Inbox"
        action={
          <span className="vo-meta">
            {scoped.length} threads · {pending} draft{pending === 1 ? "" : "s"} waiting on you
          </span>
        }
      />

      <Bento>
        <Col span={4}>
          <Card ungated>
            <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
              <Eyebrow>Threads</Eyebrow>
              <div className="vo-thlist">
                {scoped.map((t) => {
                  const s = sends[t.id] ?? "draft";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="vo-throw"
                      data-active={t.id === thread.id ? "true" : undefined}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <Face initials={t.initials} color={colorOf(t.org)} title={t.with} />
                      <span className="vo-stack" style={{ gap: 2, minWidth: 0, flex: 1, alignItems: "flex-start" }}>
                        <span className="vo-between" style={{ width: "100%" }}>
                          <span className="vo-thwith">{t.with}</span>
                          <span className="vo-meta">{t.at}</span>
                        </span>
                        <span className="vo-thsubject">{t.subject}</span>
                        <span className="vo-thpreview">{t.preview}</span>
                        <span className="vo-thstate" data-state={s}>
                          {s === "sent" ? "Reply sent" : s === "discarded" ? "Draft discarded" : "Draft waiting"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <SendRule />
        </Col>

        <Col span={8}>
          <Card>
            <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
              <div className="vo-between">
                <div className="vo-stack" style={{ gap: 2 }}>
                  <h3 className="vo-title">{thread.subject}</h3>
                  <span className="vo-meta">
                    {thread.with} · {thread.messages.length} messages
                  </span>
                </div>
                <Tag>{orgs.find((o) => o.id === thread.org)?.name ?? "Cross-venture"}</Tag>
              </div>

              <div className="vo-thread">
                {thread.messages.map((m, i) => (
                  <div key={i} className="vo-thmsg" data-mine={m.mine ? "true" : undefined}>
                    <Face initials={m.initials} title={m.from} />
                    <div className="vo-stack" style={{ gap: 2, minWidth: 0 }}>
                      <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                        <span className="vo-chauthor">{m.from}</span>
                        <span className="vo-chtime">{m.at}</span>
                      </div>
                      <p className="vo-chtext">{m.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <DraftBox
                draft={thread.draft}
                state={state}
                onSend={() => setSend(thread.id, "sent")}
                onDiscard={() => setSend(thread.id, "discarded")}
              />
            </div>
          </Card>
        </Col>
      </Bento>
    </div>
  );
};

export default Inbox;
