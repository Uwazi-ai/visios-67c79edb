import { useEffect, useMemo, useState } from "react";
import { Edit3, Calendar as CalIcon, Send, BarChart3, Lightbulb, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BRANDS, BRAND_ORDER, TEAM, loadActiveBrand, saveActiveBrand, type BrandKey,
} from "@/components/social/shared";
import { useSocialPosts, type SocialPost } from "@/hooks/useSocialPosts";
import { ComposeView } from "@/components/social/ComposeView";
import { CalendarView } from "@/components/social/CalendarView";
import { PostsView } from "@/components/social/PostsView";
import { AnalyticsView } from "@/components/social/AnalyticsView";
import { StrategyView } from "@/components/social/StrategyView";
import { SettingsView } from "@/components/social/SettingsView";
import { PostQueue } from "@/components/social/PostQueue";
import { PostDetailDrawer } from "@/components/social/PostDetailDrawer";
import { supabase } from "@/integrations/supabase/client";

type SocialTab = "compose" | "calendar" | "posts" | "analytics" | "strategy" | "settings";

const TABS: { key: SocialTab; label: string; Icon: any }[] = [
  { key: "compose", label: "Compose", Icon: Edit3 },
  { key: "calendar", label: "Calendar", Icon: CalIcon },
  { key: "posts", label: "Posts", Icon: Send },
  { key: "analytics", label: "Analytics", Icon: BarChart3 },
  { key: "strategy", label: "Strategy", Icon: Lightbulb },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function Social() {
  const [brand, setBrand] = useState<BrandKey>(loadActiveBrand());
  const [tab, setTab] = useState<SocialTab>("compose");
  const [composeInitial, setComposeInitial] = useState<SocialPost | null>(null);
  const [drawerPost, setDrawerPost] = useState<SocialPost | null>(null);
  const [voiceNotes, setVoiceNotes] = useState<string>("");
  const { posts, createPost, updatePost, deletePost } = useSocialPosts(brand);
  const navigate = useNavigate();

  useEffect(() => { saveActiveBrand(brand); }, [brand]);

  useEffect(() => {
    const handler = () => setTab("settings");
    window.addEventListener("visios:social:goto-settings", handler);
    return () => window.removeEventListener("visios:social:goto-settings", handler);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("social_ai_prompts").select("voice_notes").eq("brand", brand).maybeSingle();
      setVoiceNotes((data as any)?.voice_notes || "");
    })();
  }, [brand]);

  const cfg = BRANDS[brand];

  const openInCompose = (p: SocialPost) => {
    setComposeInitial(p);
    setTab("compose");
    setDrawerPost(null);
  };

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border-glass)", background: "rgba(2,2,10,0.6)" }}>
        <div className="t-section" style={{ fontSize: 18 }}>Social</div>

        <div className="flex items-center gap-2 mx-auto">
          {BRAND_ORDER.map((b) => {
            const c = BRANDS[b];
            const active = brand === b;
            return (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className="px-4 py-1.5 rounded-full transition"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  border: `1px solid ${active ? c.color : "var(--border-glass)"}`,
                  background: active ? `${c.color}1A` : "transparent",
                  color: active ? c.color : "var(--text-secondary)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center -space-x-1.5">
          {TEAM.map((t) => (
            <div
              key={t.initials}
              title={`${t.name} — ${t.role}`}
              style={{
                width: 28, height: 28, borderRadius: 99,
                background: t.color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                border: "2px solid rgba(2,2,10,0.9)",
              }}
            >{t.initials}</div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav
          className="hidden md:flex flex-col"
          style={{
            width: 140, minWidth: 140,
            borderRight: "1px solid var(--border-glass)",
            background: "rgba(2,2,10,0.5)",
            padding: "12px 8px",
          }}
        >
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { setTab(key); if (key !== "compose") setComposeInitial(null); }}
                className="flex items-center gap-2 rounded-md px-3 py-2 mb-0.5 text-left transition"
                style={{
                  fontSize: 12,
                  background: active ? "var(--bg-glass-2)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon size={14} strokeWidth={1.5} />
                {label}
              </button>
            );
          })}

          <div className="mt-auto px-3 py-3" style={{ borderTop: "1px solid var(--border-glass)" }}>
            <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>AI Skill</div>
            <div className="flex items-center gap-2 mt-1">
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22C55E", boxShadow: "0 0 8px #22C55E" }} className="animate-pulse" />
              <span style={{ fontSize: 11, color: "var(--text-primary)" }}>Active</span>
            </div>
          </div>
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden absolute top-[64px] left-0 right-0 z-10 flex overflow-x-auto px-2 py-1.5" style={{ background: "rgba(2,2,10,0.85)", borderBottom: "1px solid var(--border-glass)" }}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key !== "compose") setComposeInitial(null); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md mr-1 whitespace-nowrap"
              style={{
                fontSize: 11,
                background: tab === key ? "var(--bg-glass-2)" : "transparent",
                color: tab === key ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {/* Main view */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {tab === "compose" && (
              <ComposeView
                brand={brand}
                voiceNotes={voiceNotes}
                onCreate={createPost}
                onUpdate={updatePost}
                initial={composeInitial}
                onClearInitial={() => setComposeInitial(null)}
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                brand={brand}
                posts={posts}
                onOpenPost={setDrawerPost}
                onComposeAt={(d) => {
                  setComposeInitial({ ...(({} as any)), scheduled_at: d.toISOString() } as any);
                  setTab("compose");
                }}
              />
            )}
            {tab === "posts" && (
              <PostsView
                brand={brand}
                posts={posts}
                onOpenPost={setDrawerPost}
                onUpdate={updatePost}
                onDelete={deletePost}
                onCreate={createPost}
              />
            )}
            {tab === "analytics" && <AnalyticsView brand={brand} />}
            {tab === "strategy" && <StrategyView />}
            {tab === "settings" && <SettingsView />}
          </div>

          {tab !== "settings" && tab !== "strategy" && (
            <PostQueue
              brand={brand}
              posts={posts}
              onOpen={(p) => openInCompose(p)}
              onGotoCalendar={() => setTab("calendar")}
            />
          )}
        </div>
      </div>

      {drawerPost && (
        <PostDetailDrawer
          post={drawerPost}
          onClose={() => setDrawerPost(null)}
          onEdit={openInCompose}
          onDuplicate={async (p) => {
            await createPost({
              platform: p.platform, content_pillar: p.content_pillar,
              hook: p.hook, caption: p.caption, hashtags: p.hashtags,
              script_outline: p.script_outline, status: "draft",
            });
            setDrawerPost(null);
          }}
          onStatusChange={async (id, status) => { await updatePost(id, { status }); }}
        />
      )}
    </div>
  );
}
