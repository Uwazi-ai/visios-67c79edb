// Platform metadata for the Social module connection system.
import { Instagram, Facebook, Linkedin, Youtube, Music2 } from "lucide-react";
import type { SocialPlatform } from "@/components/social/shared";

export interface PlatformMeta {
  key: SocialPlatform;
  label: string;
  Icon: any;
  color: string;
  tintRgba: string;
  description: string;
  setupNote: string;
  scopes: string[];
  estimatedSetup: string;
  developerUrl: string;
  usesGoogle?: boolean;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  instagram: {
    key: "instagram",
    label: "Instagram",
    Icon: Instagram,
    color: "#E1306C",
    tintRgba: "rgba(225,48,108,0.10)",
    description: "Publish reels, carousels, and stories. Pull comments and insights.",
    setupNote: "Requires Meta Developer App with app-review approval.",
    scopes: [
      "instagram_business_basic",
      "instagram_business_content_publish",
      "instagram_business_manage_comments",
      "instagram_business_manage_insights",
    ],
    estimatedSetup: "2–4 weeks for app review",
    developerUrl: "https://developers.facebook.com",
  },
  facebook: {
    key: "facebook",
    label: "Facebook",
    Icon: Facebook,
    color: "#1877F2",
    tintRgba: "rgba(24,119,242,0.10)",
    description: "Post to Pages, read engagement, and manage comments.",
    setupNote: "Same Meta Developer App as Instagram.",
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_engagement",
    ],
    estimatedSetup: "Shares Meta app with Instagram",
    developerUrl: "https://developers.facebook.com",
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    Icon: Music2,
    color: "#000000",
    tintRgba: "rgba(255,255,255,0.06)",
    description: "Publish videos and pull metrics from your TikTok Business account.",
    setupNote: "Requires TikTok Developer App approval. Sandbox mode while in review.",
    scopes: ["user.info.basic", "video.publish", "video.list"],
    estimatedSetup: "2–6 weeks",
    developerUrl: "https://developers.tiktok.com",
  },
  linkedin: {
    key: "linkedin",
    label: "LinkedIn",
    Icon: Linkedin,
    color: "#0A66C2",
    tintRgba: "rgba(10,102,194,0.10)",
    description: "Post to your profile or Company Page. Pull engagement metrics.",
    setupNote: "Requires LinkedIn Developer App. Fastest to set up — no lengthy review.",
    scopes: [
      "r_liteprofile",
      "r_emailaddress",
      "w_member_social",
      "r_organization_social",
      "w_organization_social",
    ],
    estimatedSetup: "1–2 days",
    developerUrl: "https://www.linkedin.com/developers",
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    Icon: Youtube,
    color: "#FF0000",
    tintRgba: "rgba(255,0,0,0.10)",
    description: "Upload videos and Shorts. Pull channel and video analytics.",
    setupNote: "Extends your existing Google connection — no new app needed.",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    estimatedSetup: "30 minutes",
    developerUrl: "https://console.cloud.google.com",
    usesGoogle: true,
  },
};

export const PLATFORM_ORDER: SocialPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
];

export interface PlatformToken {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  account_id: string | null;
  account_name: string | null;
  account_username: string | null;
  account_avatar_url: string | null;
  account_type: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  brand: string | null;
  is_active: boolean;
  last_used_at: string | null;
  follower_count?: number | null;
}

export function tokenExpiresSoon(expires_at: string | null | undefined): boolean {
  if (!expires_at) return false;
  const ms = new Date(expires_at).getTime() - Date.now();
  return ms > 0 && ms < 7 * 24 * 60 * 60 * 1000;
}

export function tokenExpired(expires_at: string | null | undefined): boolean {
  if (!expires_at) return false;
  return new Date(expires_at).getTime() <= Date.now();
}
