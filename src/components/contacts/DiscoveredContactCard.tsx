import { useState } from "react";
import { Check, X, ChevronDown, Sparkles } from "lucide-react";
import { ORG_COLORS } from "@/lib/orgs";

export interface QueueRow {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  linkedin_url: string | null;
  suggested_org_id: string | null;
  email_count: number;
  last_email_date: string | null;
  confidence: "high" | "medium" | "low";
  raw_signature: string | null;
  sample_subject: string | null;
  status: string;
}

interface Org {
  id: string;
  slug: string;
  name: string;
}

interface Props {
  row: QueueRow;
  orgs: Org[];
  onApprove: (overrides: { id: string; orgId: string; name: string; email: string; company: string | null; title: string | null; phone: string | null; linkedin_url: string | null }) => void;
  onSkip: (id: string) => void;
  busy: boolean;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function ConfidenceDots({ level }: { level: QueueRow["confidence"] }) {
  const filled = level === "high" ? 4 : level === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="t-mono">CONF</span>
      <span className="inline-flex gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 5, height: 5, borderRadius: 999,
              background: i < filled ? "var(--text-accent)" : "var(--bg-glass-3)",
            }}
          />
        ))}
      </span>
    </span>
  );
}

export const DiscoveredContactCard = ({ row, orgs, onApprove, onSkip, busy }: Props) => {
  const [name, setName] = useState(row.name ?? "");
  const [title, setTitle] = useState(row.title ?? "");
  const [company, setCompany] = useState(row.company ?? "");
  const [orgId, setOrgId] = useState<string>(row.suggested_org_id ?? "");
  const suggestedOrg = orgs.find((o) => o.id === row.suggested_org_id);
  const selectedOrg = orgs.find((o) => o.id === orgId);

  const canApprove = !!orgId && (name.trim().length > 0 || row.email.length > 0);

  return (
    <div className="glass" style={{ padding: 14 }}>
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center font-display flex-shrink-0"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: selectedOrg ? `${ORG_COLORS[selectedOrg.slug] ?? "#6366F1"}33` : "var(--bg-glass-2)",
            color: selectedOrg ? (ORG_COLORS[selectedOrg.slug] ?? "#6366F1") : "var(--text-secondary)",
            fontWeight: 700, fontSize: 13,
          }}
        >
          {(name || row.email).slice(0, 1).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + actions row */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="input-glass"
              style={{ height: 28, fontSize: 14, fontWeight: 600, padding: "0 8px", flex: "1 1 160px", minWidth: 0 }}
            />
            <div className="relative">
              <select
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="input-glass appearance-none pr-7"
                style={{
                  height: 28, fontSize: 11, padding: "0 24px 0 8px",
                  borderColor: orgId ? `${ORG_COLORS[selectedOrg?.slug ?? ""] ?? "#6366F1"}66` : undefined,
                }}
              >
                <option value="">Choose org…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            </div>
            {suggestedOrg && orgId === suggestedOrg.id && (
              <span className="badge" title="Auto-suggested from email domain or keywords">
                <Sparkles size={9} /> Suggested
              </span>
            )}
            <button
              onClick={() => canApprove && onApprove({
                id: row.id,
                orgId,
                name: name.trim() || row.email,
                email: row.email,
                company: company.trim() || null,
                title: title.trim() || null,
                phone: row.phone,
                linkedin_url: row.linkedin_url,
              })}
              disabled={!canApprove || busy}
              className="btn-primary"
              style={{ height: 28, fontSize: 11, padding: "0 10px" }}
              title={canApprove ? "Add to contacts" : "Choose an org first"}
            >
              <Check size={11} /> Add
            </button>
            <button
              onClick={() => onSkip(row.id)}
              disabled={busy}
              className="btn-ghost"
              style={{ height: 28, fontSize: 11, padding: "0 10px" }}
              title="Skip"
            >
              <X size={11} /> Skip
            </button>
          </div>

          {/* Title + company */}
          <div className="flex gap-2 mt-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="input-glass"
              style={{ height: 26, fontSize: 12, padding: "0 8px", flex: 1, minWidth: 0 }}
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company"
              className="input-glass"
              style={{ height: 26, fontSize: 12, padding: "0 8px", flex: 1, minWidth: 0 }}
            />
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap mt-2" style={{ color: "var(--text-muted)", fontSize: 11 }}>
            <span style={{ color: "var(--text-secondary)" }}>{row.email}</span>
            <span>·</span>
            <span>📧 {row.email_count} email{row.email_count === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>Last: {relativeTime(row.last_email_date)}</span>
            <ConfidenceDots level={row.confidence} />
          </div>

          {row.sample_subject && (
            <div
              className="mt-2 italic truncate"
              style={{ color: "var(--text-muted)", fontSize: 11 }}
              title={row.sample_subject}
            >
              🔍 “{row.sample_subject}”
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
