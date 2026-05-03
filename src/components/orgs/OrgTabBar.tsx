import { useState } from "react";
import { Plus, GripVertical, Settings as Cog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";

interface OrgLite {
  id: string;
  name: string;
  short_name?: string | null;
  color: string;
  display_order?: number | null;
}

interface Props {
  orgs: OrgLite[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: () => void;
}

export function OrgTabBar({ orgs, activeId, onSelect, onAdd, onEdit }: Props) {
  const { refreshOrgs } = useOrg();
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ordered = [...orgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const fromIdx = ordered.findIndex((o) => o.id === dragId);
    const toIdx = ordered.findIndex((o) => o.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); return; }
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    setDragId(null);
    // Persist new order
    await Promise.all(
      ordered.map((o, i) =>
        supabase.from("orgs").update({ display_order: i } as never).eq("id", o.id)
      )
    );
    await refreshOrgs();
    toast.success("Order saved");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {orgs.map((o) => {
        const active = activeId === o.id;
        return (
          <div
            key={o.id}
            draggable
            onDragStart={() => setDragId(o.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(o.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            style={{
              background: active ? `${o.color}22` : "var(--bg-glass-1)",
              border: `1px solid ${active ? o.color : "var(--border-glass)"}`,
              color: active ? o.color : "var(--text-secondary)",
              opacity: dragId === o.id ? 0.4 : 1,
            }}
            onClick={() => onSelect(o.id)}
          >
            <GripVertical size={11} style={{ opacity: 0.4, cursor: "grab" }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{o.short_name || o.name}</span>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
        style={{
          background: "var(--bg-glass-1)",
          border: "1px dashed var(--border-glass)",
          color: "var(--text-secondary)",
        }}
      >
        <Plus size={12} /> Add Org
      </button>
      <div className="ml-auto flex gap-2">
        {activeId && (
          <button onClick={onEdit} className="btn-ghost" style={{ padding: "8px 12px" }}>
            <Cog size={12} /> Edit Org
          </button>
        )}
        <button onClick={onAdd} className="btn-primary" style={{ padding: "8px 14px" }}>
          <Plus size={12} /> Add Org
        </button>
      </div>
    </div>
  );
}
