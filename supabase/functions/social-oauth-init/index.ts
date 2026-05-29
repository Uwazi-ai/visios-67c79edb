// Builds OAuth authorization URLs per platform and returns them to the client,
// which opens them in a popup. Credentials are pulled from visi_settings so that
// Myke can manage them in the UI (Settings → Connections → API Credentials).
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

const REDIRECT_PATH = "/oauth-callback";

type Platform = "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube";

interface InitBody {
  platform: Platform;
  brand?: string;
  redirect_base?: string; // VisiOS app origin to redirect back to
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

function buildAuthUrl(
  platform: Platform,
  creds: Record<string, string>,
  redirectUri: string,
  state: string,
): { url: string; error?: string } {
  if (platform === "instagram") {
    const id = creds.meta_app_id;
    if (!id) return { url: "", error: "Meta App ID is not configured. Set it in Social Settings → API Credentials." };
    const scope = [
      "instagram_business_basic",
      "instagram_business_content_publish",
      "instagram_business_manage_comments",
      "instagram_business_manage_insights",
    ].join(",");
    const u = new URL("https://api.instagram.com/oauth/authorize");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", scope);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    return { url: u.toString() };
  }
  if (platform === "facebook") {
    const id = creds.meta_app_id;
    if (!id) return { url: "", error: "Meta App ID is not configured. Set it in Social Settings → API Credentials." };
    const scope = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_engagement",
    ].join(",");
    const u = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", scope);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    return { url: u.toString() };
  }
  if (platform === "tiktok") {
    const key = creds.tiktok_client_key;
    if (!key) return { url: "", error: "TikTok Client Key is not configured. Set it in Social Settings → API Credentials." };
    const scope = ["user.info.basic", "video.publish", "video.list"].join(",");
    const u = new URL("https://www.tiktok.com/v2/auth/authorize");
    u.searchParams.set("client_key", key);
    u.searchParams.set("scope", scope);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    return { url: u.toString() };
  }
  if (platform === "linkedin") {
    const id = creds.linkedin_client_id;
    if (!id) return { url: "", error: "LinkedIn Client ID is not configured. Set it in Social Settings → API Credentials." };
    const scope = [
      "r_liteprofile",
      "r_emailaddress",
      "w_member_social",
      "r_organization_social",
      "w_organization_social",
    ].join(" ");
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", scope);
    u.searchParams.set("state", state);
    return { url: u.toString() };
  }
  if (platform === "youtube") {
    const id = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!id) return { url: "", error: "GOOGLE_CLIENT_ID not configured" };
    const scope = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ].join(" ");
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", scope);
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("include_granted_scopes", "true");
    u.searchParams.set("state", state);
    return { url: u.toString() };
  }
  return { url: "", error: `Unsupported platform: ${platform}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as InitBody;
    const platform = body.platform;
    const brand = body.brand || "";
    const base = (body.redirect_base || "").replace(/\/$/, "");
    if (!platform || !base) {
      return jsonResponse({ error: "platform and redirect_base required" }, 400);
    }

    const creds = await loadCreds();
    const redirectUri = `${base}${REDIRECT_PATH}/${platform}`;
    // state ties the callback back to this user + brand. Random nonce + user id.
    const nonce = crypto.randomUUID();
    const state = `${user.id}:${brand}:${nonce}`;

    const { url, error } = buildAuthUrl(platform, creds, redirectUri, state);
    if (error) return jsonResponse({ error }, 400);

    return jsonResponse({ url, state, redirect_uri: redirectUri });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
