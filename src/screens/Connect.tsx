import {
  SOURCES,
  featureCount,
  surfacesFor,
  toggleSource,
  useConnectedSources,
} from "@/lib/sources";
import { Button, Card, Desc, Eyebrow, SectionHead, Tag, Title } from "@/components/primitives";

/**
 * Connect — a checklist, not a wizard.
 *
 * Every card says what it turns on, so a tenant can stop the moment they
 * have what they came for instead of being marched through ten steps.
 * Google Workspace is first because it unlocks more surfaces than anything
 * else: one connection and the product is already telling the truth.
 */
export const Connect = () => {
  const active = useConnectedSources();
  const { live, total } = featureCount(active);
  const pct = Math.round((live / total) * 100);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead title="Connect" />

      <Card ungated>
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <div className="vo-between">
            <Eyebrow>Coverage</Eyebrow>
            <span className="vo-meta">
              {live} / {total} features live
            </span>
          </div>
          <div
            className="vo-progress"
            role="progressbar"
            aria-valuenow={live}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`${live} of ${total} features live`}
          >
            <div className="vo-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <Desc>
            Kova holds no data of its own. Each source you connect turns real surfaces on; the
            rest stay dark and say so rather than showing you a zero.
          </Desc>
        </div>
      </Card>

      {/* Permissions, stated before the first click rather than buried. */}
      <Card ungated>
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <Eyebrow>What Kova is allowed to do</Eyebrow>
          <Desc>
            Kova reads. It does not send, post, spend or delete. Those actions require your
            approval one at a time and are locked off in Settings — they are not a switch you can
            flip. Disconnecting a source stops reads immediately and removes that source's data
            from this workspace.
          </Desc>
        </div>
      </Card>

      <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
        {SOURCES.map((s) => {
          const on = active.includes(s.id);
          const surfaces = surfacesFor(s.id);
          return (
            <div key={s.id} className="vo-card vo-source-card" data-on={on ? "true" : undefined}>
              <div className="vo-between" style={{ flexWrap: "wrap", gap: "var(--s-3)" }}>
                <div className="vo-stack" style={{ gap: 4, minWidth: 0 }}>
                  <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                    <Title>{s.name}</Title>
                    {on ? <Tag tone="ok">Connected</Tag> : <Tag>Not connected</Tag>}
                    {surfaces.length > 0 && (
                      <span className="vo-meta">
                        Required by {surfaces.length} {surfaces.length === 1 ? "surface" : "surfaces"}
                      </span>
                    )}
                  </div>
                  <Desc>{s.reads}</Desc>
                </div>
                <Button variant={on ? undefined : "primary"} size="sm" onClick={() => toggleSource(s.id)}>
                  {on ? "Disconnect" : "Connect"}
                </Button>
              </div>

              <div className="vo-gate-chips" style={{ marginTop: "var(--s-2)" }}>
                {s.turnsOn.map((t) => (
                  <span key={t} className="vo-chip">
                    {t}
                  </span>
                ))}
              </div>

              {s.delay && (
                <p className="vo-meta vo-gate-note" style={{ marginTop: "var(--s-2)" }}>
                  {s.name}: {s.delay}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Connect;
