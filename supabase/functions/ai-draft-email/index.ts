import { corsHeaders, jsonResponse, getAuthedUser } from "../_shared/gmail.ts";

const SYSTEM_PROMPT = `You are Myke Shaw's email drafting assistant. Myke is a serial founder running UWAZI.AI (civic intelligence), Black Innovators Network, and Culture Club Creative Agency.

His email voice: Direct. Warm but efficient. Founder-to-founder. Moves things forward in every message. Concise (never more than 5 sentences). Never corporate. Never says "I hope this email finds you well." Always has a specific next action.

Write a reply to the following thread. Match the tone of the conversation. If someone asks for a meeting, suggest a specific time. If there's a deliverable needed, name it and give a timeframe. End with the ball in their court.

Output ONLY the email body. No subject line. No "Hi <name>," unless natural. No signature — just end with "—Myke" if appropriate.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user } = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { thread, user_name, user_org } = await req.json();
    if (!Array.isArray(thread) || thread.length === 0) {
      return jsonResponse({ error: "thread (array) required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY not configured" }, 500);

    const threadText = thread
      .map((m: any) => `From: ${m.from}\nDate: ${m.timestamp ?? ""}\n\n${m.body}`)
      .join("\n\n---\n\n");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Drafting as: ${user_name ?? "Myke Shaw"} (${user_org ?? "UWAZI.AI"})\n\nThread:\n\n${threadText}\n\nDraft my reply now.`,
      },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (aiRes.status === 429) return jsonResponse({ error: "Rate limit hit. Try again shortly." }, 429);
    if (aiRes.status === 402) return jsonResponse({ error: "AI credits exhausted. Add funds in Settings." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return jsonResponse({ error: `AI gateway error [${aiRes.status}]: ${t}` }, 500);
    }
    const data = await aiRes.json();
    const draft = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return jsonResponse({ draft });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
