// drive-grant-access — an explicit, role-specified permission write on a system
// Kova does not own. There is no code path that reaches this without a person
// choosing a role, and every grant is logged.
import {
  corsHeaders,
  jsonResponse,
  getAuthedUserFromReq,
  getFreshGoogleAccessToken,
  adminClient,
} from "../_shared/google.ts";
import { driveFetch } from "../_shared/drive.ts";

const ROLES = ["reader", "commenter", "writer"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { drive_reference_id, emails, role } = await req.json();
    if (!drive_reference_id) return jsonResponse({ error: "drive_reference_id required" }, 400);
    if (!Array.isArray(emails) || emails.length === 0) return jsonResponse({ error: "emails required" }, 400);
    if (!ROLES.includes(role)) return jsonResponse({ error: "role must be reader, commenter or writer" }, 400);

    const admin = adminClient();
    const { data: ref } = await admin
      .from("drive_references")
      .select("id, file_id, shared_by, conversation_id")
      .eq("id", drive_reference_id)
      .maybeSingle();
    if (!ref) return jsonResponse({ error: "Reference not found" }, 404);

    const { data: convo } = await admin
      .from("conversations")
      .select("user_id")
      .eq("id", ref.conversation_id!)
      .maybeSingle();
    if (!convo || convo.user_id !== user.id) return jsonResponse({ error: "Forbidden" }, 403);

    const token = await getFreshGoogleAccessToken(user.id);
    const results: { email: string; ok: boolean; error?: string; permissionId?: string }[] = [];

    for (const email of emails) {
      const r = await driveFetch(
        `/files/${ref.file_id}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
        token,
        { method: "POST", body: JSON.stringify({ type: "user", role, emailAddress: email }) },
      );
      if (!r.ok) {
        const text = await r.text();
        // permissions.create fails when the sharer is not an owner or editor —
        // say so rather than failing opaquely.
        const reason =
          r.status === 403
            ? "You don't have permission to share this file — ask its owner."
            : `Google returned ${r.status}: ${text.slice(0, 200)}`;
        results.push({ email, ok: false, error: reason });
        continue;
      }
      const perm = await r.json();
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      await admin.from("drive_access_grants").insert({
        drive_reference_id,
        granted_to_email: email,
        granted_to_user_id: profile?.id ?? null,
        granted_by: user.id,
        role,
        google_permission_id: perm.id ?? null,
      });
      results.push({ email, ok: true, permissionId: perm.id });
    }

    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
