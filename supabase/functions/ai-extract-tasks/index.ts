import { corsHeaders, jsonResponse } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { notes } = await req.json();
    if (!notes || typeof notes !== "string") return jsonResponse({ error: "notes required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You extract concrete action items from meeting notes or brain dumps. Today is ${today}. Return ONLY valid JSON: {"tasks": [{"title": "...", "priority": "urgent|high|normal|low", "due_at": "YYYY-MM-DD or null"}]}. Each title must be a single concrete next-action verb-led task (e.g., "Send Q2 doc to Amy"). Skip discussion notes, decisions already made, and people's names alone. If a date is mentioned (today, tomorrow, Friday, May 5), set due_at as ISO date. Otherwise null. Default priority normal. Max 15 tasks. No prose.`,
          },
          { role: "user", content: notes.slice(0, 8000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return jsonResponse({ error: "Rate limited" }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `AI failed: ${JSON.stringify(data)}` }, 500);
    let tasks: unknown[] = [];
    try {
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 15) : [];
    } catch {
      tasks = [];
    }
    // Normalize due_at to ISO timestamp at 17:00 local-ish
    const norm = (tasks as any[]).map((t) => ({
      title: String(t.title ?? "").trim(),
      priority: ["urgent", "high", "normal", "low"].includes(t.priority) ? t.priority : "normal",
      due_at: t.due_at && /^\d{4}-\d{2}-\d{2}/.test(String(t.due_at))
        ? new Date(`${String(t.due_at).slice(0, 10)}T17:00:00Z`).toISOString()
        : null,
    })).filter((t) => t.title);
    return jsonResponse({ tasks: norm });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
