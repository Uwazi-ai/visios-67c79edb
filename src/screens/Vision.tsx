import { useState } from "react";
import { Bento, Card, Col, Desc, Eyebrow, SectionHead, Title } from "@/components/primitives";
import { CallTrace, GateCard, Sightlines } from "@/components/VisionParts";
import { EXCHANGES, route, sightlines, UNROUTED } from "@/data/vision";
import { decide, nextId, pushTurns, resetThread, useVision } from "@/data/visionStore";
import { useAppState } from "@/lib/AppState";

/**
 * Vision — the assistant that reads across ventures.
 *
 * Two things are load-bearing and neither is prompt wording:
 *  · every answer ships its tool trace, denials and failures included
 *  · every side effect stops at a gate card and waits for a person
 */
const Vision = () => {
  const { inScope, me } = useAppState();
  const { thread, decisions } = useVision();
  const [draft, setDraft] = useState("");

  const starters = EXCHANGES.filter((e) => inScope(e.org));
  const rows = sightlines(inScope);
  const blocked = rows.filter((r) => r.blocked).length;

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    const ex = route(text);
    pushTurns(
      { id: nextId("user"), role: "user", text },
      { id: nextId("vision"), role: "vision", ...(ex ? ex.answer : UNROUTED) },
    );
    setDraft("");
  };

  return (
    <div>
      <SectionHead
        title="Vision"
        action={
          thread.length ? (
            <button type="button" className="vo-btn" onClick={resetThread}>
              Clear thread
            </button>
          ) : undefined
        }
      />

      <Bento>
        <Col span={8}>
          <Card ungated>
            <div className="vo-chat">
              {thread.length === 0 ? (
                <div className="vo-empty">
                  <Eyebrow>Nothing asked yet</Eyebrow>
                  <Desc>
                    Ask across every venture at once. Each answer opens with the calls it
                    made — including the ones that were denied — so you can check the
                    reading rather than trust the sentence.
                  </Desc>
                </div>
              ) : null}

              {thread.map((t) =>
                t.role === "user" ? (
                  <div key={t.id} className="vo-msg" data-role="user">
                    <div className="vo-msg-who" style={{ background: me.color }}>
                      {me.initials}
                    </div>
                    <div className="vo-msg-body">{t.text}</div>
                  </div>
                ) : (
                  <div key={t.id} className="vo-msg" data-role="vision">
                    <div className="vo-msg-who" data-vision="true">
                      V
                    </div>
                    <div className="vo-msg-body">
                      {t.calls ? <CallTrace calls={t.calls} /> : null}
                      <p className="vo-msg-text">{t.text}</p>
                      {t.inferred ? (
                        <div className="vo-inferred">
                          <Eyebrow>Inferred, not read</Eyebrow>
                          <div className="vo-meta">{t.inferred}</div>
                        </div>
                      ) : null}
                      {t.proposal ? (
                        <GateCard
                          proposal={t.proposal}
                          decision={decisions[t.id]}
                          onDecide={(d) => decide(t.id, d)}
                        />
                      ) : null}
                    </div>
                  </div>
                ),
              )}

              <form
                className="vo-ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(draft);
                }}
              >
                <input
                  className="vo-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask across UWAZI, Culture Club, BIN, Raia, 1Flock…"
                  aria-label="Ask Vision"
                />
                <button type="submit" className="vo-btn" data-variant="primary" disabled={!draft.trim()}>
                  Ask
                </button>
              </form>
            </div>
          </Card>
        </Col>

        <Col span={4}>
          <Card>
            <Eyebrow>This session</Eyebrow>
            <Title>What Vision can see</Title>
            <Desc>
              {blocked > 0
                ? `${blocked} of ${rows.length} sources are unreadable right now. They stay listed and marked — a missing row would read as a source that doesn't exist, and you would never learn the answer was narrower than it looked.`
                : "Every connected source is readable."}
            </Desc>
            <Sightlines rows={rows} />
          </Card>

          <Card>
            <Eyebrow>Start here</Eyebrow>
            <Title>Prompts worth asking</Title>
            <div className="vo-starters">
              {starters.map((s) => (
                <button key={s.id} type="button" className="vo-starter" onClick={() => ask(s.prompt)}>
                  {s.prompt}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <Eyebrow>The rule</Eyebrow>
            <Title>Vision reads. You act.</Title>
            <Desc>
              Send, post, spend and delete return an intent, never a write. The write
              happens on your approval and nowhere else — there is no confidence
              threshold that skips the card, and no setting that turns it off.
            </Desc>
          </Card>
        </Col>
      </Bento>
    </div>
  );
};

export default Vision;
