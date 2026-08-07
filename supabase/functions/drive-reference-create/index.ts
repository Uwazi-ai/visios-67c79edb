// drive-reference-create — record a Drive file in a conversation.
// Consumes no storage quota, applies no size ceiling. A pasted link the token
// cannot read is stored as 'unenriched' rather than rejected: a labelled Drive
// card is more useful than an error.
import {
  corsHeaders,
  jsonResponse,
  getAuthedUserFromReq,
  getFreshGoogleAccessToken,
  adminClient,
} from "../_shared/google.ts";
import { extractFileId, getFileMeta, externalOwner, orgDomainsFor } from "../_shared/drive.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { conversation_id, chat_message_id = null, picked = null, url = null } = body ?? {};
    if (!conversation_id) return jsonResponse({ error: "conversation_id required" }, 400);
    if (!picked && !url) return jsonResponse({ error: "picked or url required" }, 400);

    const admin = adminClient();
    const { data: convo } = await admin
      .from("conversations")
      .select("id, org_id, user_id")
      .eq("id", conversation_id)
      .maybeSingle();
    if (!convo) return jsonResponse({ error: "Conversation not found" }, 404);
    if (convo.user_id !== user.id) return jsonResponse({ error: "Forbidden" }, 403);
    if (!convo.org_id) return jsonResponse({ error: "Conversation has no organization" }, 400);

    const fileId: string | null = picked?.id ?? extractFileId(String(url));
    if (!fileId) return jsonResponse({ error: "Could not read a Drive file id from that link" }, 400);

    const source = picked ? "picker" : "pasted";
    const driveUrl = String(url ?? picked?.url ?? `https://drive.google.com/file/d/${fileId}/view`);

    let token: string | null = null;
    try {
      token = await getFreshGoogleAccessToken(user.id);
    } catch {
      token = null;
    }

    let row: Record<string, unknown> = {
      org_id: convo.org_id,
      conversation_id,
      chat_message_id,
      shared_by: user.id,
      file_id: fileId,
      drive_url: driveUrl,
      file_name: picked?.name ?? "Drive file",
      mime_type: picked?.mimeType ?? "application/vnd.google-apps.unknown",
      web_view_link: picked?.url ?? driveUrl,
      source,
      status: "unenriched",
    };

    if (token) {
      const meta = await getFileMeta(fileId, token);
      if (meta.ok) {
        const ownerEmail = meta.meta.owners?.[0]?.emailAddress ?? null;
        const domains = await orgDomainsFor(convo.org_id);
        row = {
          ...row,
          file_name: meta.meta.name,
          mime_type: meta.meta.mimeType,
          icon_url: meta.meta.iconLink ?? null,
          thumbnail_link: meta.meta.thumbnailLink ?? null,
          web_view_link: meta.meta.webViewLink ?? driveUrl,
          owner_email: ownerEmail,
          externally_owned: externalOwner(ownerEmail, domains),
          file_modified_at: meta.meta.modifiedTime ?? null,
          status: "ok",
          metadata_fetched_at: new Date().toISOString(),
        };
      } else if (meta.status === 404) {
        row.status = "not_found";
      }
      // 403 / anything else stays 'unenriched': Kova says it cannot read the
      // details rather than asserting a state it never verified.
    }

    const { data, error } = await admin.from("drive_references").insert(row).select().single();
    if (error) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ reference: data });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
