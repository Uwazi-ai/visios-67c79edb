// Shared helpers for the Kova Inbox (Sprint 02).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getFreshGoogleAccessToken } from "./google.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-google-token",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function authedUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data?.user ?? null;
}

/** A user may only act on orgs they belong to. */
export async function isOrgMember(userId: string, orgId: string) {
  const db = admin();
  const [a, b] = await Promise.all([
    db.from("org_memberships").select("user_id").eq("user_id", userId).eq("org_id", orgId).maybeSingle(),
    db.from("org_members").select("user_id").eq("user_id", userId).eq("org_id", orgId).maybeSingle(),
  ]);
  return !!(a.data || b.data);
}

export interface MailAccount {
  id: string;
  org_id: string;
  connected_by: string;
  provider: string;
  email_address: string;
  display_name: string | null;
  status: string;
  history_id: string | null;
  last_sync_at: string | null;
}

/**
 * Loads an account and hard-refuses demo orgs. A demo tenant must never reach
 * Gmail or a model provider — the seeded data exists to demo the UI, and a
 * live API call against it would be both a cost and a correctness bug.
 */
export async function loadAccount(accountId: string): Promise<{ account?: MailAccount; error?: string }> {
  const db = admin();
  const { data, error } = await db
    .from("mail_accounts")
    .select("*, orgs!inner(is_demo)")
    .eq("id", accountId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Mail account not found" };
  if ((data as any).orgs?.is_demo) return { error: "DEMO_ORG_REFUSED" };
  return { account: data as unknown as MailAccount };
}

export async function googleToken(req: Request, userId: string) {
  const forwarded = req.headers.get("x-google-token");
  if (forwarded) return forwarded;
  return await getFreshGoogleAccessToken(userId);
}

export async function gmail(path: string, token: string, init: RequestInit = {}) {
  return await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** "Name <a@b.c>" → parts. Shared by sync and the composer's recipient check. */
export function parseAddress(raw: string): { name: string | null; address: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw ?? "");
  if (m) return { name: m[1].trim() || null, address: m[2].trim().toLowerCase() };
  return { name: null, address: (raw ?? "").trim().toLowerCase() };
}

export function splitAddresses(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => parseAddress(p).address)
    .filter(Boolean);
}
