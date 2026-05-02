import { bucket, type HealthBucket } from "@/lib/contactsHealth";

interface Props {
  contacts: Array<{ last_touched_at: string | null }>;
}

export const RelationshipHealth = ({ contacts }: Props) => {
  const counts: Record<HealthBucket, number> = { active: 0, warming: 0, cold: 0, unknown: 0 };
  for (const c of contacts) counts[bucket(c.last_touched_at)]++;

  const Item = ({ color, label, count }: { color: string; label: string; count: number }) => (
    <div className="flex items-center gap-2">
      <span className="org-dot" style={{ background: color, width: 8, height: 8 }} />
      <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{count}</span>
    </div>
  );

  return (
    <div className="glass flex items-center gap-4 px-4 py-2">
      <Item color="var(--sev-success)" label="ACTIVE" count={counts.active} />
      <span style={{ width: 1, height: 14, background: "var(--border-glass)" }} />
      <Item color="var(--sev-warn)" label="WARMING" count={counts.warming} />
      <span style={{ width: 1, height: 14, background: "var(--border-glass)" }} />
      <Item color="var(--sev-critical)" label="COLD" count={counts.cold} />
    </div>
  );
};
