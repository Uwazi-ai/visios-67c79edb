import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { stagesForOrg } from "@/lib/engagementStages";
import type { ContactRow } from "@/pages/Contacts";

interface Prefill {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  role?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  orgs: Array<{ id: string; slug: string; name: string }>;
  defaultOrgId?: string | null;
  contact?: ContactRow | null; // edit mode if provided
  prefill?: Prefill | null;
  source?: string; // e.g. 'card_scan'
}

export const ContactModal = ({ open, onClose, onSaved, orgs, defaultOrgId, contact, prefill, source }: Props) => {
  const editing = !!contact;
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState("prospect");

  useEffect(() => {
    if (!open) return;
    if (contact) {
      setName(contact.name);
      setEmail(contact.email ?? "");
      setCompany(contact.company ?? "");
      setRole(contact.role ?? "");
      setOrgId(contact.org_id ?? "");
      setLinkedinUrl(contact.linkedin_url ?? "");
      setPhone(contact.phone ?? "");
      setNotes(contact.notes ?? "");
      setStage(contact.engagement_stage ?? "prospect");
    } else {
      setName(prefill?.name ?? "");
      setEmail(prefill?.email ?? "");
      setCompany(prefill?.company ?? "");
      setRole(prefill?.role ?? "");
      setOrgId(defaultOrgId ?? orgs[0]?.id ?? "");
      setLinkedinUrl(prefill?.linkedin_url ?? "");
      setPhone(prefill?.phone ?? "");
      setNotes(prefill?.notes ?? "");
      setStage("prospect");
    }
    setErr(null);
  }, [open, contact, defaultOrgId, orgs, prefill]);

  if (!open) return null;

  // Track which fields came from a prefill so we can show "AI extracted" badges
  const prefilled = (key: keyof Prefill) => !!prefill && prefill[key] != null && prefill[key] !== "";

  const orgSlug = orgs.find((o) => o.id === orgId)?.slug;
  const stages = stagesForOrg(orgSlug);

  const save = async () => {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    if (!orgId) {
      setErr("Org is required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        company: company.trim() || null,
        role: role.trim() || null,
        org_id: orgId,
        linkedin_url: linkedinUrl.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        engagement_stage: stage,
      };
      if (editing && contact) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", contact.id);
        if (error) throw error;
        onSaved(contact.id);
      } else {
        const insertPayload = {
          ...payload,
          last_touched_at: new Date().toISOString(),
          metadata: source ? { source } : {},
        };
        const { data, error } = await supabase
          .from("contacts")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) throw error;
        if (data) {
          // Log a card-scan interaction so it shows in the timeline
          if (source === "card_scan") {
            await supabase.from("contact_interactions").insert({
              contact_id: data.id,
              org_id: orgId,
              type: "note",
              source: "card_scan",
              title: "Business card scanned",
              summary: "Contact created from a scanned business card.",
              occurred_at: new Date().toISOString(),
            });
          }
          onSaved(data.id);
        }
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-elevated p-5 w-full max-w-lg"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="t-section">{editing ? "Edit Contact" : source === "card_scan" ? "Review Scanned Card" : "Add Contact"}</h3>
            {source === "card_scan" && (
              <div className="t-mono mt-1" style={{ fontSize: 10, color: "var(--text-accent)" }}>
                ✨ AI extracted — please verify before saving
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        <div className="space-y-3">
          <Field label="Name *" extracted={prefilled("name")}>
            <input className="input-glass" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" extracted={prefilled("email")}>
              <input className="input-glass" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </Field>
            <Field label="Phone" extracted={prefilled("phone")}>
              <input className="input-glass" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555…" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company" extracted={prefilled("company")}>
              <input className="input-glass" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
            </Field>
            <Field label="Role / Title" extracted={prefilled("role")}>
              <input className="input-glass" value={role} onChange={(e) => setRole(e.target.value)} placeholder="CEO" />
            </Field>
          </div>
          <Field label="LinkedIn URL" extracted={prefilled("linkedin_url")}>
            <input className="input-glass" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Org *">
              <select className="input-glass" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">— Select —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select className="input-glass" value={stage} onChange={(e) => setStage(e.target.value)}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className="input-glass"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ resize: "vertical" }}
            />
          </Field>

          {err && <div style={{ fontSize: 12, color: "var(--sev-critical)" }}>{err}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={saving}>
              {saving && <Loader2 size={12} className="animate-spin" />}
              {editing ? "Save" : "Create Contact"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="t-mono block mb-1.5" style={{ fontSize: 10 }}>{label}</label>
    {children}
  </div>
);
