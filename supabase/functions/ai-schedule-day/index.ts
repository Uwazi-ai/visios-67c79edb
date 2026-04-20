// AI scheduler — Plan My Day. Returns proposed time blocks based on
// open tasks, existing calendar events, and user preferences.
// Body: { date: "YYYY-MM-DD", tasks: [...], events: [...], preferences: {...} }
import { corsHeaders, jsonResponse, getAuthedUserFromReq } from "../_shared/google.ts";

interface Block {
  start: string;
  end: string;
  title: string;
  type: "deep_work" | "meeting" | "admin" | "break" | "buffer";
  org_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { date, tasks, events, preferences } = await req.json();
    if (!date) return jsonResponse({ error: "date required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

    const systemPrompt = `You are Myke Shaw's scheduling assistant. Myke is a serial founder running three companies (UWAZI.AI, BIN, Culture Club).
Protect his deep work time (${preferences?.deep_work_start ?? "09:00"}–${preferences?.deep_work_end ?? "11:00"} is sacred).
Schedule meetings ${preferences?.focus_start ?? "13:00"}–${preferences?.focus_end ?? "17:00"} when possible.
Group similar org work together to minimize context switching.
Leave ${preferences?.buffer_mins ?? 10}-min buffers between meetings. Never schedule back-to-back meetings.
Lunch break ${preferences?.lunch_start ?? "12:00"}–${preferences?.lunch_end ?? "13:00"}.
Use the schedule_day tool to return blocks. Times must be ISO 8601 on ${date}.`;

    const userPrompt = `Date: ${date}
Existing calendar events (cannot move):
${(events ?? []).map((e: { start: string; end: string; title: string }) => `  • ${e.start}–${e.end}: ${e.title}`).join("\n") || "  (none)"}

Open tasks to schedule:
${(tasks ?? []).map((t: { title: string; priority?: string; estimate_mins?: number; org_id?: string }) => `  • [${t.priority ?? "normal"}, ~${t.estimate_mins ?? 30}min, org=${t.org_id ?? "personal"}] ${t.title}`).join("\n") || "  (none)"}

Build a full day plan. Include existing events as type="meeting", carve focus blocks for the highest-priority tasks, add lunch and buffers.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "schedule_day",
            description: "Return the proposed schedule for the day as ordered time blocks.",
            parameters: {
              type: "object",
              properties: {
                blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      start: { type: "string", description: "ISO 8601 datetime" },
                      end: { type: "string", description: "ISO 8601 datetime" },
                      title: { type: "string" },
                      type: { type: "string", enum: ["deep_work", "meeting", "admin", "break", "buffer"] },
                      org_id: { type: "string", description: "Org id or 'personal'" },
                    },
                    required: ["start", "end", "title", "type"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["blocks"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "schedule_day" } },
      }),
    });
    if (r.status === 429) return jsonResponse({ error: "Rate limited" }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
    const data = await r.json();
    if (!r.ok) return jsonResponse({ error: `AI failed: ${JSON.stringify(data)}` }, 500);

    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return jsonResponse({ error: "No schedule returned" }, 500);
    const args = JSON.parse(toolCall.function.arguments);
    const blocks: Block[] = args.blocks ?? [];
    return jsonResponse({ blocks });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
