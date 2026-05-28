import { useState, useMemo } from "react";
import { Trash2, Copy, Edit3 } from "lucide-react";
import { BRANDS, STATUS_COLORS, type BrandKey, type PostStatus } from "./shared";
import { platformIcon } from "./PostQueue";
import type { SocialPost } from "@/hooks/useSocialPosts";
import { toast } from "sonner";

export function PostsView({
  brand,
  posts,
  onOpenPost,
  onUpdate,
  onDelete,
  onCreate,
}: {
  brand: BrandKey;
  posts: SocialPost[];
  onOpenPost: (p: SocialPost) => void;
  onUpdate: (id: string, patch: Partial<SocialPost>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (p: Partial<SocialPost>) => Promise<SocialPost>;
}) {
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => posts.filter((p) => {
    if (filterPlatform !== "all" && p.platform !== filterPlatform) return false;
    if (filterAssignee !== "all" && (p.assigned_to || "").toLowerCase() !== filterAssignee) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  }), [posts, filterPlatform, filterAssignee, filterStatus]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };
  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} posts?`)) return;
    for (const id of selected) await onDelete(id);
    setSelected(new Set());
    toast.success("Deleted");
  };

  const duplicate = async (p: SocialPost) => {
    await onCreate({
      platform: p.platform,
      content_pillar: p.content_pillar,
      hook: p.hook,
      caption: p.caption,
      hashtags: p.hashtags,
      script_outline: p.script_outline,
      status: "draft",
    });
    toast.success("Duplicated");
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="input-glass" style={{ fontSize: 11 }}>
          <option value="all">All platforms</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="facebook">Facebook</option>
          <option value="youtube">YouTube</option>
        </select>
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="input-glass" style={{ fontSize: 11 }}>
          <option value="all">All people</option>
          <option value="anna">Anna</option>
          <option value="alexis">Alexis</option>
          <option value="myke">Myke</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-glass" style={{ fontSize: 11 }}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{selected.size} selected</span>
            <button onClick={bulkDelete} className="btn-ghost" style={{ fontSize: 11, color: "#EF4444" }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          No posts yet. Create your first post in Compose →
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                <th className="p-2" style={{ width: 32 }}>
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                </th>
                <Th>Brand</Th>
                <Th>Platform</Th>
                <Th>Caption</Th>
                <Th>Pillar</Th>
                <Th>Status</Th>
                <Th>Scheduled</Th>
                <Th>Assigned</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const Icon = platformIcon(p.platform);
                const sc = STATUS_COLORS[p.status as PostStatus] ?? STATUS_COLORS.draft;
                const bColor = BRANDS[(p.brand as BrandKey)]?.color ?? "var(--text-muted)";
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border-glass)" }} className="hover:bg-white/5">
                    <td className="p-2">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    </td>
                    <td className="p-2">
                      <span className="badge" style={{ fontSize: 10, color: bColor, borderColor: bColor }}>
                        {BRANDS[(p.brand as BrandKey)]?.label ?? p.brand}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <Icon size={12} style={{ color: "var(--text-secondary)" }} />
                        <span style={{ color: "var(--text-secondary)", textTransform: "capitalize" }}>{p.platform}</span>
                      </div>
                    </td>
                    <td className="p-2 cursor-pointer" onClick={() => onOpenPost(p)}>
                      <div className="truncate" style={{ maxWidth: 280, color: "var(--text-primary)" }}>
                        {(p.hook || p.caption || "—").slice(0, 60)}
                      </div>
                    </td>
                    <td className="p-2" style={{ color: "var(--text-muted)", fontSize: 11 }}>{p.content_pillar || "—"}</td>
                    <td className="p-2">
                      <span className="t-mono uppercase" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: sc.bg, color: sc.fg }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="p-2 t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="p-2" style={{ color: "var(--text-secondary)" }}>{p.assigned_to || "—"}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button onClick={() => onOpenPost(p)} className="btn-icon" style={{ width: 24, height: 24 }} title="Edit"><Edit3 size={11} /></button>
                        <button onClick={() => duplicate(p)} className="btn-icon" style={{ width: 24, height: 24 }} title="Duplicate"><Copy size={11} /></button>
                        <button onClick={() => { if (confirm("Delete this post?")) onDelete(p.id); }} className="btn-icon" style={{ width: 24, height: 24 }} title="Delete"><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="p-2 text-left t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>
    {children}
  </th>
);
