import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { Card, Desc, Title } from "@/components/primitives";

/**
 * ExpiryPanel — how long an unreviewed proposal stays reviewable.
 *
 * Expiry is a status change and nothing else: an expired proposal never sent
 * the email, never created the task. Calendar holds are governed by the slot
 * they hold, not by a duration, so they are stated rather than configurable.
 */

const KINDS = [
  { kind: "email_reply", label: "Email drafts", detail: "A reply nobody sent stops being the right reply." },
  { kind: "task", label: "Task proposals", detail: "Work suggested a week ago is no longer this week's work." },
  { kind: "social_post", label: "Social posts", detail: "Timely content is only content while it is timely." },
  { kind: "contact_update", label: "Contact updates", detail: "Enrichment goes stale quietly." },
];

export const ExpiryPanel = () => {
  const { scopeOrgId, orgs } = useWorkspaceScope();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("proposal_expiry_policies")
      .select("id,org_id,kind,ttl_hours");
    setRows(data ?? []);
  };
  useEffect(() => { void load(); }, []);

  const ttlFor = (kind: string) =>
    rows.find((r) => r.org_id === scopeOrgId && r.kind === kind)?.ttl_hours ??
    rows.find((r) => r.org_id === null && r.kind === kind)?.ttl_hours ??
    null;

  const write = async (kind: string, hours: number) => {
    if (!scopeOrgId) return;
    setRows((prev) => [
      ...prev.filter((r) => !(r.org_id === scopeOrgId && r.kind === kind)),
      { org_id: scopeOrgId, kind, ttl_hours: hours },
    ]);
    await (supabase as any)
      .from("proposal_expiry_policies")
      .upsert({ org_id: scopeOrgId, kind, ttl_hours: hours }, { onConflict: "org_id,kind" });
  };

  const orgName = orgs.find((o) => o.id === scopeOrgId)?.name;

  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Proposal expiry</Title>
          <Desc>
            {scopeOrgId
              ? `Applies to ${orgName}. Expiry only changes status — nothing is sent, created or cancelled on your behalf.`
              : "Showing the defaults across every organisation. Pick a single organisation in the scope switcher to change them."}
          </Desc>
        </div>

        {KINDS.map((k) => (
          <div key={k.kind} className="vo-toggle-row">
            <div className="vo-stack" style={{ gap: 2 }}>
              <span className="vo-toggle-label">{k.label}</span>
              <span className="vo-meta">{k.detail}</span>
            </div>
            <select
              className="input-glass"
              style={{ fontSize: 12 }}
              value={ttlFor(k.kind) ?? ""}
              disabled={!scopeOrgId}
              onChange={(e) => write(k.kind, Number(e.target.value))}
              aria-label={`${k.label} expiry`}
            >
              <option value="">Never expires</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
              <option value={336}>14 days</option>
            </select>
          </div>
        ))}

        <div className="vo-note">
          Calendar holds expire when the slot they hold begins — a hold on a past
          meeting is wrong, not stale. Expired proposals stay restorable for 30 days.
        </div>
      </div>
    </Card>
  );
};

export default ExpiryPanel;
