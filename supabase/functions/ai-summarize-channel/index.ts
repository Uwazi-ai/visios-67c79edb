import { corsHeaders, jsonResponse, getAuthedUser } from "../_shared/gmail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { channel_name, org, messages: msgs } = await req.json();
    if (!Array.isArray(msgs) || msgs.length === 0) {
      return jsonResponse({ error: "messages required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    const transcript = msgs
      .map((m: any) => `[${m.timestamp ?? ""}] ${m.from}: ${m.text}`)
      .join("\n");

    const messages = [
      {
        role: "system",
        content:
          "You summarize team chat channels for a busy founder. Output 3-5 short bullet points covering: open questions, decisions made, action items (with owner if visible). Be terse. No fluff. Use plain text bullets like '• ...'.",
      },
      {
        role: "user",
        content: `Channel: #${channel_name ?? ""}${org ? ` (${org})` : ""}\n\nLast messages:\n${transcript}`,
      },
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
