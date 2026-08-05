import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Copy, Trash2, Plus, KeyRound, Eye, EyeOff } from "lucide-react";

interface McpToken {
  id: string;
  label: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visi-mcp`;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `visi_mcp_${b64}`;
}

export default function MCPTokensPanel() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [revealed, setRevealed] = useState<{ token: string; label: string } | null>(null);
  const [showConfig, setShowConfig] = useState(true);

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("mcp_tokens")
      .select("id, label, token_prefix, last_used_at, created_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setTokens((data ?? []) as McpToken[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user]);

  const createToken = async () => {
    if (!user || !newLabel.trim()) return;
    setCreating(true);
    const token = generateToken();
    const hash = await sha256Hex(token);
    const { error } = await supabase.from("mcp_tokens").insert({
      user_id: user.id,
      token_hash: hash,
      token_prefix: token.slice(0, 16),
      label: newLabel.trim(),
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setRevealed({ token, label: newLabel.trim() });
    setNewLabel("");
    reload();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Any Claude Desktop instance using it will lose access.")) return;
    const { error } = await supabase.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Token revoked");
    reload();
  };

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const configSnippet = (token: string) => JSON.stringify({
    mcpServers: {
      visios: {
        command: "npx",
        args: ["-y", "mcp-remote", MCP_URL, "--header", `Authorization: Bearer ${token}`],
      },
    },
  }, null, 2);

  if (loading) return null;

  return (
    <div className="rounded-xl p-4 mt-4" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
      <div className="flex items-start gap-3 mb-3">
        <KeyRound size={18} className="mt-0.5 text-white" />
        <div className="flex-1">
          <div className="text-sm font-medium text-white">MCP Tokens (Claude Desktop)</div>
          <p className="text-xs text-gray-400">
            Personal API tokens that let Claude Desktop (or any MCP client) read and act on your Kova data — tasks, calendar, gmail, drive, contacts, grants. Each token is scoped to your user and your org memberships.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
            style={{ background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)" }}>
            <div className="min-w-0">
              <div className="text-sm text-white truncate">{t.label}</div>
              <div className="text-[11px] text-gray-500 t-mono">
                {t.token_prefix}…  ·  {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString()}` : "never used"}
              </div>
            </div>
            <button onClick={() => revoke(t.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              <Trash2 size={14} /> Revoke
            </button>
          </div>
        ))}
        {tokens.length === 0 && (
          <div className="text-xs text-gray-500 italic">No tokens yet. Create one below to connect Claude Desktop.</div>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder='Token label (e.g. "Claude Desktop — laptop")'
          className="flex-1 input-glass text-sm"
        />
        <button onClick={createToken} disabled={!newLabel.trim() || creating} className="btn-primary text-sm px-4 flex items-center gap-1">
          <Plus size={14} /> Generate
        </button>
      </div>

      {revealed && (
        <div className="mt-4 rounded-lg p-3" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.3)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-white">Token for "{revealed.label}"</div>
            <button onClick={() => setRevealed(null)} className="text-xs text-gray-400 hover:text-white">Dismiss</button>
          </div>
          <p className="text-xs text-yellow-300 mb-2">
            Copy this token now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 text-xs t-mono px-2 py-1.5 rounded bg-black/40 text-white truncate">{revealed.token}</code>
            <button onClick={() => copy(revealed.token, "Token copied")} className="btn-ghost text-xs px-2 py-1.5 flex items-center gap-1">
              <Copy size={12} /> Copy
            </button>
          </div>

          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-300 font-medium">Claude Desktop config</div>
            <button onClick={() => setShowConfig((v) => !v)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              {showConfig ? <EyeOff size={12} /> : <Eye size={12} />} {showConfig ? "Hide" : "Show"}
            </button>
          </div>
          {showConfig && (
            <>
              <pre className="text-[11px] t-mono p-2 rounded bg-black/40 text-gray-200 overflow-x-auto whitespace-pre">
{configSnippet(revealed.token)}
              </pre>
              <button onClick={() => copy(configSnippet(revealed.token), "Config copied")} className="btn-ghost text-xs px-2 py-1 mt-2 flex items-center gap-1">
                <Copy size={12} /> Copy config
              </button>
              <p className="text-[11px] text-gray-400 mt-2">
                Paste into <code className="t-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS)
                or <code className="t-mono">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows), then restart Claude Desktop.
                On Claude Pro/Team you can also use Settings → Connectors → Add custom connector with URL <code className="t-mono">{MCP_URL}</code>.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
