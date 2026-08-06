import {
  SOURCES,
  featureCount,
  surfacesFor,
  toggleSource,
  useConnectedSources,
  type SourceId,
} from "@/lib/sources";
import {
  absoluteTime,
  hasProbe,
  relativeTime,
  syncAll,
  syncSource,
  useSyncStatuses,
  type SyncStatus,
} from "@/lib/syncStatus";
import { Button, Card, Desc, Eyebrow, SectionHead, Tag, Title } from "@/components/primitives";

/** One line of truth per source: what state it is in, and when it last worked. */
const SyncLine = ({ id, status }: { id: SourceId; status: SyncStatus | undefined }) => {
  if (!hasProbe(id)) {
    return (
      <p className="vo-meta vo-sync-line" data-state="unverified">
        <span className="vo-sync-dot" data-state="unverified" />
        Connected, but Kova cannot verify this source yet — no reads have been made.
      </p>
    );
  }

  const s: SyncStatus = status ?? { state: "idle", lastSyncAt: null, rows: null };

  const text =
    s.state === "syncing"
      ? "Syncing now…"
      : s.state === "error"
        ? `Error — ${s.error ?? "read failed"}. Last good sync ${relativeTime(s.lastSyncAt)}.`
        : s.state === "ok"
          ? `Synced ${relativeTime(s.lastSyncAt)}${s.rows !== null ? ` · ${s.rows} rows` : ""}`
          : "Connected, not synced yet this session.";

  return (
    <p
      className="vo-meta vo-sync-line"
      data-state={s.state}
      title={s.lastSyncAt ? `Last successful sync: ${absoluteTime(s.lastSyncAt)}` : undefined}
    >
      <span className="vo-sync-dot" data-state={s.state} />
      {text}
    </p>
  );
};

/**
 * Connect — a checklist, not a wizard.
 *
 * Every card says what it turns on, so a tenant can stop the moment they
 * have what they came for instead of being marched through ten steps, and
 * what it last did, so a missing number can be traced to the source that
 * failed rather than guessed at.
 */
export const Connect = () => {
  const active = useConnectedSources();
  const statuses = useSyncStatuses();
  const { live, total } = featureCount(active);
  const pct = Math.round((live / total) * 100);
  const failing = active.filter((id) => statuses[id]?.state === "error");
  const syncing = active.some((id) => statuses[id]?.state === "syncing");


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
