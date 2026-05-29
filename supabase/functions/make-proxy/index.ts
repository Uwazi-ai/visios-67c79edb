// Proxy to Make.com REST API. Reads make_api_key + make_region from visi_settings.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { path, method = "GET", query, body: upstreamBody } = body as {
      path: string;
      method?: string;
      query?: Record<string, string | number | undefined>;
      body?: unknown;
    };

    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      return jsonResponse({ error: "path required (e.g. /scenarios)" }, 400);
    }

    const admin = adminClient();
    const { data: settings } = await admin
      .from("visi_settings")
      .select("key,value")
      .in("key", ["make_api_key", "make_region", "make_team_id"]);
    const map = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value || ""]));
    const apiKey = map.make_api_key;
    const region = map.make_region || "us1";
    const teamId = map.make_team_id;

    if (!apiKey) {
      return jsonResponse({ error: "No Make.com API key set. Connect in Settings → Agents." }, 400);
    }

    const params = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      }
    }
    // Most Make endpoints require teamId for list operations
    if (teamId && !params.has("teamId") && (path === "/scenarios" || path.startsWith("/scenarios?"))) {
      params.set("teamId", teamId);
    }
    const qs = params.toString();
    const url = `https://${region}.make.com/api/v2${path}${qs ? `?${qs}` : ""}`;

    const upstream = await fetch(url, {
      method,
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: upstreamBody && method !== "GET" ? JSON.stringify(upstreamBody) : undefined,
    });

    const text = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify({ status: upstream.status, ok: upstream.ok, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
