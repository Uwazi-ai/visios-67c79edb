// Verify an Anthropic API key by calling /v1/messages with a tiny prompt.
// On success, persists key to profiles.ai_prefs.anthropic_key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json(401, { error: "Missing Authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const api_key = String(body.api_key ?? "").trim();
    if (!api_key.startsWith("sk-ant-") || api_key.length < 20)
      return json(400, { error: "Key must start with sk-ant-" });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json(400, {
        error: data?.error?.message || `Anthropic error ${r.status}`,
      });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("ai_prefs")
      .eq("id", user.id)
      .maybeSingle();
    const prev = (prof?.ai_prefs ?? {}) as Record<string, unknown>;
    const next = {
      ...prev,
      anthropic_key: api_key,
      anthropic_verified_at: new Date().toISOString(),
    };
    await supabase.from("profiles").update({ ai_prefs: next }).eq("id", user.id);

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
