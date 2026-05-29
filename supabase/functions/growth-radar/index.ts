// Growth Radar — an LLM agent endpoint that turns raw growth metrics + context
// into structured, actionable insights. Authed users POST their metrics; the
// function asks Claude to surface signals, risks, and prioritized next moves.
// Reads per-user key from profiles.ai_prefs.anthropic_key, falls back to
// ANTHROPIC_API_KEY env (same resolution as claude-proxy).
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

// Keep the default model aligned with claude-proxy so the project pins one version.
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are Growth Radar, a sharp, numerate growth analyst for a B2B SaaS product.
You are given a snapshot of growth metrics and optional free-form context. Your job is to
read the numbers like an operator: separate signal from noise, name what is actually moving,
flag what is at risk, and recommend the few highest-leverage actions.

Rules:
- Be specific and quantitative. Cite the actual numbers you were given; never invent data.
- If a metric is missing or ambiguous, say so in "caveats" rather than guessing.
- Prefer 2-4 recommendations over a long list. Rank them by expected impact.
- No filler, no generic advice ("engage your users"). Every line must be defensible from the data.

Respond with ONLY a JSON object (no markdown, no prose) matching this shape:
{
  "summary": string,                       // 1-2 sentence headline of the growth picture
  "signals": [ { "label": string, "detail": string, "direction": "up" | "down" | "flat" } ],
  "risks": [ { "label": string, "detail": string, "severity": "low" | "medium" | "high" } ],
  "recommendations": [ { "action": string, "rationale": string, "priority": 1 } ],
  "caveats": [ string ]
}`;

interface RadarRequest {
  metrics?: unknown;        // object or array of growth metrics (signups, activation, retention, MRR, ...)
  context?: string;         // free-form notes: what changed, goals, what you're worried about
  question?: string;        // optional specific question to focus the analysis
  period?: string;          // e.g. "last 30 days", "Q2 2026"
  model?: string;           // optional model override
  max_tokens?: number;
}

function stripCodeFences(text: string): string {
  // Models sometimes wrap JSON in ```json ... ``` despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced ? fenced[1] : text).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: RadarRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { metrics, context, question, period, model = DEFAULT_MODEL, max_tokens = 2000 } = body ?? {};

    const hasMetrics = metrics !== undefined && metrics !== null &&
      (typeof metrics !== "object" || Object.keys(metrics as object).length > 0);
    if (!hasMetrics && !context) {
      return jsonResponse({ error: "Provide `metrics` and/or `context` to analyze." }, 400);
    }

    // Resolve API key: per-user first, fallback to env (mirrors claude-proxy).
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
    } catch { /* ignore — fall back to env key */ }

    if (!apiKey) {
      return jsonResponse({ error: "No Anthropic API key configured. Add yours in Settings → AI Assistant." }, 400);
    }

    const metricsStr = hasMetrics ? JSON.stringify(metrics, null, 2) : "(none provided)";
    const userPrompt = [
      period ? `Period: ${period}` : null,
      `Metrics:\n${metricsStr}`,
      context ? `Context:\n${context}` : null,
      question ? `Focus question: ${question}` : null,
    ].filter(Boolean).join("\n\n");

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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return jsonResponse({ error: `Anthropic ${upstream.status}: ${errText}` }, upstream.status);
    }

    const data = await upstream.json();
    const text: string = (data?.content ?? [])
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b?.text ?? "")
      .join("")
      .trim();

    // Try to return parsed structured insights; fall back to raw text if the
    // model didn't emit clean JSON so the caller still gets something usable.
    let insights: unknown = null;
    let parseError: string | null = null;
    try {
      insights = JSON.parse(stripCodeFences(text));
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    return jsonResponse({
      ok: true,
      model,
      insights,
      ...(insights === null ? { raw: text, parseError } : {}),
      usage: data?.usage ?? null,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
