import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CalendarPlus, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const TEAM_EVENT_COLOR = "#F59E0B"; // amber — distinct from member colors

function defaultDate() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toTimeInput = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default function NewTeamEventModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { orgs, activeOrgId, memberships } = useOrg();

  const myOrgs = useMemo(
    () => orgs.filter((o) => memberships.some((m) => m.org_id === o.id)),
    [orgs, memberships],
  );
  const defaultOrgId =
    activeOrgId && activeOrgId !== "all" ? activeOrgId : myOrgs[0]?.id ?? "";

  const initial = useMemo(defaultDate, [open]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [orgId, setOrgId] = useState<string>(defaultOrgId);
  const [date, setDate] = useState(toDateInput(initial));
  const [time, setTime] = useState(toTimeInput(initial));
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setOrgId(defaultOrgId);
    } else {
      setTitle(""); setDescription(""); setLocation(""); setDuration(60);
      const d = defaultDate();
      setDate(toDateInput(d)); setTime(toTimeInput(d));
    }
  }, [open, defaultOrgId]);

  if (!open) return null;

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Title required");
    if (!orgId) return toast.error("Select an organization");
    const startDate = new Date(`${date}T${time}:00`);
    if (isNaN(startDate.getTime())) return toast.error("Invalid date/time");
    const endDate = new Date(startDate.getTime() + duration * 60000);

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("events").insert({
        org_id: orgId,
        created_by: user.id,
        user_id: user.id,
        title: title.trim(),
        summary: description.trim() || null,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        visibility: "org",
        color: TEAM_EVENT_COLOR,
        attendees: location.trim() ? [{ location: location.trim() }] : [],
      });
      if (error) throw new Error(error.message);
      toast.success("Team event added");
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add event");
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
      <div className="glass w-full max-w-lg flex flex-col gap-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span style={{
            width: 22, height: 22, borderRadius: 6, background: `${TEAM_EVENT_COLOR}33`,
            border: `1px solid ${TEAM_EVENT_COLOR}66`, display: "flex", alignItems: "center", justifyContent: "center",
            color: TEAM_EVENT_COLOR,
          }}>
            <CalendarPlus size={13} />
          </span>
          <h2 className="t-section flex-1" style={{ fontSize: 14 }}>New team event</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close"><X size={14} /></button>
        </div>

        <p className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Visible to every member of the selected organization on their team calendar.
        </p>

        <div className="flex flex-col gap-1">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Team offsite, All-hands, Launch party" className="input-glass" autoFocus />
        </div>

        <div className="flex flex-col gap-1">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Organization</label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="input-glass">
            {myOrgs.length === 0 && <option value="">No organizations</option>}
            {myOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
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
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input-glass">
              <option value={30}>30 min</option>
              <option value={60}>1 hr</option>
              <option value={90}>1.5 hr</option>
              <option value={120}>2 hr</option>
              <option value={180}>3 hr</option>
              <option value={240}>4 hr</option>
              <option value={480}>All day (8h)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="t-mono flex items-center gap-1" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <MapPin size={10} /> Location <span style={{ textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>(optional)</span>
          </label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, Zoom, address…" className="input-glass" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes <span style={{ textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>(optional)</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this event about?" className="input-glass" rows={3} style={{ resize: "vertical" }} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost" disabled={submitting}>Cancel</button>
          <button onClick={submit} className="btn-primary flex items-center gap-1.5" disabled={submitting || !orgId}>
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Add to team calendar
          </button>
        </div>
      </div>
    </div>
  );
}
