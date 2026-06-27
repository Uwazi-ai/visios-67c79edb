import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import {
  TIER_CONFIG,
  TIER_RANK,
  FEATURE_REQUIRED_TIER,
  type Tier,
  type TierFeatures,
  type TierLimits,
} from "@/config/tiers";

export type FeatureKey =
  | keyof TierFeatures
  | "vision_messages"
  | "knowledge_base_docs"
  | "contacts"
  | "active_agents"
  | "seats"
  | "workspaces"
  | "social_posts"
  | "agents_unlimited";

type LimitKey = keyof TierLimits | null;

// Map FeatureKey → which limit (if any) it consumes.
function limitKeyFor(feature: FeatureKey): LimitKey {
  switch (feature) {
    case "vision_messages":
      return "vision_messages_per_month";
    case "knowledge_base_docs":
      return "knowledge_base_docs";
    case "contacts":
      return "contacts";
    case "active_agents":
    case "agents_unlimited":
      return "active_agents";
    case "seats":
      return "seats";
    case "workspaces":
      return "workspaces";
    case "social_posts":
      return "social_posts_per_month";
    default:
      return null;
  }
}

function requiredTierFor(feature: FeatureKey, currentTier: Tier): Tier {
  // Pure feature flags.
  if ((FEATURE_REQUIRED_TIER as Record<string, Tier>)[feature]) {
    return (FEATURE_REQUIRED_TIER as Record<string, Tier>)[feature];
  }
  // Limit-based features: required tier is next tier above current that lifts the limit.
  const lk = limitKeyFor(feature);
  if (!lk) return "team";
  const order: Tier[] = ["solo", "team", "growth", "enterprise"];
  const currentIdx = order.indexOf(currentTier);
  for (let i = currentIdx + 1; i < order.length; i++) {
    const t = order[i];
    const v = TIER_CONFIG[t].limits[lk];
    if (v === -1 || v > TIER_CONFIG[currentTier].limits[lk]) return t;
  }
  return "growth";
}

export type OrgUsage = {
  vision_messages_used: number;
  knowledge_docs_count: number;
  contacts_count: number;
  active_agents_count: number;
  social_posts_this_month: number;
  seats_used: number;
};

const EMPTY_USAGE: OrgUsage = {
  vision_messages_used: 0,
  knowledge_docs_count: 0,
  contacts_count: 0,
  active_agents_count: 0,
  social_posts_this_month: 0,
  seats_used: 1,
};

// Cache + realtime fetch keyed per org.
const usageCache: Record<string, OrgUsage> = {};
const usageSubs: Record<string, Set<(u: OrgUsage) => void>> = {};
const usageInited: Record<string, boolean> = {};

async function loadUsage(orgId: string) {
  const { data } = await supabase
    .from("org_usage" as any)
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  const u: OrgUsage = {
    vision_messages_used: (data as any)?.vision_messages_used ?? 0,
    knowledge_docs_count: (data as any)?.knowledge_docs_count ?? 0,
    contacts_count: (data as any)?.contacts_count ?? 0,
    active_agents_count: (data as any)?.active_agents_count ?? 0,
    social_posts_this_month: (data as any)?.social_posts_this_month ?? 0,
    seats_used: (data as any)?.seats_used ?? 1,
  };
  usageCache[orgId] = u;
  (usageSubs[orgId] ?? new Set()).forEach((cb) => cb(u));
}

export function useOrgUsage(): OrgUsage {
  const { activeOrgId } = useOrg();
  const orgId = typeof activeOrgId === "string" && activeOrgId !== "all" ? activeOrgId : null;
  const [usage, setUsage] = useState<OrgUsage>(orgId ? usageCache[orgId] ?? EMPTY_USAGE : EMPTY_USAGE);

  useEffect(() => {
    if (!orgId) {
      setUsage(EMPTY_USAGE);
      return;
    }
    if (!usageSubs[orgId]) usageSubs[orgId] = new Set();
    const cb = (u: OrgUsage) => setUsage(u);
    usageSubs[orgId].add(cb);
    if (usageCache[orgId]) setUsage(usageCache[orgId]);
    if (!usageInited[orgId]) {
      usageInited[orgId] = true;
      loadUsage(orgId);
      supabase
        .channel(`org-usage-${orgId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "org_usage", filter: `org_id=eq.${orgId}` },
          () => loadUsage(orgId),
        )
        .subscribe();
    }
    return () => {
      usageSubs[orgId].delete(cb);
    };
  }, [orgId]);

  return usage;
}

export function useOrgTier() {
  const { orgs, activeOrgId } = useOrg();
  const active = orgs.find((o) => o.id === activeOrgId) as
    | (typeof orgs[number] & {
        subscription_tier?: Tier;
        subscription_status?: string;
        trial_ends_at?: string | null;
      })
    | undefined;

  const tier: Tier = (active?.subscription_tier as Tier) ?? "solo";
  const subscriptionStatus = active?.subscription_status ?? "trialing";
  const trialEndsAt = active?.trial_ends_at ?? null;
  const isTrialing = subscriptionStatus === "trialing";
  let trialDaysLeft: number | null = null;
  if (isTrialing && trialEndsAt) {
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }
  return {
    tier,
    tierConfig: TIER_CONFIG[tier],
    isTrialing,
    trialDaysLeft,
    trialEnded: isTrialing && trialDaysLeft === 0,
    subscriptionStatus,
  };
}

export type FeatureAccess = {
  hasAccess: boolean;
  isAtLimit: boolean;
  limitValue: number; // -1 = unlimited
  usedValue: number;
  upgradeRequired: boolean;
  requiredTier: Tier;
  currentTier: Tier;
};

export function useFeatureAccess(feature: FeatureKey): FeatureAccess {
  const { tier } = useOrgTier();
  const usage = useOrgUsage();
  const cfg = TIER_CONFIG[tier];
  const reqTier = requiredTierFor(feature, tier);

  // Pure boolean feature.
  if ((FEATURE_REQUIRED_TIER as Record<string, Tier>)[feature]) {
    const has = (cfg.features as any)[feature] === true;
    return {
      hasAccess: has,
      isAtLimit: false,
      limitValue: -1,
      usedValue: 0,
      upgradeRequired: !has,
      requiredTier: reqTier,
      currentTier: tier,
    };
  }

  // Limit-based feature.
  const lk = limitKeyFor(feature);
  if (!lk) {
    return {
      hasAccess: true,
      isAtLimit: false,
      limitValue: -1,
      usedValue: 0,
      upgradeRequired: false,
      requiredTier: reqTier,
      currentTier: tier,
    };
  }
  const limit = cfg.limits[lk];
  let used = 0;
  switch (lk) {
    case "vision_messages_per_month": used = usage.vision_messages_used; break;
    case "knowledge_base_docs": used = usage.knowledge_docs_count; break;
    case "contacts": used = usage.contacts_count; break;
    case "active_agents": used = usage.active_agents_count; break;
    case "social_posts_per_month": used = usage.social_posts_this_month; break;
    case "seats": used = usage.seats_used; break;
    case "workspaces": used = 1; break;
  }
  const unlimited = limit === -1;
  const isAtLimit = !unlimited && used >= limit;
  const hasAccess = unlimited || used < limit;
  return {
    hasAccess,
    isAtLimit,
    limitValue: limit,
    usedValue: used,
    upgradeRequired: isAtLimit && TIER_RANK[reqTier] > TIER_RANK[tier],
    requiredTier: reqTier,
    currentTier: tier,
  };
}

// Helper used by callers like Vision after a successful generation.
export async function trackVisionMessage(orgId: string | null) {
  if (!orgId) return;
  try {
    await supabase.rpc("increment_vision_usage" as any, { _org_id: orgId });
  } catch {
    // non-fatal
  }
}
