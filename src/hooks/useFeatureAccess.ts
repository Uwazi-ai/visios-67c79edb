import { useOrg } from "@/contexts/OrgContext";

export type FeatureKey =
  | "team_chat"
  | "agents"
  | "social"
  | "admin_dashboard"
  | "vision_unlimited"
  | "team_dashboard";

export type Tier = "solo" | "team" | "growth" | "enterprise";

const TIER_RANK: Record<Tier, number> = {
  solo: 0,
  team: 1,
  growth: 2,
  enterprise: 3,
};

const GATE: Record<FeatureKey, Tier> = {
  team_chat: "team",
  agents: "team",
  vision_unlimited: "team",
  team_dashboard: "team",
  social: "growth",
  admin_dashboard: "growth",
};

export function useFeatureAccess(feature: FeatureKey): {
  allowed: boolean;
  requiredTier: Tier;
  currentTier: Tier;
} {
  const { orgs, activeOrgId } = useOrg();
  const active = orgs.find((o) => o.id === activeOrgId) as
    | (typeof orgs[number] & { subscription_tier?: Tier })
    | undefined;
  const currentTier: Tier = (active?.subscription_tier as Tier) ?? "solo";
  const requiredTier = GATE[feature];
  const allowed = TIER_RANK[currentTier] >= TIER_RANK[requiredTier];
  return { allowed, requiredTier, currentTier };
}
