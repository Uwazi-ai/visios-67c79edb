import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { Card, Desc, Eyebrow, Title } from "@/components/primitives";

/**
 * PlanUsagePanel — counted, not estimated.
 *
 * Every number here comes from get_usage_summary, which counts rows. A usage
 * meter that guesses is worse than no meter: people budget against it.
 */

const fmtBytes = (n: number) => {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
};

const Meter = ({ label, value, limit, display }: { label: string; value: number; limit?: number; display?: string }) => {
  const pct = limit && limit !== Infinity ? Math.min(100, (value / limit) * 100) : null;
  return (
    <div className="vo-stack" style={{ gap: 4 }}>
      <div className="vo-between">
        <span className="vo-meta">{label}</span>
        <span className="vo-meta" style={{ color: "var(--ink)" }}>
          {display ?? value}
          {limit && limit !== Infinity ? ` / ${limit}` : ""}
        </span>
      </div>
      {pct !== null ? (
        <div style={{ height: 4, background: "var(--line)", borderRadius: 2 }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 2,
              background: pct >= 90 ? "var(--risk)" : pct >= 75 ? "var(--warn)" : "var(--accent)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export const PlanUsagePanel = () => {
  const { scopeOrgId, orgLimit, planLabel, billableOrgCount } = useWorkspaceScope();
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("get_usage_summary", { p_org_id: scopeOrgId });
      setUsage(data ?? null);
    })();
  }, [scopeOrgId]);

  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Plan and usage</Title>
          <Desc>
            Counted this billing period, from the same rows the product reads.
            Demo organisations are excluded from every figure.
          </Desc>
        </div>

        <Eyebrow>{planLabel} plan</Eyebrow>

        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <Meter label="Organisations" value={billableOrgCount} limit={orgLimit} />
          <Meter label="Live connections" value={usage?.connections ?? 0} />
          <Meter label="Vision replies this month" value={usage?.vision_messages ?? 0} />
          <Meter label="Meeting briefs this month" value={usage?.briefs ?? 0} />
          <Meter
            label="Attachment storage"
            value={usage?.storage_bytes ?? 0}
            display={fmtBytes(usage?.storage_bytes ?? 0)}
          />
        </div>
      </div>
    </Card>
  );
};

export default PlanUsagePanel;
