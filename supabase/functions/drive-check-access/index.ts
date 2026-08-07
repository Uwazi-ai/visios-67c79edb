// drive-check-access — who among the conversation's participants can open this
// file. Cached 5 minutes per file id. On API failure this returns an explicit
// unknown state: Kova never reports a clean result it could not verify.
import {
  corsHeaders,
  jsonResponse,
  getAuthedUserFromReq,
  getFreshGoogleAccessToken,
  adminClient,
} from "../_shared/google.ts";
import { driveFetch, conversationParticipants, cacheGet, cacheSet } from "../_shared/drive.ts";

type Perm = { id: string; emailAddress?: string; type: string; role: string; domain?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { drive_reference_id } = await req.json();
    if (!drive_reference_id) return jsonResponse({ error: "drive_reference_id required" }, 400);

    const admin = adminClient();
    const { data: ref } = await admin
      .from("drive_references")
      .select("id, file_id, conversation_id, shared_by, org_id")
      .eq("id", drive_reference_id)
      .maybeSingle();
    if (!ref) return jsonResponse({ error: "Reference not found" }, 404);

    const { convo, participants } = await conversationParticipants(ref.conversation_id!);
    if (!convo) return jsonResponse({ error: "Conversation not found" }, 404);
    if (convo.user_id !== user.id) return jsonResponse({ error: "Forbidden" }, 403);

    const cacheKey = `perm:${ref.file_id}`;
    const cached = cacheGet<Perm[]>(cacheKey);

    let perms: Perm[] | null = cached;
    let unknownReason: string | null = null;

    if (!perms) {
      let token: string | null = null;
      try {
        token = await getFreshGoogleAccessToken(ref.shared_by);
      } catch {
        unknownReason = "The sharer's Google connection has expired.";
      }
      if (token) {
        const r = await driveFetch(
          `/files/${ref.file_id}/permissions?supportsAllDrives=true&fields=${encodeURIComponent(
            "permissions(id,emailAddress,type,role,domain)",
          )}`,
          token,
        );
        if (r.ok) {
          perms = ((await r.json()).permissions ?? []) as Perm[];
          cacheSet(cacheKey, perms);
        } else {
          unknownReason = `Google returned ${r.status} for the permission check.`;
        }
      }
    }

    if (!perms) {
      return jsonResponse({
        state: "unknown",
        reason: unknownReason ?? "The permission check could not be completed.",
        participants: participants.map((p) => ({ ...p, access: "unknown" })),
        cached: false,
      });
    }

    const emails = new Set(perms.filter((p) => p.emailAddress).map((p) => p.emailAddress!.toLowerCase()));
    const domains = new Set(perms.filter((p) => p.type === "domain" && p.domain).map((p) => p.domain!.toLowerCase()));
    const anyone = perms.some((p) => p.type === "anyone");

    const resolved = participants.map((p) => {
      const domain = p.email.split("@")[1]?.toLowerCase() ?? "";
      const has = anyone || emails.has(p.email) || domains.has(domain);
      return { ...p, access: has ? "ok" : "missing" };
    });

    const missing = resolved.filter((p) => p.access === "missing");
    return jsonResponse({
      state: missing.length ? "gap" : "clean",
      participants: resolved,
      missing,
      total: resolved.length,
      cached: !!cached,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
