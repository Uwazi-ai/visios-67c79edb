import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { Field } from "@/components/settings/SectionCard";
import { OrgColorPicker } from "./OrgColorPicker";
import { SlugInput } from "./SlugInput";
import { OrgPill } from "./OrgPill";
import { ORG_TYPES, RELATIONSHIP_LABELS, DEFAULT_ORG_COLOR, deriveShortName, slugify } from "@/lib/orgColors";

interface OrgRecord {
  id?: string;
  name: string;
  short_name: string;
  slug: string;
  color: string;
  org_type: string;
  description: string;
  priorities: string[];
  success_metric: string;
  drive_folder_id: string;
  pipeline_stages: [string, string, string, string];
  relationship_label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingOrg?: any | null;
  onCreated?: (orgId: string) => void;
}

const EMPTY: OrgRecord = {
  name: "",
  short_name: "",
  slug: "",
  color: DEFAULT_ORG_COLOR,
  org_type: "startup",
  description: "",
  priorities: ["", "", ""],
  success_metric: "",
  drive_folder_id: "",
  pipeline_stages: ["Prospect", "Intro", "Active Partner", "Ecosystem"],
  relationship_label: "Partners",
};

export function AddOrgWizard({ open, onOpenChange, editingOrg, onCreated }: Props) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { refreshOrgs, setActiveOrgId } = useOrg();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OrgRecord>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortTouched, setShortTouched] = useState(false);
  const [slugValid, setSlugValid] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!editingOrg?.id;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (editingOrg) {
      setData({
        id: editingOrg.id,
        name: editingOrg.name ?? "",
        short_name: editingOrg.short_name ?? deriveShortName(editingOrg.name ?? ""),
        slug: editingOrg.slug ?? "",
        color: editingOrg.color || DEFAULT_ORG_COLOR,
        org_type: editingOrg.org_type ?? "startup",
        description: editingOrg.description ?? "",
        priorities: Array.isArray(editingOrg.priorities) && editingOrg.priorities.length === 3
          ? editingOrg.priorities
          : [(editingOrg.priorities?.[0] ?? ""), (editingOrg.priorities?.[1] ?? ""), (editingOrg.priorities?.[2] ?? "")],
        success_metric: editingOrg.success_metric ?? editingOrg.success_definition ?? "",
        drive_folder_id: editingOrg.drive_folder_id ?? "",
        pipeline_stages: ((Array.isArray(editingOrg.pipeline_stages) && editingOrg.pipeline_stages.length === 4)
          ? editingOrg.pipeline_stages
          : (Array.isArray(editingOrg.stage_labels) && editingOrg.stage_labels.length === 4)
          ? editingOrg.stage_labels
          : EMPTY.pipeline_stages) as [string, string, string, string],
        relationship_label: editingOrg.relationship_label ?? "Partners",
      });
      setSlugTouched(true);
      setShortTouched(true);
      setSlugValid(true);
    } else {
      setData(EMPTY);
      setSlugTouched(false);
      setShortTouched(false);
      setSlugValid(false);
    }
  }, [open, editingOrg]);

  // Auto-derive short_name and slug from name
  useEffect(() => {
    if (!shortTouched) setData((d) => ({ ...d, short_name: deriveShortName(d.name) }));
    if (!slugTouched) setData((d) => ({ ...d, slug: slugify(d.name) }));
  }, [data.name, shortTouched, slugTouched]);

  const canNext1 = data.name.trim().length > 0 && data.short_name.trim().length > 0 && (slugValid || (isEdit && data.slug === editingOrg?.slug));
  const canNext2 = true;
  const canCreate = canNext1;

  const applyTypeTemplate = (typeValue: string) => {
    const t = ORG_TYPES.find((x) => x.value === typeValue);
    if (t) {
      setData((d) => ({
        ...d,
        org_type: typeValue,
        pipeline_stages: t.stages,
        relationship_label: t.relationship,
      }));
    }
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    if (!canCreate) { toast.error("Fix validation errors first"); return; }
    setSaving(true);
    const payload = {
      name: data.name.trim(),
      short_name: data.short_name.trim().toUpperCase().slice(0, 10),
      slug: data.slug.trim(),
      color: data.color,
      org_type: data.org_type,
      description: data.description || null,
      priorities: data.priorities.filter((p) => p.trim()),
      success_metric: data.success_metric || null,
      success_definition: data.success_metric || null,
      drive_folder_id: data.drive_folder_id || null,
      pipeline_stages: data.pipeline_stages,
      stage_labels: data.pipeline_stages,
      relationship_label: data.relationship_label,
    };

    if (isEdit) {
      const { error } = await supabase.from("orgs").update(payload as never).eq("id", editingOrg.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`${payload.name} updated ✓`);
      await refreshOrgs();
      onOpenChange(false);
      return;
    }

    const { data: created, error } = await supabase
      .from("orgs")
      .insert({ ...payload, created_by: user.id, is_active: true } as never)
      .select("id")
      .single();
    setSaving(false);
    if (error || !created) {
      toast.error(error?.message || "Failed to create org");
      return;
    }
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: [data.color, "#fff", "#60A5FA"] });
    toast.success(`${payload.name} created ✓`);
    await refreshOrgs();
    setActiveOrgId((created as any).id);
    onCreated?.((created as any).id);
    onOpenChange(false);
  };

  const header = (
    <div className="flex items-center justify-between mb-1">
      <div>
        <div className="t-card-title" style={{ fontSize: 16, fontWeight: 600 }}>
          {isEdit ? "Edit Organization" : "Add Organization"}
        </div>
        <div className="t-mono mt-1" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          Step {step} of 3
        </div>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} style={{ width: 24, height: 3, borderRadius: 2, background: n <= step ? data.color : "var(--bg-glass-2)" }} />
        ))}
      </div>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-4 mt-4">
      {step === 1 && (
        <>
          <Field label="Organization Name *">
            <input className="input-glass" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="UWAZI" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Short Name" hint="Used in pills and nav (max 10 chars)">
              <input
                className="input-glass uppercase"
                maxLength={10}
                value={data.short_name}
                onChange={(e) => { setShortTouched(true); setData({ ...data, short_name: e.target.value.toUpperCase() }); }}
              />
            </Field>
            <Field label="URL Slug">
              <SlugInput
                value={data.slug}
                onChange={(v) => { setSlugTouched(true); setData({ ...data, slug: v }); }}
                ignoreOrgId={editingOrg?.id}
                onValidityChange={setSlugValid}
              />
            </Field>
          </div>
          <Field label="Org Color">
            <OrgColorPicker value={data.color} onChange={(hex) => setData({ ...data, color: hex })} />
          </Field>
          <Field label="Preview">
            <OrgPill name={data.name || "ORG"} shortName={data.short_name} color={data.color} active />
          </Field>
          <Field label="Org Type">
            <div className="flex flex-wrap gap-1.5">
              {ORG_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => applyTypeTemplate(t.value)}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: data.org_type === t.value ? "var(--bg-glass-active)" : "var(--bg-glass-1)",
                    border: `1px solid ${data.org_type === t.value ? "var(--border-active)" : "var(--border-glass)"}`,
                    color: data.org_type === t.value ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Description" hint="Vision reads this for org-aware reasoning">
            <textarea className="input-glass" rows={3} value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="What does this org do? Who does it serve?" />
          </Field>
          <Field label="Top 3 priorities this quarter">
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  className="input-glass"
                  placeholder={`${i + 1}. Priority`}
                  value={data.priorities[i] ?? ""}
                  onChange={(e) => {
                    const next = [...data.priorities];
                    next[i] = e.target.value;
                    setData({ ...data, priorities: next });
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="What success looks like">
            <input className="input-glass" value={data.success_metric} onChange={(e) => setData({ ...data, success_metric: e.target.value })} placeholder="e.g. 10 active partners by Q4" />
          </Field>
          <Field label="Google Drive root folder" hint="Folder ID or shared URL (optional)">
            <input className="input-glass" value={data.drive_folder_id} onChange={(e) => setData({ ...data, drive_folder_id: e.target.value })} placeholder="https://drive.google.com/drive/folders/..." />
          </Field>
        </>
      )}

      {step === 3 && (
        <>
          <Field label="Relationship label">
            <div className="flex flex-wrap gap-1.5">
              {RELATIONSHIP_LABELS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setData({ ...data, relationship_label: r })}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: data.relationship_label === r ? "var(--bg-glass-active)" : "var(--bg-glass-1)",
                    border: `1px solid ${data.relationship_label === r ? "var(--border-active)" : "var(--border-glass)"}`,
                    color: data.relationship_label === r ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Quick-fill stage templates">
            <div className="flex flex-wrap gap-1.5">
              {ORG_TYPES.slice(0, 4).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setData({ ...data, pipeline_stages: t.stages, relationship_label: t.relationship })}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "var(--bg-glass-1)",
                    border: "1px solid var(--border-glass)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Pipeline stages">
            <div className="grid grid-cols-2 gap-2">
              {data.pipeline_stages.map((s, i) => (
                <input
                  key={i}
                  className="input-glass"
                  value={s}
                  onChange={(e) => {
                    const next = [...data.pipeline_stages] as [string, string, string, string];
                    next[i] = e.target.value;
                    setData({ ...data, pipeline_stages: next });
                  }}
                  placeholder={`Stage ${i + 1}`}
                />
              ))}
            </div>
          </Field>
        </>
      )}

      <div className="flex items-center justify-between pt-3 sticky bottom-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => s - 1))}
          disabled={saving}
        >
          {step === 1 ? <><X size={12} /> Cancel</> : <><ArrowLeft size={12} /> Back</>}
        </button>
        {step < 3 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={step === 1 ? !canNext1 : !canNext2}
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ArrowRight size={12} />
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={saving || !canCreate} onClick={handleSubmit}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {isEdit ? "Save Changes" : "Create Org"}
          </button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto" style={{ background: "var(--bg-void, #02020A)" }}>
          {header}
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{isEdit ? "Edit Organization" : "Add Organization"}</DialogTitle>
        </DialogHeader>
        {header}
        {body}
      </DialogContent>
    </Dialog>
  );
}
