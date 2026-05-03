import { useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Props {
  taskTitle: string;
  taskDescription: string | null;
}

export const VisionSuggestion = ({ taskTitle, taskDescription }: Props) => {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string>("");

  const ask = async () => {
    setLoading(true);
    setText("");
    try {
      const { data, error } = await supabase.functions.invoke("claude-proxy", {
        body: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system:
            "You are Vision, a concise productivity assistant. Given a task, give a 2-4 sentence next-step suggestion. No preamble, no headings.",
          messages: [
            {
              role: "user",
              content: `Task: ${taskTitle}\n\nDetails: ${taskDescription ?? "(none)"}\n\nWhat's the smartest next move?`,
            },
          ],
        },
      });
      if (error) throw error;
      const content = data?.content?.[0]?.text ?? data?.content ?? "";
      setText(typeof content === "string" ? content : JSON.stringify(content));
    } catch (e) {
      setText(`Couldn't reach Vision: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="glass p-3 mb-4"
      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={12} style={{ color: "var(--text-accent)" }} />
        <span className="t-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>VISION SUGGESTION</span>
        <Button size="sm" variant="ghost" onClick={ask} disabled={loading} className="ml-auto h-6 text-[11px]">
          {loading ? "Thinking…" : text ? "Refresh" : "Ask Vision"}
        </Button>
      </div>
      {text && (
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-primary)", fontFamily: "Satoshi, sans-serif" }}>
          {text}
        </p>
      )}
    </div>
  );
};
