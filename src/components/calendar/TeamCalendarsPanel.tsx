import { ChevronDown, ChevronRight } from "lucide-react";
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
}


function initials(name: string | null, email: string | null) {
  const src = name || email || "?";
  const parts = src.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function MemberRow({ m, color, on, onToggle, onSolo, isMe }: {
  m: Teammate; color: string; on: boolean; onToggle?: (v: boolean) => void; onSolo?: () => void; isMe?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
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
        className="flex-1 truncate text-xs text-left"
        style={{
          color: "var(--text-primary)", background: "transparent", border: 0, padding: 0,
          cursor: onSolo ? "pointer" : "default",
        }}
      >
        {isMe ? `You${m.display_name ? ` (${m.display_name.split(" ")[0]})` : ""}` : (m.display_name || m.email || "Unknown")}
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


export default function TeamCalendarsPanel({ me, teammates, visibleMemberIds, onToggle, onSelectSolo, onShowAll }: Props) {
  const [open, setOpen] = useState(true);
  const visible = new Set(visibleMemberIds);
  const teammateIds = teammates.map((t) => t.user_id);
  const visibleTeammates = teammateIds.filter((id) => visible.has(id));
  const isSolo = onSelectSolo && visibleTeammates.length === 1 && teammates.length > 1;

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
        {isSolo && onShowAll && (
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

