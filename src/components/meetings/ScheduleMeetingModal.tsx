import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Video, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrgMember {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

function defaultDate() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function toDateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ScheduleMeetingModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const initial = useMemo(defaultDate, [open]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInput(initial));
  const [time, setTime] = useState(toTimeInput(initial));
  const [duration, setDuration] = useState(30);
  const [addMeet, setAddMeet] = useState(true);
  const [extraEmails, setExtraEmails] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSelected(new Set());
      setExtraEmails("");
      setDuration(30);
      setAddMeet(true);
      const d = defaultDate();
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const { data: myMs } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id);
      const myOrgIds = (myMs ?? []).map((m) => m.org_id);
      const scoped =
        activeOrgId && activeOrgId !== "all"
          ? myOrgIds.filter((id) => id === activeOrgId)
          : myOrgIds;
      if (scoped.length === 0) {
        if (!cancelled) setMembers([]);
        return;
      }
      const { data: ms } = await supabase
        .from("org_memberships")
        .select("user_id")
        .in("org_id", scoped);
      const otherIds = Array.from(
        new Set((ms ?? []).map((r) => r.user_id).filter((id) => id !== user.id)),
      );
      if (otherIds.length === 0) {
        if (!cancelled) setMembers([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", otherIds);
      if (cancelled) return;
      setMembers(
        (profs ?? []).sort((a, b) =>
          (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, activeOrgId]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    const startDate = new Date(`${date}T${time}:00`);
    if (isNaN(startDate.getTime())) {
      toast.error("Invalid date/time");
      return;
    }
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const memberEmails = members.filter((m) => selected.has(m.id)).map((m) => m.email);
    const extras = extraEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
    const attendees = Array.from(new Set([...memberEmails, ...extras]));

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("calendar-create-event", {
        body: {
          summary: title.trim(),
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          attendees,
          addMeet,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Meeting scheduled");
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create meeting");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-lg flex flex-col gap-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} style={{ color: "var(--text-primary)" }} />
          <h2 className="t-section flex-1" style={{ fontSize: 14 }}>Schedule meeting</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title"
            className="input-glass"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-glass" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-glass" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-glass"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>2 hr</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Attendees</label>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const on = selected.has(m.id);
                const name = m.display_name ?? m.email;
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className="t-mono"
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      background: on ? "var(--bg-glass-active)" : "var(--bg-glass-1)",
                      color: on ? "var(--text-primary)" : "var(--text-secondary)",
                      border: on ? "1px solid var(--border-active)" : "1px solid var(--border-glass)",
                      boxShadow: on ? "0 0 0 2px rgba(255,255,255,0.04)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <input
            value={extraEmails}
            onChange={(e) => setExtraEmails(e.target.value)}
            placeholder="Extra emails (comma-separated)"
            className="input-glass"
            style={{ fontSize: 12 }}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={addMeet}
            onChange={(e) => setAddMeet(e.target.checked)}
          />
          <Video size={13} style={{ color: "var(--text-secondary)" }} />
          <span className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            Auto-create Google Meet link
          </span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost" disabled={submitting}>Cancel</button>
          <button onClick={submit} className="btn-primary flex items-center gap-1.5" disabled={submitting}>
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
