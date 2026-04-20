// Returns busy intervals for the host's primary calendar between timeMin/timeMax.
// Body: { userId: string, timeMin: ISO, timeMax: ISO }
// Public (no auth) — used by the public booking page. We use the host's stored
// refresh token (server-side) to query Google.
import { corsHeaders, jsonResponse, adminClient, getFreshGoogleAccessToken, googleFetch } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { userId, timeMin, timeMax } = await req.json();
    if (!userId || !timeMin || !timeMax) {
      return jsonResponse({ error: "userId, timeMin, timeMax required" }, 400);
    }
    // Make sure the userId actually maps to a profile with a username (don't leak
    // freeBusy for arbitrary auth users).
    const admin = adminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.username) return jsonResponse({ error: "Host not found" }, 404);

    const token = await getFreshGoogleAccessToken(userId);
    const r = await googleFetch("https://www.googleapis.com/calendar/v3/freeBusy", token, {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `freeBusy failed [${r.status}]: ${JSON.stringify(data)}` }, r.status);
    const busy: Array<{ start: string; end: string }> = data?.calendars?.primary?.busy ?? [];
    return jsonResponse({ busy });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
