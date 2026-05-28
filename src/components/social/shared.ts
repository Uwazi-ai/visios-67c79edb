// Shared types, constants, and helpers for the Social module

export type BrandKey = "uwazi" | "bin" | "myke";

export type SocialPlatform = "tiktok" | "instagram" | "linkedin" | "facebook" | "youtube";

export interface BrandConfig {
  key: BrandKey;
  label: string;
  color: string;
  tintRgba: string;
  pillars: string[];
}

export const BRANDS: Record<BrandKey, BrandConfig> = {
  uwazi: {
    key: "uwazi",
    label: "UWAZI.AI",
    color: "#9bd34b",
    tintRgba: "rgba(155,211,75,0.04)",
    pillars: ["Voter Education", "Civic Myths Busted", "Platform Demo", "Community Voice", "Election Countdown"],
  },
  bin: {
    key: "bin",
    label: "BIN",
    color: "#534AB7",
    tintRgba: "rgba(83,74,183,0.04)",
    pillars: ["Member Spotlights", "Resources & Opportunities", "Community Events", "Industry Insights", "Culture & Celebration"],
  },
  myke: {
    key: "myke",
    label: "Myke",
    color: "#185FA5",
    tintRgba: "rgba(24,95,165,0.04)",
    pillars: ["Build in Public", "Civic Tech POV", "KC Founder Life", "Lessons Learned", "Collaborations & Shoutouts"],
  },
};

export const BRAND_ORDER: BrandKey[] = ["uwazi", "bin", "myke"];

export const TEAM = [
  { initials: "AN", name: "Anna", role: "Head of Brand", color: "#185FA5" },
  { initials: "AL", name: "Alexis", role: "Head of Content Strategy & Comms", color: "#534AB7" },
  { initials: "MY", name: "Myke", role: "Founder", color: "#3B6D11" },
];

export const ASSIGNEES = ["Anna", "Alexis", "Myke"] as const;
export type Assignee = (typeof ASSIGNEES)[number];

export const PLATFORMS: { key: SocialPlatform; label: string; limit: number }[] = [
  { key: "tiktok", label: "TikTok", limit: 2200 },
  { key: "instagram", label: "Instagram", limit: 2200 },
  { key: "linkedin", label: "LinkedIn", limit: 3000 },
  { key: "facebook", label: "Facebook", limit: 63206 },
  { key: "youtube", label: "YouTube", limit: 5000 },
];

export const PLATFORM_LIMIT = (p: SocialPlatform) =>
  PLATFORMS.find((x) => x.key === p)?.limit ?? 2200;

export type PostStatus = "draft" | "scheduled" | "published" | "failed" | "pending_approval";

export const STATUS_COLORS: Record<PostStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: "rgba(245,158,11,0.15)", fg: "#F59E0B", label: "Draft" },
  scheduled: { bg: "rgba(59,130,246,0.15)", fg: "#3B82F6", label: "Scheduled" },
  published: { bg: "rgba(34,197,94,0.15)", fg: "#22C55E", label: "Published" },
  failed: { bg: "rgba(239,68,68,0.15)", fg: "#EF4444", label: "Failed" },
  pending_approval: { bg: "rgba(168,85,247,0.15)", fg: "#A855F7", label: "Pending" },
};

export const ACTIVE_BRAND_KEY = "social.activeBrand";

export function loadActiveBrand(): BrandKey {
  if (typeof window === "undefined") return "uwazi";
  const v = localStorage.getItem(ACTIVE_BRAND_KEY) as BrandKey | null;
  return v && BRANDS[v] ? v : "uwazi";
}

export function saveActiveBrand(b: BrandKey) {
  try { localStorage.setItem(ACTIVE_BRAND_KEY, b); } catch {}
}

export const PLATFORM_CADENCE: { platform: string; frequency: string; best_time: string; format: string }[] = [
  { platform: "TikTok", frequency: "1–2/day", best_time: "7–10am, 7–11pm local", format: "Vertical video (15–60s)" },
  { platform: "Instagram", frequency: "1/day + 3 stories", best_time: "11am, 7pm local", format: "Reels > Carousel > Single" },
  { platform: "LinkedIn", frequency: "3–4/week", best_time: "Tue–Thu 8–10am", format: "Text + image / native video" },
  { platform: "Facebook", frequency: "3–5/week", best_time: "1–3pm local", format: "Image / link / short video" },
  { platform: "YouTube", frequency: "1/week long + 3 shorts", best_time: "Sat 9–11am local", format: "Long-form 8–12min + Shorts" },
];
