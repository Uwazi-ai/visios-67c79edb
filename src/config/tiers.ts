// Single source of truth for subscription tier limits and feature gates.

export type Tier = "solo" | "team" | "growth" | "enterprise";

export type TierLimits = {
  seats: number;
  workspaces: number;
  vision_messages_per_month: number;
  knowledge_base_docs: number;
  contacts: number;
  active_agents: number;
  social_posts_per_month: number;
  campaigns: number;
};

export type TierFeatures = {
  team_chat: boolean;
  agents: boolean;
  social: boolean;
  meetings: boolean;
  team_dashboard: boolean;
  social_campaigns: boolean;
  admin_controls: boolean;
  custom_vision_persona: boolean;
  vision_unlimited: boolean;
  priority_support: boolean;
};

export type TierConfigEntry = {
  label: string;
  price_monthly: number | null;
  price_annual: number | null;
  color: string;
  limits: TierLimits;
  features: TierFeatures;
};

export const TIER_CONFIG: Record<Tier, TierConfigEntry> = {
  solo: {
    label: "Solo",
    price_monthly: 29,
    price_annual: 290,
    color: "#6b7280",
    limits: {
      seats: 1,
      workspaces: 1,
      vision_messages_per_month: 100,
      knowledge_base_docs: 50,
      contacts: 500,
      active_agents: 0,
      social_posts_per_month: 0,
      campaigns: 0,
    },
    features: {
      team_chat: false,
      agents: false,
      social: false,
      meetings: false,
      team_dashboard: false,
      social_campaigns: false,
      admin_controls: false,
      custom_vision_persona: false,
      vision_unlimited: false,
      priority_support: false,
    },
  },
  team: {
    label: "Team",
    price_monthly: 79,
    price_annual: 790,
    color: "#2563EB",
    limits: {
      seats: 3,
      workspaces: -1,
      vision_messages_per_month: -1,
      knowledge_base_docs: -1,
      contacts: -1,
      active_agents: 3,
      social_posts_per_month: 0,
      campaigns: 0,
    },
    features: {
      team_chat: true,
      agents: true,
      social: false,
      meetings: true,
      team_dashboard: true,
      social_campaigns: false,
      admin_controls: false,
      custom_vision_persona: false,
      vision_unlimited: true,
      priority_support: false,
    },
  },
  growth: {
    label: "Growth",
    price_monthly: 179,
    price_annual: 1790,
    color: "#9333ea",
    limits: {
      seats: 8,
      workspaces: -1,
      vision_messages_per_month: -1,
      knowledge_base_docs: -1,
      contacts: -1,
      active_agents: -1,
      social_posts_per_month: -1,
      campaigns: -1,
    },
    features: {
      team_chat: true,
      agents: true,
      social: true,
      meetings: true,
      team_dashboard: true,
      social_campaigns: true,
      admin_controls: true,
      custom_vision_persona: true,
      vision_unlimited: true,
      priority_support: true,
    },
  },
  enterprise: {
    label: "Enterprise",
    price_monthly: null,
    price_annual: null,
    color: "#22C55E",
    limits: {
      seats: -1,
      workspaces: -1,
      vision_messages_per_month: -1,
      knowledge_base_docs: -1,
      contacts: -1,
      active_agents: -1,
      social_posts_per_month: -1,
      campaigns: -1,
    },
    features: {
      team_chat: true,
      agents: true,
      social: true,
      meetings: true,
      team_dashboard: true,
      social_campaigns: true,
      admin_controls: true,
      custom_vision_persona: true,
      vision_unlimited: true,
      priority_support: true,
    },
  },
};

export const TIER_RANK: Record<Tier, number> = {
  solo: 0,
  team: 1,
  growth: 2,
  enterprise: 3,
};

// Minimum tier required to unlock each feature flag.
export const FEATURE_REQUIRED_TIER: Record<keyof TierFeatures, Tier> = {
  team_chat: "team",
  agents: "team",
  meetings: "team",
  team_dashboard: "team",
  vision_unlimited: "team",
  social: "growth",
  social_campaigns: "growth",
  admin_controls: "growth",
  custom_vision_persona: "growth",
  priority_support: "growth",
};

// Friendly display names for paywall copy.
export const FEATURE_LABELS: Record<string, string> = {
  team_chat: "Team Chat",
  agents: "Agents",
  agents_unlimited: "Unlimited Agents",
  social: "Social & Campaigns",
  social_campaigns: "Social Campaigns",
  meetings: "Meetings",
  team_dashboard: "Team Dashboard",
  vision_unlimited: "Unlimited Vision",
  custom_vision_persona: "Custom Vision Persona",
  admin_controls: "Admin Controls",
  priority_support: "Priority Support",
  seats: "More Team Seats",
  knowledge_base_docs: "Unlimited Knowledge",
  contacts: "Unlimited Contacts",
  workspaces: "Unlimited Workspaces",
};
