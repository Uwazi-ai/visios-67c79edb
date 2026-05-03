import { useEffect, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/orgColors";

interface Props {
  value: string;
  onChange: (slug: string) => void;
  ignoreOrgId?: string;
  onValidityChange?: (valid: boolean) => void;
}

export function SlugInput({ value, onChange, ignoreOrgId, onValidityChange }: Props) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) { setStatus("idle"); onValidityChange?.(false); return; }
    if (trimmed !== slugify(trimmed) || trimmed.length < 2) {
      setStatus("invalid"); onValidityChange?.(false); return;
    }
    setStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("orgs").select("id").eq("slug", trimmed).maybeSingle();
      if (data && data.id !== ignoreOrgId) {
        setStatus("taken");
        setSuggestion(`${trimmed}-2`);
        onValidityChange?.(false);
      } else {
        setStatus("available");
        setSuggestion(null);
        onValidityChange?.(true);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [value, ignoreOrgId]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          className="input-glass pr-9"
          value={value}
          onChange={(e) => onChange(slugify(e.target.value))}
          placeholder="my-org"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {status === "checking" && <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
          {status === "available" && <Check size={14} style={{ color: "#22C55E" }} />}
          {(status === "taken" || status === "invalid") && <X size={14} style={{ color: "#EF4444" }} />}
        </span>
      </div>
      <div className="t-mono" style={{ fontSize: 10 }}>
        {status === "available" && <span style={{ color: "#22C55E" }}>✓ {value} is available</span>}
        {status === "taken" && (
          <span style={{ color: "#EF4444" }}>
            ✗ {value} is taken — try{" "}
            <button type="button" onClick={() => onChange(suggestion!)} className="underline" style={{ color: "var(--text-accent)" }}>
              {suggestion}
            </button>
          </span>
        )}
        {status === "invalid" && <span style={{ color: "#EF4444" }}>✗ Use lowercase letters, numbers, and hyphens (min 2 chars)</span>}
        {status === "idle" && <span style={{ color: "var(--text-muted)" }}>URL-friendly identifier</span>}
      </div>
    </div>
  );
}
