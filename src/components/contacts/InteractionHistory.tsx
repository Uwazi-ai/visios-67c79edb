import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Calendar, Phone, FileText, CheckSquare, Loader2 } from "lucide-react";

interface Interaction {
  id: string;
  type: "email" | "meeting" | "call" | "note" | "task";
  title: string | null;
  summary: string | null;
  occurred_at: string;
  source: string;
}

const ICONS = {
  email: Mail,
  meeting: Calendar,
  call: Phone,
  note: FileText,
  task: CheckSquare,
} as const;

interface Props {
  contactId: string;
}

export const InteractionHistory = ({ contactId }: Props) => {
  const [items, setItems] = useState<Interaction[] | null>(null);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("contact_interactions")
      .select("id, type, title, summary, occurred_at, source")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setItems((data ?? []) as Interaction[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-6" style={{ color: "var(--text-muted)", fontSize: 12 }}>
        No interactions yet. Sync Gmail or log one manually.
      </div>
    );
  }

  const visible = items.slice(0, limit);

  return (
    <div className="flex flex-col gap-2">
      {visible.map((i) => {
        const Icon = ICONS[i.type] ?? FileText;
        const date = new Date(i.occurred_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return (
          <div
            key={i.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-[10px]"
            style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--bg-glass-2)",
                color: "var(--text-secondary)",
              }}
            >
              <Icon size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }} className="truncate">
                  {i.title || `(${i.type})`}
                </span>
                <span className="t-mono" style={{ fontSize: 9 }}>{date}</span>
              </div>
              {i.summary && (
                <p
                  style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}
                  className="line-clamp-2"
                >
                  {i.summary}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {items.length > limit && (
        <button
          onClick={() => setLimit(limit + 10)}
          className="btn-ghost mx-auto mt-1"
          style={{ height: 28, padding: "0 14px", fontSize: 10 }}
        >
          Load More
        </button>
      )}
    </div>
  );
};
