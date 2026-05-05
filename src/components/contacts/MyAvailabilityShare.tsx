import { useEffect, useMemo, useState } from "react";
import { Calendar, Copy, Check, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  contactEmail?: string | null;
  contactName?: string | null;
}

interface Busy { start: string; end: string }

/**
 * Outlook-style free/busy strip showing the host's availability for the next 7 days.
 * Only busy blocks are shown — never event titles or attendees. Includes a
 * "share booking link" button so the contact can pick a slot themselves.
 */
export const MyAvailabilityShare = ({ contactEmail, contactName }: Props) => {
  const [busy, setBusy] = useState<Busy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Build a 7-day window starting today, 8am-8pm local
  const days = useMemo(() => {
    const out: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancel) setUsername(profile?.username ?? null);

        const timeMin = new Date();
        timeMin.setHours(0, 0, 0, 0);
        const timeMax = new Date(timeMin);
        timeMax.setDate(timeMax.getDate() + 7);

        const { data, error } = await supabase.functions.invoke("calendar-freebusy", {
          body: {
            userId: user.id,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        if (!cancel) setBusy(((data as any)?.busy ?? []) as Busy[]);
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Failed to load availability");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const bookingUrl = username
    ? `${window.location.origin}/book/${username}`
    : null;

  async function copyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function emailLink() {
    if (!bookingUrl || !contactEmail) return "#";
    const subject = encodeURIComponent("Find a time that works");
    const body = encodeURIComponent(
      `Hi ${contactName?.split(/\s+/)[0] ?? "there"},\n\nHere's a link to book a time on my calendar:\n${bookingUrl}\n\nThanks!`,
    );
    return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="glass p-3" style={{ background: "var(--bg-glass-1)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} style={{ color: "var(--text-accent)" }} />
          <div className="t-card-title" style={{ fontSize: 10 }}>MY AVAILABILITY</div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="t-mono"
          style={{ fontSize: 9, color: "var(--text-muted)" }}
          title="Toggle preview"
        >
          <Eye size={10} style={{ display: "inline", marginRight: 4 }} />
          {expanded ? "hide" : "show 7 days"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          <Loader2 size={12} className="animate-spin" /> Loading free/busy…
        </div>
      ) : error ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{error}</div>
      ) : (
        expanded && <FreeBusyStrip days={days} busy={busy} />
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {bookingUrl ? (
          <>
            <button
              onClick={copyLink}
              className="btn-ghost"
              style={{ fontSize: 10, padding: "6px 10px" }}
              title={bookingUrl}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy booking link"}
            </button>
            {contactEmail && (
              <a
                href={emailLink()}
                className="btn-ghost"
                style={{ fontSize: 10, padding: "6px 10px" }}
              >
                Email it
              </a>
            )}
          </>
        ) : (
          <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Set your username in Settings to share a booking link.
          </span>
        )}
      </div>
      <div className="t-mono mt-2" style={{ fontSize: 9, color: "var(--text-muted)" }}>
        Free/busy only — no titles or attendees shared.
      </div>
    </div>
  );
};

function FreeBusyStrip({ days, busy }: { days: Date[]; busy: Busy[] }) {
  const HOUR_START = 8;
  const HOUR_END = 20; // 8am–8pm
  const span = HOUR_END - HOUR_START;

  return (
    <div className="space-y-1.5">
      {days.map((d) => {
        const dayStart = new Date(d); dayStart.setHours(HOUR_START, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(HOUR_END, 0, 0, 0);
        const blocks = busy
          .map((b) => ({ s: new Date(b.start), e: new Date(b.end) }))
          .filter((b) => b.e > dayStart && b.s < dayEnd)
          .map((b) => {
            const s = Math.max(b.s.getTime(), dayStart.getTime());
            const e = Math.min(b.e.getTime(), dayEnd.getTime());
            const left = ((s - dayStart.getTime()) / (dayEnd.getTime() - dayStart.getTime())) * 100;
            const width = ((e - s) / (dayEnd.getTime() - dayStart.getTime())) * 100;
            return { left, width };
          });
        const isToday = d.toDateString() === new Date().toDateString();
        const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        return (
          <div key={d.toISOString()} className="flex items-center gap-2">
            <div
              className="t-mono"
              style={{
                fontSize: 9,
                width: 64,
                color: isToday ? "var(--text-accent)" : "var(--text-muted)",
              }}
            >
              {label}
            </div>
            <div
              className="relative flex-1"
              style={{
                height: 14,
                borderRadius: 4,
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
              title={`${HOUR_START}:00 – ${HOUR_END}:00`}
            >
              {blocks.map((b, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${b.left}%`,
                    width: `${Math.max(b.width, 1)}%`,
                    background: "rgba(239,68,68,0.55)",
                    borderRadius: 3,
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 mt-1 t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
        <span className="inline-flex items-center gap-1">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(34,197,94,0.5)" }} /> Free
        </span>
        <span className="inline-flex items-center gap-1">
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(239,68,68,0.55)" }} /> Busy
        </span>
        <span>· 8am–8pm local</span>
      </div>
    </div>
  );
}
