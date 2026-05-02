import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";
import { toast } from "sonner";
import SectionCard, { Field } from "../SectionCard";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  description?: string | null;
  priorities?: any;
  success_definition?: string | null;
  stage_labels?: any;
}

const DEFAULT_STAGES = ["Prospect", "Qualified", "Proposal", "Closed"];

export default function OrganizationsTab() {
  const { orgs, refreshOrgs } = useOrg();
  const [activeId, setActiveId] = useState<string>("");
  const [data, setData] = useState<Record<string, OrgRow>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase.from("orgs").select("*");
      const map: Record<string, OrgRow> = {};
      (rows ?? []).forEach((r: any) => { map[r.id] = r; });
      setData(map);
      if (rows?.[0]) setActiveId((rows[0] as any).id);
      setLoading(false);
    })();
  }, []);

  const cur = activeId ? data[activeId] : null;
  const priorities: string[] = Array.isArray(cur?.priorities) ? (cur!.priorities as string[]) : ["", "", ""];
  const stageLabels: string[] = Array.isArray(cur?.stage_labels) && (cur!.stage_labels as any[]).length === 4 ? (cur!.stage_labels as string[]) : DEFAULT_STAGES;

  const upd = (patch: Partial<OrgRow>) => {
    if (!cur) return;
    setData((d) => ({ ...d, [cur.id]: { ...cur, ...patch } }));
  };

  const updPriority = (i: number, v: string) => {
    const next = [...(priorities ?? ["", "", ""])];
    next[i] = v;
    upd({ priorities: next });
  };

  const updStage = (i: number, v: string) => {
    const next = [...stageLabels];
    next[i] = v;
    upd({ stage_labels: next });
  };

  const save = async () => {
    if (!cur) return;
    setSaving(true);
    const { error } = await supabase.from("orgs").update({
      name: cur.name,
      color: cur.color,
      description: cur.description ?? null,
      priorities: (priorities ?? []).filter((p) => p?.trim()),
      success_definition: cur.success_definition ?? null,
      stage_labels: stageLabels,
    } as never).eq("id", cur.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved ✓");
    await refreshOrgs();
  };

  if (loading) return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;
  if (orgs.length === 0) return <div className="glass p-6 t-mono">No organizations yet.</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {orgs.map((o) => {
          const color = ORG_COLORS[o.slug] ?? o.color;
          const isActive = activeId === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setActiveId(o.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: isActive ? `${color}22` : "var(--bg-glass-1)",
                border: `1px solid ${isActive ? color : "var(--border-glass)"}`,
                color: isActive ? color : "var(--text-secondary)",
              }}
            >
              {o.name}
            </button>
          );
        })}
      </div>

      {cur && (
        <SectionCard title={cur.name} subtitle="Vision uses this context for org-aware reasoning.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Org name"><input className="input-glass" value={cur.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
            <Field label="Brand color">
              <div className="flex gap-2 items-center">
                <input type="color" value={cur.color || "#6366F1"} onChange={(e) => upd({ color: e.target.value })} style={{ width: 40, height: 36, background: "transparent", border: "1px solid var(--border-glass)", borderRadius: 8, cursor: "pointer" }} />
                <input className="input-glass" style={{ flex: 1 }} value={cur.color || ""} onChange={(e) => upd({ color: e.target.value })} />
              </div>
            </Field>
          </div>

          <Field label="Description" hint="Vision reads this for every conversation.">
            <textarea className="input-glass" rows={3} value={cur.description ?? ""} onChange={(e) => upd({ description: e.target.value })} placeholder="What this org does, who it serves, current focus." />
          </Field>

          <Field label="Top 3 priorities this quarter">
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <input key={i} className="input-glass" placeholder={`Priority ${i + 1}`} value={priorities[i] ?? ""} onChange={(e) => updPriority(i, e.target.value)} />
              ))}
            </div>
          </Field>

          <Field label="What success looks like">
            <textarea className="input-glass" rows={2} value={cur.success_definition ?? ""} onChange={(e) => upd({ success_definition: e.target.value })} />
          </Field>

          <Field label="CRM pipeline stage labels">
            <div className="grid grid-cols-2 gap-2">
              {stageLabels.map((s, i) => (
                <input key={i} className="input-glass" value={s} onChange={(e) => updStage(i, e.target.value)} placeholder={DEFAULT_STAGES[i]} />
              ))}
            </div>
          </Field>

          <div className="flex justify-end pt-2">
            <button onClick={save} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Changes
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
