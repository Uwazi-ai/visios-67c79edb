import { categoryColor, categoryLabel, relTime } from "@/data/mailCategories";
import type { MailMessage } from "@/hooks/useInbox";

/**
 * A row. Unread is font weight only — a coloured unread dot would fight the
 * category dot and the identity border and the row stops being readable.
 *
 * The magenta dot on the category indicator means "the machine decided this".
 * It disappears the moment a person overrides it, which is the record of who
 * decided what.
 */
export const MailList = ({
  messages,
  selectedId,
  onSelect,
  showIdentity,
  orgColor,
  orgName,
  hasDraft,
  loading,
}: {
  messages: MailMessage[];
  selectedId: string | null;
  onSelect: (m: MailMessage) => void;
  showIdentity: boolean;
  orgColor: (orgId: string) => string;
  orgName: (orgId: string) => string;
  hasDraft: (id: string) => boolean;
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="mb-list" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="mb-row mb-skel" aria-hidden />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-list" role="listbox" aria-label="Messages">
      {messages.map((m) => {
        const pending = m.category_source === "pending";
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={m.id === selectedId}
            className="mb-row"
            data-active={m.id === selectedId ? "true" : undefined}
            data-unread={m.is_unread ? "true" : undefined}
            style={showIdentity ? { borderLeftColor: orgColor(m.org_id) } : undefined}
            data-identity={showIdentity ? "true" : undefined}
            onClick={() => onSelect(m)}
          >
            <span className="mb-rowtop">
              <span className="mb-sender">{m.from_name || m.from_address}</span>
              <span className="mb-time">{relTime(m.received_at)}</span>
            </span>

            <span className="mb-subject">{m.subject || "(no subject)"}</span>
            <span className="mb-snippet">{m.snippet}</span>

            <span className="mb-rowfoot">
              <span className="mb-cat">
                <span
                  className={pending ? "mb-dot mb-pulse" : "mb-dot"}
                  style={pending ? undefined : { background: categoryColor(m.category) }}
                  aria-hidden
                />
                <span className="mb-catlabel">
                  {pending ? "Sorting" : categoryLabel(m.category)}
                </span>
                {m.category_source === "ai" ? (
                  <span className="mb-aidot" title="Categorised by Vision" aria-label="Categorised by Vision" />
                ) : null}
              </span>

              {showIdentity ? <span className="mb-org">{orgName(m.org_id)}</span> : null}
              {m.needs_reply ? <span className="mb-needs">needs reply</span> : null}
            </span>

            {hasDraft(m.id) ? (
              <span className="ai-mark mb-draftline">
                <span className="ai-dot" aria-hidden />
                Draft ready
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
