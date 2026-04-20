import { corsHeaders, jsonResponse } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { title, description } = await req.json();
    if (!title || typeof title !== "string") return jsonResponse({ error: "title required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You estimate how many minutes a task realistically takes for an experienced professional. Return ONLY a JSON object: {\"estimate_mins\": <int>, \"reasoning\": \"<one short sentence>\"}.",
          },
          { role: "user", content: `Task: ${title}\n${description ? `Details: ${description}` : ""}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return jsonResponse({ error: "Rate limited" }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `AI failed: ${JSON.stringify(data)}` }, 500);
    let estimate_mins = 30;
    let reasoning = "";
    try {
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
      estimate_mins = Number(parsed.estimate_mins) || 30;
      reasoning = String(parsed.reasoning ?? "");
    } catch { /* keep defaults */ }
    return jsonResponse({ estimate_mins, reasoning });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
