// Streaming Claude proxy client (SSE parsing).
import { supabase } from "@/integrations/supabase/client";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamCallbacks {
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

const CLAUDE_MODEL = "claude-sonnet-4-5";

export async function streamClaude(params: {
  system: string;
  messages: ClaudeMessage[];
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}, cb: StreamCallbacks): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Not signed in");

    const resp = await fetch(CLAUDE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        model: params.model ?? "claude-sonnet-4-20250514",
        max_tokens: params.maxTokens ?? 1500,
        stream: true,
        system: params.system,
        messages: params.messages,
      }),
      signal: params.signal,
    });

    if (!resp.ok || !resp.body) {
      let errMsg = `Claude proxy error ${resp.status}`;
      try { const j = await resp.json(); errMsg = j.error ?? errMsg; } catch { /* */ }
      throw new Error(errMsg);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let done = false;

    while (!done) {
      const { done: rdone, value } = await reader.read();
      if (rdone) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          // Anthropic SSE event: type: content_block_delta with delta.text
          if (evt.type === "content_block_delta" && evt.delta?.text) {
            cb.onDelta(evt.delta.text);
          } else if (evt.type === "message_stop") {
            done = true;
          } else if (evt.type === "error") {
            throw new Error(evt.error?.message ?? "Anthropic stream error");
          }
        } catch (e) {
          // partial JSON, push back for next chunk
          buf = line + "\n" + buf;
          break;
        }
      }
    }
    cb.onDone();
  } catch (e) {
    cb.onError(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function callClaude(params: {
  system: string;
  messages: ClaudeMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("claude-proxy", {
    body: {
      model: params.model ?? "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens ?? 1500,
      stream: false,
      system: params.system,
      messages: params.messages,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  // Anthropic non-stream shape: { content: [{ type: 'text', text: '...' }] }
  const text = data?.content?.[0]?.text ?? "";
  return text;
}
