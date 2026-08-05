import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2, ExternalLink, Save, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";
import { CardPreview, type CardData } from "@/components/card/CardPreview";
import { toast } from "sonner";

interface CustomLink { label: string; url: string }

interface FormState {
  username: string;
  display_name: string;
  avatar_url: string;
  title: string;
  company: string;
  tagline: string;
  email: string;
  phone: string;
  linkedin_url: string;
  website_url: string;
  card_theme: "dark" | "light";
  custom_links: CustomLink[];
  primary_org_id: string;
}

const empty: FormState = {
  username: "", display_name: "", avatar_url: "", title: "", company: "",
  tagline: "", email: "", phone: "", linkedin_url: "", website_url: "",
  card_theme: "dark", custom_links: [], primary_org_id: "",
};

const MyCardSettings = () => {
  const { user } = useAuth();
  const { orgs } = useOrg();
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: pub }, { data: privRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name, avatar_url, title, company, tagline, email, linkedin_url, website_url, card_theme, custom_links, primary_org_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("get_my_profile_private"),
      ]);
      const priv = (Array.isArray(privRows) ? privRows[0] : null) as any;
      const data = pub ? ({ ...pub, phone: priv?.phone ?? null } as any) : null;
      if (data) {
        const links = Array.isArray(data.custom_links) ? (data.custom_links as unknown as CustomLink[]) : [];
        setForm({
          username: data.username || "",
          display_name: data.display_name || "",
          avatar_url: data.avatar_url || "",
          title: (data.title as string) || "",
          company: (data.company as string) || "",
          tagline: (data.tagline as string) || "",
          email: data.email || "",
          phone: (data.phone as string) || "",
          linkedin_url: (data.linkedin_url as string) || "",
          website_url: (data.website_url as string) || "",
          card_theme: ((data.card_theme as string) === "light" ? "light" : "dark"),
          custom_links: links.slice(0, 5),
          primary_org_id: (data.primary_org_id as string) || "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addLink = () => {
    if (form.custom_links.length >= 5) return;
    setForm((f) => ({ ...f, custom_links: [...f.custom_links, { label: "", url: "" }] }));
  };
  const updateLink = (i: number, patch: Partial<CustomLink>) =>
    setForm((f) => ({ ...f, custom_links: f.custom_links.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const removeLink = (i: number) =>
    setForm((f) => ({ ...f, custom_links: f.custom_links.filter((_, idx) => idx !== i) }));

  const cardUrl = useMemo(() => {
    if (typeof window === "undefined" || !form.username) return "";
    return `${window.location.origin}/card/${form.username}`;
  }, [form.username]);

  const previewData: CardData = useMemo(() => {
    const orgSlug = orgs.find((o) => o.id === form.primary_org_id)?.slug ?? null;
    return {
      username: form.username || null,
      display_name: form.display_name || null,
      avatar_url: form.avatar_url || null,
      title: form.title || null,
      company: form.company || null,
      tagline: form.tagline || null,
      email: form.email || null,
      phone: form.phone || null,
      linkedin_url: form.linkedin_url || null,
      website_url: form.website_url || null,
      card_theme: form.card_theme,
      custom_links: form.custom_links.filter((l) => l.url.trim()),
      primary_org_slug: orgSlug,
    };
  }, [form, orgs]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const slug = form.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const payload = {
      id: user.id,
      email: user.email ?? form.email ?? "",
      username: slug || null,
      display_name: form.display_name.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      title: form.title.trim() || null,
      company: form.company.trim() || null,
      tagline: form.tagline.trim() || null,
      phone: form.phone.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      website_url: form.website_url.trim() || null,
      card_theme: form.card_theme,
      custom_links: form.custom_links.filter((l) => l.url.trim()).slice(0, 5),
      primary_org_id: form.primary_org_id || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload as never, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That username is taken" : error.message);
      return;
    }
    if (slug) update("username", slug);
    toast.success("Card saved");
  };

  const copyUrl = () => {
    if (!cardUrl) return;
    navigator.clipboard.writeText(cardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (loading) {
    return (
      <div className="glass flex items-center justify-center" style={{ minHeight: 240, color: "var(--text-muted)" }}>
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-enter flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="t-hero" style={{ fontSize: 36 }}>My Digital Card</h1>
          <div className="t-mono mt-1">Your Popl-style shareable identity</div>
        </div>
        <div className="flex items-center gap-2">
          {cardUrl && (
            <>
              <button onClick={copyUrl} className="btn-ghost" title="Copy link">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy URL"}
              </button>
              <Link to={`/card/${form.username}`} target="_blank" className="btn-ghost">
                <ExternalLink size={12} /> Open
              </Link>
            </>
          )}
          <button onClick={save} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 flex-1 min-h-0">
        {/* Editor */}
        <div className="glass p-5 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Section title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Display name">
                <input className="input-glass" value={form.display_name} onChange={(e) => update("display_name", e.target.value)} placeholder="Jane Doe" />
              </Field>
              <Field label="Username (URL slug)">
                <input className="input-glass" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="janedoe" />
              </Field>
            </div>
            <Field label="Avatar URL">
              <input className="input-glass" value={form.avatar_url} onChange={(e) => update("avatar_url", e.target.value)} placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title">
                <input className="input-glass" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Founder & CEO" />
              </Field>
              <Field label="Company">
                <input className="input-glass" value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Kova" />
              </Field>
            </div>
            <Field label={`Tagline (${form.tagline.length}/80)`}>
              <input className="input-glass" maxLength={80} value={form.tagline}
                onChange={(e) => update("tagline", e.target.value)} placeholder="Building the OS for multi-venture founders." />
            </Field>
          </Section>

          <Section title="Branding">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary org">
                <select className="input-glass" value={form.primary_org_id} onChange={(e) => update("primary_org_id", e.target.value)}>
                  <option value="">— Personal (indigo) —</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              <Field label="Card theme">
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => update("card_theme", t)}
                      className={form.card_theme === t ? "btn-primary" : "btn-ghost"}
                      style={{ flex: 1, justifyContent: "center", textTransform: "capitalize" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><input className="input-glass" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jane@visi.com" /></Field>
              <Field label="Phone"><input className="input-glass" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555 123 4567" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LinkedIn"><input className="input-glass" value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" /></Field>
              <Field label="Website"><input className="input-glass" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://…" /></Field>
            </div>
          </Section>

          <Section title={`Custom links (${form.custom_links.length}/5)`}>
            <div className="flex flex-col gap-2">
              {form.custom_links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input-glass" placeholder="Label" value={l.label} onChange={(e) => updateLink(i, { label: e.target.value })} style={{ flex: "0 0 30%" }} />
                  <input className="input-glass" placeholder="https://…" value={l.url} onChange={(e) => updateLink(i, { url: e.target.value })} style={{ flex: 1 }} />
                  <button onClick={() => removeLink(i)} className="btn-icon" aria-label="Remove">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {form.custom_links.length < 5 && (
                <button onClick={addLink} className="btn-ghost" style={{ alignSelf: "start" }}>
                  <Plus size={12} /> Add link
                </button>
              )}
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div className="flex flex-col items-center gap-3">
          <div className="t-mono">Live preview</div>
          <div
            style={{
              width: 320, maxWidth: "100%",
              borderRadius: 36,
              padding: 8,
              background: "linear-gradient(180deg, #1a1a2e, #02020A)",
              border: "1px solid var(--border-glass)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{
              borderRadius: 28, overflow: "hidden",
              background: form.card_theme === "light" ? "#F8FAFC" : "#02020A",
              minHeight: 560, maxHeight: 640, overflowY: "auto",
            }}>
              <CardPreview data={previewData} cardUrl={cardUrl || undefined} />
            </div>
          </div>
          {form.username && (
            <div className="t-mono text-center" style={{ fontSize: 10, wordBreak: "break-all" }}>
              {cardUrl}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="t-mono mb-2" style={{ fontSize: 10 }}>{title}</div>
    <div className="flex flex-col gap-3">{children}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="t-mono block mb-1.5" style={{ fontSize: 10 }}>{label}</label>
    {children}
  </div>
);

export default MyCardSettings;
