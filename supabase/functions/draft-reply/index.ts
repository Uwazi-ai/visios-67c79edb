// draft-reply — proposes. It never sends.
import { corsHeaders, jsonResponse, admin, authedUser, isOrgMember } from "../_shared/mail.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { message_id } = await req.json().catch(() => ({}));
    if (!message_id) return jsonResponse({ error: "message_id required" }, 400);

    const db = admin();
    const { data: msg } = await db.from("mail_messages").select("*").eq("id", message_id).maybeSingle();
    if (!msg) return jsonResponse({ error: "Message not found" }, 404);
    if (!(await isOrgMember(user.id, msg.org_id))) return jsonResponse({ error: "Forbidden" }, 403);

    const { data: org } = await db.from("orgs").select("is_demo,name").eq("id", msg.org_id).maybeSingle();
    if (org?.is_demo) return jsonResponse({ error: "Demo workspaces do not call the model." }, 400);

    const { data: thread } = await db
      .from("mail_messages")
      .select("from_name,from_address,subject,snippet,body_text,received_at")
      .eq("provider_thread_id", msg.provider_thread_id)
      .order("received_at", { ascending: true })
      .limit(8);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return jsonResponse({ error: "AI is not configured" }, 500);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              `You are the Writer for ${org?.name ?? "this organisation"}. Draft a reply the person can send with light editing. ` +
              `Plain sentences, no filler openings, no "I hope this finds you well", no em dashes as decoration. ` +
              `Answer the actual ask and state the next step. Return the reply body only — no subject line, no preamble, no markdown.`,
          },
          {
            role: "user",
            content: `Thread subject: ${msg.subject ?? "(none)"}\n\n${(thread ?? [])
              .map((m) => `${m.from_name ?? m.from_address} (${m.received_at}):\n${m.body_text ?? m.snippet ?? ""}`)
              .join("\n\n---\n\n")}`,
          },
        ],
      }),
    });

    if (r.status === 429) return jsonResponse({ error: "Rate limited. Try again shortly." }, 429);
    if (r.status === 402) return jsonResponse({ error: "AI credits exhausted." }, 402);
    if (!r.ok) return jsonResponse({ error: `AI gateway [${r.status}]: ${await r.text()}` }, 500);

    const draft = String((await r.json())?.choices?.[0]?.message?.content ?? "").trim();
    if (!draft) return jsonResponse({ error: "The model returned nothing." }, 500);

    const { data: proposal, error } = await db.from("proposals").insert({
      org_id: msg.org_id,
      agent_key: "writer",
      kind: "email_reply",
      title: `Reply to ${msg.from_name ?? msg.from_address}`,
      rationale: `${msg.from_name ?? msg.from_address} is waiting on a reply to "${msg.subject ?? "(no subject)"}".`,
      payload: { message_id: msg.id, thread_id: msg.provider_thread_id, draft_body: draft },
      status: "pending",
      confidence: 0.7,
    }).select("id,payload").single();
    if (error) throw new Error(error.message);

    return jsonResponse({ ok: true, proposal_id: proposal.id, draft_body: draft });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
