import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { DEFAULT_EMAIL_MODE, NotificationEventType } from "../_shared/notify.ts";

/**
 * send-digest-emails — one email per user per cadence, grouped by organization.
 * Never sends an empty digest.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await admin
    .from("notification_events")
    .select("id,org_id,recipient_id,event_type,title,body,deep_link,created_at")
    .gte("created_at", since)
    .is("dismissed_at", null)
    .order("created_at", { ascending: true })
    .limit(2000);

  // Which events already had an email delivery — those are not digest material.
  const ids = (events ?? []).map((e) => e.id);
  const delivered = new Set<string>();
  if (ids.length) {
    const { data: rows } = await admin
      .from("notification_deliveries")
      .select("event_id,status")
      .in("event_id", ids);
    for (const r of rows ?? []) {
      if (r.status === "sent") delivered.add(r.event_id);
    }
  }

  // Group by recipient, then org.
  const byUser = new Map<string, any[]>();
  const overflowUsers = new Set<string>();

  for (const ev of events ?? []) {
    if (delivered.has(ev.id)) continue;
    if (ev.org_id) {
      const { data: org } = await admin.from("orgs").select("is_demo").eq("id", ev.org_id).maybeSingle();
      if (org?.is_demo) continue;
    }

    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("org_id,email")
      .eq("user_id", ev.recipient_id)
      .eq("event_type", ev.event_type);
    const pref =
      (prefs ?? []).find((p: any) => p.org_id === ev.org_id) ??
      (prefs ?? []).find((p: any) => p.org_id === null);
    const mode = pref?.email ?? DEFAULT_EMAIL_MODE[ev.event_type as NotificationEventType];

    // Immediate events that were capped roll into this digest.
    let capped = false;
    if (mode === "immediate") {
      const { data: dl } = await admin
        .from("notification_deliveries")
        .select("status,error")
        .eq("event_id", ev.id)
        .maybeSingle();
      capped = dl?.status === "suppressed" && String(dl?.error ?? "").includes("daily cap");
      if (!capped) continue;
      overflowUsers.add(ev.recipient_id);
    } else if (mode !== "digest") {
      continue;
    }

    const list = byUser.get(ev.recipient_id) ?? [];
    list.push(ev);
    byUser.set(ev.recipient_id, list);
  }

  let sent = 0;
  for (const [userId, list] of byUser) {
    if (!list.length) continue; // never an empty digest

    const { data: profile } = await admin
      .from("profiles")
      .select("email,display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email) continue;

    const orgNames = new Map<string, string>();
    for (const ev of list) {
      if (ev.org_id && !orgNames.has(ev.org_id)) {
        const { data: org } = await admin.from("orgs").select("name").eq("id", ev.org_id).maybeSingle();
        orgNames.set(ev.org_id, org?.name ?? "Personal");
      }
    }

    const groups = Array.from(
      list.reduce((m: Map<string, any[]>, ev: any) => {
        const key = ev.org_id ?? "personal";
        m.set(key, [...(m.get(key) ?? []), ev]);
        return m;
      }, new Map<string, any[]>()),
    ).map(([key, items]) => ({
      orgName: key === "personal" ? "Personal" : orgNames.get(key) ?? "Organization",
      items: (items as any[]).map((i) => ({ title: i.title, body: i.body ?? "" })),
    }));

    const { error } = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "notification-digest",
        recipientEmail: profile.email,
        idempotencyKey: `digest-${userId}-${new Date().toISOString().slice(0, 13)}`,
        templateData: {
          name: profile.display_name ?? "",
          groups,
          overflow: overflowUsers.has(userId),
        },
      },
    });

    if (!error) {
      for (const ev of list) {
        await admin
          .from("notification_deliveries")
          .insert({ event_id: ev.id, channel: "email", status: "sent", sent_at: new Date().toISOString() });
      }
      sent++;
    }
  }

  return new Response(JSON.stringify({ digests: sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
