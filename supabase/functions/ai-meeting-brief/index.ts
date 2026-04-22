// Generates a short prep brief for a Google Calendar event. Authed users only.
// Body: { title: string, description?: string, attendees?: string[], start: ISO, end: ISO }
// Returns: { ok: true, brief: string, action_items: string[] }
import { corsHeaders, jsonResponse, getAuthedUserFromReq } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { title, description, attendees, start, end, mode } = await req.json();
    if (!title || !start) return jsonResponse({ error: "title and start required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

    const isPast = mode === "past" || new Date(end ?? start) < new Date();

    const attList = (attendees ?? []).filter(Boolean).join(", ") || "(no attendees listed)";
    const desc = (description ?? "").slice(0, 4000) || "(no description)";

    const userPrompt = isPast
      ? `Meeting that already happened. Based on the title, description, and attendees, infer 3-5 likely action items that someone in this meeting might need to follow up on. Be specific and actionable. Output strict JSON only:
{"brief": "1-2 sentence recap", "action_items": ["string", ...]}

Title: ${title}
When: ${start}${end ? ` → ${end}` : ""}
Attendees: ${attList}
Description: ${desc}`
      : `Upcoming meeting. Write a sharp prep brief: 3-4 sentences covering who's in the room, the likely goal, and 1-2 talking points or questions to lead with. Then suggest 2-4 follow-up action items the user should be ready to commit to. Output strict JSON only:
{"brief": "string", "action_items": ["string", ...]}

Title: ${title}
When: ${start}${end ? ` → ${end}` : ""}
Attendees: ${attList}
Description: ${desc}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a sharp executive assistant. Be specific, never generic. Always respond with strict JSON only." },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return jsonResponse({ error: "Rate limited, try again later" }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `AI failed: ${JSON.stringify(data)}` }, 500);

    const raw: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { brief?: string; action_items?: string[] } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { brief: raw, action_items: [] }; }
    return jsonResponse({
      ok: true,
      brief: parsed.brief ?? "",
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items.slice(0, 8) : [],
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
