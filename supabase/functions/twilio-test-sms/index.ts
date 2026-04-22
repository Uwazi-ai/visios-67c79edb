// Sends a test SMS using Twilio credentials supplied in the request body.
// On success, persists the credentials + phone to the caller's profile under notification_prefs.twilio.
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
    const account_sid = String(body.account_sid ?? "").trim();
    const auth_token = String(body.auth_token ?? "").trim();
    const from_number = String(body.from_number ?? "").trim();
    const to_number = String(body.to_number ?? "").trim();

    if (!account_sid.startsWith("AC") || account_sid.length < 10)
      return json(400, { error: "Invalid Account SID" });
    if (auth_token.length < 16) return json(400, { error: "Invalid Auth Token" });
    if (!/^\+\d{8,15}$/.test(from_number))
      return json(400, { error: "From number must be E.164 (e.g. +14155551234)" });
    if (!/^\+\d{8,15}$/.test(to_number))
      return json(400, { error: "Test number must be E.164 on your profile (e.g. +14155551234)" });

    const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
    const basic = btoa(`${account_sid}:${auth_token}`);
    const params = new URLSearchParams({
      To: to_number,
      From: from_number,
      Body: "Visi OS test message ✓",
    });

    const tw = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await tw.json();
    if (!tw.ok) {
      return json(400, {
        error: data?.message || `Twilio error ${tw.status}`,
        twilio_code: data?.code,
      });
    }

    // Persist to profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", user.id)
      .maybeSingle();
    const prev = (prof?.notification_prefs ?? {}) as Record<string, unknown>;
    const next = {
      ...prev,
      twilio: {
        account_sid,
        auth_token,
        from_number,
        active: true,
        last_test_at: new Date().toISOString(),
      },
      phone: to_number,
    };
    await supabase.from("profiles").update({ notification_prefs: next }).eq("id", user.id);

    return json(200, { ok: true, sid: data?.sid });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
