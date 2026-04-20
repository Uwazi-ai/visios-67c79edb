import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Activity, Trash2, Send } from "lucide-react";

type Kind = "comment" | "status_change" | "priority_change" | "assignee_change" | "due_change" | "created";

interface ActivityRow {
  id: string;
  task_id: string;
  org_id: string;
  user_id: string | null;
  kind: Kind | string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ProfileLite {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Props {
  taskId: string;
  orgId: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function colorFromName(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

function formatChange(row: ActivityRow, profilesById: Map<string, ProfileLite>): string {
  const m = row.metadata ?? {};
  const fmt = (v: unknown) =>
    v === null || v === undefined || v === "" ? "—" : String(v).replace(/_/g, " ");
  switch (row.kind) {
    case "created":
      return "created this task";
    case "status_change":
      return `changed status from ${fmt((m as any).from)} to ${fmt((m as any).to)}`;
    case "priority_change":
      return `changed priority from ${fmt((m as any).from)} to ${fmt((m as any).to)}`;
    case "due_change": {
      const to = (m as any).to ? new Date(String((m as any).to)).toLocaleDateString() : "none";
      const from = (m as any).from ? new Date(String((m as any).from)).toLocaleDateString() : "none";
      return `changed due date from ${from} to ${to}`;
    }
    case "assignee_change": {
      const toId = (m as any).to as string | null;
      const fromId = (m as any).from as string | null;
      const name = (id: string | null) =>
        id ? (profilesById.get(id)?.display_name ?? profilesById.get(id)?.email ?? "someone") : "unassigned";
      return `reassigned from ${name(fromId)} to ${name(toId)}`;
    }
    default:
      return row.kind;
  }
}

export const TaskActivityPanel = ({ taskId, orgId }: Props) => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load activity + profiles
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("task_activity")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast({ title: "Couldn't load activity", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const list = (data ?? []) as ActivityRow[];
      setRows(list);
      const ids = Array.from(
        new Set(
          list
            .flatMap((r) => [r.user_id, (r.metadata as any)?.from, (r.metadata as any)?.to])
            .filter((v): v is string => typeof v === "string"),
        ),
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", ids);
        if (!cancelled && profs) {
          setProfiles(new Map(profs.map((p) => [p.id, p as ProfileLite])));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`task-activity-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_activity", filter: `task_id=eq.${taskId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as ActivityRow;
            setRows((prev) => (prev.find((r) => r.id === row.id) ? prev : [...prev, row]));
            if (row.user_id && !profiles.has(row.user_id)) {
              const { data: p } = await supabase
                .from("profiles")
                .select("id, display_name, email, avatar_url")
                .eq("id", row.user_id)
                .maybeSingle();
              if (p) setProfiles((prev) => new Map(prev).set(p.id, p as ProfileLite));
            }
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as ActivityRow;
            setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as ActivityRow;
            setRows((prev) => prev.filter((r) => r.id !== row.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Auto-scroll on new
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [rows.length]);

  const submit = async () => {
    const body = comment.trim();
    if (!body || !user || !orgId) return;
    setSending(true);
    const optimistic: ActivityRow = {
      id: `tmp-${Date.now()}`,
      task_id: taskId,
      org_id: orgId,
      user_id: user.id,
      kind: "comment",
      body,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setRows((prev) => [...prev, optimistic]);
    setComment("");
    const { data, error } = await supabase
      .from("task_activity")
      .insert({ task_id: taskId, org_id: orgId, user_id: user.id, kind: "comment", body })
      .select()
      .single();
    setSending(false);
    if (error) {
      setRows((prev) => prev.filter((r) => r.id !== optimistic.id));
      toast({ title: "Couldn't post comment", description: error.message, variant: "destructive" });
      setComment(body);
      return;
    }
    if (data) {
      setRows((prev) => prev.map((r) => (r.id === optimistic.id ? (data as ActivityRow) : r)));
    }
  };

  const removeComment = async (id: string) => {
    const prev = rows;
    setRows((p) => p.filter((r) => r.id !== id));
    const { error } = await supabase.from("task_activity").delete().eq("id", id);
    if (error) {
      setRows(prev);
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--border-glass)" }}>
      <div className="flex items-center gap-1.5 mb-3">
        <Activity size={12} style={{ color: "var(--text-muted)" }} />
        <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
          ACTIVITY <span className="slash">/</span> {rows.length}
        </span>
      </div>

      <div ref={scrollRef} className="space-y-2.5 max-h-72 overflow-y-auto pr-1 mb-3">
        {loading ? (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>No activity yet — be the first to comment.</div>
        ) : (
          rows.map((r) => {
            const author = r.user_id ? profiles.get(r.user_id) : null;
            const name = author?.display_name ?? author?.email ?? "System";
            const isMine = r.user_id && user?.id === r.user_id;
            const isComment = r.kind === "comment";
            return (
              <div key={r.id} className="flex gap-2">
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: colorFromName(name),
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 9,
                    flexShrink: 0,
                  }}
                >
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{name}</span>
                    {!isComment && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {formatChange(r, profiles)}
                      </span>
                    )}
                    <span className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                      · {timeAgo(r.created_at)}
                    </span>
                    {isComment && isMine && !r.id.startsWith("tmp-") && (
                      <button
                        onClick={() => removeComment(r.id)}
                        className="ml-auto opacity-50 hover:opacity-100"
                        title="Delete comment"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  {isComment && r.body && (
                    <div
                      className="px-2.5 py-1.5 inline-block max-w-full"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border-glass)",
                        borderRadius: 8,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {r.body}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-1.5 items-end">
        <Textarea
          placeholder="Add a comment… (⌘↵ to send)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={sending || !comment.trim() || !orgId}
          className="flex-shrink-0"
        >
          <Send size={12} className="mr-1" />
          {sending ? "…" : "Post"}
        </Button>
      </div>
      {!orgId && (
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          <MessageSquare size={10} className="inline mr-1" /> Task needs an org to enable comments.
        </div>
      )}
    </div>
  );
};
