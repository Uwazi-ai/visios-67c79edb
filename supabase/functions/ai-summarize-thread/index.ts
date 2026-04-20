import { corsHeaders, jsonResponse, getAuthedUser } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { thread } = await req.json();
    if (!Array.isArray(thread) || thread.length === 0) return jsonResponse({ error: "thread required" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    const threadText = thread
      .map((m: any) => `From: ${m.from}\n${m.body}`)
      .join("\n\n---\n\n");

    const messages = [
      {
        role: "system",
        content:
          "You summarize email threads for a busy founder. Output 2–3 short sentences max. State (a) what the thread is about, (b) what action is needed from the recipient, (c) any deadline. No fluff.",
      },
      { role: "user", content: threadText },
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });
    if (!r.ok) {
      const t = await r.text();
      return jsonResponse({ error: `AI error [${r.status}]: ${t}` }, 500);
    }
    const data = await r.json();
    return jsonResponse({ summary: data?.choices?.[0]?.message?.content?.trim() ?? "" });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
