// Entitlement enforcement shared by every mutating edge endpoint.
//
// Rules (Sprint 06 / K1+K2):
//  - Subscription + plan limits are read LIVE from the database on every call.
//    Never trust a client-supplied tier, never cache as enforcement.
//  - Only CREATE actions are blocked at caps. Reads and exports always succeed
//    on every tier, including lapsed (read_only / export_only) accounts.
//  - Violations return a TYPED error: { code:'lock_hit', lock_type, feature, tier_needed }
//    with HTTP 402 — never silent, never a generic 500.
//  - Every lock encounter writes one lock_events row.
//  - @uwazi.ai emails bypass all paywall checks entirely.
//
// Lock types:
//   A = usage / resource cap reached on the current plan
//   B = feature not included in the current plan
//   C = subscription lapsed (read_only / export_only) and a write was attempted
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type LockType = "A" | "B" | "C";

export interface LockHit {
  code: "lock_hit";
  lock_type: LockType;
  feature: string;
  tier_needed: string;
  /** Present for type A: the cap that was reached and the current count. */
  limit?: number;
  used?: number;
  message: string;
}

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "grace"
  | "read_only"
  | "export_only";

export interface PlanLimits {
  org_cap?: number;
  seat_cap?: number;
  vision_messages_mo?: number;
  contacts_cap?: number;
  documents_cap?: number;
  personas?: number;
  features?: Record<string, boolean>;
  [k: string]: unknown;
}

export interface Entitlements {
  ownerId: string;
  userId: string;
  bypass: boolean;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  periodEnd: string | null;
  limits: PlanLimits;
}

/** Plan ordering, cheapest first. Used to resolve `tier_needed`. */
const TIER_ORDER = ["free", "starter", "growth", "enterprise"] as const;

/** Statuses where writes are refused (reads/exports still allowed). */
const WRITE_BLOCKED: SubscriptionStatus[] = ["read_only", "export_only"];

/** Caps that count existing rows, mapped to their plan limit key. */
export type CountCap = "org_cap" | "seat_cap" | "contacts_cap" | "documents_cap" | "personas";
/** Caps that count monthly usage via usage_counters. */
export type UsageMetric = "vision_messages" | "card_scans";

const UNLIMITED = -1;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function isExemptEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith("@uwazi.ai");
}

/** Typed 402 response for a lock. Always use this — never a bare 500. */
export function lockResponse(lock: LockHit): Response {
  return new Response(JSON.stringify(lock), {
    status: 402,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logLockEvent(
  feature: string,
  tier: string,
  lockType: LockType,
  userId: string,
) {
  try {
    await admin().from("lock_events").insert({
      feature,
      tier,
      lock_type: lockType,
      user_id: userId,
    });
  } catch {
    // Telemetry must never break the request path.
  }
}

async function buildLock(
  ent: Entitlements,
  feature: string,
  lockType: LockType,
  extra: Partial<LockHit> = {},
): Promise<LockHit> {
  const tierNeeded = extra.tier_needed ?? nextTier(ent.planId);
  await logLockEvent(feature, ent.planId, lockType, ent.userId);
  return {
    code: "lock_hit",
    lock_type: lockType,
    feature,
    tier_needed: tierNeeded,
    message:
      lockType === "C"
        ? "This workspace is read-only. Reading and exporting still work."
        : lockType === "B"
        ? `${feature} is not included on the ${ent.planName} plan.`
        : `You've reached the ${ent.planName} plan limit for ${feature}.`,
    ...extra,
  };
}

function nextTier(planId: string): string {
  const i = TIER_ORDER.indexOf(planId as typeof TIER_ORDER[number]);
  if (i < 0) return "starter";
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)];
}

/** Smallest tier whose `key` limit exceeds `needed` (or is unlimited). */
async function tierThatLifts(key: string, needed: number): Promise<string> {
  const { data } = await admin().from("plans").select("id,limits");
  for (const id of TIER_ORDER) {
    const row = (data ?? []).find((p: any) => p.id === id);
    const v = (row?.limits ?? {})[key];
    if (v === UNLIMITED || (typeof v === "number" && v > needed)) return id;
  }
  return "enterprise";
}

/**
 * Resolve the owning account for a user. Ownership is the billing anchor:
 * a member inherits the entitlements of the org owner. Roles live on
 * memberships (org_members / orgs.owner_id), never on profiles.
 */
export async function resolveOwnerId(userId: string): Promise<string> {
  const sb = admin();
  const { data: owned } = await sb
    .from("orgs")
    .select("owner_id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (owned?.owner_id) return owned.owner_id;

  const { data: memberships } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId);
  const orgIds = (memberships ?? []).map((m: any) => m.org_id);
  if (orgIds.length) {
    const { data: orgs } = await sb
      .from("orgs")
      .select("owner_id,created_at")
      .in("id", orgIds)
      .order("created_at", { ascending: true })
      .limit(1);
    if (orgs?.[0]?.owner_id) return orgs[0].owner_id;
  }
  return userId;
}

/** Live read of the caller's plan + subscription status. No caching. */
export async function getEntitlements(user: {
  id: string;
  email?: string | null;
}): Promise<Entitlements> {
  const sb = admin();
  const ownerId = await resolveOwnerId(user.id);

  const { data: sub } = await sb
    .from("subscriptions")
    .select("plan_id,status,period_end")
    .eq("org_owner_id", ownerId)
    .maybeSingle();

  const planId = sub?.plan_id ?? "free";
  const { data: plan } = await sb
    .from("plans")
    .select("id,name,limits")
    .eq("id", planId)
    .maybeSingle();

  return {
    ownerId,
    userId: user.id,
    bypass: isExemptEmail(user.email),
    planId: plan?.id ?? "free",
    planName: plan?.name ?? "Free",
    status: (sub?.status as SubscriptionStatus) ?? "active",
    periodEnd: sub?.period_end ?? null,
    limits: (plan?.limits ?? {}) as PlanLimits,
  };
}

/**
 * Gate a CREATE action against a row-count cap.
 * `currentCount` is the number of existing rows; creating one more must fit.
 * Returns null when allowed, or a typed LockHit when blocked.
 */
export async function checkCreateCap(
  ent: Entitlements,
  cap: CountCap,
  feature: string,
  currentCount: number,
): Promise<LockHit | null> {
  if (ent.bypass) return null;
  if (WRITE_BLOCKED.includes(ent.status)) {
    return buildLock(ent, feature, "C", { tier_needed: ent.planId });
  }
  const limit = ent.limits[cap];
  if (typeof limit !== "number" || limit === UNLIMITED) return null;
  if (currentCount < limit) return null;
  return buildLock(ent, feature, "A", {
    limit,
    used: currentCount,
    tier_needed: await tierThatLifts(cap, limit),
  });
}

/** Gate a boolean feature flag on the plan. */
export async function checkFeature(
  ent: Entitlements,
  feature: string,
): Promise<LockHit | null> {
  if (ent.bypass) return null;
  if (WRITE_BLOCKED.includes(ent.status)) {
    return buildLock(ent, feature, "C", { tier_needed: ent.planId });
  }
  if (ent.limits.features?.[feature] === true) return null;

  const { data } = await admin().from("plans").select("id,limits");
  let needed = "growth";
  for (const id of TIER_ORDER) {
    const row = (data ?? []).find((p: any) => p.id === id);
    if ((row?.limits?.features ?? {})[feature] === true) {
      needed = id;
      break;
    }
  }
  return buildLock(ent, feature, "B", { tier_needed: needed });
}

/**
 * Gate a metered monthly action (vision messages, card scans) and, when
 * allowed, increment the counter for the current period.
 */
export async function checkAndConsume(
  ent: Entitlements,
  metric: UsageMetric,
  limitKey: "vision_messages_mo" | "card_scans_mo",
): Promise<LockHit | null> {
  if (ent.bypass) return null;
  if (WRITE_BLOCKED.includes(ent.status)) {
    return buildLock(ent, metric, "C", { tier_needed: ent.planId });
  }
  const sb = admin();
  const period = currentPeriod();
  const limit = ent.limits[limitKey];

  const { data: row } = await sb
    .from("usage_counters")
    .select("id,count")
    .eq("owner_id", ent.ownerId)
    .eq("metric", metric)
    .eq("period", period)
    .maybeSingle();
  const used = row?.count ?? 0;

  if (typeof limit === "number" && limit !== UNLIMITED && used >= limit) {
    return buildLock(ent, metric, "A", {
      limit,
      used,
      tier_needed: await tierThatLifts(limitKey, limit),
    });
  }

  if (row?.id) {
    await sb.from("usage_counters").update({ count: used + 1 }).eq("id", row.id);
  } else {
    await sb
      .from("usage_counters")
      .insert({ owner_id: ent.ownerId, metric, period, count: 1 });
  }
  return null;
}

/** Count existing rows for a cap check, scoped to the owner's orgs. */
export async function countForOwner(
  ownerId: string,
  table: string,
): Promise<number> {
  const sb = admin();
  const { data: orgs } = await sb.from("orgs").select("id").eq("owner_id", ownerId);
  const ids = (orgs ?? []).map((o: any) => o.id);
  if (!ids.length) return 0;
  const { count } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("org_id", ids);
  return count ?? 0;
}
