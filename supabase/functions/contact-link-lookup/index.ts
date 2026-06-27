// PUBLIC endpoint. Looks up a personal booking link by token.
// Body: { token: string }
import { corsHeaders, jsonResponse, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) return jsonResponse({ error: "token required" }, 400);
    const admin = adminClient();
    const { data: link } = await admin
      .from("contact_booking_links")
      .select("id, token, host_user_id, contact_id, org_id, title, description, duration_mins, location, status, invitee_name, invitee_email, booked_slot_id, booked_at, meet_link, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!link) return jsonResponse({ error: "Link not found" }, 404);

    const { data: host } = await admin
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .eq("id", link.host_user_id)
      .maybeSingle();

    const { data: slots } = await admin
      .from("contact_booking_link_slots")
      .select("id, start_at, end_at")
      .eq("link_id", link.id)
      .order("start_at", { ascending: true });

    let org: { name: string; color: string } | null = null;
    if (link.org_id) {
      const { data: o } = await admin.from("orgs").select("name, color").eq("id", link.org_id).maybeSingle();
      if (o) org = o;
    }

    return jsonResponse({ link, host, slots: slots ?? [], org });
  } catch (e) {
    console.error("contact-link-lookup error", e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: "An internal error occurred. Please try again." }, 500);
  }
});
