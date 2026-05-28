import { useState } from "react";
import { X } from "lucide-react";
import { BRANDS, STATUS_COLORS, type BrandKey, type PostStatus } from "./shared";
import { platformIcon } from "./PostQueue";
import type { SocialPost } from "@/hooks/useSocialPosts";
import { toast } from "sonner";

export function PostDetailDrawer({
  post,
  onClose,
  onEdit,
  onDuplicate,
  onStatusChange,
}: {
  post: SocialPost;
  onClose: () => void;
  onEdit: (p: SocialPost) => void;
  onDuplicate: (p: SocialPost) => void;
  onStatusChange: (id: string, status: PostStatus) => Promise<void>;
}) {
  const [status, setStatus] = useState<PostStatus>(post.status);
  const Icon = platformIcon(post.platform);
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  const cfg = BRANDS[(post.brand as BrandKey)];

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} style={{ background: "rgba(0,0,0,0.4)" }}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full overflow-y-auto"
        style={{ width: 360, maxWidth: "100%", background: "rgba(10,10,18,0.96)", backdropFilter: "blur(20px)", borderLeft: "1px solid var(--border-glass)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div className="flex items-center gap-2">
            <Icon size={14} style={{ color: "var(--text-secondary)" }} />
            <span className="badge" style={{ fontSize: 10, color: cfg?.color, borderColor: cfg?.color }}>{cfg?.label}</span>
            <span className="t-mono uppercase" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: sc.bg, color: sc.fg }}>
              {sc.label}
            </span>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        <div className="p-4 space-y-4">
          {post.hook && (
            <div>
              <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Hook</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{post.hook}</div>
            </div>
          )}
          <div>
            <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Caption</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.caption || "—"}</div>
          </div>

          {post.scheduled_at && (
            <div>
              <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Scheduled</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(post.scheduled_at).toLocaleString()}</div>
            </div>
          )}
          {post.assigned_to && (
            <div>
              <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Assigned to</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{post.assigned_to}</div>
            </div>
          )}

          {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
            <div>
              <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Hashtags</div>
              <div className="flex flex-wrap gap-1">
                {post.hashtags.map((h, i) => <span key={i} className="badge" style={{ fontSize: 10 }}>#{h.replace(/^#/, "")}</span>)}
              </div>
            </div>
          )}

          <div>
            <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>Status</div>
            <select
              value={status}
              onChange={async (e) => {
                const s = e.target.value as PostStatus;
                setStatus(s);
                try { await onStatusChange(post.id, s); toast.success("Status updated"); } catch (err: any) { toast.error(err?.message || "Update failed"); }
              }}
              className="input-glass w-full"
              style={{ fontSize: 12 }}
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
              <option value="pending_approval">Pending approval</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onEdit(post)} className="btn-primary flex-1">Edit in Compose</button>
            <button onClick={() => onDuplicate(post)} className="btn-ghost">Duplicate</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
