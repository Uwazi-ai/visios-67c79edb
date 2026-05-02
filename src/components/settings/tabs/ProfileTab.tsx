import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { saveProfile, savePreferences } from "@/lib/settingsHelpers";
import SectionCard, { Field } from "../SectionCard";

interface ProfileForm {
  display_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  timezone: string;
  primary_org_id: string;
  tagline: string;
  avatar_url: string;
  preferences: any;
}

const TIMEZONES = [
  "America/Chicago", "America/New_York", "America/Los_Angeles", "America/Denver",
  "Europe/London", "Europe/Paris", "Asia/Singapore", "Asia/Dubai", "UTC",
];

const empty: ProfileForm = {
  display_name: "", preferred_name: "", email: "", phone: "", timezone: "America/Chicago",
  primary_org_id: "", tagline: "", avatar_url: "", preferences: {},
};

export default function ProfileTab() {
  const { user } = useAuth();
  const { orgs } = useOrg();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name,preferred_name,email,phone,timezone,primary_org_id,tagline,avatar_url,preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          display_name: data.display_name ?? "",
          preferred_name: data.preferred_name ?? "",
          email: data.email ?? user.email ?? "",
          phone: data.phone ?? "",
          timezone: data.timezone ?? "America/Chicago",
          primary_org_id: data.primary_org_id ?? "",
          tagline: data.tagline ?? "",
          avatar_url: data.avatar_url ?? "",
          preferences: (data as any).preferences ?? {},
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const upd = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onPickAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    upd("avatar_url", pub.publicUrl);
    await saveProfile(user.id, { avatar_url: pub.publicUrl }, { silent: true });
    setUploading(false);
    toast.success("Photo updated");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await saveProfile(user.id, {
      display_name: form.display_name || null,
      preferred_name: form.preferred_name || null,
      phone: form.phone || null,
      timezone: form.timezone,
      primary_org_id: form.primary_org_id || null,
      tagline: form.tagline || null,
    });
    setSaving(false);
  };

  const updatePref = (patch: any) => {
    if (!user) return;
    const next = { ...(form.preferences ?? {}), ...patch };
    upd("preferences", next);
    savePreferences(user.id, form.preferences ?? {}, patch);
  };

  if (loading) {
    return <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}><Loader2 className="animate-spin" size={18} /></div>;
  }

  const prefs = form.preferences ?? {};

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Personal Information" subtitle="Identity used across Visi OS, Digital Card, and Vision context.">
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative rounded-full overflow-hidden flex items-center justify-center"
            style={{ width: 80, height: 80, background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)" }}
          >
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={20} style={{ color: "var(--text-muted)" }} />
            )}
            {uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="animate-spin" size={16} /></div>}
          </button>
          <div className="t-mono" style={{ fontSize: 10 }}>
            <div>Profile photo</div>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost mt-2" style={{ fontSize: 10 }}>Upload</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onPickAvatar(e.target.files[0])} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name"><input className="input-glass" value={form.display_name} onChange={(e) => upd("display_name", e.target.value)} /></Field>
          <Field label="Display name"><input className="input-glass" value={form.preferred_name} onChange={(e) => upd("preferred_name", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email (read-only)"><input className="input-glass" value={form.email} readOnly style={{ opacity: 0.6 }} /></Field>
          <Field label="Phone"><input className="input-glass" value={form.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="+1 555 123 4567" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time zone">
            <select className="input-glass" value={form.timezone} onChange={(e) => upd("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Primary org">
            <select className="input-glass" value={form.primary_org_id} onChange={(e) => upd("primary_org_id", e.target.value)}>
              <option value="">— Personal —</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label={`Bio / tagline (${form.tagline.length}/120)`}>
          <input className="input-glass" maxLength={120} value={form.tagline} onChange={(e) => upd("tagline", e.target.value)} placeholder="One line — used in Digital Card and Vision context" />
        </Field>

        <div className="flex justify-end pt-2">
          <button onClick={save} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Changes
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Preferences" subtitle="Controls for theme, daily brief, and date display.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Theme">
            <div className="flex gap-2">
              {(["dark", "light", "system"] as const).map((t) => (
                <button key={t} onClick={() => updatePref({ theme: t })} className={(prefs.theme ?? "dark") === t ? "btn-primary" : "btn-ghost"} style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Default org view">
            <select className="input-glass" value={prefs.default_org ?? "all"} onChange={(e) => updatePref({ default_org: e.target.value })}>
              <option value="all">All Orgs</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Morning brief time">
            <select className="input-glass" value={prefs.brief_time ?? "07:00"} onChange={(e) => updatePref({ brief_time: e.target.value })}>
              {["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Brief length">
            <div className="flex gap-2">
              {(["concise", "standard", "detailed"] as const).map((t) => (
                <button key={t} onClick={() => updatePref({ brief_length: t })} className={(prefs.brief_length ?? "standard") === t ? "btn-primary" : "btn-ghost"} style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Date format">
          <select className="input-glass" value={prefs.date_format ?? "MM/DD/YYYY"} onChange={(e) => updatePref({ date_format: e.target.value })}>
            <option>MM/DD/YYYY</option>
            <option>DD/MM/YYYY</option>
            <option>YYYY-MM-DD</option>
          </select>
        </Field>
      </SectionCard>
    </div>
  );
}
