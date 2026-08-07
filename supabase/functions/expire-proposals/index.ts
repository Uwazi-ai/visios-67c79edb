import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { notify } from "../_shared/notify.ts";

/**
 * expire-proposals — hourly, idempotent.
 *
 * Expiry is a STATUS CHANGE ONLY. An expired proposal has done nothing: no
 * email, no event, no task. This is the one place where doing nothing is
 * unambiguously correct.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const now = Date.now();

  const { data: policies } = await admin
    .from("proposal_expiry_policies")
    .select("org_id,kind,ttl_hours");

  const ttlFor = (orgId: string, kind: string): number | null => {
    const org = (policies ?? []).find((p) => p.org_id === orgId && p.kind === kind);
    if (org) return org.ttl_hours;
    const global = (policies ?? []).find((p) => p.org_id === null && p.kind === kind);
    return global?.ttl_hours ?? null;
  };

  const { data: pending } = await admin
    .from("proposals")
    .select("id,org_id,kind,title,payload,created_at,expiring_notified_at")
    .eq("status", "pending")
    .limit(2000);

  const expiredIds: string[] = [];
  let notified = 0;

  for (const p of pending ?? []) {
    let expiresAt: number | null = null;

    if (p.kind === "calendar_hold") {
      // Not a duration: a hold for a past slot is wrong, not stale.
      const start = (p.payload as any)?.proposed_start ?? (p.payload as any)?.start;
      expiresAt = start ? new Date(start).getTime() : null;
    } else {
      const ttl = ttlFor(p.org_id, p.kind);
      if (ttl) expiresAt = new Date(p.created_at).getTime() + ttl * 3600 * 1000;
    }
    if (expiresAt == null) continue;

    if (expiresAt <= now) {
      expiredIds.push(p.id);
      continue;
    }

    // One warning, 24 hours out. Tracked so re-runs never re-notify.
    if (expiresAt - now <= 24 * 3600 * 1000 && !p.expiring_notified_at) {
      const { data: members } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", p.org_id);
      for (const m of members ?? []) {
        await notify(admin, {
          recipient_id: m.user_id,
          org_id: p.org_id,
          event_type: "proposal_expiring",
          title: `Proposal expiring: ${p.title}`,
          body: "This proposal leaves the queue in 24 hours unless you commit it.",
          entity_type: "proposal",
          entity_id: p.id,
          deep_link: "/os",
        });
      }
      await admin
        .from("proposals")
        .update({ expiring_notified_at: new Date().toISOString() })
        .eq("id", p.id);
      notified++;
    }
  }

  if (expiredIds.length) {
    await admin
      .from("proposals")
      .update({ status: "expired", expired_at: new Date().toISOString() })
      .in("id", expiredIds)
      .eq("status", "pending");
  }

  // Retained 30 days, restorable, then removed.
  const cutoff = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  const { count: purged } = await admin
    .from("proposals")
    .delete({ count: "exact" })
    .eq("status", "expired")
    .lt("expired_at", cutoff);

  return new Response(
    JSON.stringify({ expired: expiredIds.length, notified, purged: purged ?? 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
