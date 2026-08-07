import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useCalendar — one read per surface, and the deduplication happens here
 * rather than in the grid. A meeting invited to two of your accounts is one
 * meeting; letting it reach the grid twice reads as a conflict with itself,
 * which is exactly the false positive that destroys trust in conflict
 * detection.
 */

export interface Attendee {
  email: string;
  name?: string | null;
  response?: string;
  self?: boolean;
  organizer?: boolean;
}

export interface CalendarAccount {
  id: string;
  org_id: string;
  account_email: string;
  calendar_id: string;
  display_name: string | null;
  color_override: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface CalendarEvent {
  id: string;
  org_id: string;
  calendar_account_id: string;
  ical_uid: string | null;
  recurring_event_id: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  conference_url: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  event_timezone: string;
  status: string;
  transparency: string;
  organizer_email: string | null;
  self_response: string;
  attendees: Attendee[];
  linked_task_ids: string[];
  transcript_ref: Record<string, unknown>;
  /** Every org this same meeting landed in — one block, both markers. */
  org_ids: string[];
}

export interface Conflict {
  event_a_id: string;
  event_b_id: string;
  org_a_id: string;
  org_b_id: string;
  overlap_start: string;
  overlap_end: string;
  is_cross_org: boolean;
}

export interface HoldProposal {
  id: string;
  org_id: string;
  title: string;
  rationale: string | null;
  payload: {
    starts_at?: string;
    ends_at?: string;
    duration_minutes?: number;
    calendar_account_id?: string;
    attendees?: string[];
  };
}

export interface Brief {
  event_id: string;
  content: string;
  status: string;
  context_refs: Array<{ kind: string; id: string; label: string }>;
}

/** Two rows for the same meeting collapse into one, carrying both orgs. */
function dedupe(rows: CalendarEvent[]): CalendarEvent[] {
  const byUid = new Map<string, CalendarEvent>();
  const out: CalendarEvent[] = [];
  for (const r of rows) {
    const key = r.ical_uid;
    if (!key) { out.push({ ...r, org_ids: [r.org_id] }); continue; }
    const existing = byUid.get(key);
    if (existing) {
      if (!existing.org_ids.includes(r.org_id)) existing.org_ids.push(r.org_id);
      continue;
    }
    const copy = { ...r, org_ids: [r.org_id] };
    byUid.set(key, copy);
    out.push(copy);
  }
  return out;
}

export function useCalendar(scopeOrgId: string | null, from: Date, to: Date) {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [holds, setHolds] = useState<HoldProposal[]>([]);
  const [briefs, setBriefs] = useState<Record<string, Brief>>({});
  const [error, setError] = useState<string | null>(null);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const load = useCallback(async () => {
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) { setLoading(false); return; }

    let accountsQ = supabase
      .from("calendar_accounts")
      .select("id,org_id,account_email,calendar_id,display_name,color_override,status,last_sync_at,last_error");
    let eventsQ = supabase
      .from("calendar_events")
      .select("id,org_id,calendar_account_id,ical_uid,recurring_event_id,title,description,location,conference_url,starts_at,ends_at,all_day,event_timezone,status,transparency,organizer_email,self_response,attendees,linked_task_ids,transcript_ref")
      .neq("status", "cancelled")
      .lt("starts_at", toIso)
      .gt("ends_at", fromIso)
      .order("starts_at", { ascending: true });
    let holdsQ = supabase
      .from("proposals")
      .select("id,org_id,title,rationale,payload")
      .eq("kind", "calendar_hold")
      .eq("status", "pending");

    if (scopeOrgId) {
      accountsQ = accountsQ.eq("org_id", scopeOrgId);
      eventsQ = eventsQ.eq("org_id", scopeOrgId);
      holdsQ = holdsQ.eq("org_id", scopeOrgId);
    }

    const [a, e, c, p, b] = await Promise.allSettled([
      accountsQ,
      eventsQ,
      supabase.rpc("get_schedule_conflicts", { p_start: fromIso, p_end: toIso }),
      holdsQ,
      supabase.from("meeting_briefs").select("event_id,content,status,context_refs"),
    ]);

    if (a.status === "fulfilled" && a.value.data) setAccounts(a.value.data as CalendarAccount[]);
    if (e.status === "fulfilled") {
      if (e.value.error) setError(e.value.error.message);
      setEvents(dedupe(((e.value.data ?? []) as unknown as CalendarEvent[])));
    }
    if (c.status === "fulfilled" && c.value.data) setConflicts(c.value.data as Conflict[]);
    if (p.status === "fulfilled" && p.value.data) setHolds(p.value.data as unknown as HoldProposal[]);
    if (b.status === "fulfilled" && b.value.data) {
      const map: Record<string, Brief> = {};
      for (const row of b.value.data as unknown as Brief[]) map[row.event_id] = row;
      setBriefs(map);
    }
    setLoading(false);
  }, [scopeOrgId, fromIso, toIso]);

  useEffect(() => { void load(); }, [load]);

  const orgsWithAccounts = useMemo(
    () => new Set(accounts.map((a) => a.org_id)),
    [accounts],
  );

  const conflictIds = useMemo(() => {
    const cross = new Set<string>();
    const same = new Set<string>();
    for (const c of conflicts) {
      (c.is_cross_org ? cross : same).add(c.event_a_id);
      (c.is_cross_org ? cross : same).add(c.event_b_id);
    }
    return { cross, same };
  }, [conflicts]);

  const rsvp = useCallback(async (
    eventId: string,
    response: "needsAction" | "accepted" | "declined" | "tentative",
  ) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, self_response: response } : e)));
    await supabase.from("calendar_events").update({ self_response: response }).eq("id", eventId);
  }, []);

  const requestBrief = useCallback(async (eventId: string) => {
    setBriefs((prev) => ({
      ...prev,
      [eventId]: { event_id: eventId, content: "", status: "generating", context_refs: [] },
    }));
    const { data, error: err } = await supabase.functions.invoke("generate-meeting-brief", {
      body: { event_id: eventId },
    });
    if (err) {
      setBriefs((prev) => ({
        ...prev,
        [eventId]: { event_id: eventId, content: "Brief generation failed.", status: "failed", context_refs: [] },
      }));
      return;
    }
    const res = data as { content?: string };
    setBriefs((prev) => ({
      ...prev,
      [eventId]: { event_id: eventId, content: res?.content ?? "", status: "ready", context_refs: [] },
    }));
  }, []);

  const dismissHold = useCallback(async (id: string) => {
    setHolds((prev) => prev.filter((h) => h.id !== id));
    await supabase.from("proposals").update({ status: "dismissed" }).eq("id", id);
  }, []);

  return {
    loading, error, accounts, events, conflicts, conflictIds, holds, briefs,
    orgsWithAccounts, reload: load, rsvp, requestBrief, dismissHold,
  };
}
