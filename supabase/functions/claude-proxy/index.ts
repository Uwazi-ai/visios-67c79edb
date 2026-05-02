// Claude (Anthropic) proxy. Streams SSE through.
// Reads per-user key from profiles.ai_prefs.anthropic_key, falls back to ANTHROPIC_API_KEY env.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      model = "claude-sonnet-4-20250514",
      max_tokens = 1500,
      stream = false,
      system,
      messages,
      temperature,
    } = body ?? {};

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
      return jsonResponse({ error: `Anthropic ${upstream.status}: ${errText}` }, upstream.status);
    }

    if (stream) {
      return new Response(upstream.body, {
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
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
