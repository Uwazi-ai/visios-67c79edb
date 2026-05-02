import { useEffect, useState } from "react";
import { Sparkles, Loader2, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ContactRow } from "@/pages/Contacts";
import { relativeTime } from "@/lib/contactsHealth";

interface Props {
  contact: ContactRow;
  orgName: string | null;
}

interface RecentItem {
  type: string;
  title: string | null;
  summary: string | null;
  occurred_at: string;
}

export const AISuggestionCard = ({ contact, orgName }: Props) => {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [drafting, setDrafting] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setSuggestion(null);

    (async () => {
      const { data: rec } = await supabase
        .from("contact_interactions")
        .select("type, title, summary, occurred_at")
        .eq("contact_id", contact.id)
        .order("occurred_at", { ascending: false })
        .limit(3);
      const recentItems = (rec ?? []) as RecentItem[];
      if (!cancelled) setRecent(recentItems);

      const recentSummary = recentItems
        .map((r) => `- ${r.type.toUpperCase()} (${new Date(r.occurred_at).toLocaleDateString()}): ${r.title ?? "—"}${r.summary ? " — " + r.summary.slice(0, 120) : ""}`)
        .join("\n") || "No recorded interactions yet.";

      const prompt = `Contact: ${contact.name}${contact.company ? ` (${contact.company})` : ""}
Org context: ${orgName ?? "—"}
Last touched: ${relativeTime(contact.last_touched_at)}
Recent interactions:
${recentSummary}

Suggest one specific follow-up action — one sentence — that would move this relationship forward.`;

      try {
        const { data, error } = await supabase.functions.invoke("ai-draft-email", {
          body: {
            thread: [{ from: "Visi (you)", timestamp: new Date().toISOString(), body: prompt }],
            user_name: "Myke Shaw",
            user_org: orgName ?? "UWAZI.AI",
          },
        });
        if (cancelled) return;
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        setSuggestion(data?.draft ?? "—");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contact.id, contact.name, contact.company, contact.last_touched_at, orgName]);

  const openDraft = async () => {
    setDraftOpen(true);
    setDrafting(true);
    setDraft("");
    try {
      const recentSummary = recent
        .map((r) => `- ${r.type}: ${r.title ?? ""} (${new Date(r.occurred_at).toLocaleDateString()})`)
        .join("\n") || "No prior interactions.";

      const promptThread = [
        {
          from: contact.name + (contact.email ? ` <${contact.email}>` : ""),
          timestamp: contact.last_touched_at ?? new Date().toISOString(),
          body: `Context for warm follow-up to ${contact.name}${contact.company ? ` at ${contact.company}` : ""}.
Org: ${orgName ?? "—"}
Last touched: ${relativeTime(contact.last_touched_at)}
Recent interactions:
${recentSummary}

Write a brief, warm follow-up email that re-opens the conversation and proposes a specific next step.`,
        },
      ];

      const { data, error } = await supabase.functions.invoke("ai-draft-email", {
        body: {
          thread: promptThread,
          user_name: "Myke Shaw",
          user_org: orgName ?? "UWAZI.AI",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setDraft(data?.draft ?? "");
    } catch (e) {
      setDraft(e instanceof Error ? e.message : "Failed to draft");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <>
      <div
        className="glass p-4"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.10), rgba(37,99,235,0.06))",
          borderColor: "rgba(99,102,241,0.30)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} style={{ color: "#A78BFA" }} />
          <span className="t-card-title" style={{ color: "#C4B5FD" }}>Suggested Next Step</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={14} className="animate-spin" />
            <span style={{ fontSize: 12 }}>Thinking…</span>
          </div>
        ) : err ? (
          <p style={{ fontSize: 12, color: "var(--sev-warn)" }}>{err}</p>
        ) : (
          <p
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--text-primary)",
              lineHeight: 1.5,
            }}
          >
            {suggestion}
          </p>
        )}
        <div className="mt-3">
          <button onClick={openDraft} disabled={loading || !!err} className="btn-primary" style={{ fontSize: 10, padding: "8px 14px" }}>
            <Mail size={12} /> Draft Email
          </button>
        </div>
      </div>

      {draftOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setDraftOpen(false)}
        >
          <div
            className="glass-elevated p-5 w-full max-w-xl"
            style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="t-section">Draft to {contact.name}</h3>
                <p className="t-mono mt-1">{contact.email ?? "—"}</p>
              </div>
              <button onClick={() => setDraftOpen(false)} className="btn-icon"><X size={14} /></button>
            </div>
            {drafting ? (
              <div className="flex items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="input-glass flex-1"
                style={{ minHeight: 240, fontFamily: "var(--font-body)", whiteSpace: "pre-wrap" }}
              />
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setDraftOpen(false)} className="btn-ghost">Close</button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(draft);
                }}
                disabled={drafting || !draft}
                className="btn-primary"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
