// Claude (Anthropic) proxy. Streams SSE through.
// Reads per-user key from profiles.ai_prefs.anthropic_key, falls back to ANTHROPIC_API_KEY env.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

async function logUsage(row: {
  user_id: string;
  model: string;
  call_type: string | null;
  streamed: boolean;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  latency_ms: number;
  ok: boolean;
  error: string | null;
}) {
  try {
    const admin = adminClient();
    await admin.from("ai_token_usage").insert({
      user_id: row.user_id,
      provider: "anthropic",
      model: row.model,
      call_type: row.call_type,
      streamed: row.streamed,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cache_read_tokens: row.cache_read_tokens,
      cache_write_tokens: row.cache_write_tokens,
      latency_ms: row.latency_ms,
      ok: row.ok,
      error: row.error,
    });
  } catch {
    // never break the response
  }
}

function scheduleBackground(promise: Promise<unknown>) {
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) {
    rt.waitUntil(promise);
  } else {
    promise.catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      model = "claude-sonnet-4-5",
      stream = false,
      system,
      messages,
      temperature,
      callType,
    } = body ?? {};
    const max_tokens = body?.max_tokens ?? (callType === "brief" ? 4096 : 2048);

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "messages array required" }, 400);
    }

    // Resolve API key: per-user first, fallback to env
    let apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    try {
      const admin = adminClient();
      const { data: prof } = await admin
        .from("profiles")
        .select("ai_prefs")
        .eq("id", user.id)
        .maybeSingle();
      const prefs = (prof?.ai_prefs ?? {}) as Record<string, unknown>;
      const userKey = typeof prefs.anthropic_key === "string" ? (prefs.anthropic_key as string) : "";
      if (userKey && userKey.startsWith("sk-ant-")) apiKey = userKey;
    } catch { /* ignore */ }

    if (!apiKey) return jsonResponse({ error: "No Anthropic API key configured. Add yours in Settings → AI Assistant." }, 400);

    const startedAt = Date.now();
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        stream,
        ...(system ? { system } : {}),
        ...(typeof temperature === "number" ? { temperature } : {}),
        messages,
      }),
    });

    if (!upstream.ok && !stream) {
      const errText = await upstream.text();
      const latency_ms = Date.now() - startedAt;
      scheduleBackground(logUsage({
        user_id: user.id,
        model,
        call_type: callType ?? null,
        streamed: false,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        latency_ms,
        ok: false,
        error: `Anthropic ${upstream.status}: ${errText}`,
      }));
      return jsonResponse({ error: `Anthropic ${upstream.status}: ${errText}` }, upstream.status);
    }

    if (stream) {
      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        const latency_ms = Date.now() - startedAt;
        scheduleBackground(logUsage({
          user_id: user.id,
          model,
          call_type: callType ?? null,
          streamed: true,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          latency_ms,
          ok: false,
          error: `Anthropic ${upstream.status}: ${errText}`,
        }));
        return new Response(errText || "Upstream error", {
          status: upstream.status,
          headers: { ...corsHeaders },
        });
      }

      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadTokens = 0;
      let cacheWriteTokens = 0;
      let buf = "";

      const inspect = (text: string) => {
        buf += text;
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim());
            if (payload?.type === "message_start" && payload.message?.usage) {
              const u = payload.message.usage;
              inputTokens = u.input_tokens ?? inputTokens;
              cacheReadTokens = u.cache_read_input_tokens ?? cacheReadTokens;
              cacheWriteTokens = u.cache_creation_input_tokens ?? cacheWriteTokens;
              outputTokens = u.output_tokens ?? outputTokens;
            } else if (payload?.type === "message_delta" && payload.usage) {
              outputTokens = payload.usage.output_tokens ?? outputTokens;
            }
          } catch {
            // ignore malformed chunk
          }
        }
      };

      const decoder = new TextDecoder();
      let finished = false;
      const finish = (ok: boolean, error: string | null) => {
        if (finished) return;
        finished = true;
        const latency_ms = Date.now() - startedAt;
        scheduleBackground(logUsage({
          user_id: user.id,
          model,
          call_type: callType ?? null,
          streamed: true,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheReadTokens,
          cache_write_tokens: cacheWriteTokens,
          latency_ms,
          ok,
          error,
        }));
      };

      const tee = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          try {
            inspect(decoder.decode(chunk, { stream: true }));
          } catch {
            // ignore inspection errors, never block passthrough
          }
          controller.enqueue(chunk);
        },
        flush() {
          finish(true, null);
        },
        cancel(reason) {
          finish(false, reason instanceof Error ? reason.message : String(reason));
        },
      });

      const piped = upstream.body ? upstream.body.pipeThrough(tee) : null;

      return new Response(piped, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await upstream.json();
    const latency_ms = Date.now() - startedAt;
    const usage = data?.usage ?? {};
    scheduleBackground(logUsage({
      user_id: user.id,
      model,
      call_type: callType ?? null,
      streamed: false,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
      latency_ms,
      ok: true,
      error: null,
    }));
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
