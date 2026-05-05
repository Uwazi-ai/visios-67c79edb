import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";

export const OrgSwitcher = () => {
  const { orgs, memberships, activeOrgId, setActiveOrgId, isOwner, isRestricted } = useOrg();
  const memberOrgs = orgs.filter((o) => memberships.some((m) => m.org_id === o.id));
  const visible = isRestricted ? memberOrgs : (isOwner ? orgs : memberOrgs);

  return (
    <div className="px-5 py-4">
      <div className="t-mono mb-3" style={{ fontSize: 10, color: "var(--text-muted)" }}>
        ORG CONTEXT
      </div>
      <div className="flex flex-col gap-1.5">
        {visible.map((o: any) => {
          const active = activeOrgId === o.id;
          const color = o.color || ORG_COLORS[o.slug] || "#6366F1";
          const label = o.short_name || o.name;
          return (
            <button
              key={o.id}
              onClick={() => setActiveOrgId(o.id)}
              className={`org-pill ${active ? "active" : ""} w-full justify-start`}
              style={{ padding: "6px 10px" }}
            >
              <span
                className="org-dot"
                style={{
                  background: color,
                  boxShadow: active ? `0 0 8px ${color}` : undefined,
                }}
              />
              <span className="truncate" style={{ fontSize: 12 }}>{label}</span>
            </button>
          );
        })}
        {isOwner && !isRestricted && visible.length > 0 && (
          <button
            onClick={() => setActiveOrgId("all")}
            className={`org-pill ${activeOrgId === "all" ? "active" : ""} w-full justify-start`}
            style={{ padding: "6px 10px" }}
          >
            <span className="org-dot" style={{ background: "linear-gradient(90deg,#2563EB,#EF4444,#22C55E)" }} />
            <span style={{ fontSize: 12 }}>All</span>
          </button>
        )}
      </div>
    </div>
  );
};
