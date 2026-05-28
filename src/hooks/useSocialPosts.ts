import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BrandKey, PostStatus, SocialPlatform } from "@/components/social/shared";

export interface SocialPost {
  id: string;
  brand: string;
  platform: string;
  format: string | null;
  content_pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  script_outline: any | null;
  media_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  assigned_to: string | null;
  status: PostStatus;
  ai_generated: boolean;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSocialPosts(brand: BrandKey) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("social_posts")
      .select("*")
      .eq("brand", brand)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (!error && data) setPosts(data as any);
    setLoading(false);
  }, [brand]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel(`social_posts_${brand}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_posts" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [brand, refresh]);

  const createPost = useCallback(async (p: Partial<SocialPost>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("social_posts")
      .insert({
        brand,
        platform: p.platform || "instagram",
        content_pillar: p.content_pillar,
        hook: p.hook,
        caption: p.caption,
        hashtags: (p.hashtags as any) ?? [],
        script_outline: p.script_outline,
        scheduled_at: p.scheduled_at,
        assigned_to: p.assigned_to,
        status: (p.status as any) ?? "draft",
        ai_generated: p.ai_generated ?? false,
        media_url: p.media_url,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await refresh();
    return data as any as SocialPost;
  }, [brand, refresh]);

  const updatePost = useCallback(async (id: string, patch: Partial<SocialPost>) => {
    const { error } = await supabase.from("social_posts").update(patch as any).eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const deletePost = useCallback(async (id: string) => {
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { posts, loading, refresh, createPost, updatePost, deletePost };
}

export async function generateSocialContent(args: {
  brand: BrandKey;
  brandLabel: string;
  platform: SocialPlatform;
  pillar: string;
  voiceNotes: string;
  brief: string;
}) {
  const system = `You are the social media strategist for Myke Shaw's brand ecosystem.

ACTIVE BRAND: ${args.brandLabel}
ACTIVE PLATFORM: ${args.platform}
CONTENT PILLAR: ${args.pillar}

BRAND VOICE: ${args.voiceNotes}

OUTPUT FORMAT — return STRICT JSON only (no prose, no markdown fences) with exactly these keys:
{
  "hooks": [
    {"type": "urgency", "text": "..."},
    {"type": "disruption", "text": "..."},
    {"type": "community", "text": "..."}
  ],
  "caption": "full caption with CTA",
  "hashtags": ["tag1", "tag2", "tag3"],
  "script_outline": {
    "hook": "spoken hook line (0-3s)",
    "setup": "setup line (3-15s)",
    "content": "main content (15-45s)",
    "cta": "call to action (45s+)"
  }
}

script_outline is only needed for TikTok and Instagram Reels — return null for other platforms.
Never use: "In today's world", "In today's fast-paced", or any generic AI filler.
Always start with the hook. Every caption needs one clear CTA.`;

  const { data, error } = await supabase.functions.invoke("claude-proxy", {
    body: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: args.brief }],
    },
  });
  if (error) throw error;

  const text =
    data?.content?.[0]?.text ??
    data?.content?.[0]?.input ??
    (typeof data === "string" ? data : "");
  const jsonText = extractJson(String(text));
  try {
    return { parsed: JSON.parse(jsonText), raw: text };
  } catch {
    return { parsed: null, raw: text };
  }
}

export async function analyzeSocialMetrics(args: {
  brand: string;
  platform: string;
  input: string;
}) {
  const system = `You are analyzing social media performance for ${args.brand} on ${args.platform}.

Interpret the provided metrics and return STRICT JSON only:
{
  "summary": "2-sentence narrative",
  "top_performers": [{"type": "...", "metric": "...", "why": "..."}],
  "low_performers": [{"type": "...", "metric": "...", "fix": "..."}],
  "recommendations": ["specific action 1", "specific action 2", "specific action 3"],
  "retire": ["format or topic to stop"],
  "expand": ["format or topic to increase"]
}

Be specific. Reference actual numbers. Never say "consider" — say "do this."`;

  const { data, error } = await supabase.functions.invoke("claude-proxy", {
    body: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: args.input }],
    },
  });
  if (error) throw error;
  const text = data?.content?.[0]?.text ?? "";
  const jsonText = extractJson(String(text));
  try { return { parsed: JSON.parse(jsonText), raw: text }; } catch { return { parsed: null, raw: text }; }
}

export async function generate90DayStrategy(args: { brand: string; voiceNotes: string; pillars: string[] }) {
  const system = `You are creating a 90-day social strategy for ${args.brand}.

VOICE: ${args.voiceNotes}
PILLARS: ${args.pillars.join(", ")}

Return a clear, actionable 90-day strategy as markdown with these sections:
1. Platform focus (which platforms, why, what %)
2. Content calendar skeleton (week-by-week themes for 12 weeks)
3. Growth goals (specific numbers per platform)
4. Key dates and tentpole moments
5. KPIs to track weekly

Be specific. No generic advice. Reference the pillars by name.`;

  const { data, error } = await supabase.functions.invoke("claude-proxy", {
    body: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: `Generate the 90-day strategy now.` }],
    },
  });
  if (error) throw error;
  return data?.content?.[0]?.text ?? "";
}

function extractJson(s: string): string {
  // Strip markdown fences if present, then take from first { to last }
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body;
}
