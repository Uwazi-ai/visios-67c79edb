// Publishes a social_posts row via the connected platform's API.
// Looks up the token from social_platform_tokens for the authed user + platform.
import { corsHeaders, jsonResponse, getAuthedUserFromReq, adminClient } from "../_shared/google.ts";

interface PostBody {
  post_id: string;
  platform: "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube";
  caption: string;
  media_urls?: string[];
  hashtags?: string[];
}

async function publishFacebook(token: any, caption: string, media: string[]): Promise<string> {
  const pageId = token.account_id;
  const url = `https://graph.facebook.com/v18.0/${pageId}/${media[0] ? "photos" : "feed"}`;
  const params = new URLSearchParams();
  params.set("access_token", token.access_token);
  params.set("message", caption);
  if (media[0]) params.set("url", media[0]);
  const r = await fetch(url, { method: "POST", body: params });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "Facebook post failed");
  return j.id || j.post_id || "";
}

async function publishInstagram(token: any, caption: string, media: string[]): Promise<string> {
  if (!media[0]) throw new Error("Instagram requires at least one image or video URL.");
  const igUserId = token.account_id;
  const containerUrl = new URL(`https://graph.instagram.com/${igUserId}/media`);
  containerUrl.searchParams.set("image_url", media[0]);
  containerUrl.searchParams.set("caption", caption);
  containerUrl.searchParams.set("access_token", token.access_token);
  const cr = await fetch(containerUrl, { method: "POST" });
  const cj = await cr.json();
  if (!cr.ok) throw new Error(cj?.error?.message || "Instagram container failed");
  const pubUrl = new URL(`https://graph.instagram.com/${igUserId}/media_publish`);
  pubUrl.searchParams.set("creation_id", cj.id);
  pubUrl.searchParams.set("access_token", token.access_token);
  const pr = await fetch(pubUrl, { method: "POST" });
  const pj = await pr.json();
  if (!pr.ok) throw new Error(pj?.error?.message || "Instagram publish failed");
  return pj.id;
}

async function publishLinkedIn(token: any, caption: string): Promise<string> {
  const author = `urn:li:person:${token.account_id}`;
  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: caption },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || "LinkedIn post failed");
  return j.id || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUserFromReq(req);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { post_id, platform, caption, media_urls = [], hashtags = [] } = (await req.json()) as PostBody;
    if (!post_id || !platform) return jsonResponse({ error: "post_id and platform required" }, 400);

    const admin = adminClient();
    const { data: tok } = await admin
      .from("social_platform_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("is_active", true)
      .maybeSingle();
    if (!tok) return jsonResponse({ error: `${platform} is not connected. Connect it in Social Settings.` }, 400);

    const fullCaption = hashtags.length
      ? `${caption}\n\n${hashtags.map((h) => "#" + h.replace(/^#/, "")).join(" ")}`
      : caption;

    let externalId = "";
    try {
      switch (platform) {
        case "facebook":  externalId = await publishFacebook(tok, fullCaption, media_urls); break;
        case "instagram": externalId = await publishInstagram(tok, fullCaption, media_urls); break;
        case "linkedin":  externalId = await publishLinkedIn(tok, fullCaption); break;
        case "tiktok":
        case "youtube":
          throw new Error(`${platform} publishing requires media upload — coming next.`);
      }
    } catch (publishErr) {
      const msg = publishErr instanceof Error ? publishErr.message : String(publishErr);
      await admin.from("social_posts").update({
        status: "failed",
        error_message: msg,
      }).eq("id", post_id);
      return jsonResponse({ success: false, error: msg }, 200);
    }

    await admin.from("social_posts").update({
      status: "published",
      published_at: new Date().toISOString(),
      external_post_id: externalId,
      error_message: null,
    }).eq("id", post_id);

    await admin.from("social_platform_tokens").update({
      last_used_at: new Date().toISOString(),
    }).eq("id", tok.id);

    return jsonResponse({ success: true, external_post_id: externalId });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
