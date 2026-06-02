import { ChevronDown, ChevronRight, AlertCircle, Mail } from "lucide-react";
import { useState } from "react";
import { colorForMember } from "@/lib/memberColors";

export interface Teammate {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Props {
  me: Teammate | null;
  teammates: Teammate[];
  visibleMemberIds: string[];
  onToggle: (memberId: string, on: boolean) => void;
  onSelectSolo?: (memberId: string) => void;
  onShowAll?: () => void;
  soloMemberId?: string | null;
  unavailableMembers?: Record<string, string>;
}


function initials(name: string | null, email: string | null) {
  const src = name || email || "?";
  const parts = src.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function MemberRow({ m, color, on, onToggle, onSolo, isMe, isSelected, unavailableReason }: {
  m: Teammate; color: string; on: boolean; onToggle?: (v: boolean) => void; onSolo?: () => void;
  isMe?: boolean; isSelected?: boolean; unavailableReason?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 py-1 px-1.5 rounded"
      style={{
        background: isSelected ? `${color}22` : "transparent",
        border: isSelected ? `1px solid ${color}66` : "1px solid transparent",
        boxShadow: isSelected ? `0 0 8px ${color}33` : "none",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}66` }} />
      {m.avatar_url ? (
        <img src={m.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: 999, objectFit: "cover" }} />
      ) : (
        <div style={{
          width: 18, height: 18, borderRadius: 999, background: "var(--bg-glass-1)",
          border: "1px solid var(--border-glass)", display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-secondary)",
        }}>{initials(m.display_name, m.email)}</div>
      )}
      <button
        onClick={onSolo}
        disabled={!onSolo}
        title={onSolo ? `Show only ${m.display_name || m.email || "this member"}'s calendar` : undefined}
        className="flex-1 truncate text-xs text-left flex items-center gap-1.5"
        style={{
          color: isSelected ? "var(--text-primary)" : "var(--text-primary)",
          background: "transparent", border: 0, padding: 0,
          cursor: onSolo ? "pointer" : "default",
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        <span className="truncate">
          {isMe ? `You${m.display_name ? ` (${m.display_name.split(" ")[0]})` : ""}` : (m.display_name || m.email || "Unknown")}
        </span>
        {unavailableReason && (
          <AlertCircle
            size={11}
            style={{ color: "var(--sev-warn)", flexShrink: 0 }}
            aria-label={unavailableReason === "not_connected" ? "Google not connected" : "Calendar unavailable"}
          />
        )}
      </button>
      {!isMe && onToggle && (
        <button
          onClick={() => onToggle(!on)}
          aria-pressed={on}
          title={on ? "Hide from calendar" : "Show on calendar"}
          style={{
            width: 26, height: 14, borderRadius: 999, position: "relative",
            background: on ? color : "var(--bg-glass-1)",
            border: `1px solid ${on ? color : "var(--border-glass)"}`,
            transition: "all 0.15s",
          }}
        >
          <span style={{
            position: "absolute", top: 1, left: on ? 13 : 1,
            width: 10, height: 10, borderRadius: 999,
            background: on ? "#fff" : "var(--text-muted)",
            transition: "left 0.15s",
          }} />
        </button>
      )}
    </div>
  );
}


export default function TeamCalendarsPanel({ me, teammates, visibleMemberIds, onToggle, onSelectSolo, onShowAll, soloMemberId, unavailableMembers }: Props) {
  const [open, setOpen] = useState(true);
  const visible = new Set(visibleMemberIds);
  const ua = unavailableMembers ?? {};
  const solo = soloMemberId ?? null;
  const soloMember = solo ? teammates.find((t) => t.user_id === solo) ?? null : null;
  const soloReason = solo ? ua[solo] : undefined;
  const soloColor = solo ? colorForMember(solo) : undefined;

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 t-card-title"
          style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Team Calendars
        </button>
        {soloMember && onShowAll && (
          <button
            onClick={onShowAll}
            className="t-mono"
            style={{ fontSize: 9, color: "var(--text-secondary)", background: "transparent", border: 0, cursor: "pointer", padding: 0 }}
            title="Show all team calendars"
          >
            show all
          </button>
        )}
      </div>

      {soloMember && (
        <div
          className="flex flex-col gap-1 px-2 py-1.5 rounded"
          style={{
            background: `${soloColor}1A`,
            border: `1px solid ${soloColor}55`,
            boxShadow: `0 0 10px ${soloColor}22`,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: soloColor, boxShadow: `0 0 6px ${soloColor}` }} />
            <span className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.08 }}>
              Viewing
            </span>
            <span className="truncate" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--text-primary)" }}>
              {soloMember.display_name || soloMember.email || "Member"}
            </span>
          </div>
          {soloReason && (
            <div className="flex items-start gap-1.5 t-mono" style={{ fontSize: 9, color: "var(--sev-warn)" }}>
              <AlertCircle size={10} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ lineHeight: 1.3 }}>
                {soloReason === "not_connected"
                  ? "They haven't connected Google Calendar yet — no events to show."
                  : "Their calendar couldn't be reached. Ask them to reconnect Google."}
              </span>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-col">
          {me && (
            <MemberRow
              m={me}
              color={colorForMember(me.user_id)}
              on
              isMe
              onSolo={onShowAll}
            />
          )}
          {teammates.map((t) => (
            <MemberRow
              key={t.user_id}
              m={t}
              color={colorForMember(t.user_id)}
              on={visible.has(t.user_id)}
              onToggle={(v) => onToggle(t.user_id, v)}
              onSolo={onSelectSolo ? () => onSelectSolo(t.user_id) : undefined}
              isSelected={solo === t.user_id}
              unavailableReason={ua[t.user_id]}
            />
          ))}
          {teammates.length === 0 && (
            <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", paddingTop: 4 }}>
              No teammates yet. Invite from Settings → Team.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
