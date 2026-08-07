// Shared Google Drive helpers for Kova's Drive-reference surface.
// Drive references store bytes nowhere: Kova keeps a metadata snapshot and a
// link, and Google keeps the file and the permissions.
import { adminClient } from "./google.ts";

export const DRIVE = "https://www.googleapis.com/drive/v3";

export const TEXT_EXTRACTABLE = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
];

export const visionCanRead = (mime: string) =>
  TEXT_EXTRACTABLE.includes(mime) || mime.startsWith("text/");

/** Pull a Drive file id out of any of the URL shapes Google hands out. */
export function extractFileId(url: string): string | null {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export const isDriveUrl = (url: string) =>
  /^https:\/\/(docs|drive|sheets|slides)\.google\.com\//.test(url);

export async function driveFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${DRIVE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export type DriveMeta = {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
  owners?: { emailAddress?: string }[];
};

export async function getFileMeta(fileId: string, token: string) {
  const fields = "id,name,mimeType,iconLink,thumbnailLink,webViewLink,modifiedTime,owners(emailAddress)";
  const r = await driveFetch(
    `/files/${fileId}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
    token,
  );
  if (!r.ok) return { ok: false as const, status: r.status, body: await r.text() };
  return { ok: true as const, meta: (await r.json()) as DriveMeta };
}

/**
 * Everyone who can see the conversation. Conversations in Kova are owned by one
 * operator; the rest of the participant set is the org's membership, which is
 * who a shared file has to actually reach.
 */
export async function conversationParticipants(conversationId: string) {
  const admin = adminClient();
  const { data: convo } = await admin
    .from("conversations")
    .select("id, org_id, user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return { convo: null, participants: [] as { userId: string; email: string; name: string }[] };

  const ids = new Set<string>([convo.user_id]);
  if (convo.org_id) {
    const { data: members } = await admin
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", convo.org_id);
    for (const m of members ?? []) ids.add(m.user_id);
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .in("id", [...ids]);

  return {
    convo,
    participants: (profiles ?? [])
      .filter((p) => !!p.email)
      .map((p) => ({ userId: p.id, email: String(p.email).toLowerCase(), name: p.display_name ?? p.email })),
  };
}

export function externalOwner(ownerEmail: string | null, orgDomains: string[]) {
  if (!ownerEmail) return false;
  const domain = ownerEmail.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !orgDomains.map((d) => d.toLowerCase()).includes(domain);
}

export async function orgDomainsFor(orgId: string) {
  const admin = adminClient();
  const { data: org } = await admin.from("orgs").select("metadata").eq("id", orgId).maybeSingle();
  const meta = (org?.metadata ?? {}) as { domains?: string[] };
  return meta.domains ?? [];
}

/* ------------------------------------------------------------------ */
/* Permission-check cache: 5 minutes per file id.                      */
/* A busy conversation must not burn quota redrawing cards nobody      */
/* clicked, so the result is memoised for the life of the isolate.     */
/* ------------------------------------------------------------------ */

type CacheEntry = { at: number; value: unknown };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export function cacheGet<T>(key: string): T | null {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown) {
  CACHE.set(key, { at: Date.now(), value });
}
