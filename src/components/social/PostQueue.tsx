import { useNavigate } from "react-router-dom";
import { Instagram, Linkedin, Facebook, Youtube, Music2 } from "lucide-react";
import { BRANDS, STATUS_COLORS, type BrandKey, type PostStatus } from "./shared";
import type { SocialPost } from "@/hooks/useSocialPosts";

const platformIcon = (p: string) => {
  switch (p) {
    case "instagram": return Instagram;
    case "linkedin": return Linkedin;
    case "facebook": return Facebook;
    case "youtube": return Youtube;
    default: return Music2; // tiktok
  }
};

export function PostQueue({
  brand,
  posts,
  onOpen,
  onGotoCalendar,
}: {
  brand: BrandKey;
  posts: SocialPost[];
  onOpen: (p: SocialPost) => void;
  onGotoCalendar: () => void;
}) {
  const queue = posts
    .filter((p) => p.status === "draft" || p.status === "scheduled" || p.status === "pending_approval")
    .slice(0, 12);

  return (
    <aside
      className="hidden lg:flex flex-col"
      style={{
        width: 180,
        minWidth: 180,
        borderLeft: "1px solid var(--border-glass)",
        background: "rgba(2,2,10,0.4)",
      }}
    >
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
          Post Queue
        </div>
        <div className="t-card-title mt-1" style={{ fontSize: 12, color: BRANDS[brand].color }}>
          {BRANDS[brand].label}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {queue.length === 0 ? (
          <div className="text-center px-2 py-6" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            No upcoming posts. Create one in Compose.
          </div>
        ) : queue.map((p) => {
          const Icon = platformIcon(p.platform);
          const sc = STATUS_COLORS[p.status as PostStatus] ?? STATUS_COLORS.draft;
          return (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className="w-full text-left rounded-lg p-2 hover:opacity-90 transition"
              style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} style={{ color: "var(--text-secondary)" }} />
                <span
                  className="t-mono uppercase"
                  style={{
                    fontSize: 8,
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: sc.bg,
                    color: sc.fg,
                    letterSpacing: "0.05em",
                  }}
                >
                  {sc.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.3 }} className="line-clamp-2">
                {(p.hook || p.caption || "Untitled").slice(0, 80)}
              </div>
              {p.scheduled_at && (
                <div className="t-mono mt-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                  {new Date(p.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}
                  {new Date(p.scheduled_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onGotoCalendar}
        className="px-3 py-3 text-left"
        style={{ borderTop: "1px solid var(--border-glass)", fontSize: 11, color: "var(--text-accent)" }}
      >
        View full calendar →
      </button>
    </aside>
  );
}

export { platformIcon };
