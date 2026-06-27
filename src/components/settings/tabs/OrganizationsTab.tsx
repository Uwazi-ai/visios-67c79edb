import { useEffect, useState } from "react";
import { Loader2, Save, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import SectionCard, { Field } from "../SectionCard";
import { OrgTabBar } from "@/components/orgs/OrgTabBar";
import { AddOrgWizard } from "@/components/orgs/AddOrgWizard";
import { ArchiveOrgPanel } from "@/components/orgs/ArchiveOrgPanel";
import { ArchivedOrgsList } from "@/components/orgs/ArchivedOrgsList";
import { OrgPill } from "@/components/orgs/OrgPill";
import TeamInvitesPanel from "../TeamInvitesPanel";

interface OrgRow {
  id: string;
  name: string;
  short_name?: string | null;
  slug: string;
  color: string;
  description?: string | null;
  priorities?: any;
  success_metric?: string | null;
  success_definition?: string | null;
  pipeline_stages?: any;
  stage_labels?: any;
  relationship_label?: string | null;
  org_type?: string | null;
  drive_folder_id?: string | null;
  display_order?: number | null;
  is_active?: boolean;
}

export default function OrganizationsTab() {
  const { orgs, refreshOrgs, setActiveOrgId } = useOrg();
  const [activeId, setActiveId] = useState<string>("");
  const [data, setData] = useState<Record<string, OrgRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [archivedKey, setArchivedKey] = useState(0);

  const load = async () => {
    const { data: rows } = await supabase.rpc("list_owned_orgs_full");
    const active = ((rows ?? []) as any[]).filter((r) => r.is_active !== false);
    const map: Record<string, OrgRow> = {};
    active.forEach((r: any) => { map[r.id] = r; });
    setData(map);
    if (active[0] && !activeId) setActiveId(active[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [orgs.length]);

  const cur = activeId ? data[activeId] : null;

  const upd = (patch: Partial<OrgRow>) => {
    if (!cur) return;
    setData((d) => ({ ...d, [cur.id]: { ...cur, ...patch } }));
  };

  const priorities: string[] = Array.isArray(cur?.priorities) ? (cur!.priorities as string[]) : ["", "", ""];
  const stageLabels: string[] = Array.isArray(cur?.pipeline_stages) && (cur!.pipeline_stages as any[]).length === 4
    ? (cur!.pipeline_stages as string[])
    : Array.isArray(cur?.stage_labels) && (cur!.stage_labels as any[]).length === 4
    ? (cur!.stage_labels as string[])
    : ["Prospect", "Intro", "Active", "Champion"];

  const updPriority = (i: number, v: string) => {
    const next = [...(priorities ?? ["", "", ""])];
    while (next.length < 3) next.push("");
    next[i] = v;
    upd({ priorities: next });
  };

  const updStage = (i: number, v: string) => {
    const next = [...stageLabels] as [string, string, string, string];
    next[i] = v;
    upd({ pipeline_stages: next, stage_labels: next });
  };

  const save = async () => {
    if (!cur) return;
    setSaving(true);
    const { error } = await supabase.from("orgs").update({
      name: cur.name,
      color: cur.color,
      short_name: cur.short_name,
      description: cur.description ?? null,
      priorities: (priorities ?? []).filter((p) => p?.trim()),
      success_metric: cur.success_metric ?? null,
      success_definition: cur.success_metric ?? null,
      pipeline_stages: stageLabels,
      stage_labels: stageLabels,
      relationship_label: cur.relationship_label ?? "Partners",
    } as never).eq("id", cur.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved ✓");
    await refreshOrgs();
  };

  const openAdd = () => { setEditing(null); setWizardOpen(true); };
  const openEdit = () => { if (cur) { setEditing(cur); setWizardOpen(true); } };

  if (loading) return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;

  if (orgs.length === 0) {
    return (
      <>
        <div className="glass p-10 flex flex-col items-center justify-center text-center" style={{ minHeight: 320 }}>
          <div className="t-card-title mb-2" style={{ fontSize: 14, color: "var(--text-primary)" }}>No organizations yet</div>
          <div className="t-mono mb-5" style={{ fontSize: 11 }}>Add your first organization to get started</div>
          <button className="btn-primary" onClick={openAdd}><Plus size={12} /> Create Your First Org</button>
        </div>
        <ArchivedOrgsList refreshKey={archivedKey} />
        <AddOrgWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          editingOrg={editing}
          onCreated={(id) => { setActiveId(id); setActiveOrgId(id); load(); }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OrgTabBar
        orgs={orgs.map((o: any) => ({ id: o.id, name: o.name, short_name: o.short_name, color: o.color, display_order: o.display_order }))}
        activeId={activeId}
        onSelect={setActiveId}
        onAdd={openAdd}
        onEdit={openEdit}
      />

      {cur && (
        <SectionCard
          title={cur.name}
          subtitle="Vision uses this context for org-aware reasoning."
        >
          <div className="flex items-center gap-2">
            <OrgPill name={cur.name} shortName={cur.short_name} color={cur.color} active />
            <span className="t-mono" style={{ fontSize: 10 }}>/{cur.slug}</span>
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
            <input className="input-glass" value={cur.success_metric ?? cur.success_definition ?? ""} onChange={(e) => upd({ success_metric: e.target.value })} />
          </Field>

          <Field label="Pipeline stages">
            <div className="grid grid-cols-2 gap-2">
              {stageLabels.map((s, i) => (
                <input key={i} className="input-glass" value={s} onChange={(e) => updStage(i, e.target.value)} placeholder={`Stage ${i + 1}`} />
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

      {cur && <TeamInvitesPanel orgId={cur.id} orgName={cur.name} />}

      {cur && orgs.length >= 2 && (
        <ArchiveOrgPanel
          orgId={cur.id}
          orgName={cur.name}
          onArchived={() => {
            const remaining = orgs.filter((o) => o.id !== cur.id);
            if (remaining[0]) setActiveId(remaining[0].id);
            setArchivedKey((k) => k + 1);
          }}
        />
      )}

      <ArchivedOrgsList refreshKey={archivedKey} />

      <AddOrgWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editingOrg={editing}
        onCreated={(id) => { setActiveId(id); setActiveOrgId(id); load(); }}
      />
    </div>
  );
}
