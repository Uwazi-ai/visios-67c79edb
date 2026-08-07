// drive-create-doc — create an empty Doc, Sheet or Slides deck in the org's
// Drive folder and share it with the conversation's participants at writer.
// Auto-sharing is acceptable only here: the file is new and empty, so there is
// no pre-existing content to leak. Requires only drive.file.
import {
  corsHeaders,
  jsonResponse,
  getAuthedUserFromReq,
  getFreshGoogleAccessToken,
  adminClient,
} from "../_shared/google.ts";
import { driveFetch, conversationParticipants } from "../_shared/drive.ts";

const MIME: Record<string, string> = {
  document: "application/vnd.google-apps.document",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
  presentation: "application/vnd.google-apps.presentation",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { conversation_id, type, title } = await req.json();
    if (!conversation_id) return jsonResponse({ error: "conversation_id required" }, 400);
    const mimeType = MIME[type];
    if (!mimeType) return jsonResponse({ error: "type must be document, spreadsheet or presentation" }, 400);

    const admin = adminClient();
    const { convo, participants } = await conversationParticipants(conversation_id);
    if (!convo) return jsonResponse({ error: "Conversation not found" }, 404);
    if (convo.user_id !== user.id) return jsonResponse({ error: "Forbidden" }, 403);
    if (!convo.org_id) return jsonResponse({ error: "Conversation has no organization" }, 400);

    const { data: org } = await admin
      .from("orgs")
      .select("id, name, drive_folder_id")
      .eq("id", convo.org_id)
      .maybeSingle();
    if (!org?.drive_folder_id) {
      return jsonResponse(
        { error: "connect_required", message: `${org?.name ?? "This organization"} has no Drive folder set. Set one in Connect before creating documents.` },
        400,
      );
    }

    const token = await getFreshGoogleAccessToken(user.id);
    const create = await driveFetch(
      `/files?supportsAllDrives=true&fields=${encodeURIComponent("id,name,mimeType,iconLink,webViewLink,modifiedTime,owners(emailAddress)")}`,
      token,
      { method: "POST", body: JSON.stringify({ name: title || "Untitled", mimeType, parents: [org.drive_folder_id] }) },
    );
    if (!create.ok) return jsonResponse({ error: `Google returned ${create.status}: ${await create.text()}` }, create.status);
    const file = await create.json();

    const { data: ref, error } = await admin
      .from("drive_references")
      .insert({
        org_id: org.id,
        conversation_id,
        shared_by: user.id,
        file_id: file.id,
        drive_url: file.webViewLink,
        file_name: file.name,
        mime_type: file.mimeType,
        icon_url: file.iconLink ?? null,
        web_view_link: file.webViewLink,
        owner_email: file.owners?.[0]?.emailAddress ?? null,
        file_modified_at: file.modifiedTime ?? null,
        source: "created",
        status: "ok",
        metadata_fetched_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return jsonResponse({ error: error.message }, 400);

    const shared: string[] = [];
    for (const p of participants) {
      if (p.userId === user.id) continue;
      const r = await driveFetch(
        `/files/${file.id}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
        token,
        { method: "POST", body: JSON.stringify({ type: "user", role: "writer", emailAddress: p.email }) },
      );
      if (!r.ok) continue;
      const perm = await r.json();
      await admin.from("drive_access_grants").insert({
        drive_reference_id: ref.id,
        granted_to_email: p.email,
        granted_to_user_id: p.userId,
        granted_by: user.id,
        role: "writer",
        google_permission_id: perm.id ?? null,
      });
      shared.push(p.name);
    }

    return jsonResponse({ reference: ref, org_name: org.name, shared_with: shared });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
