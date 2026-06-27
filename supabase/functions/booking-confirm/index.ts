// PUBLIC endpoint. Confirms a booking:
// 1. Loads the event_type + host profile.
// 2. Creates a Google Calendar event w/ Meet link on the host's calendar.
// 3. Inserts row into bookings + items.
// 4. Triggers AI prep brief (best-effort, async, non-blocking).
//
// Body: { eventTypeId, inviteeName, inviteeEmail, startAt (ISO), intakeData }
import { corsHeaders, jsonResponse, adminClient, getFreshGoogleAccessToken, googleFetch } from "../_shared/google.ts";

function uuid(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { eventTypeId, inviteeName, inviteeEmail, startAt, intakeData } = await req.json();
    if (!eventTypeId || !inviteeName || !inviteeEmail || !startAt) {
      return jsonResponse({ error: "eventTypeId, inviteeName, inviteeEmail, startAt required" }, 400);
    }
    const admin = adminClient();
    const { data: et, error: etErr } = await admin
      .from("event_types")
      .select("id, name, slug, duration_mins, description, org_id, user_id, active")
      .eq("id", eventTypeId)
      .maybeSingle();
    if (etErr || !et || !et.active) return jsonResponse({ error: "Event type not found" }, 404);
    if (!et.user_id) return jsonResponse({ error: "Event type missing host" }, 400);

    const { data: host } = await admin
      .from("profiles")
      .select("id, email, display_name, username")
      .eq("id", et.user_id)
      .maybeSingle();
    if (!host) return jsonResponse({ error: "Host profile not found" }, 404);

    const start = new Date(startAt);
    const end = new Date(start.getTime() + (et.duration_mins ?? 30) * 60_000);

    // 1) Create Google Calendar event
    let googleEventId: string | null = null;
    let meetLink: string | null = null;
    try {
      const token = await getFreshGoogleAccessToken(et.user_id);
      const r = await googleFetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            summary: `${et.name} with ${inviteeName}`,
            description: et.description ?? "",
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            attendees: [{ email: inviteeEmail, displayName: inviteeName }],
            conferenceData: {
              createRequest: {
                requestId: uuid(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }),
        },
      );
      const data = await r.json();
      if (r.ok) {
        googleEventId = data.id ?? null;
        meetLink = data.hangoutLink ?? data?.conferenceData?.entryPoints?.find((e: { entryPointType?: string }) => e.entryPointType === "video")?.uri ?? null;
      } else {
        console.error("calendar create failed", r.status, JSON.stringify(data));
      }
    } catch (e) {
      console.error("calendar error (non-fatal)", e instanceof Error ? e.message : String(e));
    }

    // 2) Insert booking
    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .insert({
        org_id: et.org_id,
        event_type_id: et.id,
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        intake_data: intakeData ?? {},
        google_event_id: googleEventId,
        status: "confirmed",
      })
      .select()
      .single();
    if (bErr) return jsonResponse({ error: `booking insert failed: ${bErr.message}` }, 500);

    // 3) Inbox item (best-effort)
    if (et.org_id) {
      await admin.from("items").insert({
        org_id: et.org_id,
        user_id: et.user_id,
        type: "event",
        title: `${inviteeName} — ${et.name}`,
        source: "booking",
        due_at: start.toISOString(),
        metadata: {
          booking_id: booking.id,
          invitee_email: inviteeEmail,
          google_event_id: googleEventId,
          meet_link: meetLink,
        },
      });
    }

    // 4) Fire-and-forget AI prep brief
    (async () => {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-prep-brief`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ bookingId: booking.id }),
        });
      } catch (e) {
        console.error("prep-brief trigger failed", e instanceof Error ? e.message : String(e));
      }
    })();

    return jsonResponse({
      ok: true,
      booking: { id: booking.id, start_at: booking.start_at, end_at: booking.end_at },
      meetLink,
      host: { name: host.display_name ?? host.username },
      eventType: { name: et.name, duration_mins: et.duration_mins },
    });
  } catch (e) {
    console.error("booking-confirm error", e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: "An internal error occurred. Please try again." }, 500);
  }
});
