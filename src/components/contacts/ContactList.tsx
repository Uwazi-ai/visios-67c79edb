import { useMemo, useState } from "react";
import { Search, Building2 } from "lucide-react";
import { ORG_COLORS } from "@/lib/orgs";
import { bucket, relativeTime, HEALTH_COLORS } from "@/lib/contactsHealth";
import type { ContactRow } from "@/pages/Contacts";

type StaleFilter = null | 30 | 60 | 90;
type TypeFilter = "all" | "people" | "companies";

interface Props {
  contacts: ContactRow[];
  orgs: Array<{ id: string; slug: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  initialStale?: StaleFilter;
}

export const ContactList = ({ contacts, orgs, selectedId, onSelect, initialStale = null }: Props) => {
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [stale, setStale] = useState<StaleFilter>(initialStale);

  const orgsBySlug = useMemo(() => new Map(orgs.map((o) => [o.slug, o])), [orgs]);
  const orgsById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    const now = Date.now();
    return contacts
      .filter((c) => {
        if (orgFilter !== "all") {
          const o = orgsById.get(c.org_id ?? "");
          if (!o || o.slug !== orgFilter) return false;
        }
        if (typeFilter === "people" && !c.email && !c.role) return c.company ? false : true;
        if (typeFilter === "companies" && !c.company) return false;
        if (stale !== null) {
          if (!c.last_touched_at) return true;
          const days = (now - new Date(c.last_touched_at).getTime()) / 86_400_000;
          if (days < stale) return false;
        }
        if (!ql) return true;
        const hay = `${c.name} ${c.company ?? ""} ${c.email ?? ""} ${c.role ?? ""}`.toLowerCase();
        return hay.includes(ql);
      })
      .sort((a, b) => {
        const at = a.last_touched_at ? new Date(a.last_touched_at).getTime() : 0;
        const bt = b.last_touched_at ? new Date(b.last_touched_at).getTime() : 0;
        return bt - at;
      });
  }, [contacts, q, orgFilter, typeFilter, stale, orgsById]);

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`org-pill ${active ? "active" : ""}`}
      style={{ padding: "3px 9px", fontSize: 11 }}
    >
      {children}
    </button>
  );

  return (
    <div className="glass flex flex-col" style={{ width: 320, minWidth: 320, height: "100%" }}>
      {/* Search */}
      <div className="p-3 border-b" style={{ borderColor: "var(--border-glass)" }}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts..."
            className="input-glass"
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Chip active={orgFilter === "all"} onClick={() => setOrgFilter("all")}>All</Chip>
          {orgs.map((o) => (
            <Chip key={o.id} active={orgFilter === o.slug} onClick={() => setOrgFilter(o.slug)}>
              <span className="org-dot" style={{ background: ORG_COLORS[o.slug] ?? "#6366F1" }} />
              {o.slug.toUpperCase()}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All</Chip>
          <Chip active={typeFilter === "people"} onClick={() => setTypeFilter("people")}>People</Chip>
          <Chip active={typeFilter === "companies"} onClick={() => setTypeFilter("companies")}>Companies</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Chip active={stale === null} onClick={() => setStale(null)}>Any age</Chip>
          <Chip active={stale === 30} onClick={() => setStale(30)}>Stale 30d</Chip>
          <Chip active={stale === 60} onClick={() => setStale(60)}>Stale 60d</Chip>
          <Chip active={stale === 90} onClick={() => setStale(90)}>Stale 90d+</Chip>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center" style={{ color: "var(--text-muted)", fontSize: 12 }}>
            No matching contacts.
          </div>
        ) : (
          filtered.map((c) => {
            const org = orgsById.get(c.org_id ?? "");
            const orgColor = org ? ORG_COLORS[org.slug] ?? "#6366F1" : "#6366F1";
            const b = bucket(c.last_touched_at);
            const initials = c.name
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("");
            const active = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${active ? "" : "hover:bg-white/[0.04]"}`}
                style={{
                  background: active ? "var(--bg-glass-active)" : "transparent",
                  borderLeft: active ? `2px solid ${orgColor}` : "2px solid transparent",
                }}
              >
                <div
                  className="flex items-center justify-center font-semibold flex-shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: `${orgColor}22`,
                    color: orgColor,
                    fontSize: 12,
                    border: `1px solid ${orgColor}44`,
                  }}
                >
                  {initials || <Building2 size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }} className="truncate">
                      {c.name}
                    </span>
                    {b === "warming" && <span className="org-dot" style={{ background: HEALTH_COLORS.warming }} />}
                    {b === "cold" && <span className="org-dot dot-critical" style={{ background: HEALTH_COLORS.cold }} />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.company && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }} className="truncate">
                        {c.company}
                      </span>
                    )}
                    {org && (
                      <span
                        className="badge"
                        style={{
                          background: `${orgColor}15`,
                          border: `1px solid ${orgColor}40`,
                          color: orgColor,
                          fontSize: 9,
                        }}
                      >
                        {org.slug.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <span className="t-mono flex-shrink-0" style={{ fontSize: 9 }}>
                  {relativeTime(c.last_touched_at)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
