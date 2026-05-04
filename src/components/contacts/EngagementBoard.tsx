import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ORG_COLORS } from "@/lib/orgs";
import { stagesForOrg } from "@/lib/engagementStages";
import { daysSince } from "@/lib/contactsHealth";
import type { ContactRow } from "@/pages/Contacts";

interface Props {
  contacts: ContactRow[];
  orgs: Array<{ id: string; slug: string; name: string }>;
  activeOrgSlug: string | null; // null => "all"
  onChanged: () => void;
  onSelect: (id: string) => void;
}

export const EngagementBoard = ({ contacts, orgs, activeOrgSlug, onChanged, onSelect }: Props) => {
  const orgsById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  // Use stages for the active org, or default if "all"
  const stages = stagesForOrg(activeOrgSlug);

  const buckets = useMemo(() => {
    const m = new Map<string, ContactRow[]>();
    stages.forEach((s) => m.set(s.id, []));
    for (const c of contacts) {
      if (activeOrgSlug) {
        const o = orgsById.get(c.org_id ?? "");
        if (!o || o.slug !== activeOrgSlug) continue;
      }
      const stage = c.engagement_stage ?? stages[0].id;
      if (m.has(stage)) m.get(stage)!.push(c);
      else m.get(stages[0].id)!.push(c);
    }
    return m;
  }, [contacts, stages, activeOrgSlug, orgsById]);

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/contact-id");
    if (!id) return;
    await supabase.from("contacts").update({ engagement_stage: stageId }).eq("id", id);
    onChanged();
  };

  return (
    <div className="glass hidden lg:flex flex-col" style={{ width: 280, minWidth: 280, height: "100%" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-glass)" }}>
        <div className="t-card-title">Engagements</div>
        <div className="t-mono mt-1" style={{ fontSize: 9 }}>
          {activeOrgSlug ? activeOrgSlug.toUpperCase() : "ALL ORGS"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {stages.map((s) => {
          const cards = buckets.get(s.id) ?? [];
          return (
            <div
              key={s.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, s.id)}
              className="rounded-[12px] p-2"
              style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="t-card-title" style={{ fontSize: 10 }}>{s.label}</span>
                <span className="t-mono" style={{ fontSize: 9 }}>{cards.length}</span>
              </div>
              <div className="space-y-1.5">
                {cards.length === 0 && (
                  <div className="px-2 py-3 text-center" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    Drop here
                  </div>
                )}
                {cards.map((c) => {
                  const org = orgsById.get(c.org_id ?? "");
                  const color = org ? ORG_COLORS[org.slug] ?? "#6366F1" : "#6366F1";
                  const days = daysSince(c.last_touched_at);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/contact-id", c.id)}
                      onClick={() => onSelect(c.id)}
                      className="rounded-[8px] px-2.5 py-2 cursor-pointer transition-colors hover:bg-white/[0.05]"
                      style={{
                        background: "var(--bg-glass-2)",
                        border: "1px solid var(--border-glass)",
                        borderLeft: `2px solid ${color}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }} className="truncate">
                          {c.name}
                        </span>
                        {org && (
                          <span
                            className="badge flex-shrink-0"
                            style={{
                              background: `${color}15`,
                              border: `1px solid ${color}40`,
                              color,
                              fontSize: 8,
                              padding: "2px 5px",
                            }}
                          >
                            {org.slug.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <p className="line-clamp-1 mt-1" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {c.notes}
                        </p>
                      )}
                      {days !== null && (
                        <span className="t-mono mt-1 inline-block" style={{ fontSize: 9 }}>
                          {days}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
