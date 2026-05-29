import { useEffect, useState } from "react";
import { X, Sparkles, Send, Edit3, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRANDS, type BrandKey } from "./shared";
import type { SocialPost } from "@/hooks/useSocialPosts";
import { toast } from "sonner";

interface Reply {
  id: string;
  post_id: string | null;
  platform: string;
  author: string | null;
  comment_text: string | null;
  reply_text: string | null;
  status: string;
  created_at: string;
}

export function CommentRepliesDrawer({ post, onClose }: { post: SocialPost; onClose: () => void }) {
  const cfg = BRANDS[post.brand as BrandKey];
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("social_comment_replies")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: false });
    setReplies((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [post.id]);

  const seedDemoComment = async () => {
    const samples = [
      { author: "@maria.kc", text: "Love this — when does early voting start?" },
      { author: "@dev_jay", text: "This is exactly what we needed. How can I help?" },
      { author: "@curious_voter", text: "Wait, does this actually work for my district?" },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];
    const { error } = await supabase.from("social_comment_replies").insert({
      post_id: post.id,
      platform: post.platform,
      author: pick.author,
      comment_text: pick.text,
      status: "pending",
    });
    if (error) toast.error(error.message); else load();
  };

  const draftReply = async (r: Reply) => {
    setDrafting(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("claude-proxy", {
        body: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: `You are writing a reply on behalf of ${cfg?.label || post.brand} in their voice. Be genuine, on-brand, and community-forward. Under 100 words.`,
          messages: [{ role: "user", content: `Comment: ${r.comment_text}. Draft a reply.` }],
        },
      });
      if (error) throw error;
      const text = (data?.content?.[0]?.text || "").trim();
      setDrafts((d) => ({ ...d, [r.id]: text }));
    } catch (e: any) {
      toast.error(e?.message || "Draft failed");
    } finally {
      setDrafting(null);
    }
  };

  const postReply = async (r: Reply) => {
    const text = drafts[r.id];
    if (!text?.trim()) { toast.error("No reply text"); return; }
    const { error } = await supabase
      .from("social_comment_replies")
      .update({ reply_text: text, status: "posted" })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reply posted");
    setEditing((e) => ({ ...e, [r.id]: false }));
    load();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} style={{ background: "rgba(0,0,0,0.4)" }}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full overflow-y-auto"
        style={{ width: 360, maxWidth: "100%", background: "rgba(10,10,18,0.96)", backdropFilter: "blur(20px)", borderLeft: "1px solid var(--border-glass)" }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border-glass)" }}>
          <div>
            <div className="t-section" style={{ fontSize: 14 }}>Comment Replies</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {replies.length} comment{replies.length === 1 ? "" : "s"} · {cfg?.label}
            </div>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={14} /></button>
        </div>

        <div className="p-4 space-y-3">
          <button onClick={seedDemoComment} className="btn-ghost w-full" style={{ fontSize: 11, justifyContent: "center" }}>
            + Add sample comment (demo)
          </button>

          {loading ? (
            <div className="flex justify-center py-8" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : replies.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--text-muted)", fontSize: 12 }}>
              No comments yet.
            </div>
          ) : (
            replies.map((r) => {
              const posted = r.status === "posted";
              return (
                <div key={r.id} className="glass rounded-lg p-3 space-y-2" style={{ borderLeft: `2px solid ${cfg?.color}` }}>
                  <div className="flex items-center justify-between">
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.author || "Anonymous"}</div>
                    <div className="flex items-center gap-1.5">
                      {posted && (
                        <span className="t-mono uppercase" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>
                          <Check size={9} className="inline mr-0.5" /> Replied
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{r.comment_text}</div>

                  {posted ? (
                    <div className="rounded p-2" style={{ background: "var(--bg-glass-1)", fontSize: 12 }}>
                      <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>Your reply</div>
                      {r.reply_text}
                    </div>
                  ) : drafts[r.id] !== undefined ? (
                    <div className="space-y-2">
                      <textarea
                        value={drafts[r.id]}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        readOnly={!editing[r.id]}
                        className="input-glass w-full"
                        rows={4}
                        style={{ fontSize: 12, lineHeight: 1.5 }}
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => postReply(r)} className="btn-primary flex-1" style={{ fontSize: 11, justifyContent: "center" }}>
                          <Send size={11} /> Post Reply
                        </button>
                        <button
                          onClick={() => setEditing((e) => ({ ...e, [r.id]: !e[r.id] }))}
                          className="btn-ghost"
                          style={{ fontSize: 11 }}
                        >
                          <Edit3 size={11} /> {editing[r.id] ? "Done" : "Edit"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => draftReply(r)}
                      disabled={drafting === r.id}
                      className="btn-ghost w-full"
                      style={{ fontSize: 11, justifyContent: "center", color: cfg?.color }}
                    >
                      {drafting === r.id ? <><Loader2 size={11} className="animate-spin" /> Drafting...</> : <><Sparkles size={11} /> Draft Reply</>}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

export function useReplyCounts(postIds: string[]) {
  const [counts, setCounts] = useState<Record<string, { total: number; pending: number }>>({});
  useEffect(() => {
    if (postIds.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("social_comment_replies")
        .select("post_id,status")
        .in("post_id", postIds);
      const map: Record<string, { total: number; pending: number }> = {};
      (data || []).forEach((r: any) => {
        if (!r.post_id) return;
        if (!map[r.post_id]) map[r.post_id] = { total: 0, pending: 0 };
        map[r.post_id].total++;
        if (r.status !== "posted") map[r.post_id].pending++;
      });
      setCounts(map);
    })();
  }, [postIds.join(",")]);
  return counts;
}
