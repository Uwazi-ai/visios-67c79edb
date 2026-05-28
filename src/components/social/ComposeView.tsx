import { useEffect, useMemo, useState } from "react";
import { Sparkles, Upload, X, Plus, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import {
  BRANDS, PLATFORMS, PLATFORM_LIMIT, type BrandKey, type SocialPlatform, ASSIGNEES,
} from "./shared";
import { generateSocialContent, type SocialPost } from "@/hooks/useSocialPosts";
import { toast } from "sonner";

interface Hook { type: string; text: string; }

export function ComposeView({
  brand,
  voiceNotes,
  onCreate,
  onUpdate,
  initial,
  onClearInitial,
}: {
  brand: BrandKey;
  voiceNotes: string;
  onCreate: (p: Partial<SocialPost>) => Promise<SocialPost>;
  onUpdate: (id: string, p: Partial<SocialPost>) => Promise<void>;
  initial?: SocialPost | null;
  onClearInitial?: () => void;
}) {
  const cfg = BRANDS[brand];
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [pillar, setPillar] = useState(cfg.pillars[0]);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [selectedHookIdx, setSelectedHookIdx] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [scriptOutline, setScriptOutline] = useState<any | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("Anna");
  const [newTag, setNewTag] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset pillar when brand changes
  useEffect(() => { setPillar(cfg.pillars[0]); }, [brand, cfg.pillars]);

  // Load from initial
  useEffect(() => {
    if (!initial) return;
    setEditingId(initial.id);
    setPlatform((initial.platform as SocialPlatform) || "instagram");
    setPillar(initial.content_pillar || cfg.pillars[0]);
    setCaption(initial.caption || "");
    setHashtags(Array.isArray(initial.hashtags) ? initial.hashtags : []);
    setScriptOutline(initial.script_outline ?? null);
    setShowBuilder(true);
    setHooks(initial.hook ? [{ type: "saved", text: initial.hook }] : null);
    setSelectedHookIdx(initial.hook ? 0 : null);
    setScheduledAt(initial.scheduled_at ? toLocalInput(initial.scheduled_at) : "");
    setAssignedTo(initial.assigned_to || "Anna");
  }, [initial, cfg.pillars]);

  const limit = PLATFORM_LIMIT(platform);
  const len = caption.length;
  const pct = len / limit;
  const counterColor =
    pct >= 1 ? "#EF4444" : pct >= 0.8 ? "#F59E0B" : "var(--text-muted)";

  const generate = async () => {
    if (!brief.trim()) { toast.error("Add a brief first"); return; }
    setLoading(true);
    setHooks(null); setSelectedHookIdx(null);
    try {
      const { parsed, raw } = await generateSocialContent({
        brand, brandLabel: cfg.label, platform, pillar, voiceNotes, brief,
      });
      if (parsed?.hooks) {
        setHooks(parsed.hooks);
        setCaption(parsed.caption || "");
        setHashtags(parsed.hashtags || []);
        setScriptOutline(parsed.script_outline ?? null);
      } else {
        setCaption(String(raw || ""));
        toast.warning("AI output couldn't be parsed — raw text loaded");
      }
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setEditingId(null);
    setBrief(""); setHooks(null); setSelectedHookIdx(null);
    setCaption(""); setHashtags([]); setScriptOutline(null);
    setShowBuilder(false); setScheduledAt(""); setAssignedTo("Anna");
    onClearInitial?.();
  };

  const save = async (status: "draft" | "scheduled") => {
    try {
      const payload: Partial<SocialPost> = {
        platform,
        content_pillar: pillar,
        hook: selectedHookIdx !== null && hooks ? hooks[selectedHookIdx].text : null,
        caption,
        hashtags,
        script_outline: scriptOutline,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        assigned_to: assignedTo,
        status,
        ai_generated: !!hooks,
      };
      if (editingId) {
        await onUpdate(editingId, payload);
        toast.success("Post updated");
      } else {
        await onCreate(payload);
        toast.success("Saved to queue");
      }
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  };

  const showScriptOutline = platform === "tiktok" || platform === "instagram";

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        background: cfg.tintRgba,
        transition: "background-color 150ms ease",
      }}
    >
      <div className="max-w-3xl mx-auto p-5 space-y-5">
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--bg-glass-1)" }}>
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPlatform(p.key)}
                className="px-3 py-1.5 rounded-md transition"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  background: platform === p.key ? "var(--bg-glass-3)" : "transparent",
                  color: platform === p.key ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <select
            value={pillar}
            onChange={(e) => setPillar(e.target.value)}
            className="input-glass"
            style={{ minWidth: 200 }}
          >
            {cfg.pillars.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {editingId && (
            <button onClick={reset} className="btn-ghost ml-auto" style={{ fontSize: 11 }}>
              <X size={12} /> Cancel edit
            </button>
          )}
        </div>

        {/* AI brief */}
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} style={{ color: cfg.color }} />
            <span className="t-mono uppercase" style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
              AI Brief
            </span>
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={5}
            placeholder="Describe what you want to create — topic, angle, tone, any assets or context..."
            className="input-glass w-full"
            style={{ resize: "vertical", minHeight: 100 }}
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={generate}
              disabled={loading}
              className="btn-primary"
              style={{ background: cfg.color, color: "#000" }}
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Sparkles size={14} /> Generate →</>}
            </button>
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass p-4 rounded-xl animate-pulse" style={{ height: 80 }} />
            ))}
          </div>
        )}

        {/* Generated hooks */}
        {!loading && hooks && (
          <div className="space-y-3">
            <div className="t-mono uppercase" style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
              Generated hooks
            </div>
            {hooks.map((h, i) => (
              <div
                key={i}
                className="glass p-4 rounded-xl"
                style={{
                  border: selectedHookIdx === i ? `1px solid ${cfg.color}` : "1px solid var(--border-glass)",
                  background: selectedHookIdx === i ? cfg.tintRgba : "var(--bg-glass-1)",
                }}
              >
                <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: cfg.color, letterSpacing: "0.1em" }}>
                  {h.type}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }} className="mb-3">
                  {h.text}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedHookIdx(i)}
                    className="btn-ghost"
                    style={{ fontSize: 11 }}
                  >
                    {selectedHookIdx === i ? "✓ Selected" : "Use this"}
                  </button>
                  <button
                    onClick={() => { setSelectedHookIdx(i); setShowBuilder(true); }}
                    className="btn-ghost"
                    style={{ fontSize: 11 }}
                  >
                    Build caption →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Caption builder */}
        {showBuilder && (
          <div className="glass p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="t-mono uppercase" style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
                Caption
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: counterColor }}>
                {len} / {limit}
              </div>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              className="input-glass w-full"
              style={{ resize: "vertical", minHeight: 140, fontSize: 13 }}
            />

            {/* Hashtags */}
            <div>
              <div className="t-mono uppercase mb-2" style={{ fontSize: 10, color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
                Hashtags
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {hashtags.map((t, i) => (
                  <span key={i} className="badge flex items-center gap-1" style={{ fontSize: 11 }}>
                    #{t.replace(/^#/, "")}
                    <button onClick={() => setHashtags(hashtags.filter((_, j) => j !== i))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTag.trim()) {
                        setHashtags([...hashtags, newTag.replace(/^#/, "").trim()]);
                        setNewTag("");
                      }
                    }}
                    placeholder="add tag"
                    className="input-glass"
                    style={{ width: 100, fontSize: 11, padding: "2px 6px" }}
                  />
                  <button
                    onClick={() => { if (newTag.trim()) { setHashtags([...hashtags, newTag.replace(/^#/, "").trim()]); setNewTag(""); } }}
                    className="btn-icon"
                    style={{ width: 22, height: 22 }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Script outline */}
            {showScriptOutline && scriptOutline && (
              <div className="rounded-lg" style={{ border: "1px solid var(--border-glass)" }}>
                <button
                  onClick={() => setScriptOpen(!scriptOpen)}
                  className="w-full flex items-center gap-2 px-3 py-2"
                  style={{ fontSize: 12 }}
                >
                  {scriptOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="t-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
                    Script Outline
                  </span>
                </button>
                {scriptOpen && (
                  <div className="px-4 pb-3 space-y-2 t-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <div><b style={{ color: cfg.color }}>HOOK (0:00–0:03):</b> {scriptOutline.hook}</div>
                    <div><b style={{ color: cfg.color }}>SETUP (0:03–0:15):</b> {scriptOutline.setup}</div>
                    <div><b style={{ color: cfg.color }}>CONTENT (0:15–0:45):</b> {scriptOutline.content}</div>
                    <div><b style={{ color: cfg.color }}>CTA (0:45–end):</b> {scriptOutline.cta}</div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <label
                className="rounded-lg flex flex-col items-center justify-center cursor-pointer p-3 text-center"
                style={{ border: "1px dashed var(--border-glass)", minHeight: 70, fontSize: 11, color: "var(--text-muted)" }}
              >
                <Upload size={16} className="mb-1" />
                <span>Drop media</span>
                <input type="file" accept="image/*,video/*" className="hidden" />
              </label>

              <div>
                <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                  Schedule
                </div>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="input-glass w-full"
                  style={{ fontSize: 12 }}
                />
              </div>

              <div>
                <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                  Assigned to
                </div>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="input-glass w-full"
                  style={{ fontSize: 12 }}
                >
                  {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button onClick={() => save("draft")} className="btn-ghost">Save to Queue</button>
              <button
                onClick={() => save("scheduled")}
                className="btn-primary"
                disabled={!scheduledAt}
                title={!scheduledAt ? "Set a schedule time first" : "Schedule post"}
              >
                {scheduledAt ? "Schedule" : "Post Now"}
              </button>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }} className="text-right">
              Post Now requires platform connection in Settings.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
