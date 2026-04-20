// Lists primary calendar events for the authed user between timeMin/timeMax.
// Body: { timeMin: ISO, timeMax: ISO }
import { corsHeaders, jsonResponse, getAuthedUserFromReq, getFreshGoogleAccessToken, googleFetch } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { timeMin, timeMax } = await req.json();
    if (!timeMin || !timeMax) return jsonResponse({ error: "timeMin, timeMax required" }, 400);

    let token: string;
    try {
      token = await getFreshGoogleAccessToken(user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/refresh token/i.test(message)) {
        return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED", fallback: true, events: [] });
      }
      throw e;
    }
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const r = await googleFetch(url.toString(), token);
    const data = await r.json();
    if (!r.ok) {
      const message = `list events failed [${r.status}]: ${JSON.stringify(data)}`;
      if (r.status === 401 || /invalid_grant|invalid credentials/i.test(message)) {
        return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED", fallback: true, events: [] });
      }
      return jsonResponse({ error: message, fallback: true, events: [] });
    }
    const events = (data.items ?? []).map((e: Record<string, unknown> & { start?: Record<string, string>; end?: Record<string, string>; attendees?: Array<{ email?: string }> }) => ({
      id: e.id,
      summary: e.summary ?? "(no title)",
      description: e.description ?? "",
      location: e.location ?? "",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
      attendees: (e.attendees ?? []).map((a) => a.email).filter(Boolean),
      hangoutLink: e.hangoutLink ?? null,
      htmlLink: e.htmlLink ?? null,
      colorId: e.colorId ?? null,
      status: e.status ?? null,
    }));
    return jsonResponse({ events });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: message, fallback: true, events: [] });
  }
});
