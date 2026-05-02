import { useEffect, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useTime } from "@/contexts/TimezoneContext";
import { ORG_COLORS } from "@/lib/orgs";
import { detectOrgSlugFromEmails } from "@/lib/orgDetect";
import { EmptyHint } from "./DashCard";

const PERSONAL_COLOR = "#6366F1";

interface ApiEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[];
  hangoutLink: string | null;
  htmlLink: string | null;
}

interface Row {
  id: string;
  time: string;
  title: string;
  color: string;
  attendees: number;
  hangoutLink: string | null;
  live: boolean;
}

export const ScheduleToday = () => {
  const { user } = useAuth();
  const { orgs } = useOrg();
  const { tz } = useTime();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const { data, error } = await supabase.functions.invoke("calendar-list-events", {
          body: { timeMin: start.toISOString(), timeMax: end.toISOString() },
        });
        if (cancelled) return;
        if (error) throw new Error(error.message);
        if (data?.error && !data?.fallback) throw new Error(data.error);
        if (data?.fallback || !data?.events) {
          setRows([]);
          return;
        }
        const orgColorBySlug = new Map<string, string>();
        orgs.forEach((o) => orgColorBySlug.set(o.slug, o.color || ORG_COLORS[o.slug] || PERSONAL_COLOR));
        const now = new Date();
        const mapped: Row[] = (data.events as ApiEvent[])
          .filter((e) => !e.allDay && e.start)
          .map((e) => {
            const slug = detectOrgSlugFromEmails(e.attendees ?? [], orgs);
            const startD = new Date(e.start);
            const endD = new Date(e.end);
            return {
              id: e.id,
              time: startD.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: false,
                timeZone: tz,
              }),
              title: e.summary || "(no title)",
              color: slug ? orgColorBySlug.get(slug) ?? PERSONAL_COLOR : PERSONAL_COLOR,
              attendees: (e.attendees ?? []).length,
              hangoutLink: e.hangoutLink,
              live: now >= startD && now <= endD,
            };
          });
        setRows(mapped);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, orgs, tz]);

  if (loading && !rows) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }
  if (err) return <EmptyHint>{err}</EmptyHint>;
  if (!rows || rows.length === 0) return <EmptyHint>Nothing on the calendar today.</EmptyHint>;

  return (
    <>
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors hover:bg-white/[0.04]"
          style={{ borderLeft: `2px solid ${r.color}`, background: "var(--bg-glass-1)" }}
        >
          <span className="t-mono" style={{ color: "var(--text-primary)", fontSize: 12 }}>{r.time}</span>
          <span
            className="flex-1 truncate"
            style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {r.title}
          </span>
          {r.attendees > 0 && <span className="badge badge-muted">{r.attendees}</span>}
          {r.live && r.hangoutLink && (
            <a href={r.hangoutLink} target="_blank" rel="noreferrer" className="btn-ghost flex items-center gap-1" style={{ height: 26, padding: "0 10px", fontSize: 10 }}>
              <Video size={10} /> Join
            </a>
          )}
        </div>
      ))}
    </>
  );
};
