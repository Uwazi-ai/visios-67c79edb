import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, ExternalLink, KeyRound, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const STEPS = [
  {
    title: "Create a Make.com scenario",
    body: "In Make.com, create a new scenario and add the Anthropic Claude module (or an HTTP module pointed at https://api.anthropic.com/v1/messages).",
  },
  {
    title: "Add your Anthropic credentials in Make",
    body: "When Make prompts for an API key, paste the same Anthropic key you stored here. Make stores its own copy — Kova never transmits the key to Make on your behalf.",
  },
  {
    title: "Wire Kova as the trigger (optional)",
    body: "Use a Make.com Webhook trigger and call it from a Kova edge function or automation. The webhook URL belongs in Make, not here.",
  },
  {
    title: "Test end-to-end",
    body: "Run the scenario once in Make. If Claude responds, your key is valid and the integration is live.",
  },
];

export default function MakeIntegration() {
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      // Ping the claude-proxy edge function — it 200s if ANTHROPIC_API_KEY is set server-side.
      const { data, error } = await supabase.functions.invoke("claude-proxy", {
        body: { ping: true },
      });
      setKeyConfigured(!error && !!data);
    } catch {
      setKeyConfigured(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="page-enter max-w-3xl mx-auto py-6 space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft size={14} /> Back to Settings
      </Link>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(110, 0, 247, 0.12)", border: "1px solid rgba(110, 0, 247, 0.3)" }}
          >
            <Zap size={20} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <h1 className="t-hero" style={{ fontSize: 28 }}>Make.com Integration</h1>
            <div className="t-mono mt-0.5">Run Anthropic Claude scenarios from Make</div>
          </div>
        </div>
      </div>

      {/* Secret status */}
      <div className="glass p-5 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} style={{ color: "var(--text-secondary)" }} className="mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              ANTHROPIC_API_KEY status
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Your Anthropic key is stored as an encrypted server-side secret. It is never sent to the browser or shown
              in plain text — not in this page, not in logs, not in support tickets. Only backend edge functions can
              read it.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-glass-2)" }}>
          <div className="flex items-center gap-2 text-sm">
            {keyConfigured === null && <span style={{ color: "var(--text-secondary)" }}>Checking…</span>}
            {keyConfigured === true && (
              <>
                <Check size={14} style={{ color: "#22C55E" }} />
                <span style={{ color: "#86efac" }}>Configured and reachable</span>
              </>
            )}
            {keyConfigured === false && (
              <span style={{ color: "#FCA5A5" }}>Not configured or unreachable</span>
            )}
          </div>
          <button onClick={checkStatus} disabled={checking} className="btn-ghost text-xs">
            {checking ? "Checking…" : "Re-check"}
          </button>
        </div>

        <div className="text-xs" style={{ color: "var(--text-tertiary, var(--text-muted))" }}>
          To rotate or replace the key, ask the assistant: <em>"Rotate my ANTHROPIC_API_KEY"</em>. You'll get a secure
          form to paste the new value — it's never typed into chat.
        </div>
      </div>

      {/* Useful endpoints */}
      <div className="glass p-5 rounded-xl space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={16} style={{ color: "var(--text-secondary)" }} />
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Useful endpoints for Make
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: "Claude proxy (auth required)", url: `${WEBHOOK_BASE}/claude-proxy` },
            { label: "Kova MCP server", url: `${WEBHOOK_BASE}/visi-mcp` },
          ].map((e) => (
            <div
              key={e.url}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
              style={{ background: "var(--bg-glass-2)" }}
            >
              <div className="min-w-0">
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{e.label}</div>
                <div className="text-xs font-mono truncate" style={{ color: "var(--text-primary)" }}>{e.url}</div>
              </div>
              <button onClick={() => copy(e.url, e.label)} className="btn-ghost text-xs flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="glass p-5 rounded-xl space-y-4">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Setup steps
        </div>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: "var(--bg-glass-2)", color: "var(--text-primary)" }}
              >
                {i + 1}
              </div>
              <div>
                <div className="text-sm" style={{ color: "var(--text-primary)" }}>{s.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.body}</div>
              </div>
            </li>
          ))}
        </ol>

        <a
          href="https://www.make.com/en/integrations/anthropic-claude"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: "#a78bfa" }}
        >
          Make.com Anthropic docs <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
