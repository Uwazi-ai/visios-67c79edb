// gmail-fetch-body — bodies are fetched on open and cached, never during sync.
import {
  corsHeaders, jsonResponse, admin, authedUser, isOrgMember, loadAccount, googleToken, gmail,
} from "../_shared/mail.ts";

function decode(data?: string) {
  if (!data) return "";
  const b = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(b, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function walk(part: any, out: { text: string; html: string }) {
  if (!part) return;
  if (part.mimeType === "text/plain") out.text += decode(part.body?.data);
  if (part.mimeType === "text/html") out.html += decode(part.body?.data);
  (part.parts ?? []).forEach((p: any) => walk(p, out));
}

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

    if (msg.body_text || msg.body_html) {
      return jsonResponse({ body_text: msg.body_text, body_html: msg.body_html, cached: true });
    }

    const { account, error } = await loadAccount(msg.mail_account_id);
    if (error === "DEMO_ORG_REFUSED") {
      return jsonResponse({ body_text: msg.snippet ?? "", body_html: null, cached: true, demo: true });
    }
    if (!account) return jsonResponse({ error: error ?? "not found" }, 404);

    const token = await googleToken(req, account.connected_by);
    if (!token) return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED" }, 200);

    const r = await gmail(`/messages/${msg.provider_message_id}?format=full`, token);
    if (!r.ok) return jsonResponse({ error: `Gmail [${r.status}]: ${await r.text()}` }, r.status);
    const full = await r.json();
    const out = { text: "", html: "" };
    walk(full.payload, out);

    await db.from("mail_messages").update({
      body_text: out.text || null,
      body_html: out.html || null,
      body_cached_at: new Date().toISOString(),
    }).eq("id", message_id);

    return jsonResponse({ body_text: out.text || null, body_html: out.html || null, cached: false });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
