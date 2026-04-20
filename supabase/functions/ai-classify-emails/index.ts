import { corsHeaders, jsonResponse, getAuthedUser } from "../_shared/gmail.ts";

const SYSTEM_PROMPT = `You triage emails for a busy founder running multiple ventures (UWAZI.AI, Black Innovators Network, Culture Club Creative Agency).

For each email, decide:
- urgency: one of "urgent" | "action" | "fyi" | "newsletter"
  - urgent: time-sensitive, money/legal/people on the line, or a direct ask needing reply <24h
  - action: requires the founder to do or decide something, but not same-day
  - fyi: informational, no action needed
  - newsletter: marketing, digests, automated content
- ai_summary: ONE short sentence (max ~15 words) capturing the gist + any ask
- org_tag: which venture/context this belongs to (e.g. "UWAZI.AI", "BIN", "Culture Club", "Personal", "Other") — infer from sender, domain, subject, and any provided org_context

Return strictly via the classify_emails tool.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { emails } = await req.json();
    if (!Array.isArray(emails) || emails.length === 0) {
      return jsonResponse({ error: "emails (array) required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    const compact = emails.map((e: any) => ({
      id: String(e.id),
      from: e.from ?? "",
      subject: e.subject ?? "",
      snippet: (e.snippet ?? "").slice(0, 300),
      org_context: e.org_context ?? "",
    }));

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Classify these ${compact.length} emails. Return ONE result per id, in the same order.\n\n${JSON.stringify(compact, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_emails",
              description: "Return classification for each email by id.",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        urgency: { type: "string", enum: ["urgent", "action", "fyi", "newsletter"] },
                        ai_summary: { type: "string" },
                        org_tag: { type: "string" },
                      },
                      required: ["id", "urgency", "ai_summary", "org_tag"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_emails" } },
      }),
    });

    if (r.status === 429) return jsonResponse({ error: "Rate limit hit. Try again shortly." }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted. Add funds in Settings." }, 402);
    if (!r.ok) {
      const t = await r.text();
      return jsonResponse({ error: `AI gateway error [${r.status}]: ${t}` }, 500);
    }

    const data = await r.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let results: Array<{ id: string; urgency: string; ai_summary: string; org_tag: string }> = [];
    if (call?.function?.arguments) {
      try {
        const parsed = JSON.parse(call.function.arguments);
        if (Array.isArray(parsed?.results)) results = parsed.results;
      } catch { /* fallthrough */ }
    }

    // Ensure every input id has a result; fill gaps with safe defaults
    const byId = new Map(results.map((x) => [String(x.id), x]));
    const final = compact.map((e) =>
      byId.get(e.id) ?? { id: e.id, urgency: "fyi", ai_summary: e.subject || e.snippet || "", org_tag: "Other" }
    );

    return jsonResponse(final);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
