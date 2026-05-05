import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X, Copy, Check, Trash2, Send, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  contactId: string;
  contactName: string;
  contactEmail?: string | null;
  orgId?: string | null;
}

interface SlotDraft { id: string; start: string; end: string }
interface LinkRow {
  id: string;
  token: string;
  title: string;
  duration_mins: number;
  status: string;
  created_at: string;
  invitee_name: string | null;
  booked_at: string | null;
  slots?: { id: string; start_at: string; end_at: string }[];
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultSlot(duration: number): SlotDraft {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 25);
  const end = new Date(start.getTime() + duration * 60_000);
  return { id: uid(), start: toLocal(start), end: toLocal(end) };
}

function toLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ContactBookingLinks = ({ contactId, contactName, contactEmail, orgId }: Props) => {
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Draft form state
  const [title, setTitle] = useState(`Meeting with ${contactName.split(/\s+/)[0]}`);
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>(() => [defaultSlot(30)]);
  const [saving, setSaving] = useState(false);

  const refresh = useMemo(() => async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_booking_links")
      .select("id, token, title, duration_mins, status, created_at, invitee_name, booked_at, contact_booking_link_slots(id, start_at, end_at)")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    setLinks(((data ?? []) as any[]).map((l) => ({ ...l, slots: l.contact_booking_link_slots })));
    setLoading(false);
  }, [contactId]);

  useEffect(() => { refresh(); }, [refresh]);

  function addSlot() {
    setSlots((p) => [...p, defaultSlot(duration)]);
  }

  function updateSlot(id: string, patch: Partial<SlotDraft>) {
    setSlots((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlot(id: string) {
    setSlots((p) => p.filter((s) => s.id !== id));
  }

  async function save() {
    if (!title.trim() || slots.length === 0) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: link, error } = await supabase
        .from("contact_booking_links")
        .insert({
          host_user_id: user.id,
          contact_id: contactId,
          org_id: orgId ?? null,
          title: title.trim(),
          description: description.trim() || null,
          duration_mins: duration,
          invitee_email: contactEmail ?? null,
          invitee_name: contactName,
        })
        .select()
        .single();
      if (error) throw error;

      const rows = slots.map((s) => ({
        link_id: link.id,
        start_at: new Date(s.start).toISOString(),
        end_at: new Date(s.end).toISOString(),
      }));
      const { error: sErr } = await supabase.from("contact_booking_link_slots").insert(rows);
      if (sErr) throw sErr;

      // Reset
      setCreating(false);
      setTitle(`Meeting with ${contactName.split(/\s+/)[0]}`);
      setDescription("");
      setDuration(30);
      setSlots([defaultSlot(30)]);
      await refresh();
    } catch (e) {
      alert(`Could not create link: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function publicUrl(token: string) {
    return `${window.location.origin}/meet/${token}`;
  }

  async function copy(token: string, id: string) {
    await navigator.clipboard.writeText(publicUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function emailHref(token: string) {
    if (!contactEmail) return "#";
    const subject = encodeURIComponent(`Pick a time — ${title || "Meeting"}`);
    const body = encodeURIComponent(
      `Hi ${contactName.split(/\s+/)[0]},\n\nI've pre-selected a few times. Please pick what works:\n${publicUrl(token)}\n\nThanks!`,
    );
    return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }

  async function deleteLink(id: string) {
    if (!confirm("Delete this booking link?")) return;
    await supabase.from("contact_booking_links").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="glass p-3" style={{ background: "var(--bg-glass-1)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Link2 size={12} style={{ color: "var(--text-accent)" }} />
          <div className="t-card-title" style={{ fontSize: 10 }}>BOOKING LINKS FOR THIS CONTACT</div>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="btn-ghost"
          style={{ fontSize: 10, padding: "4px 8px" }}
        >
          {creating ? <X size={11} /> : <Plus size={11} />}
          {creating ? "Cancel" : "New link"}
        </button>
      </div>

      {creating && (
        <div className="space-y-2 mb-3 glass-active p-3" style={{ borderRadius: 8 }}>
          <div>
            <div className="t-mono mb-1" style={{ fontSize: 10 }}>TITLE</div>
            <input className="input-glass" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="t-mono mb-1" style={{ fontSize: 10 }}>DURATION (MIN)</div>
              <select className="input-glass" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={45}>45</option>
                <option value={60}>60</option>
              </select>
            </div>
            <div>
              <div className="t-mono mb-1" style={{ fontSize: 10 }}>DESCRIPTION</div>
              <input className="input-glass" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="t-mono" style={{ fontSize: 10 }}>PROPOSED SLOTS</div>
              <button onClick={addSlot} className="btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }}>
                <Plus size={10} /> Add slot
              </button>
            </div>
            <div className="space-y-1.5">
              {slots.map((s) => (
                <div key={s.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="datetime-local"
                    className="input-glass"
                    value={s.start}
                    onChange={(e) => {
                      const start = e.target.value;
                      const end = toLocal(new Date(new Date(start).getTime() + duration * 60_000));
                      updateSlot(s.id, { start, end });
                    }}
                  />
                  <input
                    type="datetime-local"
                    className="input-glass"
                    value={s.end}
                    onChange={(e) => updateSlot(s.id, { end: e.target.value })}
                  />
                  <button onClick={() => removeSlot(s.id)} className="btn-icon" title="Remove">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreating(false)} className="btn-ghost" style={{ fontSize: 10, padding: "6px 10px" }}>Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 10, padding: "6px 10px" }}>
              {saving && <Loader2 size={11} className="animate-spin" />} Create link
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : links.length === 0 ? (
        <div className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
          No links yet. Create one to send {contactName.split(/\s+/)[0]} a few time options to choose from.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div key={l.id} className="glass p-2.5" style={{ borderRadius: 8 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold truncate" style={{ fontSize: 12, color: "var(--text-primary)" }}>
                    {l.title}
                  </div>
                  <div className="t-mono mt-0.5" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {l.duration_mins} min · {(l.slots?.length ?? 0)} slot{(l.slots?.length ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
                <span
                  className="badge"
                  style={
                    l.status === "booked"
                      ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#86EFAC" }
                      : { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#A5B4FC" }
                  }
                >
                  {l.status.toUpperCase()}
                </span>
              </div>

              {l.status === "booked" && l.booked_at && (
                <div className="t-mono mt-1" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                  Booked {new Date(l.booked_at).toLocaleString()}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2">
                <button onClick={() => copy(l.token, l.id)} className="btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }}>
                  {copiedId === l.id ? <Check size={11} /> : <Copy size={11} />}
                  {copiedId === l.id ? "Copied" : "Copy link"}
                </button>
                {contactEmail && l.status === "open" && (
                  <a href={emailHref(l.token)} className="btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }}>
                    <Send size={11} /> Email
                  </a>
                )}
                <a href={publicUrl(l.token)} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 10, padding: "4px 8px" }}>
                  Preview
                </a>
                <button onClick={() => deleteLink(l.id)} className="btn-ghost" style={{ fontSize: 10, padding: "4px 8px", color: "var(--sev-error, #ef4444)" }}>
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
