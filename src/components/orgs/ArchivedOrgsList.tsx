import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";

interface Row {
  id: string;
  name: string;
  short_name: string | null;
  color: string;
  created_at: string;
}

export function ArchivedOrgsList({ refreshKey }: { refreshKey: number }) {
  const { refreshOrgs } = useOrg();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("orgs")
      .select("id, name, short_name, color, created_at")
      .eq("is_active", false)
      .order("name");
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const restore = async (id: string, name: string) => {
    const { error } = await supabase.from("orgs").update({ is_active: true } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${name} restored`);
    await refreshOrgs();
    await load();
  };

  if (rows.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="t-mono mb-2" style={{ fontSize: 10 }}>── Archived Organizations ──</div>
      <div className="flex flex-col gap-2">
        {rows.map((o) => (
          <div key={o.id} className="glass flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color }} />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{o.name}</span>
              <span className="t-mono" style={{ fontSize: 10 }}>— Archived</span>
            </div>
            <button onClick={() => restore(o.id, o.name)} className="btn-ghost" style={{ padding: "6px 10px" }}>
              <RotateCcw size={12} /> Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
