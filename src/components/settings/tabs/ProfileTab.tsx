import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Camera, Upload, AtSign, Linkedin, Instagram, Twitter, Mail, Phone as PhoneIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { saveProfile, savePreferences } from "@/lib/settingsHelpers";
import SectionCard, { Field } from "../SectionCard";

interface ProfileForm {
  display_name: string;
  full_name: string; // stored in preferred_name
  email: string;
  phone: string;
  title: string;
  bio: string; // stored in tagline
  avatar_url: string;
  linkedin_url: string;
  twitter: string;
  instagram: string;
  timezone: string;
  primary_org_id: string;
  preferences: any;
  custom_links: any;
}

const TIMEZONES = [
  "America/Chicago", "America/New_York", "America/Los_Angeles", "America/Denver",
  "Europe/London", "Europe/Paris", "Asia/Singapore", "Asia/Dubai", "UTC",
];

const empty: ProfileForm = {
  display_name: "", full_name: "", email: "", phone: "", title: "", bio: "",
  avatar_url: "", linkedin_url: "", twitter: "", instagram: "",
  timezone: "America/Chicago", primary_org_id: "",
  preferences: {}, custom_links: {},
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const HUE_COLORS = ["#60A5FA", "#34D399", "#F59E0B", "#A78BFA", "#F472B6", "#22D3EE", "#FB7185", "#9bd34b"];
function colorForUser(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HUE_COLORS[h % HUE_COLORS.length];
}
function initialsOf(name: string) {
  const n = name.trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}
function normalizeHandle(v: string) {
  return v.trim().replace(/^@+/, "");
}

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
      const [{ data: pub }, { data: privRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,preferred_name,email,timezone,primary_org_id,tagline,avatar_url,title,linkedin_url,custom_links")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("get_my_profile_private"),
      ]);
      const priv = (Array.isArray(privRows) ? privRows[0] : null) as any;
      const data = pub ? ({ ...pub, phone: priv?.phone ?? null, preferences: priv?.preferences ?? {} } as any) : null;
      if (data) {
        const links = (data as any).custom_links ?? {};
        setForm({
          display_name: data.display_name ?? "",
          full_name: data.preferred_name ?? "",
          email: data.email ?? user.email ?? "",
          phone: data.phone ?? "",
          title: (data as any).title ?? "",
          bio: data.tagline ?? "",
          avatar_url: data.avatar_url ?? "",
          linkedin_url: (data as any).linkedin_url ?? "",
          twitter: links.twitter ?? "",
          instagram: links.instagram ?? "",
          timezone: data.timezone ?? "America/Chicago",
          primary_org_id: data.primary_org_id ?? "",
          preferences: (data as any).preferences ?? {},
          custom_links: links,
        });
      } else {
        setForm((f) => ({ ...f, email: user.email ?? "" }));
      }
      setLoading(false);
    })();
  }, [user]);

  const upd = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const userColor = useMemo(() => (user ? colorForUser(user.id) : "#60A5FA"), [user]);

  const nameError = useMemo(() => {
    const n = form.display_name.trim();
    if (n.length < 2) return "Display name is required (2–50 chars)";
    if (n.length > 50) return "Display name must be 50 chars or less";
    return null;
  }, [form.display_name]);

  const onPickAvatar = async (file: File) => {
    if (!user) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Photo must be JPG, PNG, or WebP");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo must be 5MB or less");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    upd("avatar_url", url);
    await saveProfile(user.id, { avatar_url: url }, { silent: true });
    setUploading(false);
    toast.success("Photo updated");
  };

  const save = async () => {
    if (!user) return;
    if (nameError) {
      toast.error(nameError);
      return;
    }
    if (form.bio.length > 160) {
      toast.error("Bio must be 160 chars or less");
      return;
    }
    setSaving(true);
    const links = {
      ...(form.custom_links ?? {}),
      twitter: normalizeHandle(form.twitter) || null,
      instagram: normalizeHandle(form.instagram) || null,
    };
    const ok = await saveProfile(user.id, {
      display_name: form.display_name.trim(),
      preferred_name: form.full_name.trim() || null,
      title: form.title.trim() || null,
      tagline: form.bio.trim() || null,
      phone: form.phone.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      custom_links: links,
      timezone: form.timezone,
      primary_org_id: form.primary_org_id || null,
    });
    if (ok) {
      // Broadcast so other modules can refresh immediately
      window.dispatchEvent(new CustomEvent("profile:updated", { detail: { userId: user.id } }));
    }
    setSaving(false);
  };

  const updatePref = (patch: any) => {
    if (!user) return;
    const next = { ...(form.preferences ?? {}), ...patch };
    upd("preferences", next);
    savePreferences(user.id, form.preferences ?? {}, patch);
  };

  if (loading) {
    return (
      <div className="glass flex items-center justify-center" style={{ minHeight: 200 }}>
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  const prefs = form.preferences ?? {};
  const previewName = form.display_name.trim() || "Your Name";
  const previewInitials = initialsOf(previewName);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <SectionCard
          title="Personal Information"
          subtitle="Identity used across Visi OS: Chat, Digital Card, team presence."
        >
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-full overflow-hidden flex items-center justify-center"
              style={{
                width: 88,
                height: 88,
                background: form.avatar_url ? "var(--bg-glass-2)" : `${userColor}22`,
                border: `1px solid ${form.avatar_url ? "var(--border-glass)" : userColor + "55"}`,
                color: userColor,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 28,
              }}
              title="Change photo"
            >
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{previewInitials}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                  <Loader2 className="animate-spin" size={18} />
                </div>
              )}
            </button>
            <div className="flex flex-col gap-2">
              <div className="t-mono" style={{ fontSize: 10 }}>Profile photo</div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  disabled={uploading}
                >
                  <Upload size={11} /> {form.avatar_url ? "Replace" : "Upload"}
                </button>
                {form.avatar_url && (
                  <button
                    onClick={async () => {
                      if (!user) return;
                      upd("avatar_url", "");
                      await saveProfile(user.id, { avatar_url: null }, { silent: true });
                      window.dispatchEvent(new CustomEvent("profile:updated", { detail: { userId: user.id } }));
                      toast.success("Photo removed");
                    }}
                    className="btn-ghost"
                    style={{ fontSize: 11 }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                JPG, PNG, or WebP · max 5MB
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickAvatar(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Display name * (${form.display_name.length}/50)`}>
              <input
                className="input-glass"
                value={form.display_name}
                onChange={(e) => upd("display_name", e.target.value.slice(0, 50))}
                placeholder="Shown in Chat & team views"
                style={nameError && form.display_name.length > 0 ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
              />
              {nameError && form.display_name.length > 0 && (
                <div className="t-mono mt-1" style={{ fontSize: 9, color: "#FCA5A5" }}>{nameError}</div>
              )}
            </Field>
            <Field label="Full name">
              <input
                className="input-glass"
                value={form.full_name}
                onChange={(e) => upd("full_name", e.target.value)}
                placeholder="Legal / formal name"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Role / title">
              <input
                className="input-glass"
                value={form.title}
                onChange={(e) => upd("title", e.target.value)}
                placeholder="Founder, Designer, etc."
              />
            </Field>
            <Field label="Phone">
              <input
                className="input-glass"
                value={form.phone}
                onChange={(e) => upd("phone", e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </Field>
          </div>

          <Field label={`Bio (${form.bio.length}/160)`}>
            <textarea
              className="input-glass"
              value={form.bio}
              onChange={(e) => upd("bio", e.target.value.slice(0, 160))}
              rows={2}
              placeholder="A short line about you — shown on your Digital Card"
              style={{ resize: "vertical", minHeight: 48, fontFamily: "var(--font-body)" }}
            />
          </Field>

          <Field label="Email (read-only)">
            <input className="input-glass" value={form.email} readOnly style={{ opacity: 0.6 }} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="LinkedIn URL">
              <input
                className="input-glass"
                value={form.linkedin_url}
                onChange={(e) => upd("linkedin_url", e.target.value)}
                placeholder="linkedin.com/in/you"
              />
            </Field>
            <Field label="Twitter / X handle">
              <input
                className="input-glass"
                value={form.twitter}
                onChange={(e) => upd("twitter", e.target.value)}
                placeholder="@handle"
              />
            </Field>
            <Field label="Instagram handle">
              <input
                className="input-glass"
                value={form.instagram}
                onChange={(e) => upd("instagram", e.target.value)}
                placeholder="@handle"
              />
            </Field>
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

          <div className="flex justify-end pt-2">
            <button onClick={save} className="btn-primary" disabled={saving || !!nameError}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Changes
            </button>
          </div>
        </SectionCard>

        {/* Live preview card */}
        <div className="flex flex-col gap-3">
          <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
            LIVE PREVIEW · how teammates see you
          </div>
          <div
            className="glass relative overflow-hidden"
            style={{ padding: 20, borderRadius: 14 }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(120% 80% at 0% 0%, ${userColor}22 0%, transparent 60%)`,
                pointerEvents: "none",
              }}
            />
            <div className="relative flex flex-col items-center text-center gap-3">
              <div
                className="rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  width: 84,
                  height: 84,
                  background: form.avatar_url ? "var(--bg-glass-2)" : `${userColor}22`,
                  border: `2px solid ${userColor}55`,
                  color: userColor,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 28,
                }}
              >
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{previewInitials}</span>
                )}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 18,
                    color: "var(--text-primary)",
                    lineHeight: 1.2,
                  }}
                >
                  {previewName}
                </div>
                {form.title && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {form.title}
                  </div>
                )}
              </div>
              {form.bio && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {form.bio}
                </div>
              )}

              <div className="flex flex-col gap-1.5 self-stretch mt-2">
                {form.email && (
                  <PreviewRow icon={<Mail size={11} />} text={form.email} />
                )}
                {form.phone && (
                  <PreviewRow icon={<PhoneIcon size={11} />} text={form.phone} />
                )}
                {form.linkedin_url && (
                  <PreviewRow icon={<Linkedin size={11} />} text={form.linkedin_url} />
                )}
                {form.twitter && (
                  <PreviewRow icon={<Twitter size={11} />} text={`@${normalizeHandle(form.twitter)}`} />
                )}
                {form.instagram && (
                  <PreviewRow icon={<Instagram size={11} />} text={`@${normalizeHandle(form.instagram)}`} />
                )}
              </div>
            </div>
          </div>

          {/* Chat bubble preview */}
          <div className="glass" style={{ padding: 14, borderRadius: 12 }}>
            <div className="t-mono mb-2" style={{ fontSize: 9, color: "var(--text-muted)" }}>
              In Chat
            </div>
            <div className="flex items-start gap-2">
              <div
                className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{
                  width: 32, height: 32,
                  background: form.avatar_url ? "var(--bg-glass-2)" : `${userColor}22`,
                  border: `1px solid ${userColor}44`,
                  color: userColor,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{previewInitials}</span>
                )}
              </div>
              <div className="flex flex-col">
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                  {previewName}
                </span>
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--border-glass)",
                    borderRadius: "12px 12px 12px 3px",
                    padding: "6px 10px",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    marginTop: 2,
                  }}
                >
                  Hey team 👋
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

function PreviewRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        fontSize: 11,
        color: "var(--text-secondary)",
        background: "var(--bg-glass-1)",
        border: "1px solid var(--border-glass)",
        borderRadius: 8,
        padding: "6px 10px",
      }}
    >
      <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>{icon}</span>
      <span className="truncate" style={{ minWidth: 0 }}>{text}</span>
    </div>
  );
}
