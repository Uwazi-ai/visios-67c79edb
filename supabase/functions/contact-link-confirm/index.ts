// PUBLIC endpoint. Confirms a personal booking link by token + chosen slot.
// Body: { token, slotId, inviteeName, inviteeEmail }
import { corsHeaders, jsonResponse, adminClient, getFreshGoogleAccessToken, googleFetch } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, slotId, inviteeName, inviteeEmail } = await req.json();
    if (!token || !slotId || !inviteeName || !inviteeEmail) {
      return jsonResponse({ error: "token, slotId, inviteeName, inviteeEmail required" }, 400);
    }
    const admin = adminClient();
    const { data: link } = await admin
      .from("contact_booking_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (!link) return jsonResponse({ error: "Link not found" }, 404);
    if (link.status !== "open") return jsonResponse({ error: "This link has already been used" }, 409);

    const { data: slot } = await admin
      .from("contact_booking_link_slots")
      .select("*")
      .eq("id", slotId)
      .eq("link_id", link.id)
      .maybeSingle();
    if (!slot) return jsonResponse({ error: "Slot not found" }, 404);

    const start = new Date(slot.start_at);
    const end = new Date(slot.end_at);

    // Create Google Calendar event w/ Meet
    let googleEventId: string | null = null;
    let meetLink: string | null = null;
    try {
      const accessToken = await getFreshGoogleAccessToken(link.host_user_id);
      const r = await googleFetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            summary: `${link.title} with ${inviteeName}`,
            description: link.description ?? "",
            location: link.location ?? undefined,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            attendees: [{ email: inviteeEmail, displayName: inviteeName }],
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
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

    const { error: updErr } = await admin
      .from("contact_booking_links")
      .update({
        status: "booked",
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        booked_slot_id: slot.id,
        booked_at: new Date().toISOString(),
        google_event_id: googleEventId,
        meet_link: meetLink,
      })
      .eq("id", link.id);
    if (updErr) {
      console.error("contact-link-confirm update error", updErr.message);
      return jsonResponse({ error: "Failed to confirm booking. Please try again." }, 500);
    }

    // Touch contact (if linked)
    if (link.contact_id) {
      await admin.from("contacts").update({ last_touched_at: new Date().toISOString() }).eq("id", link.contact_id);
    }

    return jsonResponse({
      ok: true,
      meetLink,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  } catch (e) {
    console.error("contact-link-confirm error", e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: "An internal error occurred. Please try again." }, 500);
  }
});
