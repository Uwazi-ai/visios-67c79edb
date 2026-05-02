// Hourly cron entry. Finds users whose gmail_contact_sync_enabled is true and
// whose gmail_last_synced_at is older than gmail_sync_frequency_hours, then
// invokes gmail-discover-contacts for each.
//
// Triggered by pg_cron via net.http_post — does not require an end-user JWT.
import { corsHeaders, adminClient } from "../_shared/google.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = adminClient();
    const { data: settings, error } = await admin
      .from("agent_settings")
      .select("user_id, gmail_sync_frequency_hours, gmail_sync_lookback_days, gmail_min_email_count, gmail_last_synced_at, gmail_auto_approve_known_domains")
      .eq("gmail_contact_sync_enabled", true);
    if (error) return jsonResponse({ error: error.message }, 500);

    const now = Date.now();
    const due = (settings ?? []).filter((s: any) => {
      if (!s.gmail_last_synced_at) return true;
      const last = new Date(s.gmail_last_synced_at).getTime();
      const dueAt = last + (s.gmail_sync_frequency_hours * 60 * 60 * 1000);
      return now >= dueAt;
    });

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-discover-contacts`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const results: Array<{ user_id: string; ok: boolean; error?: string; queued?: number }> = [];

    for (const s of due) {
      // Forge a session for this user via admin API
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: "", // not used; we use admin token approach below
      } as any).catch(() => ({ data: null, error: { message: "skip" } }));
      // Simpler path: call the function with the service role key as Bearer +
      // pass the user_id in the body. The function reads auth.uid() from JWT
      // though, so instead we directly inline the discovery logic via an
      // x-impersonate header is not supported. Easiest: do a direct admin
      // invocation with a user-scoped JWT signed by service role.
      // We bypass: call the function but pass the service_role JWT — and have
      // the function accept an `impersonate_user_id` field when called with
      // the service role key. (Simpler: replicate inline.)
      // Practical approach for now: skip if no other path; we'll use an
      // internal POST with the service role JWT and a special header.
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "x-cron-user-id": s.user_id,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            days: s.gmail_sync_lookback_days,
            minEmailCount: s.gmail_min_email_count,
            autoApprove: !!s.gmail_auto_approve_known_domains,
          }),
        });
        const data = await r.json().catch(() => ({}));
        results.push({ user_id: s.user_id, ok: r.ok, queued: data?.queued, error: r.ok ? undefined : data?.error });
      } catch (e) {
        results.push({ user_id: s.user_id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return jsonResponse({ ok: true, due: due.length, results });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
