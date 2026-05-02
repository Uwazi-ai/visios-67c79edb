import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { stagesForOrg } from "@/lib/engagementStages";
import type { ContactRow } from "@/pages/Contacts";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  orgs: Array<{ id: string; slug: string; name: string }>;
  defaultOrgId?: string | null;
  contact?: ContactRow | null; // edit mode if provided
}

export const ContactModal = ({ open, onClose, onSaved, orgs, defaultOrgId, contact }: Props) => {
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
      setName("");
      setEmail("");
      setCompany("");
      setRole("");
      setOrgId(defaultOrgId ?? orgs[0]?.id ?? "");
      setLinkedinUrl("");
      setPhone("");
      setNotes("");
      setStage("prospect");
    }
    setErr(null);
  }, [open, contact, defaultOrgId, orgs]);

  if (!open) return null;

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
        const { data, error } = await supabase
          .from("contacts")
          .insert({ ...payload, last_touched_at: new Date().toISOString() })
          .select("id")
          .single();
        if (error) throw error;
        if (data) onSaved(data.id);
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
          <h3 className="t-section">{editing ? "Edit Contact" : "Add Contact"}</h3>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        <div className="space-y-3">
          <Field label="Name *">
            <input className="input-glass" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input className="input-glass" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </Field>
            <Field label="Phone">
              <input className="input-glass" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555…" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <input className="input-glass" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
            </Field>
            <Field label="Role / Title">
              <input className="input-glass" value={role} onChange={(e) => setRole(e.target.value)} placeholder="CEO" />
            </Field>
          </div>
          <Field label="LinkedIn URL">
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
