import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Sparkles, X } from "lucide-react";
import { DRIVE_LABEL, GOOGLE_MARKS, driveKind, visionCanRead } from "@/data/driveMarks";
import type { AccessResult, DriveReference } from "@/hooks/useDriveReferences";

const modified = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Modified today";
  if (days === 1) return "Modified yesterday";
  if (days < 30) return `Modified ${days} days ago`;
  return `Modified ${new Date(iso).toLocaleDateString()}`;
};

const ROLES: { value: "reader" | "commenter" | "writer"; label: string }[] = [
  { value: "reader", label: "Viewer" },
  { value: "commenter", label: "Commenter" },
  { value: "writer", label: "Editor" },
];

/**
 * A Drive card, deliberately unlike an upload card: no file size (irrelevant for
 * a reference), modified time rather than upload time, and an access state.
 *
 * The clean case is silent. A warning that fires on every share is a warning
 * nobody reads.
 */
export const DriveCard = ({
  reference,
  access,
  onCheck,
  onGrant,
  onRemove,
  createdNote,
}: {
  reference: DriveReference;
  access?: AccessResult;
  onCheck?: () => void;
  onGrant?: (emails: string[], role: "reader" | "commenter" | "writer") => Promise<unknown>;
  onRemove?: () => void;
  createdNote?: string;
}) => {
  const kind = driveKind(reference.mime_type);
  const mark = GOOGLE_MARKS[kind];
  const [role, setRole] = useState<"reader" | "commenter" | "writer">("reader");
  const [expanded, setExpanded] = useState(false);
  const [granting, setGranting] = useState(false);
  const [shareAnyway, setShareAnyway] = useState(false);

  useEffect(() => {
    if (!access && onCheck && reference.status === "ok") onCheck();
    // Checked once per card. Re-checking on every render would burn Drive quota
    // redrawing cards nobody clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference.id]);

  const gone = reference.status === "not_found";
  const unenriched = reference.status === "unenriched";
  const missing = access && access.state === "gap" ? access.missing : [];

  return (
    <div className="vd-card" data-gone={gone ? "true" : undefined}>
      <span className="vd-icon" style={{ background: mark }} aria-hidden>
        {kind === "sheet" ? "▤" : kind === "slide" ? "▢" : kind === "pdf" ? "▦" : "▤"}
      </span>

      <div className="vd-body">
        <div className="vd-title-row">
          <a className="vd-title" href={reference.web_view_link} target="_blank" rel="noreferrer">
            {gone ? reference.file_name : unenriched ? "Drive file" : reference.file_name}
          </a>
          {reference.externally_owned ? (
            <span className="vd-tag" title={reference.owner_email ?? undefined}>
              Externally owned
            </span>
          ) : null}
        </div>

        <div className="vd-meta">
          {gone ? (
            "This file is no longer available"
          ) : unenriched ? (
            <>Drive file — Kova can't read details · <span className="vd-url">{reference.drive_url}</span></>
          ) : (
            [DRIVE_LABEL[kind], modified(reference.file_modified_at)].filter(Boolean).join(" · ")
          )}
        </div>

        {createdNote ? <div className="vd-meta">{createdNote}</div> : null}

        {!gone && !unenriched ? (
          <div className="vd-vision" data-can={visionCanRead(reference.mime_type) ? "true" : "false"}>
            <Sparkles size={12} strokeWidth={1.75} aria-hidden />
            {visionCanRead(reference.mime_type)
              ? "Vision can read this file"
              : "Vision can't read this file type"}
          </div>
        ) : null}

        {/* Access state. Silence is the common case and stays silent. */}
        {access?.state === "unknown" ? (
          <div className="vd-note">Access couldn't be checked — {access.reason}</div>
        ) : missing.length > 0 && !shareAnyway ? (
          <div className="vd-warn">
            <div className="vd-warn-head">
              <AlertTriangle size={13} strokeWidth={1.75} aria-hidden />
              {missing.length === 1 ? (
                <span>{missing[0].name} doesn't have access to this file</span>
              ) : (
                <button type="button" className="vd-expand" onClick={() => setExpanded((v) => !v)}>
                  {missing.length} of {(access as { total: number }).total} participants don't have access
                </button>
              )}
            </div>
            {expanded && missing.length > 1 ? (
              <ul className="vd-names">
                {missing.map((m) => (
                  <li key={m.userId}>{m.name}</li>
                ))}
              </ul>
            ) : null}
            <div className="vd-warn-actions">
              <label className="vd-role">
                <span className="vc-visually-hidden">Access role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="b-sec"
                disabled={granting || !onGrant}
                onClick={async () => {
                  if (!onGrant) return;
                  setGranting(true);
                  await onGrant(missing.map((m) => m.email), role);
                  setGranting(false);
                }}
              >
                {granting ? "Granting…" : `Give access as ${ROLES.find((r) => r.value === role)!.label}`}
              </button>
              <button type="button" className="b-ghost" onClick={() => setShareAnyway(true)}>
                Share anyway
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="vd-actions">
        <a className="vd-open" href={reference.web_view_link} target="_blank" rel="noreferrer" aria-label="Open in Drive">
          <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
        </a>
        {onRemove ? (
          <button type="button" className="vd-open" onClick={onRemove} aria-label="Remove reference">
            <X size={14} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default DriveCard;
