// Lists primary Google Calendar events for a set of teammates the authed user
// shares an org with. Returns sanitized events (title, start, end, hangoutLink,
// owner_id). Private events are skipped.
//
// Body: { memberIds: string[], timeMin: ISO, timeMax: ISO }
import {
  corsHeaders,
  jsonResponse,
  adminClient,
  getAuthedUserFromReq,
  getFreshGoogleAccessToken,
  googleFetch,
} from "../_shared/google.ts";

interface TeamEvent {
  id: string;
  owner_id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  hangoutLink: string | null;
  htmlLink: string | null;
  attendees: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { memberIds, timeMin, timeMax } = await req.json();
    if (!Array.isArray(memberIds) || !timeMin || !timeMax) {
      return jsonResponse({ error: "memberIds[], timeMin, timeMax required" }, 400);
    }
    const requested: string[] = memberIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0 && x !== user.id);
    if (requested.length === 0) return jsonResponse({ events: [] });

    const admin = adminClient();

    // Find orgs the authed user belongs to
    const { data: myOrgs, error: orgErr } = await admin
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id);
    if (orgErr) return jsonResponse({ error: orgErr.message }, 500);
    const orgIds = (myOrgs ?? []).map((r: { org_id: string }) => r.org_id);
    if (orgIds.length === 0) return jsonResponse({ events: [] });

    // Find which of the requested members share an org with the caller
    const { data: shared, error: shErr } = await admin
      .from("org_memberships")
      .select("user_id")
      .in("org_id", orgIds)
      .in("user_id", requested);
    if (shErr) return jsonResponse({ error: shErr.message }, 500);
    const allowed = Array.from(new Set((shared ?? []).map((r: { user_id: string }) => r.user_id)));
    if (allowed.length === 0) return jsonResponse({ events: [] });

    const url = (memberId: string) => {
      const u = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      u.searchParams.set("timeMin", timeMin);
      u.searchParams.set("timeMax", timeMax);
      u.searchParams.set("singleEvents", "true");
      u.searchParams.set("orderBy", "startTime");
      u.searchParams.set("maxResults", "250");
      return u.toString();
    };

    const unavailable: Array<{ user_id: string; reason: string }> = [];
    const results = await Promise.all(
      allowed.map(async (memberId): Promise<TeamEvent[]> => {
        try {
          const token = await getFreshGoogleAccessToken(memberId);
          const r = await googleFetch(url(memberId), token);
          if (!r.ok) {
            unavailable.push({ user_id: memberId, reason: `google_api_${r.status}` });
            return [];
          }
          const data = await r.json() as { items?: Array<Record<string, unknown> & {
            start?: Record<string, string>; end?: Record<string, string>;
            attendees?: Array<{ email?: string }>; visibility?: string;
          }> };
          return (data.items ?? [])
            .filter((e) => e.visibility !== "private" && e.visibility !== "confidential")
            .map((e) => ({
              id: `g:${memberId}:${e.id as string}`,
              owner_id: memberId,
              summary: (e.summary as string) ?? "(busy)",
              start: (e.start?.dateTime ?? e.start?.date) as string,
              end: (e.end?.dateTime ?? e.end?.date) as string,
              allDay: !e.start?.dateTime,
              hangoutLink: (e.hangoutLink as string) ?? null,
              htmlLink: (e.htmlLink as string) ?? null,
              attendees: (e.attendees ?? []).map((a) => a.email).filter((x): x is string => Boolean(x)),
            }))
            .filter((e) => e.start && e.end);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          unavailable.push({
            user_id: memberId,
            reason: /refresh token/i.test(msg) ? "not_connected" : "token_error",
          });
          return [];
        }
      }),
    );

    return jsonResponse({ events: results.flat(), unavailable });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e), events: [] }, 500);
  }
});
