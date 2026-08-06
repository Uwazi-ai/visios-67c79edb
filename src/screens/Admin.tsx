import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button, Card, Desc, Eyebrow, SectionHead, Stat, Tag } from "@/components/primitives";

/**
 * Platform console — the tenant level of the tenancy model, seen from above.
 *
 * Everything here reads through SECURITY DEFINER RPCs that check
 * is_platform_admin() themselves. The guard below is a courtesy for the UI;
 * it is not the security boundary. A non-admin who forces the screen open
 * gets empty tables and a failed write, not someone else's workspace.
 */

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  seats_used: number;
  ai_pool_limit: number;
  status: string;
  trial_ends_at: string;
  created_at: string;
  orgs_count: number;
  tasks_count: number;
  docs_count: number;
  contacts_count: number;
  last_activity: string | null;
}

interface MemberRow {
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  joined_at: string;
}

interface AuditRow {
  id: string;
  actor_email: string | null;
  tenant_name: string | null;
  action: string;
  target: string | null;
  reason: string | null;
  created_at: string;
}

const PLANS = ["trial", "starter", "growth", "scale", "enterprise"];
const STATUSES = ["active", "trialing", "suspended", "cancelled"];

/* 12-hour display, 24-hour data — the invariant applies here too. */
const when = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

const statusTone = (s: string): "ok" | "warn" | "risk" | undefined => {
  if (s === "active") return "ok";
  if (s === "trialing") return "warn";
  if (s === "suspended" || s === "cancelled") return "risk";
  return undefined;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="vo-stack" style={{ gap: "var(--s-1)", minWidth: 0 }}>
    <span className="vo-eyebrow">{label}</span>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  background: "var(--inset)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink)",
  font: "inherit",
  fontSize: "var(--t-body)",
  minHeight: 44,
  padding: "0 var(--s-3)",
  width: "100%",
};

const TenantEditor = ({ row, onSaved }: { row: TenantRow; onSaved: () => void }) => {
  const [plan, setPlan] = useState(row.plan);
  const [seats, setSeats] = useState(String(row.seats));
  const [pool, setPool] = useState(String(row.ai_pool_limit));
  const [status, setStatus] = useState(row.status);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(row.plan);
    setSeats(String(row.seats));
    setPool(String(row.ai_pool_limit));
    setStatus(row.status);
    setReason("");
    setError(null);
  }, [row]);

  const dirty =
    plan !== row.plan ||
    Number(seats) !== row.seats ||
    Number(pool) !== row.ai_pool_limit ||
    status !== row.status;

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.rpc("platform_update_tenant", {
      _tenant_id: row.id,
      _plan: plan,
      _seats: Number(seats),
      _ai_pool_limit: Number(pool),
      _status: status,
      _reason: reason || null,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
      <div
        style={{
          display: "grid",
          gap: "var(--s-3)",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        <Field label="Plan">
          <select style={inputStyle} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seats">
          <input
            style={inputStyle}
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
        </Field>
        <Field label="AI pool">
          <input
            style={inputStyle}
            type="number"
            min={0}
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Reason (recorded in the audit log)">
        <input
          style={inputStyle}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this change"
        />
      </Field>

      {Number(seats) < row.seats_used && (
        <div className="vo-meta" style={{ color: "var(--warn-txt)" }}>
          {row.seats_used} people already hold a seat. Lowering the cap below that does not remove
          anyone — it only blocks the next invite.
        </div>
      )}
      {error && (
        <div className="vo-meta" style={{ color: "var(--err-txt)" }}>
          {error}
        </div>
      )}

      <div className="vo-row">
        <Button variant="primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {!dirty && <span className="vo-meta">Nothing changed yet.</span>}
      </div>
    </div>
  );
};

const Admin = () => {
  const { isPlatformAdmin, loading: tenantLoading } = useTenant();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [tenants, log] = await Promise.allSettled([
      supabase.rpc("platform_tenant_overview"),
      supabase.rpc("platform_audit_recent", { _limit: 20 }),
    ]);
    if (tenants.status === "fulfilled" && tenants.value.data) {
      setRows(tenants.value.data as TenantRow[]);
    }
    if (log.status === "fulfilled" && log.value.data) {
      setAudit(log.value.data as AuditRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) void load();
  }, [isPlatformAdmin, load]);

  useEffect(() => {
    if (!selected) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    void supabase
      .rpc("platform_tenant_members", { _tenant_id: selected })
      .then(({ data }) => {
        if (!cancelled) setMembers((data ?? []) as MemberRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          seatsUsed: acc.seatsUsed + Number(r.seats_used),
          seats: acc.seats + r.seats,
          orgs: acc.orgs + Number(r.orgs_count),
          tasks: acc.tasks + Number(r.tasks_count),
          suspended: acc.suspended + (r.status === "suspended" || r.status === "cancelled" ? 1 : 0),
        }),
        { seatsUsed: 0, seats: 0, orgs: 0, tasks: 0, suspended: 0 },
      ),
    [rows],
  );

  const current = rows.find((r) => r.id === selected) ?? null;

  if (tenantLoading) {
    return (
      <div>
        <SectionHead title="Platform" />
        <Card ungated>
          <Desc>Checking your access…</Desc>
        </Card>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div>
        <SectionHead title="Platform" />
        <Card ungated>
          <div className="vo-stack">
            <Eyebrow>Not available</Eyebrow>
            <Desc>
              The platform console is for Kova staff. Your account is scoped to your own workspace,
              and the server refuses these reads regardless of what the interface shows.
            </Desc>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Platform"
        action={
          <Button size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      <Card ungated>
        <div
          style={{
            display: "grid",
            gap: "var(--s-4)",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          }}
        >
          <Stat value={rows.length} label="Tenants" note={`${totals.suspended} not active`} />
          <Stat
            value={totals.seatsUsed}
            label="Seats in use"
            note={`of ${totals.seats} licensed`}
          />
          <Stat value={totals.orgs} label="Organizations" />
          <Stat value={totals.tasks} label="Tasks on record" />
        </div>
      </Card>

      <Card ungated>
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <Eyebrow>Tenants</Eyebrow>
          {rows.length === 0 && !loading && (
            <Desc>No tenants yet. The first workspace appears here the moment it is created.</Desc>
          )}
          {rows.map((r) => {
            const left = daysLeft(r.trial_ends_at);
            const open = r.id === selected;
            return (
              <div key={r.id} className="vo-inset">
                <button
                  type="button"
                  onClick={() => setSelected(open ? null : r.id)}
                  aria-expanded={open}
                  style={{
                    background: "none",
                    border: 0,
                    color: "inherit",
                    cursor: "pointer",
                    font: "inherit",
                    padding: 0,
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div className="vo-between" style={{ flexWrap: "wrap" }}>
                    <div className="vo-stack" style={{ gap: 2, minWidth: 0 }}>
                      <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                        <span className="vo-title" style={{ fontSize: "var(--t-body)" }}>
                          {r.name}
                        </span>
                        <Tag tone={statusTone(r.status)}>{r.status}</Tag>
                        <Tag tone="accent">{r.plan}</Tag>
                      </div>
                      <span className="vo-meta">
                        /{r.slug} · {r.orgs_count} orgs · {r.tasks_count} tasks · {r.docs_count} docs
                        · {r.contacts_count} contacts
                      </span>
                    </div>
                    <div className="vo-row" style={{ gap: "var(--s-4)" }}>
                      <span className="vo-meta">
                        {r.seats_used}/{r.seats} seats
                      </span>
                      <span className="vo-meta">
                        {r.status === "trialing"
                          ? left > 0
                            ? `${left}d of trial`
                            : "Trial ended"
                          : `Active ${when(r.last_activity)}`}
                      </span>
                    </div>
                  </div>
                </button>

                {open && current && (
                  <div
                    className="vo-stack"
                    style={{
                      borderTop: "1px solid var(--line)",
                      gap: "var(--s-4)",
                      marginTop: "var(--s-3)",
                      paddingTop: "var(--s-3)",
                    }}
                  >
                    <TenantEditor
                      row={current}
                      onSaved={() => {
                        void load();
                      }}
                    />
                    <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
                      <Eyebrow>Members</Eyebrow>
                      {members.length === 0 && <span className="vo-meta">No members yet.</span>}
                      {members.map((m) => (
                        <div key={m.user_id} className="vo-between">
                          <span className="vo-meta">
                            {m.display_name ?? m.email ?? m.user_id}
                            {m.email && m.display_name ? ` · ${m.email}` : ""}
                          </span>
                          <span className="vo-meta">
                            {m.role} · joined {when(m.joined_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card ungated>
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <Eyebrow>Recent platform actions</Eyebrow>
          {audit.length === 0 && (
            <Desc>Nothing logged yet. Every plan, seat and status change lands here.</Desc>
          )}
          {audit.map((a) => (
            <div key={a.id} className="vo-between" style={{ gap: "var(--s-3)" }}>
              <span className="vo-meta" style={{ minWidth: 0 }}>
                <strong style={{ color: "var(--ink)" }}>{a.action}</strong>
                {a.tenant_name ? ` · ${a.tenant_name}` : ""}
                {a.reason ? ` · ${a.reason}` : ""}
              </span>
              <span className="vo-meta" style={{ whiteSpace: "nowrap" }}>
                {a.actor_email ?? "system"} · {when(a.created_at)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Admin;
