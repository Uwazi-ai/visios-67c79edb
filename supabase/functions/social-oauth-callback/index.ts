// Exchanges an OAuth `code` for tokens, fetches the account profile, and stores
// the result in social_platform_tokens. Called from the public /oauth-callback
// page in the VisiOS popup, which forwards `code`, `platform`, and `redirect_uri`.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

type Platform = "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube";

interface CallbackBody {
  platform: Platform;
  code: string;
  state: string;
  redirect_uri: string;
}

async function loadCreds(): Promise<Record<string, string>> {
  const admin = adminClient();
  const { data } = await admin
    .from("visi_settings")
    .select("key,value")
    .in("key", [
      "meta_app_id",
      "meta_app_secret",
      "tiktok_client_key",
      "tiktok_client_secret",
      "linkedin_client_id",
      "linkedin_client_secret",
    ]);
  return Object.fromEntries((data || []).map((r: any) => [r.key, r.value || ""]));
}

async function exchangeInstagram(creds: Record<string, string>, code: string, redirect_uri: string) {
  // Short-lived token
  const fd = new FormData();
  fd.set("client_id", creds.meta_app_id);
  fd.set("client_secret", creds.meta_app_secret);
  fd.set("grant_type", "authorization_code");
  fd.set("redirect_uri", redirect_uri);
  fd.set("code", code);
  const tr = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: fd });
  if (!tr.ok) throw new Error(`Instagram token exchange failed: ${await tr.text()}`);
  const short = await tr.json();
  // Long-lived (60 days)
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", creds.meta_app_secret);
  longUrl.searchParams.set("access_token", short.access_token);
  const lr = await fetch(longUrl);
  const long = lr.ok ? await lr.json() : { access_token: short.access_token, expires_in: 3600 };
  // Profile
  const pr = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${long.access_token}`,
  );
  const profile = pr.ok ? await pr.json() : { id: short.user_id, username: "" };
  return {
    access_token: long.access_token,
    refresh_token: null as string | null,
    expires_in: long.expires_in ?? 60 * 24 * 3600,
    account_id: String(profile.id ?? short.user_id ?? ""),
    account_username: profile.username ?? null,
    account_name: profile.username ?? null,
    account_avatar_url: null as string | null,
    account_type: profile.account_type ?? null,
  };
}

async function exchangeFacebook(creds: Record<string, string>, code: string, redirect_uri: string) {
  const u = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  u.searchParams.set("client_id", creds.meta_app_id);
  u.searchParams.set("client_secret", creds.meta_app_secret);
  u.searchParams.set("redirect_uri", redirect_uri);
  u.searchParams.set("code", code);
  const tr = await fetch(u);
  if (!tr.ok) throw new Error(`Facebook token exchange failed: ${await tr.text()}`);
  const tok = await tr.json();
  // Get pages; default to first page (UI can later show a picker)
  const pr = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${tok.access_token}`,
  );
  const pages = pr.ok ? await pr.json() : { data: [] };
  const page = (pages.data || [])[0] ?? null;
  return {
    access_token: page?.access_token ?? tok.access_token,
    refresh_token: null as string | null,
    expires_in: tok.expires_in ?? 60 * 24 * 3600,
    account_id: page?.id ?? "",
    account_username: page?.name ?? null,
    account_name: page?.name ?? null,
    account_avatar_url: null as string | null,
    account_type: page ? "page" : "user",
  };
}

async function exchangeTikTok(creds: Record<string, string>, code: string, redirect_uri: string) {
  const fd = new URLSearchParams();
  fd.set("client_key", creds.tiktok_client_key);
  fd.set("client_secret", creds.tiktok_client_secret);
  fd.set("code", code);
  fd.set("grant_type", "authorization_code");
  fd.set("redirect_uri", redirect_uri);
  const tr = await fetch("https://open.tiktok.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fd.toString(),
  });
  if (!tr.ok) throw new Error(`TikTok token exchange failed: ${await tr.text()}`);
  const tok = await tr.json();
  const pr = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name",
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  const profile = pr.ok ? (await pr.json()).data?.user ?? {} : {};
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    expires_in: tok.expires_in ?? 24 * 3600,
    account_id: profile.open_id ?? tok.open_id ?? "",
    account_username: profile.display_name ?? null,
    account_name: profile.display_name ?? null,
    account_avatar_url: profile.avatar_url ?? null,
    account_type: "user",
  };
}

async function exchangeLinkedIn(creds: Record<string, string>, code: string, redirect_uri: string) {
  const fd = new URLSearchParams();
  fd.set("grant_type", "authorization_code");
  fd.set("code", code);
  fd.set("redirect_uri", redirect_uri);
  fd.set("client_id", creds.linkedin_client_id);
  fd.set("client_secret", creds.linkedin_client_secret);
  const tr = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fd.toString(),
  });
  if (!tr.ok) throw new Error(`LinkedIn token exchange failed: ${await tr.text()}`);
  const tok = await tr.json();
  const pr = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const profile = pr.ok ? await pr.json() : {};
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    expires_in: tok.expires_in ?? 60 * 24 * 3600,
    account_id: profile.sub ?? "",
    account_username: profile.email ?? profile.name ?? null,
    account_name: profile.name ?? null,
    account_avatar_url: profile.picture ?? null,
    account_type: "person",
  };
}

async function exchangeYouTube(_creds: Record<string, string>, code: string, redirect_uri: string) {
  const id = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const secret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const fd = new URLSearchParams();
  fd.set("code", code);
  fd.set("client_id", id);
  fd.set("client_secret", secret);
  fd.set("redirect_uri", redirect_uri);
  fd.set("grant_type", "authorization_code");
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: fd.toString(),
  });
  if (!tr.ok) throw new Error(`YouTube token exchange failed: ${await tr.text()}`);
  const tok = await tr.json();
  const pr = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  const channels = pr.ok ? await pr.json() : { items: [] };
  const ch = channels.items?.[0];
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? null,
    expires_in: tok.expires_in ?? 3600,
    account_id: ch?.id ?? "",
    account_username: ch?.snippet?.customUrl ?? null,
    account_name: ch?.snippet?.title ?? null,
    account_avatar_url: ch?.snippet?.thumbnails?.default?.url ?? null,
    account_type: "channel",
    follower_count: Number(ch?.statistics?.subscriberCount ?? 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { platform, code, state, redirect_uri } = (await req.json()) as CallbackBody;
    if (!platform || !code || !redirect_uri) {
      return jsonResponse({ error: "platform, code, and redirect_uri required" }, 400);
    }

    // Validate state encodes the same user
    const [stateUserId, brand] = (state || "").split(":");
    if (stateUserId && stateUserId !== user.id) {
      return jsonResponse({ error: "OAuth state user mismatch" }, 400);
    }

    const creds = await loadCreds();
    let result;
    switch (platform) {
      case "instagram": result = await exchangeInstagram(creds, code, redirect_uri); break;
      case "facebook":  result = await exchangeFacebook(creds, code, redirect_uri); break;
      case "tiktok":    result = await exchangeTikTok(creds, code, redirect_uri); break;
      case "linkedin":  result = await exchangeLinkedIn(creds, code, redirect_uri); break;
      case "youtube":   result = await exchangeYouTube(creds, code, redirect_uri); break;
      default: return jsonResponse({ error: `Unsupported platform: ${platform}` }, 400);
    }

    const admin = adminClient();
    const expires_at = result.expires_in
      ? new Date(Date.now() + result.expires_in * 1000).toISOString()
      : null;

    const row = {
      user_id: user.id,
      platform,
      account_id: result.account_id || null,
      account_name: result.account_name,
      account_username: result.account_username,
      account_avatar_url: result.account_avatar_url,
      account_type: result.account_type,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      token_expires_at: expires_at,
      brand: brand || null,
      is_active: true,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await admin
      .from("social_platform_tokens")
      .upsert(row, { onConflict: "user_id,platform,account_id" });
    if (upErr) throw new Error(upErr.message);

    // Also keep social_integrations in sync for legacy UI
    await admin.from("social_integrations").upsert(
      {
        user_id: user.id,
        platform,
        status: "connected",
        connected_at: new Date().toISOString(),
        display_name: result.account_name,
        username: result.account_username,
        avatar_url: result.account_avatar_url,
        follower_count: (result as any).follower_count ?? null,
        token_expires_at: expires_at,
      },
      { onConflict: "user_id,platform" },
    );

    return jsonResponse({
      success: true,
      account: {
        platform,
        name: result.account_name,
        username: result.account_username,
        avatar_url: result.account_avatar_url,
      },
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
