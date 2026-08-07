import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { Card, Desc, Eyebrow, Title, Tag } from "@/components/primitives";
import {
  DeliveryMode,
  EVENT_GROUPS,
  NOTIFICATION_EVENTS,
  defaultEmailMode,
} from "@/lib/notifications";

/**
 * NotificationsPanel — per-event delivery, with per-organisation overrides.
 *
 * In-app is always available; email is the interruptive channel, so it is the
 * one with three states. A row that has never been touched shows the system
 * default rather than a stored value, so defaults can change later.
 */

interface PrefRow {
  org_id: string | null;
  event_type: string;
  in_app: boolean;
  email: DeliveryMode;
}

export const NotificationsPanel = () => {
  const { orgs } = useWorkspaceScope();
  const [scope, setScope] = useState<string | null>(null); // null = global default
  const [rows, setRows] = useState<PrefRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return setLoading(false);
      setUserId(auth.user.id);
      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("org_id,event_type,in_app,email")
        .eq("user_id", auth.user.id);
      setRows((data ?? []) as PrefRow[]);
      setLoading(false);
    })();
  }, []);

  const find = (type: string) =>
    rows.find((r) => r.org_id === scope && r.event_type === type) ??
    (scope ? rows.find((r) => r.org_id === null && r.event_type === type) : undefined);

  const inherited = (type: string) =>
    !!scope && !rows.some((r) => r.org_id === scope && r.event_type === type);

  const write = async (type: string, patch: Partial<PrefRow>) => {
    if (!userId) return;
    const current = find(type);
    const next: PrefRow = {
      org_id: scope,
      event_type: type,
      in_app: current?.in_app ?? true,
      email: current?.email ?? defaultEmailMode(type),
      ...patch,
    };
    setRows((prev) => [...prev.filter((r) => !(r.org_id === scope && r.event_type === type)), next]);
    await (supabase as any)
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id,org_id,event_type" });
  };

  const clearOverride = async (type: string) => {
    if (!userId || !scope) return;
    setRows((prev) => prev.filter((r) => !(r.org_id === scope && r.event_type === type)));
    await (supabase as any)
      .from("notification_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", scope)
      .eq("event_type", type);
  };

  if (loading) return <Card><Desc>Loading your notification settings…</Desc></Card>;

  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Notifications</Title>
          <Desc>
            In-app always arrives. Email is the interruptive one, so it is off for
            most events until you ask for it. Nothing is sent about your own actions,
            and nothing is sent about something you were just looking at.
          </Desc>
        </div>

        <div className="vo-row" style={{ flexWrap: "wrap", gap: "var(--s-2)" }}>
          <button
            type="button"
            className="b-ghost b-sm"
            data-active={scope === null ? "true" : undefined}
            onClick={() => setScope(null)}
          >
            All organisations
          </button>
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              className="b-ghost b-sm"
              data-active={scope === o.id ? "true" : undefined}
              onClick={() => setScope(o.id)}
            >
              <span className="vo-dot" style={{ background: o.identity_color }} aria-hidden /> {o.name}
            </button>
          ))}
        </div>

        {EVENT_GROUPS.map((group) => (
          <div key={group} className="vo-stack" style={{ gap: "var(--s-2)" }}>
            <Eyebrow>{group}</Eyebrow>
            {NOTIFICATION_EVENTS.filter((e) => e.group === group).map((e) => {
              const pref = find(e.type);
              const email = pref?.email ?? defaultEmailMode(e.type);
              const inApp = pref?.in_app ?? true;
              return (
                <div key={e.type} className="vo-toggle-row">
                  <label className="vo-stack" style={{ gap: 2 }}>
                    <span className="vo-toggle-label">
                      {e.label}
                      {inherited(e.type) ? <Tag>Inherited</Tag> : null}
                    </span>
                    <span className="vo-meta">{e.detail}</span>
                  </label>
                  <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                    <label className="vo-meta vo-row" style={{ gap: 6 }}>
                      <input
                        type="checkbox"
                        className="vo-switch"
                        checked={inApp}
                        onChange={(ev) => write(e.type, { in_app: ev.target.checked })}
                        aria-label={`${e.label}: in-app`}
                      />
                      In-app
                    </label>
                    <select
                      className="input-glass"
                      style={{ fontSize: 12 }}
                      value={email}
                      onChange={(ev) => write(e.type, { email: ev.target.value as DeliveryMode })}
                      aria-label={`${e.label}: email`}
                    >
                      <option value="off">Email: off</option>
                      <option value="immediate">Email: immediate</option>
                      <option value="digest">Email: daily digest</option>
                    </select>
                    {inherited(e.type) ? null : scope ? (
                      <button type="button" className="vo-link" onClick={() => clearOverride(e.type)}>
                        Reset
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="vo-note">
          A maximum of 20 immediate emails reach you in a day. Anything past that is
          grouped into your digest rather than dropped.
        </div>
      </div>
    </Card>
  );
};

export default NotificationsPanel;
