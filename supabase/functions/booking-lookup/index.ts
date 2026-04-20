// PUBLIC endpoint. Resolves /book/:username/:slug to the host + event type.
// Body: { username: string, slug: string }
import { corsHeaders, jsonResponse, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { username, slug } = await req.json();
    if (!username || !slug) return jsonResponse({ error: "username, slug required" }, 400);
    const admin = adminClient();
    const { data: host } = await admin
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .eq("username", username)
      .maybeSingle();
    if (!host) return jsonResponse({ error: "Host not found" }, 404);
    const { data: et } = await admin
      .from("event_types")
      .select("id, name, slug, duration_mins, description, org_id, intake_fields, active, buffer_before, buffer_after")
      .eq("user_id", host.id)
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (!et) return jsonResponse({ error: "Event type not found" }, 404);
    let org: { name: string; color: string } | null = null;
    if (et.org_id) {
      const { data: o } = await admin
        .from("orgs")
        .select("name, color")
        .eq("id", et.org_id)
        .maybeSingle();
      if (o) org = o;
    }
    return jsonResponse({ host, eventType: et, org });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
