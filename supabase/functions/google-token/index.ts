// Returns a fresh Google access token for the authed user (refresh-token flow).
// Used by the client when it needs to call Google APIs that we don't proxy.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, getFreshGoogleAccessToken } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const access_token = await getFreshGoogleAccessToken(user.id);
    return jsonResponse({ access_token });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
