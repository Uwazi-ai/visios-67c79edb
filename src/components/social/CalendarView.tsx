import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { BRANDS, STATUS_COLORS, type BrandKey, type PostStatus } from "./shared";
import { platformIcon } from "./PostQueue";
import type { SocialPost } from "@/hooks/useSocialPosts";

export function CalendarView({
  brand,
  posts,
  onOpenPost,
  onComposeAt,
}: {
  brand: BrandKey;
  posts: SocialPost[];
  onOpenPost: (p: SocialPost) => void;
  onComposeAt: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const visible = useMemo(() => posts.filter((p) => {
    if (filterPlatform !== "all" && p.platform !== filterPlatform) return false;
    if (filterAssignee !== "all" && (p.assigned_to || "").toLowerCase() !== filterAssignee) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  }), [posts, filterPlatform, filterAssignee, filterStatus]);

  const days = buildMonth(cursor);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="btn-icon"
        ><ChevronLeft size={14} /></button>
        <div className="t-section" style={{ fontSize: 16, minWidth: 160 }}>{monthLabel}</div>
        <button
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="btn-icon"
        ><ChevronRight size={14} /></button>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
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
          </select>
          <button
            onClick={() => onComposeAt(new Date())}
            className="btn-primary"
            style={{ fontSize: 11 }}
          >
            <Plus size={12} /> Add post
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="t-mono uppercase text-center" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayPosts = visible.filter((p) => p.scheduled_at && sameDay(new Date(p.scheduled_at), d));
          const isToday = sameDay(d, new Date());
          return (
            <div
              key={i}
              onClick={(e) => { if (e.target === e.currentTarget) onComposeAt(d); }}
              className="rounded-lg p-1.5 cursor-pointer"
              style={{
                minHeight: 84,
                background: inMonth ? "var(--bg-glass-1)" : "transparent",
                border: isToday ? `1px solid ${BRANDS[brand].color}` : "1px solid var(--border-glass)",
                opacity: inMonth ? 1 : 0.45,
              }}
            >
              <div className="t-mono mb-1" style={{ fontSize: 9, color: isToday ? BRANDS[brand].color : "var(--text-muted)" }}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((p) => {
                  const Icon = platformIcon(p.platform);
                  const sc = STATUS_COLORS[p.status as PostStatus] ?? STATUS_COLORS.draft;
                  const bColor = BRANDS[(p.brand as BrandKey)]?.color ?? "var(--text-muted)";
                  return (
                    <div
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); onOpenPost(p); }}
                      className="rounded px-1 py-0.5 flex items-center gap-1 truncate"
                      style={{
                        background: "var(--bg-glass-2)",
                        borderLeft: `2px solid ${bColor}`,
                        fontSize: 10,
                      }}
                    >
                      <Icon size={10} style={{ color: "var(--text-secondary)" }} />
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: sc.fg, flexShrink: 0 }} />
                      <span className="truncate" style={{ color: "var(--text-primary)" }}>
                        {(p.hook || p.caption || "Post").slice(0, 30)}
                      </span>
                    </div>
                  );
                })}
                {dayPosts.length > 3 && (
                  <div className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                    +{dayPosts.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
          No posts scheduled for this period.
        </div>
      )}
    </div>
  );
}

function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function buildMonth(cursor: Date) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekday = start.getDay();
  const first = new Date(start); first.setDate(1 - startWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) { const d = new Date(first); d.setDate(first.getDate() + i); days.push(d); }
  return days;
}
