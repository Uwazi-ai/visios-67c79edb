// Entitlement service. Mutating endpoints call this (or import
// ../_shared/entitlements.ts directly) before performing a CREATE.
//
// POST body:
//   { action: "get" }
//   { action: "check", resource: "contacts"|"documents"|"orgs"|"seats"|"personas" }
//   { action: "consume", metric: "vision_messages"|"card_scans" }
//   { action: "feature", feature: "team_chat" }
//
// Reads and exports are never gated here — only CREATE intent is.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  getEntitlements,
  checkCreateCap,
  checkFeature,
  checkAndConsume,
  countForOwner,
  lockResponse,
  type CountCap,
} from "../_shared/entitlements.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const RESOURCES: Record<string, { cap: CountCap; table: string | null }> = {
  contacts: { cap: "contacts_cap", table: "contacts" },
  documents: { cap: "documents_cap", table: "kb_documents" },
  personas: { cap: "personas", table: "personas" },
  orgs: { cap: "org_cap", table: null },
  seats: { cap: "seat_cap", table: null },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: auth } = await sb.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const ent = await getEntitlements({ id: user.id, email: user.email });

    if (!body.action || body.action === "get") {
      return json({
        plan_id: ent.planId,
        plan_name: ent.planName,
        status: ent.status,
        period_end: ent.periodEnd,
        limits: ent.limits,
        bypass: ent.bypass,
      });
    }

    if (body.action === "feature") {
      if (typeof body.feature !== "string") return json({ error: "feature required" }, 400);
      const lock = await checkFeature(ent, body.feature);
      return lock ? lockResponse(lock) : json({ allowed: true });
    }

    if (body.action === "consume") {
      const metric = body.metric;
      if (metric !== "vision_messages" && metric !== "card_scans") {
        return json({ error: "unknown metric" }, 400);
      }
      const lock = await checkAndConsume(
        ent,
        metric,
        metric === "vision_messages" ? "vision_messages_mo" : "card_scans_mo",
      );
      return lock ? lockResponse(lock) : json({ allowed: true });
    }

    if (body.action === "check") {
      const spec = RESOURCES[body.resource];
      if (!spec) return json({ error: "unknown resource" }, 400);

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      let used = 0;
      if (spec.table) {
        used = await countForOwner(ent.ownerId, spec.table);
      } else if (body.resource === "orgs") {
        const { count } = await admin
          .from("orgs")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ent.ownerId);
        used = count ?? 0;
      } else {
        const { data: orgs } = await admin
          .from("orgs")
          .select("id")
          .eq("owner_id", ent.ownerId);
        const ids = (orgs ?? []).map((o: any) => o.id);
        if (ids.length) {
          const { data: members } = await admin
            .from("org_members")
            .select("user_id")
            .in("org_id", ids);
          used = new Set((members ?? []).map((m: any) => m.user_id)).size;
        }
      }

      const lock = await checkCreateCap(ent, spec.cap, body.resource, used);
      return lock ? lockResponse(lock) : json({ allowed: true, used });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
