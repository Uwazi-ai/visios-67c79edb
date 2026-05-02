import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { query, org_id, limit } = await req.json();
    if (!query || typeof query !== "string") return jsonResponse({ error: "query required" }, 400);
    const admin = adminClient();
    const { data, error } = await admin.rpc("search_kb_text", {
      query_text: query,
      org_filter: org_id ?? null,
      user_filter: user.id,
      match_count: limit ?? 5,
    });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ hits: data ?? [] });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
