import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useTime } from "@/contexts/TimezoneContext";
import { Plus, Copy, Check, Link2, Calendar, Clock, ExternalLink, Sparkles, Trash2, GripVertical, ToggleLeft, ToggleRight } from "lucide-react";
import { ORG_COLORS } from "@/lib/orgs";

type EventType = {
  id: string;
  name: string;
  slug: string;
  duration_mins: number | null;
  description: string | null;
  org_id: string | null;
  user_id: string | null;
  active: boolean | null;
  intake_fields: IntakeField[];
};

type IntakeField = {
  id: string;
  type: "text" | "textarea" | "url" | "dropdown" | "checkbox";
  label: string;
  required: boolean;
  options?: string[];
};

type Booking = {
  id: string;
  invitee_name: string;
  invitee_email: string;
  start_at: string;
  end_at: string;
  org_id: string | null;
  event_type_id: string | null;
  prep_brief: string | null;
  status: string | null;
  intake_data: Record<string, unknown>;
  google_event_id: string | null;
};

const FIELD_TYPES: IntakeField["type"][] = ["text", "textarea", "url", "dropdown", "checkbox"];

function newField(): IntakeField {
  return { id: crypto.randomUUID(), type: "text", label: "New question", required: false };
}

function colorFromName(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatDateLine(iso: string, tz: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
}

const BookingsPage = () => {
  const { user } = useAuth();
  const { orgs, memberships, activeOrgId } = useOrg();
  const { tz } = useTime();
  const [tab, setTab] = useState<"types" | "upcoming">("types");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingBrief, setCreatingBrief] = useState(false);

  const visibleOrgIds = useMemo(() => {
    if (activeOrgId === "all" || !activeOrgId) return memberships.map((m) => m.org_id);
    return [activeOrgId];
  }, [memberships, activeOrgId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      setUsername(profile?.username ?? null);

      const { data: ets } = await supabase
        .from("event_types")
        .select("*")
        .order("created_at", { ascending: false });
      const typed: EventType[] = (ets ?? []).map((e) => ({
        ...e,
        intake_fields: (Array.isArray(e.intake_fields) ? e.intake_fields : []) as IntakeField[],
      }));
      setEventTypes(typed);
      if (typed.length && !selectedTypeId) setSelectedTypeId(typed[0].id);

      const { data: bks } = await supabase
        .from("bookings")
        .select("*")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(100);
      setBookings((bks ?? []) as Booking[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredTypes = eventTypes.filter((e) => !e.org_id || visibleOrgIds.includes(e.org_id));
  const filteredBookings = bookings.filter((b) => !b.org_id || visibleOrgIds.includes(b.org_id));

  const selectedType = filteredTypes.find((e) => e.id === selectedTypeId) ?? null;
  const selectedBooking = filteredBookings.find((b) => b.id === selectedBookingId) ?? null;

  async function createNewType() {
    if (!user) return;
    const orgId = activeOrgId && activeOrgId !== "all" ? activeOrgId : (memberships[0]?.org_id ?? null);
    const { data, error } = await supabase
      .from("event_types")
      .insert({
        name: "New event type",
        slug: `meeting-${Math.random().toString(36).slice(2, 7)}`,
        duration_mins: 30,
        description: "",
        active: true,
        org_id: orgId,
        user_id: user.id,
        intake_fields: [],
      })
      .select()
      .single();
    if (error) return;
    const created: EventType = { ...data, intake_fields: [] };
    setEventTypes((p) => [created, ...p]);
    setSelectedTypeId(created.id);
    setTab("types");
  }

  async function updateType(patch: Partial<EventType>) {
    if (!selectedType) return;
    const next: EventType = { ...selectedType, ...patch };
    setEventTypes((p) => p.map((e) => (e.id === selectedType.id ? next : e)));
    await supabase
      .from("event_types")
      .update({
        name: next.name,
        slug: next.slug,
        duration_mins: next.duration_mins,
        description: next.description,
        active: next.active,
        intake_fields: next.intake_fields as unknown as never,
      })
      .eq("id", next.id);
  }

  async function deleteType() {
    if (!selectedType) return;
    if (!confirm(`Delete "${selectedType.name}"?`)) return;
    await supabase.from("event_types").delete().eq("id", selectedType.id);
    setEventTypes((p) => p.filter((e) => e.id !== selectedType.id));
    setSelectedTypeId(null);
  }

  function publicUrl(et: EventType): string {
    const base = window.location.origin;
    const u = username ?? "your-username";
    return `${base}/book/${u}/${et.slug}`;
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function generateBrief(bookingId: string) {
    setCreatingBrief(true);
    try {
      const { data } = await supabase.functions.invoke("ai-prep-brief", { body: { bookingId } });
      const brief = (data as { brief?: string })?.brief;
      if (brief) {
        setBookings((p) => p.map((b) => (b.id === bookingId ? { ...b, prep_brief: brief } : b)));
      }
    } finally {
      setCreatingBrief(false);
    }
  }

  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(100vh-120px)]">
      {/* LEFT */}
      <aside className="glass p-3 flex flex-col min-h-0">
        <div className="flex items-center gap-1 mb-3 p-1 rounded-lg" style={{ background: "var(--bg-glass-1)" }}>
          {(["types", "upcoming"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="t-nav flex-1 py-2 rounded-md transition-all"
              style={{
                background: tab === t ? "var(--bg-glass-active)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: tab === t ? "0 0 0 1px var(--border-active-glow)" : "none",
              }}
            >
              {t === "types" ? "Event Types" : "Upcoming"}
            </button>
          ))}
        </div>

        <button onClick={createNewType} className="btn-primary w-full justify-center mb-3" style={{ height: 36 }}>
          <Plus size={14} /> New Event Type
        </button>

        <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-2">
          {loading && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer-block" style={{ height: 78, borderRadius: 12 }} />
              ))}
            </>
          )}
          {!loading && tab === "types" && filteredTypes.length === 0 && (
            <EmptyHint label="No event types yet" hint="Create your first type to start taking bookings." />
          )}
          {!loading &&
            tab === "types" &&
            filteredTypes.map((et) => {
              const org = orgs.find((o) => o.id === et.org_id);
              const orgColor = (org && (ORG_COLORS[org.slug] ?? org.color)) ?? "#60A5FA";
              const isActive = selectedTypeId === et.id;
              return (
                <button
                  key={et.id}
                  onClick={() => {
                    setSelectedTypeId(et.id);
                    setSelectedBookingId(null);
                  }}
                  className={`w-full text-left p-3 transition-all ${isActive ? "glass-active" : "glass"}`}
                  style={{ borderRadius: 12 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: orgColor, boxShadow: `0 0 8px ${orgColor}66` }} />
                    <span className="font-display font-bold" style={{ fontSize: 13, color: "var(--text-primary)" }}>{et.name}</span>
                    <span className="ml-auto">{et.active ? <ToggleRight size={14} style={{ color: "var(--sev-success)" }} /> : <ToggleLeft size={14} style={{ color: "var(--text-muted)" }} />}</span>
                  </div>
                  <div className="t-mono flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    <Clock size={9} /> {et.duration_mins ?? 30}MIN {org && <>· {org.name.toUpperCase()}</>}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full t-mono"
                    style={{ background: `${orgColor}1F`, border: `1px solid ${orgColor}44`, color: orgColor, fontSize: 9 }}>
                    /{et.slug}
                  </div>
                </button>
              );
            })}

          {!loading && tab === "upcoming" && filteredBookings.length === 0 && (
            <EmptyHint label="No upcoming bookings" hint="When someone books, they'll show up here." />
          )}
          {!loading &&
            tab === "upcoming" &&
            filteredBookings.map((b) => {
              const org = orgs.find((o) => o.id === b.org_id);
              const orgColor = (org && (ORG_COLORS[org.slug] ?? org.color)) ?? colorFromName(b.invitee_name);
              const et = eventTypes.find((e) => e.id === b.event_type_id);
              const isActive = selectedBookingId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBookingId(b.id);
                    setSelectedTypeId(null);
                  }}
                  className={`w-full text-left p-3 flex items-start gap-3 transition-all ${isActive ? "glass-active" : "glass"}`}
                  style={{ borderRadius: 12 }}
                >
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: orgColor, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {initials(b.invitee_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>{b.invitee_name}</div>
                    <div className="t-mono mt-0.5" style={{ fontSize: 10 }}>{formatDateLine(b.start_at, tz)}</div>
                    {et && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded t-mono" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-glass)", fontSize: 9 }}>
                        {et.name}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      {/* RIGHT */}
      <section className="glass p-5 overflow-y-auto min-h-0">
        {!selectedType && !selectedBooking && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="glass p-4 mb-4" style={{ borderRadius: "50%" }}>
              <Link2 size={28} style={{ color: "var(--text-accent)" }} />
            </div>
            <div className="t-section mb-1">Select a booking link</div>
            <div className="t-body" style={{ maxWidth: 320 }}>Pick an event type to configure availability and intake, or open an upcoming booking to see the AI prep brief.</div>
          </div>
        )}

        {selectedType && (
          <EventTypeDetail
            et={selectedType}
            org={orgs.find((o) => o.id === selectedType.org_id) ?? null}
            publicUrl={publicUrl(selectedType)}
            username={username}
            copied={copied}
            onCopy={() => copyLink(publicUrl(selectedType))}
            onUpdate={updateType}
            onDelete={deleteType}
          />
        )}

        {selectedBooking && (
          <BookingDetail
            booking={selectedBooking}
            org={orgs.find((o) => o.id === selectedBooking.org_id) ?? null}
            eventType={eventTypes.find((e) => e.id === selectedBooking.event_type_id) ?? null}
            onGenerateBrief={() => generateBrief(selectedBooking.id)}
            generating={creatingBrief}
          />
        )}
      </section>
    </div>
  );
};

const EmptyHint = ({ label, hint }: { label: string; hint: string }) => (
  <div className="text-center py-10">
    <Calendar size={18} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
    <div className="t-card-title mb-1">{label}</div>
    <div className="t-body" style={{ fontSize: 12 }}>{hint}</div>
  </div>
);

const EventTypeDetail = ({
  et, org, publicUrl, username, copied, onCopy, onUpdate, onDelete,
}: {
  et: EventType;
  org: { id: string; name: string; slug: string } | null;
  publicUrl: string;
  username: string | null;
  copied: boolean;
  onCopy: () => void;
  onUpdate: (p: Partial<EventType>) => void;
  onDelete: () => void;
}) => {
  const orgColor = (org && (ORG_COLORS[org.slug] ?? "#60A5FA")) ?? "#60A5FA";
  const fields = et.intake_fields ?? [];

  function setField(idx: number, patch: Partial<IntakeField>) {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onUpdate({ intake_fields: next });
  }
  function removeField(idx: number) {
    onUpdate({ intake_fields: fields.filter((_, i) => i !== idx) });
  }
  function addField() {
    onUpdate({ intake_fields: [...fields, newField()] });
  }
  function moveField(idx: number, dir: -1 | 1) {
    const next = [...fields];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onUpdate({ intake_fields: next });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <span style={{ width: 12, height: 12, borderRadius: 6, background: orgColor, boxShadow: `0 0 12px ${orgColor}88`, marginTop: 6 }} />
        <div className="flex-1 min-w-0">
          <input
            value={et.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="font-display font-bold bg-transparent border-none outline-none w-full"
            style={{ fontSize: 18, color: "var(--text-primary)" }}
          />
          <div className="t-mono mt-1 flex items-center gap-2" style={{ fontSize: 10 }}>
            <Clock size={10} /> {et.duration_mins ?? 30}MIN
            <span className="slash">/</span>
            <span className={`badge ${et.active ? "badge-success" : "badge-muted"}`}>{et.active ? "ACTIVE" : "INACTIVE"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onUpdate({ active: !et.active })} className="btn-ghost" style={{ height: 32 }}>
            {et.active ? "Disable" : "Enable"}
          </button>
          <button onClick={onDelete} className="btn-icon" title="Delete" style={{ width: 32, height: 32 }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Public URL */}
      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)" }}>
        <Link2 size={14} style={{ color: "var(--text-accent)", flexShrink: 0 }} />
        <div className="flex-1 min-w-0 t-mono truncate" style={{ fontSize: 11, color: "var(--text-primary)" }}>
          {publicUrl}
        </div>
        <button onClick={onCopy} className="btn-ghost" style={{ height: 30, padding: "0 12px" }}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-icon" style={{ width: 30, height: 30 }}>
          <ExternalLink size={12} />
        </a>
      </div>
      {!username && (
        <div className="t-body" style={{ fontSize: 11, color: "var(--sev-warn)" }}>
          ⚠ Set your username in Settings to make this link work publicly.
        </div>
      )}

      {/* Basics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Slug">
          <input
            className="input-glass"
            value={et.slug}
            onChange={(e) => onUpdate({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
          />
        </Field>
        <Field label="Duration (mins)">
          <input
            type="number"
            className="input-glass"
            value={et.duration_mins ?? 30}
            onChange={(e) => onUpdate({ duration_mins: Number(e.target.value) || 30 })}
          />
        </Field>
        <Field label="Status">
          <button
            onClick={() => onUpdate({ active: !et.active })}
            className={`badge ${et.active ? "badge-success" : "badge-muted"}`}
            style={{ fontSize: 11, padding: "8px 12px", justifyContent: "center", width: "100%", cursor: "pointer" }}
          >
            {et.active ? "ACTIVE" : "INACTIVE"}
          </button>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          className="input-glass"
          rows={2}
          value={et.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="What is this meeting for?"
        />
      </Field>

      {/* Intake builder */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="t-card-title">Intake Form</div>
          <button onClick={addField} className="btn-ghost" style={{ height: 30, padding: "0 12px" }}>
            <Plus size={12} /> Add Field
          </button>
        </div>
        <div className="space-y-2">
          {fields.length === 0 && (
            <div className="glass p-4 text-center t-body" style={{ fontSize: 12 }}>
              No questions. Bookers will only enter name + email.
            </div>
          )}
          {fields.map((f, idx) => (
            <div key={f.id} className="glass p-3 flex items-center gap-2 flex-wrap">
              <div className="flex flex-col">
                <button onClick={() => moveField(idx, -1)} className="text-muted-fg hover:text-primary-fg">▲</button>
                <button onClick={() => moveField(idx, 1)} className="text-muted-fg hover:text-primary-fg">▼</button>
              </div>
              <GripVertical size={14} style={{ color: "var(--text-muted)" }} />
              <select
                value={f.type}
                onChange={(e) => setField(idx, { type: e.target.value as IntakeField["type"] })}
                className="input-glass"
                style={{ width: 120 }}
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                className="input-glass flex-1 min-w-[180px]"
                value={f.label}
                onChange={(e) => setField(idx, { label: e.target.value })}
                placeholder="Question label"
              />
              {f.type === "dropdown" && (
                <input
                  className="input-glass flex-1 min-w-[180px]"
                  value={(f.options ?? []).join(", ")}
                  onChange={(e) => setField(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Option1, Option2, …"
                />
              )}
              <label className="t-mono flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 10 }}>
                <input type="checkbox" checked={f.required} onChange={(e) => setField(idx, { required: e.target.checked })} />
                REQUIRED
              </label>
              <button onClick={() => removeField(idx)} className="btn-icon" style={{ width: 30, height: 30 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="t-mono mb-1.5" style={{ fontSize: 10, letterSpacing: "0.1em" }}>{label}</div>
    {children}
  </div>
);

const BookingDetail = ({
  booking, org, eventType, onGenerateBrief, generating,
}: {
  booking: Booking;
  org: { id: string; name: string; slug: string } | null;
  eventType: EventType | null;
  onGenerateBrief: () => void;
  generating: boolean;
}) => {
  const { tz } = useTime();
  const orgColor = (org && (ORG_COLORS[org.slug] ?? "#60A5FA")) ?? "#60A5FA";
  const meetLink = (booking as unknown as { meet_link?: string }).meet_link;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: orgColor, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16,
          }}
        >
          {initials(booking.invitee_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold" style={{ fontSize: 18, color: "var(--text-primary)" }}>{booking.invitee_name}</div>
          <div className="t-mono mt-0.5" style={{ fontSize: 11 }}>{booking.invitee_email}</div>
          {eventType && <div className="t-mono mt-0.5" style={{ fontSize: 10 }}>{eventType.name}</div>}
        </div>
        <span className={`badge ${booking.status === "confirmed" ? "badge-success" : "badge-muted"}`}>{(booking.status ?? "pending").toUpperCase()}</span>
      </div>

      {/* Prep brief */}
      <div
        className="glass p-4"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(37,99,235,0.06))",
          border: "1px solid rgba(99,102,241,0.30)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} style={{ color: "#A5B4FC" }} />
          <div className="t-card-title" style={{ color: "#C7D2FE" }}>AI PREP BRIEF</div>
          {!booking.prep_brief && (
            <button onClick={onGenerateBrief} className="btn-ghost ml-auto" style={{ height: 28, padding: "0 10px", fontSize: 10 }} disabled={generating}>
              {generating ? "Generating…" : "Generate"}
            </button>
          )}
        </div>
        {booking.prep_brief ? (
          <div className="t-body" style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {booking.prep_brief}
          </div>
        ) : (
          <div className="t-body" style={{ fontSize: 12 }}>No brief yet. Click Generate to draft one with Lovable AI.</div>
        )}
      </div>

      {/* Grid of facts */}
      <div className="grid grid-cols-2 gap-3">
        <FactCell label="Date" value={formatDateLine(booking.start_at, tz)} />
        <FactCell label="Duration" value={`${eventType?.duration_mins ?? 30} mins`} />
        <FactCell label="Meet" value={meetLink ? "Google Meet ready" : (booking.google_event_id ? "On Google Calendar" : "—")} />
        <FactCell label="Org" value={org?.name ?? "—"} />
      </div>

      {/* Intake answers */}
      {Object.keys(booking.intake_data ?? {}).length > 0 && (
        <div>
          <div className="t-card-title mb-2">Intake</div>
          <div className="glass p-3 space-y-2">
            {Object.entries(booking.intake_data ?? {}).map(([k, v]) => (
              <div key={k}>
                <div className="t-mono" style={{ fontSize: 9 }}>{k.toUpperCase()}</div>
                <div className="t-body" style={{ fontSize: 13, color: "var(--text-primary)" }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {meetLink && (
          <a href={meetLink} target="_blank" rel="noreferrer" className="btn-primary">
            Join Meeting
          </a>
        )}
        <button className="btn-ghost">Reschedule</button>
        <button className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
};

const FactCell = ({ label, value }: { label: string; value: string }) => (
  <div className="glass p-3">
    <div className="t-mono mb-1" style={{ fontSize: 9 }}>{label.toUpperCase()}</div>
    <div className="font-display font-bold" style={{ fontSize: 13, color: "var(--text-primary)" }}>{value}</div>
  </div>
);

export default BookingsPage;
