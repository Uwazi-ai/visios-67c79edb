// send-reply — the only path that puts mail on the wire.
//
// Commits atomically in intent: proposal committed → message done. A failure
// leaves the proposal pending and nothing half-written.
import {
  corsHeaders, jsonResponse, admin, authedUser, isOrgMember, loadAccount, googleToken, gmail,
} from "../_shared/mail.ts";

function b64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authedUser(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { proposal_id, message_id, body, save_draft } = await req.json().catch(() => ({}));
    if (!body || !String(body).trim()) return jsonResponse({ error: "An empty reply cannot be sent." }, 400);

    const db = admin();

    let msgId = message_id;
    let proposal: any = null;
    if (proposal_id) {
      const { data } = await db.from("proposals").select("*").eq("id", proposal_id).maybeSingle();
      if (!data) return jsonResponse({ error: "Proposal not found" }, 404);
      proposal = data;
      msgId = msgId ?? data.payload?.message_id;
    }
    if (!msgId) return jsonResponse({ error: "message_id required" }, 400);

    const { data: msg } = await db.from("mail_messages").select("*").eq("id", msgId).maybeSingle();
    if (!msg) return jsonResponse({ error: "Message not found" }, 404);
    if (!(await isOrgMember(user.id, msg.org_id))) return jsonResponse({ error: "Forbidden" }, 403);

    const { account, error: accErr } = await loadAccount(msg.mail_account_id);
    if (accErr === "DEMO_ORG_REFUSED") return jsonResponse({ error: "Demo workspaces cannot send mail." }, 400);
    if (!account) return jsonResponse({ error: accErr ?? "not found" }, 404);

    const token = await googleToken(req, account.connected_by);
    if (!token) return jsonResponse({ error: "GOOGLE_AUTH_REQUIRED" }, 200);

    const to = msg.from_address;
    if (!to) return jsonResponse({ error: "No recipient could be resolved." }, 400);
    const subject = /^re:/i.test(msg.subject ?? "") ? msg.subject : `Re: ${msg.subject ?? ""}`;

    const mime = [
      `From: ${account.display_name ? `${account.display_name} <${account.email_address}>` : account.email_address}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
    ].join("\r\n") + "\r\n\r\n" + body;

    const raw = b64url(mime);
    const path = save_draft ? "/drafts" : "/messages/send";
    const payload = save_draft
      ? { message: { raw, threadId: msg.provider_thread_id } }
      : { raw, threadId: msg.provider_thread_id };

    const r = await gmail(path, token, { method: "POST", body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      // Nothing is committed on failure. The composer keeps the text.
      return jsonResponse({ error: `Gmail [${r.status}]: ${JSON.stringify(data)}` }, r.status);
    }

    if (save_draft) return jsonResponse({ ok: true, saved_draft: true, id: data.id });

    if (proposal) {
      const original = String(proposal.payload?.draft_body ?? "");
      await db.from("proposals").update({
        status: "committed",
        decided_at: new Date().toISOString(),
        decided_by: user.id,
        payload: { ...proposal.payload, sent_body: body, edited: original.trim() !== String(body).trim() },
      }).eq("id", proposal.id);
    }

    await db.from("mail_messages").update({
      triage_status: "done",
      needs_reply: false,
      is_unread: false,
      triaged_at: new Date().toISOString(),
      triaged_by: user.id,
    }).eq("id", msgId);

    return jsonResponse({ ok: true, id: data.id, thread_id: data.threadId });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
