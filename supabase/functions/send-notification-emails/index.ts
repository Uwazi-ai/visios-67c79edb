import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { EVENT_SURFACE, NotificationEventType } from "../_shared/notify.ts";

/**
 * send-notification-emails — runs every minute over pending immediate deliveries.
 *
 * Suppression happens here, not at raise time, because "was the user just
 * looking at this?" can only be answered at send time.
 */

const DAILY_IMMEDIATE_CAP = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pending } = await admin
    .from("notification_deliveries")
    .select("id,event_id,attempts,notification_events(*)")
    .eq("status", "pending")
    .lte("attempts", 4)
    .order("created_at", { ascending: true })
    .limit(100);

  let sent = 0;
  let suppressed = 0;
  const sentToday = new Map<string, number>();

  for (const d of pending ?? []) {
    const ev: any = (d as any).notification_events;
    if (!ev) continue;

    // Demo orgs never receive mail. A seeded row must not become a support incident.
    if (ev.org_id) {
      const { data: org } = await admin
        .from("orgs")
        .select("name,is_demo")
        .eq("id", ev.org_id)
        .maybeSingle();
      if (org?.is_demo) {
        await admin
          .from("notification_deliveries")
          .update({ status: "suppressed", error: "demo org" })
          .eq("id", d.id);
        suppressed++;
        continue;
      }
      ev.__org_name = org?.name ?? null;
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email,display_name,preferences")
      .eq("id", ev.recipient_id)
      .maybeSingle();

    if (!profile?.email) {
      await admin
        .from("notification_deliveries")
        .update({ status: "failed", error: "no recipient email", attempts: (d as any).attempts + 1 })
        .eq("id", d.id);
      continue;
    }

    // Already saw it: active in the relevant surface within 2 minutes.
    const surface = EVENT_SURFACE[ev.event_type as NotificationEventType];
    const seen = (profile.preferences as any)?.surface_activity?.[surface];
    if (seen && Date.now() - new Date(seen).getTime() < 2 * 60 * 1000) {
      await admin
        .from("notification_deliveries")
        .update({ status: "suppressed", error: "recently active in surface" })
        .eq("id", d.id);
      suppressed++;
      continue;
    }

    // Hard cap of 20 immediate emails per user per day; overflow rolls into digest.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let count = sentToday.get(ev.recipient_id) ?? -1;
    if (count < 0) {
      const { count: c } = await admin
        .from("notification_deliveries")
        .select("id, notification_events!inner(recipient_id)", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", since)
        .eq("notification_events.recipient_id", ev.recipient_id);
      count = c ?? 0;
    }
    if (count >= DAILY_IMMEDIATE_CAP) {
      await admin
        .from("notification_deliveries")
        .update({ status: "suppressed", error: "daily cap — rolled into digest" })
        .eq("id", d.id);
      suppressed++;
      continue;
    }

    const orgPrefix = ev.__org_name ? `[${ev.__org_name}] ` : "";
    try {
      const { error } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "notification",
          recipientEmail: profile.email,
          idempotencyKey: `notification-${ev.id}`,
          subjectOverride: `${orgPrefix}${ev.title}`,
          templateData: {
            title: ev.title,
            body: ev.body ?? "",
            orgName: ev.__org_name ?? "",
            deepLink: ev.deep_link,
            name: profile.display_name ?? "",
          },
        },
      });
      if (error) throw error;
      await admin
        .from("notification_deliveries")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: (d as any).attempts + 1 })
        .eq("id", d.id);
      sentToday.set(ev.recipient_id, count + 1);
      sent++;
    } catch (e) {
      // Retryable: the event is untouched, only the delivery failed.
      await admin
        .from("notification_deliveries")
        .update({
          status: (d as any).attempts >= 4 ? "failed" : "pending",
          attempts: (d as any).attempts + 1,
          error: String((e as Error)?.message ?? e),
        })
        .eq("id", d.id);
    }
  }

  return new Response(JSON.stringify({ sent, suppressed, considered: pending?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
