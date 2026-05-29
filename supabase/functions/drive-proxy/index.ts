// drive-proxy — server-side Google Drive helper for Visi OS.
// Actions:
//   - drive_list_shared_drives: list shared drives the authed user can access
//   - drive_search: search files within a specific Shared Drive (corpora=drive)
//   - drive_read_file: export/read file content (truncated for Vision context)
import { corsHeaders, jsonResponse, getAuthedUserFromReq, getFreshGoogleAccessToken, adminClient } from "../_shared/google.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";

async function gfetch(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function listSharedDrives(token: string) {
  const r = await gfetch(`${DRIVE}/drives?pageSize=50&fields=drives(id,name,createdTime)`, token);
  if (!r.ok) throw new Error(`drives list failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.drives ?? [];
}

async function searchInDrive(token: string, driveId: string, query: string, maxResults = 10) {
  const terms = (query || "").replace(/['"\\]/g, "").trim();
  const qParts: string[] = ["trashed = false"];
  if (terms) qParts.push(`(name contains '${terms}' or fullText contains '${terms}')`);
  const q = qParts.join(" and ");
  const url = `${DRIVE}/files?` +
    `q=${encodeURIComponent(q)}` +
    `&corpora=drive&driveId=${encodeURIComponent(driveId)}` +
    `&includeItemsFromAllDrives=true&supportsAllDrives=true` +
    `&fields=${encodeURIComponent("files(id,name,mimeType,modifiedTime,webViewLink,size,lastModifyingUser(displayName,emailAddress))")}` +
    `&pageSize=${maxResults}&orderBy=modifiedTime desc`;
  const r = await gfetch(url, token);
  if (!r.ok) throw new Error(`drive search failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return (j.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    type: f.mimeType,
    modifiedAt: f.modifiedTime,
    link: f.webViewLink,
    modifiedBy: f.lastModifyingUser?.displayName ?? f.lastModifyingUser?.emailAddress ?? null,
    size: f.size ?? null,
  }));
}

async function readFile(token: string, fileId: string, mimeType: string) {
  let url: string | null = null;
  let exportMime = "text/plain";
  if (mimeType?.includes("spreadsheet")) exportMime = "text/csv";
  if (mimeType?.startsWith("application/vnd.google-apps")) {
    url = `${DRIVE}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`;
  } else if (mimeType?.startsWith("text/") || mimeType === "application/json") {
    url = `${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`;
  } else {
    return { content: null, truncated: false, reason: `Unsupported file type: ${mimeType}` };
  }
  const r = await gfetch(url, token);
  if (!r.ok) return { content: null, truncated: false, reason: `read failed: ${r.status}` };
  const text = await r.text();
  return { content: text.slice(0, 3000), truncated: text.length > 3000 };
}

async function ensureOrgAccess(userId: string, driveId: string) {
  // Verify the drive is linked to an org this user is a member of.
  const admin = adminClient();
  const { data: org } = await admin
    .from("orgs")
    .select("id, shared_drive_id")
    .eq("shared_drive_id", driveId)
    .maybeSingle();
  if (!org) return true; // not yet linked to any org — allow (used by Browse / Connect flow)
  const { data: mem } = await admin
    .from("org_memberships")
    .select("id")
    .eq("org_id", org.id)
    .eq("user_id", userId)
    .maybeSingle();
  return !!mem;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { action, params = {} } = await req.json();
    const token = await getFreshGoogleAccessToken(user.id);

    if (action === "drive_list_shared_drives") {
      const drives = await listSharedDrives(token);
      return jsonResponse({ drives });
    }

    if (action === "drive_search") {
      const { driveId, query, maxResults } = params;
      if (!driveId) return jsonResponse({ error: "driveId required" }, 400);
      if (!(await ensureOrgAccess(user.id, driveId))) {
        return jsonResponse({ error: "Forbidden: not a member of org linked to this drive" }, 403);
      }
      const files = await searchInDrive(token, driveId, query ?? "", maxResults ?? 10);
      return jsonResponse({ files });
    }

    if (action === "drive_read_file") {
      const { fileId, mimeType, driveId } = params;
      if (!fileId || !mimeType) return jsonResponse({ error: "fileId & mimeType required" }, 400);
      if (driveId && !(await ensureOrgAccess(user.id, driveId))) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      const out = await readFile(token, fileId, mimeType);
      return jsonResponse(out);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
