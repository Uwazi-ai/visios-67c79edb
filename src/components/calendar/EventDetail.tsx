import { AlertTriangle, ExternalLink, Video } from "lucide-react";
import { Button, Card, Desc, Eyebrow, GatedButton, Tag } from "@/components/primitives";
import { fmtRange, localZone } from "@/lib/calendarTime";
import type { Brief, CalendarEvent, HoldProposal } from "@/hooks/useCalendar";

/**
 * Event detail — a right pane, not a modal. A modal makes you close the
 * calendar to look at the calendar.
 */
export const EventDetail = ({
  event, orgName, orgColor, brief, onBrief, onRsvp, onClose, conflictWith,
}: {
  event: CalendarEvent;
  orgName: (id: string) => string;
  orgColor: (id: string) => string;
  brief?: Brief;
  onBrief: () => void;
  onRsvp: (r: "accepted" | "declined" | "tentative") => void;
  onClose: () => void;
  conflictWith: CalendarEvent[];
}) => {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const zone = localZone();
  const differs = event.event_timezone && event.event_timezone !== "UTC" && event.event_timezone !== zone;

  return (
    <Card>
      <div className="cal-detail">
        <div className="vo-between">
          <div className="vo-row" style={{ gap: 6 }}>
            {event.org_ids.map((id) => (
              <span key={id} className="cal-swatch" style={{ background: orgColor(id) }} aria-hidden />
            ))}
            <Eyebrow>{event.org_ids.map(orgName).join(" + ")}</Eyebrow>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        <h3 className="vo-title">{event.title ?? "(untitled)"}</h3>

        <span className="vo-meta">
          {event.all_day
            ? start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + " · all day"
            : `${start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · ${fmtRange(start, end)} (${zone})`}
        </span>
        {differs ? (
          <span className="vo-meta">Organised in {event.event_timezone}.</span>
        ) : null}

        {event.org_ids.length > 1 ? (
          <Tag>One meeting, invited to {event.org_ids.length} of your accounts</Tag>
        ) : null}

        {conflictWith.length > 0 && (
          <div className="vo-row" style={{ gap: 6, color: "var(--warn-txt)" }}>
            <AlertTriangle size={13} aria-hidden />
            <span className="vo-meta" style={{ color: "var(--warn-txt)" }}>
              Overlaps {conflictWith.map((c) => c.title ?? "(untitled)").join(", ")}
            </span>
          </div>
        )}

        {event.conference_url ? (
          <a className="vo-row" style={{ gap: 6, color: "var(--accent-txt)", fontSize: "var(--t-meta)" }}
             href={event.conference_url} target="_blank" rel="noreferrer">
            <Video size={13} aria-hidden /> Join video call
          </a>
        ) : null}
        {event.location ? <span className="vo-meta">{event.location}</span> : null}

        <div className="cal-rsvp">
          <Button size="sm" variant={event.self_response === "accepted" ? "primary" : "ghost"} onClick={() => onRsvp("accepted")}>Yes</Button>
          <Button size="sm" variant={event.self_response === "tentative" ? "primary" : "ghost"} onClick={() => onRsvp("tentative")}>Maybe</Button>
          <Button size="sm" variant={event.self_response === "declined" ? "primary" : "ghost"} onClick={() => onRsvp("declined")}>No</Button>
        </div>

        {event.attendees.length > 0 && (
          <div className="vo-stack" style={{ gap: 4 }}>
            <Eyebrow>Attendees</Eyebrow>
            {event.attendees.slice(0, 12).map((a) => (
              <div key={a.email} className="cal-attendee">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.name || a.email}
                </span>
                <span className="vo-meta">{a.response ?? "needsAction"}</span>
              </div>
            ))}
          </div>
        )}

        <div className="vo-stack" style={{ gap: 6 }}>
          <div className="vo-row" style={{ gap: 6 }}>
            <span className="ai-mark">Brief</span>
            <hr className="ai-rule" />
          </div>
          {!brief && (
            <>
              <Desc>What Google cannot tell you: the thread, the open task, and what you promised last time.</Desc>
              <Button size="sm" variant="ghost" onClick={onBrief}>Prepare me for this</Button>
            </>
          )}
          {brief?.status === "generating" && <span className="vo-meta" style={{ color: "var(--ai-txt)" }}>Assembling…</span>}
          {brief?.status === "failed" && <span className="vo-meta" style={{ color: "var(--err-txt)" }}>Brief generation failed.</span>}
          {brief?.status === "ready" && (
            <div className="ai-draft">
              <div className="ai-draft-head">
                <span className="ai-dot" aria-hidden />
                <span className="ai-draft-note">written by Vision, not sent anywhere</span>
              </div>
              <p className="vo-desc" style={{ whiteSpace: "pre-wrap" }}>{brief.content}</p>
            </div>
          )}
        </div>

        {event.description ? (
          <div className="vo-stack" style={{ gap: 4 }}>
            <Eyebrow>Description</Eyebrow>
            <p className="vo-desc" style={{ whiteSpace: "pre-wrap" }}>{event.description.slice(0, 1200)}</p>
          </div>
        ) : null}

        {(event.transcript_ref as { url?: string })?.url ? (
          <a className="vo-row" style={{ gap: 6, color: "var(--accent-txt)", fontSize: "var(--t-meta)" }}
             href={(event.transcript_ref as { url?: string }).url} target="_blank" rel="noreferrer">
            <ExternalLink size={13} aria-hidden /> Transcript
          </a>
        ) : null}
      </div>
    </Card>
  );
};

/**
 * A proposed hold. It renders on the grid where it would land; this pane is
 * where a person commits it. Nothing here writes to Google until they do.
 */
export const HoldDetail = ({
  hold, orgName, onCommit, onDismiss, onClose, resolvedAttendees,
}: {
  hold: HoldProposal;
  orgName: (id: string) => string;
  onCommit: () => void;
  onDismiss: () => void;
  onClose: () => void;
  resolvedAttendees: string[];
}) => {
  const start = hold.payload.starts_at ? new Date(hold.payload.starts_at) : null;
  const end = hold.payload.ends_at ? new Date(hold.payload.ends_at) : null;
  const duration = hold.payload.duration_minutes ?? (start && end ? (end.getTime() - start.getTime()) / 60000 : null);
  const unresolved = [
    !start ? "a time" : null,
    !duration ? "a duration" : null,
    !hold.payload.calendar_account_id ? "a calendar" : null,
  ].filter(Boolean) as string[];

  return (
    <Card>
      <div className="cal-detail">
        <div className="vo-between">
          <span className="ai-mark">Proposed hold</span>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <h3 className="vo-title">{hold.title}</h3>
        <span className="vo-meta">
          {orgName(hold.org_id)}
          {start ? ` · ${start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}` : ""}
          {start && end ? ` · ${fmtRange(start, end)}` : ""}
        </span>
        {hold.rationale ? <Desc>{hold.rationale}</Desc> : null}

        <div className="vo-stack" style={{ gap: 4 }}>
          <Eyebrow>Attendees</Eyebrow>
          {resolvedAttendees.length === 0 ? (
            <span className="vo-meta">No attendees resolved from your contacts — this would be a private hold.</span>
          ) : (
            resolvedAttendees.map((a) => <span key={a} className="vo-meta">{a}</span>)
          )}
        </div>

        <div className="vo-row" style={{ gap: "var(--s-2)", flexWrap: "wrap" }}>
          <GatedButton
            blockedCount={unresolved.length}
            blockedLabel={`Needs ${unresolved.join(", ")}`}
            readyLabel="Put it on the calendar"
            size="sm"
            onClick={onCommit}
          />
          <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
        </div>
      </div>
    </Card>
  );
};
