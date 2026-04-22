// Creates a Google Calendar event on the authed user's primary calendar.
// Body: { summary, start: ISO, end: ISO, description?, colorId? }
import { corsHeaders, jsonResponse, getAuthedUserFromReq, getFreshGoogleAccessToken, googleFetch } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { summary, start, end, description, colorId, attendees, addMeet } = await req.json();
    if (!summary || !start || !end) return jsonResponse({ error: "summary, start, end required" }, 400);

    const token = await getFreshGoogleAccessToken(user.id);
    const body: Record<string, unknown> = {
      summary,
      description: description ?? "",
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
      colorId: colorId ?? "7",
    };
    if (Array.isArray(attendees) && attendees.length > 0) {
      body.attendees = attendees
        .filter((e: unknown) => typeof e === "string" && e.includes("@"))
        .map((email: string) => ({ email }));
    }
    if (addMeet) {
      body.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }
    const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
      (addMeet ? "?conferenceDataVersion=1&sendUpdates=all" : "?sendUpdates=all");
    const r = await googleFetch(url, token, { method: "POST", body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `create event failed [${r.status}]: ${JSON.stringify(data)}` }, r.status);
    return jsonResponse({ ok: true, event: { id: data.id, htmlLink: data.htmlLink, hangoutLink: data.hangoutLink ?? null } });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
