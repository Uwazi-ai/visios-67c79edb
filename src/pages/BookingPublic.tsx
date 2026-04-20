import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalIcon, Clock, ChevronLeft, ChevronRight, Check, Sparkles, Loader2 } from "lucide-react";
import { VisiLogo } from "@/components/visi/Logo";

type IntakeField = {
  id: string;
  type: "text" | "textarea" | "url" | "dropdown" | "checkbox";
  label: string;
  required: boolean;
  options?: string[];
};

type LookupResult = {
  host: { id: string; display_name: string | null; username: string; avatar_url: string | null };
  eventType: {
    id: string; name: string; slug: string; duration_mins: number;
    description: string | null; org_id: string | null;
    intake_fields: IntakeField[]; buffer_before: number | null; buffer_after: number | null;
  };
  org: { name: string; color: string } | null;
};

const SLOT_INCREMENT = 30; // minutes
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19;

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

const BookingPublic = () => {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [busy, setBusy] = useState<Array<{ start: string; end: string }>>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [intake, setIntake] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ start: string; meetLink: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("booking-lookup", { body: { username, slug } });
        if (error) throw error;
        const e = (data as { error?: string }).error;
        if (e) throw new Error(e);
        setLookup(data as LookupResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load this booking link");
      } finally {
        setLoading(false);
      }
    })();
  }, [username, slug]);

  // Fetch freeBusy for the selected day
  useEffect(() => {
    if (!selectedDay || !lookup) return;
    (async () => {
      setBusyLoading(true);
      const start = new Date(selectedDay); start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDay); end.setHours(23, 59, 59, 999);
      try {
        const { data } = await supabase.functions.invoke("calendar-freebusy", {
          body: { userId: lookup.host.id, timeMin: start.toISOString(), timeMax: end.toISOString() },
        });
        setBusy((data as { busy?: Array<{ start: string; end: string }> })?.busy ?? []);
      } catch {
        setBusy([]);
      } finally {
        setBusyLoading(false);
      }
    })();
  }, [selectedDay, lookup]);

  const slots = useMemo(() => {
    if (!selectedDay || !lookup) return [];
    const out: Date[] = [];
    const dur = lookup.eventType.duration_mins ?? 30;
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_INCREMENT) {
        const d = new Date(selectedDay);
        d.setHours(h, m, 0, 0);
        if (d.getTime() < Date.now()) continue;
        const slotEnd = new Date(d.getTime() + dur * 60_000);
        const isBusy = busy.some((b) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return d.getTime() < be && slotEnd.getTime() > bs;
        });
        if (!isBusy) out.push(d);
      }
    }
    return out;
  }, [selectedDay, lookup, busy]);

  async function submit() {
    if (!lookup || !selectedSlot || !name || !email) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-confirm", {
        body: {
          eventTypeId: lookup.eventType.id,
          inviteeName: name,
          inviteeEmail: email,
          startAt: selectedSlot.toISOString(),
          intakeData: intake,
        },
      });
      if (error) throw error;
      const d = data as { ok?: boolean; meetLink?: string | null; error?: string };
      if (d.error) throw new Error(d.error);
      setConfirmation({ start: selectedSlot.toISOString(), meetLink: d.meetLink ?? null });
    } catch (e) {
      alert(`Booking failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PublicShell>
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin" /></div>
      </PublicShell>
    );
  }
  if (error || !lookup) {
    return (
      <PublicShell>
        <div className="glass p-8 text-center">
          <div className="t-section mb-2">Link not found</div>
          <div className="t-body">{error ?? "This booking link is no longer active."}</div>
        </div>
      </PublicShell>
    );
  }

  if (confirmation) {
    return (
      <PublicShell>
        <div className="glass-elevated p-8 text-center max-w-md mx-auto">
          <div className="mx-auto mb-4 inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
            <Check size={28} style={{ color: "var(--sev-success)" }} />
          </div>
          <div className="t-hero mb-3" style={{ fontSize: 28 }}>You're booked!</div>
          <div className="t-body mb-1">{lookup.eventType.name} with {lookup.host.display_name ?? lookup.host.username}</div>
          <div className="t-mono mb-4" style={{ fontSize: 12 }}>{new Date(confirmation.start).toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          {confirmation.meetLink && (
            <a href={confirmation.meetLink} target="_blank" rel="noreferrer" className="btn-primary">Open Google Meet</a>
          )}
          <div className="t-body mt-4" style={{ fontSize: 12 }}>A calendar invite has been sent to {email}.</div>
        </div>
      </PublicShell>
    );
  }

  const orgColor = lookup.org?.color ?? "#60A5FA";

  return (
    <PublicShell>
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr_320px] gap-5">
        {/* LEFT: event info */}
        <aside className="glass p-5 h-fit">
          {lookup.org && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3 t-mono"
              style={{ background: `${orgColor}1F`, border: `1px solid ${orgColor}66`, color: orgColor, fontSize: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: orgColor }} />
              {lookup.org.name}
            </div>
          )}
          <h1 className="t-hero" style={{ fontSize: 26, lineHeight: 1.05 }}>{lookup.eventType.name}</h1>
          <div className="t-mono mt-2 flex items-center gap-3" style={{ fontSize: 11 }}>
            <span className="inline-flex items-center gap-1.5"><Clock size={11} /> {lookup.eventType.duration_mins} MIN</span>
          </div>
          <div className="t-body mt-3">{lookup.eventType.description}</div>
          <div className="mt-5 flex items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--border-glass)" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: lookup.host.avatar_url ? `url(${lookup.host.avatar_url}) center/cover` : "linear-gradient(135deg, #2563EB, #6366F1)",
            }} />
            <div>
              <div className="font-display font-bold" style={{ fontSize: 13, color: "var(--text-primary)" }}>{lookup.host.display_name ?? lookup.host.username}</div>
              <div className="t-mono" style={{ fontSize: 10 }}>@{lookup.host.username}</div>
            </div>
          </div>
        </aside>

        {/* MIDDLE: calendar */}
        <section className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setMonthCursor((m) => addMonths(m, -1))} className="btn-icon" style={{ width: 32, height: 32 }}><ChevronLeft size={14} /></button>
            <div className="t-section">{monthCursor.toLocaleDateString([], { month: "long", year: "numeric" })}</div>
            <button onClick={() => setMonthCursor((m) => addMonths(m, 1))} className="btn-icon" style={{ width: 32, height: 32 }}><ChevronRight size={14} /></button>
          </div>
          <MonthGrid month={monthCursor} selected={selectedDay} onPick={(d) => { setSelectedDay(d); setSelectedSlot(null); }} />
        </section>

        {/* RIGHT: time slots + intake */}
        <aside className="glass p-5 h-fit">
          {!selectedDay && (
            <div className="text-center py-6">
              <CalIcon size={20} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <div className="t-card-title">Pick a day</div>
              <div className="t-body" style={{ fontSize: 12 }}>Then choose a time that works.</div>
            </div>
          )}
          {selectedDay && !selectedSlot && (
            <>
              <div className="t-card-title mb-3">{selectedDay.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</div>
              {busyLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0,1,2,3,4,5].map((i) => <div key={i} className="shimmer-block" style={{ height: 36, borderRadius: 10 }} />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="t-body text-center py-4">No available slots this day.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                  {slots.map((s) => (
                    <button key={s.toISOString()} onClick={() => setSelectedSlot(s)} className="glass py-2 t-mono" style={{ fontSize: 12, color: "var(--text-primary)" }}>
                      {s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {selectedSlot && (
            <div className="space-y-3">
              <div className="t-card-title">Confirm details</div>
              <div className="glass-active p-3 t-mono" style={{ fontSize: 12, color: "var(--text-primary)" }}>
                {selectedSlot.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
              <div>
                <div className="t-mono mb-1" style={{ fontSize: 10 }}>NAME *</div>
                <input className="input-glass" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <div className="t-mono mb-1" style={{ fontSize: 10 }}>EMAIL *</div>
                <input type="email" className="input-glass" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {(lookup.eventType.intake_fields ?? []).map((f) => (
                <div key={f.id}>
                  <div className="t-mono mb-1" style={{ fontSize: 10 }}>{f.label.toUpperCase()}{f.required && " *"}</div>
                  {f.type === "textarea" ? (
                    <textarea className="input-glass" rows={3} value={String(intake[f.id] ?? "")} onChange={(e) => setIntake((p) => ({ ...p, [f.id]: e.target.value }))} />
                  ) : f.type === "dropdown" ? (
                    <select className="input-glass" value={String(intake[f.id] ?? "")} onChange={(e) => setIntake((p) => ({ ...p, [f.id]: e.target.value }))}>
                      <option value="">Select…</option>
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "checkbox" ? (
                    <label className="flex items-center gap-2 t-body" style={{ fontSize: 13 }}>
                      <input type="checkbox" checked={Boolean(intake[f.id])} onChange={(e) => setIntake((p) => ({ ...p, [f.id]: e.target.checked }))} />
                      {f.label}
                    </label>
                  ) : (
                    <input type={f.type === "url" ? "url" : "text"} className="input-glass" value={String(intake[f.id] ?? "")} onChange={(e) => setIntake((p) => ({ ...p, [f.id]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setSelectedSlot(null)} className="btn-ghost flex-1 justify-center">Back</button>
                <button onClick={submit} disabled={submitting || !name || !email} className="btn-primary flex-1 justify-center">
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Booking…</> : "Confirm Booking"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </PublicShell>
  );
};

const MonthGrid = ({ month, selected, onPick }: { month: Date; selected: Date | null; onPick: (d: Date) => void }) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="t-mono text-center" style={{ fontSize: 10 }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d.getTime() < today.getTime();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const disabled = past || isWeekend;
          const isSelected = selected && sameDay(d, selected);
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onPick(d)}
              className="aspect-square rounded-lg t-mono transition-all"
              style={{
                fontSize: 12,
                background: isSelected ? "var(--bg-glass-active)" : disabled ? "transparent" : "var(--bg-glass-1)",
                color: disabled ? "var(--text-muted)" : "var(--text-primary)",
                border: `1px solid ${isSelected ? "var(--border-active)" : "var(--border-glass)"}`,
                opacity: disabled ? 0.35 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                boxShadow: isSelected ? "0 0 16px var(--glow-blue)" : "none",
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PublicShell = ({ children }: { children: React.ReactNode }) => (
  <div className="app-bg min-h-screen">
    <div className="bg-orb-1" />
    <div className="bg-orb-2" />
    <header className="relative z-10 px-5 py-4 flex items-center justify-between">
      <Logo />
      <div className="t-mono flex items-center gap-1" style={{ fontSize: 10 }}>
        <Sparkles size={11} /> POWERED BY VISI OS
      </div>
    </header>
    <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 page-enter">
      {children}
      <div className="text-center mt-8">
        <Link to="/" className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>← Back to Visi OS</Link>
      </div>
    </main>
  </div>
);

export default BookingPublic;
