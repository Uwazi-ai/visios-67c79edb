// Shared Gmail helpers for Kova edge functions
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { getFreshGoogleAccessToken } from "./google.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-google-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function getAuthedUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { user: null, supabase: null, token: null };
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { user: null, supabase: null, token: null };
  return { user: data.user, supabase, token };
}

/**
 * Gets a Google access token for the user. We pull it from the most recent
 * provider session via supabase admin API (the `provider_token` is stored on
 * the session in auth metadata under raw_user_meta_data when the trigger fires
 * but it expires; for live calls we use the current session's provider_token
 * which the client must forward via header `x-google-token`).
 */
export async function getGoogleToken(req: Request, userId?: string): Promise<string | null> {
  const sessionToken = req.headers.get("x-google-token");
  if (sessionToken) return sessionToken;
  if (!userId) return null;
  return await getFreshGoogleAccessToken(userId);
}

export async function gmailFetch(
  path: string,
  googleToken: string,
  init: RequestInit = {},
) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${googleToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}
