// Summarizes a meeting transcript via Lovable AI.
// Body: { title: string, transcriptUrl?: string, transcriptText?: string, attendees?: string[], start?: ISO }
// Returns: { ok: true, summary: string, action_items: string[], source: "url" | "text" | "metadata" }
import { corsHeaders, jsonResponse, getAuthedUserFromReq } from "../_shared/google.ts";

async function tryFetchTranscript(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 Kova-Bot" },
      redirect: "follow",
    });
    if (!r.ok) return null;
    const html = await r.text();
    // strip tags, collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 200) return null;
    return text.slice(0, 18000);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { title, transcriptUrl, transcriptText, attendees, start } = await req.json();
    if (!title) return jsonResponse({ error: "title required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

    let body = "";
    let source: "url" | "text" | "metadata" = "metadata";
    if (typeof transcriptText === "string" && transcriptText.trim().length > 100) {
      body = transcriptText.slice(0, 18000);
      source = "text";
    } else if (typeof transcriptUrl === "string" && transcriptUrl.startsWith("http")) {
      const fetched = await tryFetchTranscript(transcriptUrl);
      if (fetched) {
        body = fetched;
        source = "url";
      }
    }

    const attList = (attendees ?? []).filter(Boolean).join(", ") || "(no attendees listed)";
    const userPrompt = body
      ? `Summarize this meeting transcript. Output strict JSON only:
{"summary": "3-5 sentence recap of what happened, decisions made, and tone", "action_items": ["string", ...]}

Title: ${title}
When: ${start ?? "(unknown)"}
Attendees: ${attList}
Transcript:
${body}`
      : `Transcript could not be retrieved. Based only on the title, attendees, and timing, infer a likely recap and 3-5 plausible action items. Mark the recap clearly as inferred. Output strict JSON only:
{"summary": "string (start with 'Inferred: ')", "action_items": ["string", ...]}

Title: ${title}
When: ${start ?? "(unknown)"}
Attendees: ${attList}
Transcript URL (could not fetch): ${transcriptUrl ?? "(none)"}`;

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
    let parsed: { summary?: string; action_items?: string[] } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { summary: raw, action_items: [] }; }
    return jsonResponse({
      ok: true,
      summary: parsed.summary ?? "",
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items.slice(0, 8) : [],
      source,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
