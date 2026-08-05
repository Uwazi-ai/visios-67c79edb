// Step-by-step setup instructions per platform, shown in a right-side drawer.
import { X, ExternalLink } from "lucide-react";
import type { SocialPlatform } from "./shared";
import { PLATFORM_META } from "@/lib/socialPlatforms";

interface GuideStep { title: string; body: string; }

const GUIDES: Record<SocialPlatform, { steps: GuideStep[]; estimated: string; link: string }> = {
  instagram: {
    estimated: "2–4 weeks for app review",
    link: "https://developers.facebook.com",
    steps: [
      { title: "Create a Meta App", body: "Go to developers.facebook.com → Create App → Business type." },
      { title: "Add Instagram Graph API", body: "From your app dashboard, add the Instagram Graph API product." },
      { title: "Add yourself as a tester", body: "Add your Instagram Business account as a tester for the app." },
      { title: "Configure redirect URI", body: "Set the OAuth redirect URI to {ORIGIN}/oauth-callback/instagram." },
      { title: "Submit for App Review", body: "Request the scopes: instagram_business_content_publish, instagram_business_manage_comments, instagram_business_manage_insights." },
      { title: "Connect as developer", body: "While in review, you can still connect your own account as the app developer." },
      { title: "Paste credentials in Kova", body: "Once approved, copy App ID and App Secret into Social Settings → API Credentials." },
    ],
  },
  facebook: {
    estimated: "Shares Meta app with Instagram",
    link: "https://developers.facebook.com",
    steps: [
      { title: "Use the same Meta App", body: "Facebook and Instagram share one Meta Developer App." },
      { title: "Add Facebook Login product", body: "From your app dashboard, add Facebook Login." },
      { title: "Configure redirect URI", body: "Add {ORIGIN}/oauth-callback/facebook to Valid OAuth Redirect URIs." },
      { title: "Request Page permissions", body: "Submit for review: pages_show_list, pages_manage_posts, pages_read_engagement, pages_manage_engagement." },
      { title: "Connect your Page", body: "Click Connect Facebook and pick which Page to manage." },
    ],
  },
  tiktok: {
    estimated: "2–6 weeks",
    link: "https://developers.tiktok.com",
    steps: [
      { title: "Create a TikTok App", body: "Go to developers.tiktok.com → Create App." },
      { title: "Add products", body: "Add Login Kit + Content Posting API." },
      { title: "Configure redirect URI", body: "Set redirect URI to {ORIGIN}/oauth-callback/tiktok." },
      { title: "Submit for review", body: "Content Posting API requires approval." },
      { title: "Sandbox connection", body: "While in review, you can connect as a sandbox user." },
      { title: "Paste credentials", body: "Once approved, paste Client Key and Client Secret in Social Settings." },
    ],
  },
  linkedin: {
    estimated: "1–2 days",
    link: "https://www.linkedin.com/developers",
    steps: [
      { title: "Create a LinkedIn App", body: "Go to linkedin.com/developers → Create App." },
      { title: "Add products", body: "Add Share on LinkedIn and Marketing Developer Platform." },
      { title: "Configure redirect URI", body: "Add {ORIGIN}/oauth-callback/linkedin to Authorized redirect URLs." },
      { title: "Paste credentials", body: "Copy Client ID and Client Secret into Social Settings → API Credentials." },
      { title: "Connect", body: "Click Connect LinkedIn — no review needed." },
    ],
  },
  youtube: {
    estimated: "30 minutes",
    link: "https://console.cloud.google.com",
    steps: [
      { title: "Use your existing Google project", body: "Open the Google Cloud Console project that powers Kova sign-in." },
      { title: "Enable YouTube Data API v3", body: "Under APIs & Services → Library, enable YouTube Data API v3." },
      { title: "Add YouTube scopes", body: "Add youtube.upload and youtube.readonly to your existing OAuth consent screen." },
      { title: "Connect YouTube", body: "Click Connect YouTube in Kova — uses your existing Google credentials." },
    ],
  },
};

export function SetupGuideDrawer({ platform, onClose }: { platform: SocialPlatform; onClose: () => void }) {
  const meta = PLATFORM_META[platform];
  const guide = GUIDES[platform];
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app";
  const redirectUri = `${origin}/oauth-callback/${platform}`;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 overflow-y-auto"
        style={{
          width: 400,
          background: "var(--bg-base, #02020a)",
          borderLeft: "1px solid var(--border-glass)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div className="flex items-center gap-2">
            <meta.Icon size={18} style={{ color: meta.color }} />
            <div className="t-section" style={{ fontSize: 14 }}>{meta.label} setup</div>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="glass p-3 rounded-lg">
            <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              Estimated time
            </div>
            <div style={{ fontSize: 12 }}>{guide.estimated}</div>
          </div>

          <div className="glass p-3 rounded-lg">
            <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
              Redirect URI
            </div>
            <div className="t-mono" style={{ fontSize: 11, color: "var(--text-primary)", wordBreak: "break-all" }}>
              {redirectUri}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(redirectUri)}
              className="btn-ghost mt-2"
              style={{ fontSize: 10 }}
            >
              Copy
            </button>
          </div>

          <ol className="space-y-3">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div
                  className="flex-shrink-0 rounded-full flex items-center justify-center t-mono"
                  style={{
                    width: 22, height: 22, background: `${meta.color}22`,
                    color: meta.color, fontSize: 11, fontWeight: 600,
                  }}
                >{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {s.body.replace("{ORIGIN}", origin)}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <a
            href={guide.link}
            target="_blank" rel="noopener noreferrer"
            className="btn-ghost w-full flex items-center justify-center gap-2"
            style={{ fontSize: 12 }}
          >
            Open developer console <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
