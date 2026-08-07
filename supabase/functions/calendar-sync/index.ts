// calendar-sync — incremental Google Calendar sync into calendar_events.
//
// Read-only against Google. This function never writes to a calendar; it only
// mirrors one. Deletions arrive as status 'cancelled' and are KEPT — a
// cancelled meeting that vanishes from history is a bug you discover months
// later when you cannot explain a gap in your week.
import {
  corsHeaders, jsonResponse, admin, authedUser, isOrgMember,
  isDemoOrg, googleToken, gcal, type CalendarAccount,
} from "../_shared/calendar.ts";

const BACK_DAYS = 30;
const FORWARD_DAYS = 180;

function windowBounds() {
  const now = Date.now();
  return {
    timeMin: new Date(now - BACK_DAYS * 86400000).toISOString(),
    timeMax: new Date(now + FORWARD_DAYS * 86400000).toISOString(),
  };
}

interface GEvent {
  id: string;
  iCalUID?: string;
  recurringEventId?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  visibility?: string;
  transparency?: string;
  organizer?: { email?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; self?: boolean; organizer?: boolean; optional?: boolean }>;
}

const STATUS_MAP: Record<string, string> = { confirmed: "confirmed", tentative: "tentative", cancelled: "cancelled" };
const VIS_MAP: Record<string, string> = { default: "default", public: "public", private: "private", confidential: "confidential" };
const RSVP_MAP: Record<string, string> = { needsAction: "needsAction", accepted: "accepted", declined: "declined", tentative: "tentative" };

/** All-day events are dates, not instants. Store the date at UTC midnight and
 *  render in the reader's zone — a local-midnight timestamp shifts the day. */
function bounds(e: GEvent) {
  const allDay = !e.start?.dateTime;
  if (allDay) {
    const s = e.start?.date ?? new Date().toISOString().slice(0, 10);
    const en = e.end?.date ?? s;
    return { allDay, starts_at: `${s}T00:00:00.000Z`, ends_at: `${en}T00:00:00.000Z` };
  }
  return { allDay, starts_at: e.start!.dateTime!, ends_at: e.end?.dateTime ?? e.start!.dateTime! };
}

function conferenceUrl(e: GEvent) {
  if (e.hangoutLink) return e.hangoutLink;
  const ep = e.conferenceData?.entryPoints?.find((x) => x.entryPointType === "video");
  return ep?.uri ?? null;
}

function toRow(e: GEvent, acct: CalendarAccount) {
  const b = bounds(e);
  const self = e.attendees?.find((a) => a.self);
  return {
    org_id: acct.org_id,
    calendar_account_id: acct.id,
    provider_event_id: e.id,
    ical_uid: e.iCalUID ?? null,
    recurring_event_id: e.recurringEventId ?? null,
    is_recurring_instance: !!e.recurringEventId,
    title: e.summary ?? null,
    description: e.description ?? null,
    location: e.location ?? null,
    conference_url: conferenceUrl(e),
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    all_day: b.allDay,
    event_timezone: e.start?.timeZone ?? "UTC",
    status: STATUS_MAP[e.status ?? "confirmed"] ?? "confirmed",
    visibility: VIS_MAP[e.visibility ?? "default"] ?? "default",
    transparency: e.transparency === "transparent" ? "transparent" : "opaque",
    organizer_email: e.organizer?.email ?? null,
    self_response: RSVP_MAP[self?.responseStatus ?? "needsAction"] ?? "needsAction",
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      name: a.displayName ?? null,
      response: a.responseStatus ?? "needsAction",
      self: !!a.self,
      organizer: !!a.organizer,
      optional: !!a.optional,
    })),
    source: "synced",
    updated_at: new Date().toISOString(),
  };
}

async function listPage(acct: CalendarAccount, token: string, opts: { syncToken?: string | null; pageToken?: string }) {
  const p = new URLSearchParams({ singleEvents: "true", maxResults: "250", showDeleted: "true" });
  if (opts.syncToken) p.set("syncToken", opts.syncToken);
  else {
    const w = windowBounds();
    p.set("timeMin", w.timeMin);
    p.set("timeMax", w.timeMax);
  }
  if (opts.pageToken) p.set("pageToken", opts.pageToken);
  return await gcal(`/calendars/${encodeURIComponent(acct.calendar_id)}/events?${p}`, token);
}

async function syncAccount(acct: CalendarAccount) {
  const db = admin();
  const token = await googleToken(acct.connected_by);

  let syncToken: string | null = acct.sync_token;
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let seen = 0;
  let fullResync = false;

  for (let guard = 0; guard < 40; guard++) {
    let r = await listPage(acct, token, { syncToken, pageToken });

    if (r.status === 410) {
      // Token expired. Google will not tell you what you missed, so re-read
      // the whole window rather than failing the sync.
      fullResync = true;
      syncToken = null;
      pageToken = undefined;
      r = await listPage(acct, token, { syncToken: null });
    }
    if (!r.ok) {
      const body = await r.text();
      throw Object.assign(new Error(`google ${r.status}: ${body}`), { httpStatus: r.status });
    }

    const data = await r.json() as { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
    const rows = (data.items ?? []).filter((e) => e.id).map((e) => toRow(e, acct));
    if (rows.length) {
      const { error } = await db
        .from("calendar_events")
        .upsert(rows, { onConflict: "calendar_account_id,provider_event_id" });
      if (error) throw new Error(`upsert failed: ${error.message}`);
      seen += rows.length;
    }
    nextSyncToken = data.nextSyncToken ?? nextSyncToken;
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  await db.from("calendar_accounts").update({
    sync_token: nextSyncToken,
    last_sync_at: new Date().toISOString(),
    last_error: null,
    status: "connected",
  }).eq("id", acct.id);

  return { account_id: acct.id, events: seen, full_resync: fullResync };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const accountId: string | undefined = body?.account_id;
    const orgId: string | undefined = body?.org_id;

    const db = admin();
    let q = db.from("calendar_accounts").select("*");
    if (accountId) q = q.eq("id", accountId);
    if (orgId) q = q.eq("org_id", orgId);
    const { data, error } = await q;
    if (error) return jsonResponse({ error: error.message }, 500);

    const accounts = (data ?? []) as CalendarAccount[];
    const results: unknown[] = [];

    for (const acct of accounts) {
      if (!(await isOrgMember(user.id, acct.org_id))) continue;
      if (await isDemoOrg(acct.org_id)) {
        results.push({ account_id: acct.id, skipped: "demo_org" });
        continue;
      }
      try {
        results.push(await syncAccount(acct));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const expired = (e as { httpStatus?: number })?.httpStatus === 401 || /invalid_grant|refresh token/i.test(msg);
        await db.from("calendar_accounts").update({
          last_error: msg.slice(0, 500),
          status: expired ? "expired" : "error",
        }).eq("id", acct.id);
        results.push({ account_id: acct.id, error: msg });
      }
    }

    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
