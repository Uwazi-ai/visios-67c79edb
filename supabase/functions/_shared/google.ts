// Server-side Google OAuth helper. Refreshes access tokens using the
// refresh_token stored on profiles.google_refresh_token.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getAuthedUserFromReq(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data } = await sb.auth.getUser(token);
  return data?.user ?? null;
}

interface RefreshResult {
  access_token: string;
  expires_in: number;
}

/**
 * Exchange a stored refresh_token for a fresh access token.
 * Throws if no refresh token is stored or the exchange fails.
 */
export async function getFreshGoogleAccessToken(userId: string): Promise<string> {
  const admin = adminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("google_refresh_token, google_access_token")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  if (!profile?.google_refresh_token) {
    throw new Error("No Google refresh token stored. Sign out and sign in again.");
  }
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: profile.google_refresh_token,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await r.json() as RefreshResult & { error?: string; error_description?: string };
  if (!r.ok) {
    throw new Error(`token refresh failed: ${data.error ?? r.status} ${data.error_description ?? ""}`);
  }
  // Best-effort cache (not strictly needed but useful for debugging)
  await admin
    .from("profiles")
    .update({ google_access_token: data.access_token })
    .eq("id", userId);
  return data.access_token;
}

export async function googleFetch(url: string, accessToken: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
