// classify-messages — rules first, then batched inference on metadata only.
//
// Two hard rules live here:
//   1. category_source = 'user' is never overwritten.
//   2. bodies are never sent to the model. Snippets only.
import { corsHeaders, jsonResponse, admin, authedUser, isOrgMember } from "../_shared/mail.ts";

const BATCH = 20;

const DEFINITIONS = `
urgent       — Time-sensitive, consequence for delay, from a real person. Client escalation, deadline today, "are we still on for 2pm".
meetings     — Scheduling, agendas, invites, recaps, reschedules. Calendly notifications, "can we move Thursday", agendas.
transactions — Money and legal: invoices, receipts, contracts, payroll, banking. Stripe payouts, vendor invoices, DocuSign.
outreach     — Someone wants something from you and you have no prior relationship. Cold pitches, partnership asks, media requests, applicants.
marketing    — Bulk, automated, promotional, newsletters, product announcements. Substack, SaaS product updates, promos.
`;

const PRECEDENCE =
  "When several fit, use this precedence: urgent > transactions > meetings > outreach > marketing. Urgency wins because under-prioritising costs more than over-prioritising.";

function ruleMatch(msg: any, rules: any[]): string | null {
  const domain = String(msg.from_address ?? "").split("@")[1] ?? "";
  for (const r of rules) {
    const v = String(r.match_value ?? "").toLowerCase();
    if (r.match_type === "from_address" && String(msg.from_address).toLowerCase() === v) return r.category;
    if (r.match_type === "from_domain" && domain.toLowerCase() === v.replace(/^@/, "")) return r.category;
    if (r.match_type === "subject_contains" && String(msg.subject ?? "").toLowerCase().includes(v)) return r.category;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { org_id } = await req.json().catch(() => ({}));
    if (!org_id) return jsonResponse({ error: "org_id required" }, 400);
    if (!(await isOrgMember(user.id, org_id))) return jsonResponse({ error: "Forbidden" }, 403);

    const db = admin();
    const { data: org } = await db.from("orgs").select("is_demo").eq("id", org_id).maybeSingle();
    if (org?.is_demo) return jsonResponse({ error: "Demo workspaces are not classified." }, 400);

    const { data: pending } = await db
      .from("mail_messages")
      .select("id,from_address,from_name,subject,snippet,to_addresses,cc_addresses")
      .eq("org_id", org_id)
      .eq("category_source", "pending")
      .order("received_at", { ascending: true })
      .limit(200);

    if (!pending?.length) return jsonResponse({ ok: true, rules: 0, ai: 0 });

    const { data: rules } = await db
      .from("mail_category_rules").select("*").eq("org_id", org_id).eq("is_active", true);

    // 1. deterministic rules — cheaper and more reliable than inference
    const remaining: any[] = [];
    let ruled = 0;
    for (const m of pending) {
      const hit = ruleMatch(m, rules ?? []);
      if (hit) {
        await db.from("mail_messages").update({
          category: hit, category_source: "rule", category_confidence: 1,
          categorized_at: new Date().toISOString(),
        }).eq("id", m.id).neq("category_source", "user");
        ruled++;
      } else remaining.push(m);
    }

    // few-shot from human corrections in this org
    const { data: corrected } = await db
      .from("mail_messages")
      .select("from_address,subject,snippet,category")
      .eq("org_id", org_id).eq("category_source", "user")
      .order("categorized_at", { ascending: false }).limit(10);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return jsonResponse({ error: "AI is not configured" }, 500);

    let classified = 0;
    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH);
      const payload = batch.map((m) => ({
        message_id: m.id,
        from_address: m.from_address,
        from_name: m.from_name,
        subject: m.subject,
        snippet: (m.snippet ?? "").slice(0, 300),
        to: m.to_addresses,
        cc: m.cc_addresses,
      }));

      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "system",
              content: `You categorise business email into exactly one category.\n\n${DEFINITIONS}\n${PRECEDENCE}\n\n${
                corrected?.length
                  ? `Corrections made by this user, treat as authoritative examples:\n${JSON.stringify(corrected)}\n`
                  : ""
              }Return JSON only. No preamble, no markdown fences. An array of { "message_id": string, "category": string, "confidence": number 0-1 }.`,
            },
            { role: "user", content: JSON.stringify(payload) },
          ],
        }),
      });

      if (r.status === 429) return jsonResponse({ error: "Rate limited. Try again shortly." }, 429);
      if (r.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
      if (!r.ok) return jsonResponse({ error: `AI gateway [${r.status}]: ${await r.text()}` }, 500);

      const text = (await r.json())?.choices?.[0]?.message?.content ?? "";
      let results: any[] = [];
      try {
        const cleaned = String(text).replace(/```json|```/g, "").trim();
        const start = cleaned.indexOf("[");
        const end = cleaned.lastIndexOf("]");
        results = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
      } catch { results = []; }

      const valid = new Set(["urgent", "meetings", "transactions", "outreach", "marketing"]);
      for (const res of Array.isArray(results) ? results : []) {
        if (!res?.message_id || !valid.has(res.category)) continue;
        const { error } = await db.from("mail_messages").update({
          category: res.category,
          category_source: "ai",
          category_confidence: Math.max(0, Math.min(1, Number(res.confidence) || 0.5)),
          categorized_at: new Date().toISOString(),
        }).eq("id", res.message_id).neq("category_source", "user");
        if (!error) classified++;
      }
    }

    return jsonResponse({ ok: true, rules: ruled, ai: classified });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
