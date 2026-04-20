// Creates a Google Calendar event on the authed user's primary calendar.
// Body: { summary, start: ISO, end: ISO, description?, colorId? }
import { corsHeaders, jsonResponse, getAuthedUserFromReq, getFreshGoogleAccessToken, googleFetch } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { summary, start, end, description, colorId } = await req.json();
    if (!summary || !start || !end) return jsonResponse({ error: "summary, start, end required" }, 400);

    const token = await getFreshGoogleAccessToken(user.id);
    const r = await googleFetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      token,
      {
        method: "POST",
        body: JSON.stringify({
          summary,
          description: description ?? "",
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(end).toISOString() },
          colorId: colorId ?? "7",
        }),
      },
    );
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `create event failed [${r.status}]: ${JSON.stringify(data)}` }, r.status);
    return jsonResponse({ ok: true, event: { id: data.id, htmlLink: data.htmlLink } });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
