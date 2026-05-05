import { useState } from "react";
import { Mail, Calendar, FileText, Linkedin, Phone, Building2, Pencil, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ORG_COLORS } from "@/lib/orgs";
import { daysSince, relativeTime, HEALTH_COLORS, bucket } from "@/lib/contactsHealth";
import { stageLabel } from "@/lib/engagementStages";
import { InteractionHistory } from "./InteractionHistory";
import { AISuggestionCard } from "./AISuggestionCard";
import { MyAvailabilityShare } from "./MyAvailabilityShare";
import type { ContactRow } from "@/pages/Contacts";

interface Props {
  contact: ContactRow;
  org: { id: string; slug: string; name: string } | null;
  onEdit: () => void;
  onChanged: () => void;
  refreshKey: number;
}

export const ContactDetail = ({ contact, org, onEdit, onChanged, refreshKey }: Props) => {
  const [logging, setLogging] = useState(false);
  const orgColor = org ? ORG_COLORS[org.slug] ?? "#6366F1" : "#6366F1";
  const days = daysSince(contact.last_touched_at);
  const hb = bucket(contact.last_touched_at);

  const logInteraction = async (type: "email" | "meeting" | "call" | "note") => {
    setLogging(true);
    const title = type === "note" ? "Note" : type.charAt(0).toUpperCase() + type.slice(1);
    const now = new Date().toISOString();
    await supabase.from("contact_interactions").insert({
      contact_id: contact.id,
      org_id: contact.org_id,
      type,
      title,
      occurred_at: now,
      source: "manual",
    });
    await supabase.from("contacts").update({ last_touched_at: now }).eq("id", contact.id);
    setLogging(false);
    onChanged();
  };

  return (
    <div className="glass flex flex-col flex-1 overflow-hidden" key={refreshKey}>
      {/* Header */}
      <div className="p-3 md:p-5 border-b" style={{ borderColor: "var(--border-glass)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="flex items-center justify-center font-bold flex-shrink-0"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `${orgColor}22`,
                color: orgColor,
                fontSize: 18,
                border: `1px solid ${orgColor}55`,
              }}
            >
              {contact.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || <Building2 size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="t-section truncate" style={{ fontSize: 22 }}>{contact.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {contact.role && (
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{contact.role}</span>
                )}
                {contact.role && contact.company && (
                  <span style={{ color: "var(--text-muted)" }}>·</span>
                )}
                {contact.company && (
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{contact.company}</span>
                )}
                {org && (
                  <span
                    className="badge"
                    style={{
                      background: `${orgColor}15`,
                      border: `1px solid ${orgColor}40`,
                      color: orgColor,
                    }}
                  >
                    {org.slug.toUpperCase()}
                  </span>
                )}
                {contact.visibility === "private" ? (
                  <span className="badge" title="Only visible to you" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#A5B4FC" }}>🔒 PRIVATE</span>
                ) : (
                  <span className="badge" title="Visible to your team" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#86EFAC" }}>👥 TEAM</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--text-accent)" }}>
                    <Mail size={11} /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    <Phone size={11} /> {contact.phone}
                  </span>
                )}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--text-accent)" }}>
                    <Linkedin size={11} /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button onClick={onEdit} className="btn-icon" title="Edit"><Pencil size={13} /></button>
            <div
              className="badge"
              style={{
                background: `${HEALTH_COLORS[hb]}15`,
                border: `1px solid ${HEALTH_COLORS[hb]}40`,
                color: HEALTH_COLORS[hb],
              }}
            >
              {days === null ? "Never touched" : `${days}d ago`}
            </div>
            <span className="t-mono" style={{ fontSize: 9 }}>{relativeTime(contact.last_touched_at)}</span>
            <span className="t-mono" style={{ fontSize: 9 }}>
              Stage: {stageLabel(org?.slug, contact.engagement_stage)}
            </span>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mt-4">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="btn-ghost" style={{ fontSize: 10, padding: "8px 12px" }}>
              <Mail size={12} /> Email
            </a>
          )}
          <button onClick={() => logInteraction("email")} disabled={logging} className="btn-ghost" style={{ fontSize: 10, padding: "8px 12px" }}>
            <Plus size={12} /> Log Email
          </button>
          <button onClick={() => logInteraction("call")} disabled={logging} className="btn-ghost" style={{ fontSize: 10, padding: "8px 12px" }}>
            <Phone size={12} /> Log Call
          </button>
          <button onClick={() => logInteraction("note")} disabled={logging} className="btn-ghost" style={{ fontSize: 10, padding: "8px 12px" }}>
            <FileText size={12} /> Add Note
          </button>
          <button onClick={() => logInteraction("meeting")} disabled={logging} className="btn-ghost" style={{ fontSize: 10, padding: "8px 12px" }}>
            <Calendar size={12} /> Schedule Meeting
          </button>
          {logging && <Loader2 size={14} className="animate-spin self-center" style={{ color: "var(--text-muted)" }} />}
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4 md:space-y-5">
        {contact.notes && (
          <div className="glass p-3" style={{ background: "var(--bg-glass-1)" }}>
            <div className="t-card-title mb-1.5" style={{ fontSize: 10 }}>NOTES</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
              {contact.notes}
            </p>
          </div>
        )}

        <MyAvailabilityShare contactEmail={contact.email} contactName={contact.name} />

        <div>
          <div className="t-card-title mb-3">Interaction History</div>
          <InteractionHistory contactId={contact.id} key={`hist-${contact.id}-${refreshKey}`} />
        </div>

        <AISuggestionCard contact={contact} orgName={org?.name ?? null} />
      </div>
    </div>
  );
};
