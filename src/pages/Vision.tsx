import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Send, Trash2, Settings, MoreHorizontal, Pencil, Check, X,
  Copy, RefreshCw, ThumbsUp, ThumbsDown, Menu, ChevronDown, Sparkles,
  Target, Pencil as PencilIcon, FlaskConical, BarChart3, Compass, Palette, Eye, Sun,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { PERSONAS, PERSONA_MAP, DEFAULT_PERSONA, type PersonaKey } from "@/lib/aiPersonas";
import { buildVisionSystemPrompt, type VisionContext } from "@/lib/visionPrompt";
import { callClaude } from "@/lib/claudeStream";
import { toast } from "@/hooks/use-toast";
import { VisionCircle } from "@/components/vision/VisionCircle";
import { StreamingText } from "@/components/vision/StreamingText";
import { ThinkingIndicator } from "@/components/vision/ThinkingIndicator";
import { extractActionFromResponse, handleVisionAction } from "@/lib/visionActions";
import { useFeatureAccess, trackVisionMessage } from "@/hooks/useFeatureAccess";
import { useUpgrade } from "@/contexts/UpgradeContext";

interface Conversation {
  id: string;
  title: string | null;
  active_persona: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  persona?: string | null;
  feedback?: "positive" | "negative" | null;
  streaming?: boolean;
  thinking?: boolean;
  created_at?: string;
}

const SUGGESTION_CHIPS = [
  { icon: "🎯", text: "Brief me on my day" },
  { icon: "✍️", text: "Draft an email reply" },
  { icon: "🔬", text: "Research a topic" },
  { icon: "📊", text: "Analyze my pipeline" },
  { icon: "🧭", text: "Help me decide" },
  { icon: "🎨", text: "Write a creative brief" },
];

const SLASH_COMMANDS = [
  { cmd: "/brief", desc: "Generate morning brief with calendar + Gmail", prompt: "Give me a full morning brief: calendar, urgent emails, top 3 priorities." },
  { cmd: "/draft", desc: "Draft an email reply", prompt: "Help me draft an email reply. Ask me what it's about." },
  { cmd: "/prep", desc: "Prep for an upcoming meeting", prompt: "Help me prep for my next meeting." },
  { cmd: "/decide", desc: "Structured decision framework", prompt: "I have a decision to make. Walk me through it like a strategic advisor." },
  { cmd: "/reflect", desc: "Weekly reflection", prompt: "Walk me through a weekly reflection. What went well, what didn't, what to change." },
  { cmd: "/search", desc: "Search the knowledge base", prompt: "Search my knowledge base for: " },
];

function groupConversations(convs: Conversation[]) {
  const now = Date.now();
  const buckets: Record<string, Conversation[]> = { Today: [], Yesterday: [], "Last 7 Days": [], "Last 30 Days": [], Older: [] };
  for (const c of convs) {
    const t = new Date(c.updated_at).getTime();
    const days = (now - t) / (1000 * 60 * 60 * 24);
    if (days < 1) buckets.Today.push(c);
    else if (days < 2) buckets.Yesterday.push(c);
    else if (days < 7) buckets["Last 7 Days"].push(c);
    else if (days < 30) buckets["Last 30 Days"].push(c);
    else buckets.Older.push(c);
  }
  return buckets;
}

const PERSONA_ICONS: Record<PersonaKey, typeof Target> = {
  chief_of_staff: Target,
  writer: PencilIcon,
  researcher: FlaskConical,
  analyst: BarChart3,
  advisor: Compass,
  creative_director: Palette,
};

export default function Vision() {
  const { user } = useAuth();
  const { activeOrgId: rawActiveOrgId, orgs, memberships, isOwner, isRestricted } = useOrg();
  const activeOrgId = rawActiveOrgId && rawActiveOrgId !== "all" ? rawActiveOrgId : null;
  const navigate = useNavigate();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const visionAccess = useFeatureAccess("vision_messages");
  const { open: openUpgrade } = useUpgrade();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [persona, setPersona] = useState<PersonaKey>(DEFAULT_PERSONA);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [lastSources, setLastSources] = useState<{ sources: Record<string, boolean>; counts: Record<string, number> } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [prefs, setPrefs] = useState<any>({});

  // Load user prefs (Vision identity + brief delivery)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .maybeSingle();
      setPrefs((data as any)?.preferences ?? {});
    })();
  }, [user]);


  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation list
  const reloadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("vision_conversations")
      .select("id,title,active_persona,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    setConversations(data ?? []);
  }, [user]);

  useEffect(() => { reloadConversations(); }, [reloadConversations]);

  // Load messages for active conv
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      const { data } = await supabase
        .from("vision_messages")
        .select("*")
        .eq("conversation_id", activeConvId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []).map((m: any) => ({
        id: m.id, role: m.role, content: m.content, persona: m.persona,
        feedback: m.feedback, created_at: m.created_at,
      })));
      const conv = conversations.find((c) => c.id === activeConvId);
      if (conv) setPersona((conv.active_persona as PersonaKey) || DEFAULT_PERSONA);
      setLoadingMessages(false);
    })();
    return () => { cancelled = true; };
  }, [activeConvId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 6 * 24) + "px";
  }, [input]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  }, []);

  // Daily brief: send "Give me my daily brief" and record in daily_briefs
  const triggerDailyBrief = useCallback(async (origin: "manual" | "auto") => {
    if (!user || sending) return;
    const today = new Date().toISOString().slice(0, 10);
    if (origin === "auto") {
      // Only auto-trigger if no brief recorded today
      const { data: existing } = await supabase
        .from("daily_briefs")
        .select("id")
        .eq("user_id", user.id)
        .eq("brief_date", today)
        .maybeSingle();
      if (existing) return;
    }
    // Record the brief (idempotent via unique constraint)
    await supabase
      .from("daily_briefs")
      .insert({ user_id: user.id, brief_date: today })
      .then(() => {}, () => {});
    // Start a fresh chat for the brief
    setActiveConvId(null);
    setMessages([]);
    sendMessageRef.current?.("Give me my daily brief");
  }, [user, sending]);

  // Ref to break circular dep between triggerDailyBrief and sendMessage
  const sendMessageRef = useRef<((text: string) => void) | null>(null);

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending || !user) return;
    if (visionAccess.isAtLimit && visionAccess.upgradeRequired) {
      openUpgrade({ feature: "vision_unlimited", requiredTier: visionAccess.requiredTier });
      return;
    }
    setSending(true);
    setInput("");
    setShowSlash(false);
    // Track usage (best-effort, fire-and-forget)
    trackVisionMessage(typeof activeOrgId === "string" && activeOrgId !== "all" ? activeOrgId : null);


    // Ensure we have a conversation
    let convId = activeConvId;
    if (!convId) {
      const { data: created, error: cErr } = await supabase
        .from("vision_conversations")
        .insert({ user_id: user.id, active_persona: persona, active_org_id: activeOrgId ?? null, title: null })
        .select().single();
      if (cErr || !created) {
        toast({ title: "Couldn't create chat", description: cErr?.message, variant: "destructive" });
        setSending(false); return;
      }
      convId = created.id;
      setActiveConvId(convId);
      setConversations((prev) => [created as Conversation, ...prev]);
    }

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", persona, streaming: true, thinking: true },
    ]);

    // Persist user message
    supabase.from("vision_messages").insert({
      conversation_id: convId, user_id: user.id, role: "user", content: text, persona,
    }).then(() => {});

    // Fetch live context from Vision Context Engine
    let visionCtx: VisionContext = {};
    try {
      const accessibleOrgIds = memberships.map((m) => m.org_id);
      const isDailyBrief = /\b(brief|morning brief|daily brief|day ahead|catch me up|what'?s on (today|my plate))\b/i.test(text);
      const { data: ctxData } = await supabase.functions.invoke("vision-context", {
        body: {
          org_id: activeOrgId ?? null,
          org_ids: accessibleOrgIds,
          message: text,
          is_daily_brief: isDailyBrief,
        },
      });
      if (ctxData) {
        visionCtx = ctxData as VisionContext;
        setLastSources({
          sources: (ctxData as any).sources ?? {},
          counts: {
            emails: (ctxData as any).emails?.length ?? 0,
            calendar: (ctxData as any).calendar?.length ?? 0,
            drive: (ctxData as any).drive?.length ?? 0,
            contacts: (ctxData as any).contacts?.length ?? 0,
            tasks: (ctxData as any).tasks?.length ?? 0,
            kb: (ctxData as any).kb?.length ?? 0,
          },
        });
      }
    } catch (e) {
      console.warn("vision-context failed", e);
    }

    const myMemberOrgIds = new Set(memberships.map((m) => m.org_id));
    const accessibleOrgs = orgs.filter((o) => myMemberOrgIds.has(o.id)).map((o) => o.name);
    const myMembership = activeOrg ? memberships.find((m) => m.org_id === activeOrg.id) : undefined;
    const roleLabel = isOwner
      ? "Founder"
      : myMembership?.role === "owner"
        ? "Org Admin"
        : isRestricted
          ? "Read-only"
          : "Team Member";

    const system = buildVisionSystemPrompt(persona, visionCtx, {
      display_name: (user.user_metadata?.full_name as string) ?? null,
      preferred_name: prefs.signature_name ?? null,
      email: user.email ?? null,
      active_org_name: activeOrg?.name ?? null,
      is_founder: isOwner,
      role_label: roleLabel,
      accessible_orgs: accessibleOrgs,
      vision_display_name: prefs.vision_display_name ?? null,
      vision_persona_description: prefs.vision_persona_description ?? null,
      vision_tone: prefs.vision_tone ?? null,
      brief_time: prefs.brief_time ?? null,
      brief_to_channel: prefs.brief_to_channel === true,
      brief_to_inbox: prefs.brief_to_inbox === true,
    });

    const history = [...messages, userMsg]
      .filter((m) => m.content && !m.streaming)
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Manual SSE fetch with letter-by-letter pacing
    const ac = new AbortController();
    abortRef.current = ac;
    const CLAUDE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    let accumulated = "";
    let firstCharSeen = false;
    // Queue + pacing for letter-by-letter feel
    const queue: string[] = [];
    let paced = "";
    let pacingTimer: ReturnType<typeof setTimeout> | null = null;
    const PACE_MS = 8;

    const flushOne = () => {
      if (queue.length === 0) { pacingTimer = null; return; }
      const ch = queue.shift()!;
      paced += ch;
      setMessages((prev) => prev.map((m) => m.id === assistantId
        ? { ...m, content: paced, thinking: false, streaming: true } : m));
      pacingTimer = setTimeout(flushOne, PACE_MS);
    };
    const enqueue = (s: string) => {
      for (const ch of s) queue.push(ch);
      if (!pacingTimer) flushOne();
    };

    try {
      const resp = await fetch(CLAUDE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          callType: /\bbrief\b/i.test(text) ? "brief" : "chat",
          stream: true,
          system,
          messages: history,
        }),
        signal: ac.signal,
      });

      if (!resp.ok || !resp.body) {
        let errMsg = `Vision error ${resp.status}`;
        try { const j = await resp.json(); errMsg = j.error ?? errMsg; } catch { /* */ }
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta?.text) {
              accumulated += evt.delta.text;
              if (!firstCharSeen) {
                firstCharSeen = true;
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, thinking: false } : m));
              }
              enqueue(evt.delta.text);
            } else if (evt.type === "error") {
              throw new Error(evt.error?.message ?? "Stream error");
            }
          } catch { /* partial json */ }
        }
      }

      // Wait for the pacing queue to drain before marking done
      await new Promise<void>((resolve) => {
        const wait = () => {
          if (queue.length === 0 && !pacingTimer) resolve();
          else setTimeout(wait, 20);
        };
        wait();
      });

      // Extract any trailing action JSON block
      const { action, cleanedText } = extractActionFromResponse(accumulated);
      const finalText = action ? cleanedText : accumulated;

      setMessages((prev) => prev.map((m) => m.id === assistantId
        ? { ...m, content: finalText, streaming: false, thinking: false } : m));

      // Persist assistant message (without the JSON block)
      const { data: savedMsg } = await supabase.from("vision_messages").insert({
        conversation_id: convId, user_id: user.id, role: "assistant", content: finalText, persona,
      }).select().single();
      if (savedMsg) {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, id: savedMsg.id } : m));
      }

      // Mirror the brief into #dailyreports if user opted in
      const isBriefMsg = /\b(brief|morning brief|daily brief|day ahead|catch me up|what'?s on (today|my plate))\b/i.test(text);
      if (isBriefMsg && prefs.brief_to_channel === true && activeOrgId) {
        try {
          const { data: ch } = await supabase
            .from("channels")
            .select("id")
            .eq("org_id", activeOrgId)
            .eq("name", "dailyreports")
            .eq("is_system", true)
            .maybeSingle();
          if (ch?.id) {
            const aiName = (prefs.vision_display_name || "Vision").trim();
            await supabase.from("messages").insert({
              channel_id: ch.id,
              org_id: activeOrgId,
              user_id: user.id,
              content: `**${aiName} — Daily Brief for ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}**\n\n${finalText}`,
              metadata: { sender: "vision", kind: "daily_brief", generated_at: new Date().toISOString() },
            });
          }
        } catch (err) {
          console.warn("brief_to_channel post failed", err);
        }
      }
      if (isBriefMsg && prefs.brief_to_inbox === true) {
        // Inbox delivery is queued for a future email job; flag for visibility.
        console.info("[brief] brief_to_inbox enabled — email delivery pending implementation.");
      }

      // Dispatch action (after persisting)
      if (action) {
        try {
          await handleVisionAction(action, { navigate, userId: user.id, activeOrgId });
        } catch (err) {
          console.warn("Vision action failed", err);
        }
      }

      // Bump updated_at
      supabase.from("vision_conversations").update({ updated_at: new Date().toISOString(), active_persona: persona })
        .eq("id", convId).then(() => {});

      // Auto-title on first exchange
      if (history.length <= 1) {
        try {
          const titleRaw = await callClaude({
            system: "You generate ultra-short conversation titles.",
            messages: [{ role: "user", content: `Generate a 3-5 word title for a conversation starting with: "${text}". Return ONLY the title, no quotes, no punctuation at the end.` }],
            maxTokens: 30,
          });
          const title = (titleRaw || "New chat").trim().replace(/^["']|["']$/g, "").slice(0, 60);
          await supabase.from("vision_conversations").update({ title }).eq("id", convId);
          setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title } : c));
        } catch { /* ignore */ }
      }
      reloadConversations();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => prev.map((m) => m.id === assistantId
        ? { ...m, content: `⚠️ ${msg}`, streaming: false, thinking: false } : m));
      toast({ title: "Vision error", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [sending, user, activeConvId, persona, activeOrgId, activeOrg, messages, reloadConversations, navigate, memberships, orgs, isOwner, isRestricted]);

  // Keep ref in sync so triggerDailyBrief can invoke without a dep cycle
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Auto-trigger morning brief in a 3-hour window starting at the user's preferred brief_time (default 07:00)
  const autoBriefTried = useRef(false);
  useEffect(() => {
    if (autoBriefTried.current || !user) return;
    if (prefs.brief_auto === false) return;
    const briefTime = (prefs.brief_time as string | undefined) ?? "07:00";
    const [bh, bm] = briefTime.split(":").map((x: string) => parseInt(x, 10));
    if (Number.isNaN(bh)) return;
    const now = new Date();
    const start = bh * 60 + (bm || 0);
    const cur = now.getHours() * 60 + now.getMinutes();
    if (cur < start || cur >= start + 180) return; // 3-hour window
    autoBriefTried.current = true;
    const t = setTimeout(() => { triggerDailyBrief("auto"); }, 800);
    return () => clearTimeout(t);
  }, [user, prefs.brief_time, prefs.brief_auto, triggerDailyBrief]);



  const switchPersona = (next: PersonaKey) => {
    setPersona(next);
    setPersonaPickerOpen(false);
    if (activeConvId) {
      supabase.from("vision_conversations").update({ active_persona: next }).eq("id", activeConvId).then(() => {});
    }
    if (messages.length > 0) {
      setMessages((prev) => [...prev, {
        id: `greet-${Date.now()}`, role: "assistant",
        content: PERSONA_MAP[next].greeting, persona: next,
      }]);
    }
  };

  const renameConv = async (id: string) => {
    if (!editingTitle.trim()) { setEditingId(null); return; }
    await supabase.from("vision_conversations").update({ title: editingTitle.trim() }).eq("id", id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: editingTitle.trim() } : c));
    setEditingId(null);
  };

  const deleteConv = async (id: string) => {
    await supabase.from("vision_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) newChat();
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("vision_conversations").delete().eq("user_id", user.id);
    setConversations([]);
    setActiveConvId(null);
    setMessages([]);
    setConfirmClear(false);
    toast({ title: "All chats cleared" });
  };

  const regenerate = async () => {
    // Find last user message before the last assistant message
    const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const realIdx = messages.length - 1 - lastAssistantIdx;
    const lastUser = [...messages.slice(0, realIdx)].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Remove the last assistant message
    const removed = messages[realIdx];
    setMessages((prev) => prev.filter((m) => m.id !== removed.id));
    if (removed.id && !removed.id.startsWith("a-")) {
      await supabase.from("vision_messages").delete().eq("id", removed.id);
    }
    sendMessage(lastUser.content);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied" }));
  };

  const setFeedback = async (msg: ChatMessage, fb: "positive" | "negative") => {
    const next = msg.feedback === fb ? null : fb;
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, feedback: next } : m));
    if (msg.id && !msg.id.startsWith("a-")) {
      await supabase.from("vision_messages").update({ feedback: next }).eq("id", msg.id);
    }
  };

  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  const onInputChange = (val: string) => {
    setInput(val);
    setShowSlash(val.startsWith("/") && !val.includes(" "));
  };

  const filteredSlash = useMemo(() => {
    if (!showSlash) return [];
    const q = input.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(q));
  }, [showSlash, input]);

  const personaObj = PERSONA_MAP[persona];

  return (
    <div
      className="flex w-full -m-4 md:-m-6 -mb-24 md:-mb-6"
      style={{ height: "calc(100vh - 64px)", minHeight: 600, background: "#0b0b14" }}
    >
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 flex" : "hidden"} md:relative md:flex md:z-auto flex-col`}
        style={{
          width: 260, background: "#070710", borderRight: "1px solid #1f1f2e",
        }}
      >
        <div className="px-3 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #1f1f2e" }}>
          <Sparkles size={16} className="text-[#a78bfa]" />
          <span className="font-display font-bold tracking-tight text-white text-sm flex-1">Vision</span>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition"
            style={{ background: "#1f2937", border: "1px solid #374151" }}
          >
            <Plus size={14} /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {Object.entries(grouped).map(([bucket, list]) => list.length === 0 ? null : (
            <div key={bucket} className="mb-3">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-gray-500 font-medium">{bucket}</div>
              {list.map((c) => {
                const active = c.id === activeConvId;
                const editing = editingId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                      active ? "text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                    style={{ background: active ? "#1f2937" : "transparent" }}
                    onClick={() => { if (!editing) { setActiveConvId(c.id); setSidebarOpen(false); } }}
                  >
                    {editing ? (
                      <>
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameConv(c.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 bg-[#0b0b14] border border-[#374151] rounded px-1.5 py-0.5 text-sm text-white outline-none"
                        />
                        <button onClick={(e) => { e.stopPropagation(); renameConv(c.id); }} className="text-gray-400 hover:text-white"><Check size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-gray-400 hover:text-white"><X size={12} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{c.title || "New chat"}</span>
                        <ConvMenu
                          onRename={() => { setEditingId(c.id); setEditingTitle(c.title ?? ""); }}
                          onDelete={() => deleteConv(c.id)}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="px-2 py-6 text-center text-xs text-gray-500">No chats yet</div>
          )}
        </div>

        <div className="px-2 py-2 space-y-1" style={{ borderTop: "1px solid #1f1f2e" }}>
          <button
            onClick={() => navigate("/settings/ai")}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-[#1f2937]"
          >
            <Settings size={14} /> Vision Settings
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-[#1f2937]"
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "#0b0b14" }}>
        {/* Top bar */}
        <div className="flex items-center px-3 py-2 gap-2" style={{ borderBottom: "1px solid #1f1f2e" }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-300 md:hidden"><Menu size={20} /></button>
          <div className="flex-1 text-center md:text-left text-white font-display font-bold md:pl-2">Vision</div>
          <button
            onClick={() => triggerDailyBrief("manual")}
            disabled={sending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-amber-300 hover:text-white hover:bg-[#1f2937] disabled:opacity-40"
            title="Get my daily brief"
          >
            <Sun size={14} /> <span className="hidden sm:inline">Daily Brief</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setSourcesOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-gray-300 hover:text-white hover:bg-[#1f2937]"
              title="What Vision can see"
            >
              <Eye size={14} /> <span className="hidden sm:inline">Sources</span>
            </button>
            {sourcesOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSourcesOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-2 z-50 rounded-xl p-3 w-72"
                  style={{ background: "#111827", border: "1px solid #374151" }}
                >
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Vision can see</div>
                  <SourceList sources={lastSources?.sources ?? null} counts={lastSources?.counts ?? null} />
                  <button
                    onClick={() => { setSourcesOpen(false); navigate("/settings"); }}
                    className="mt-3 w-full text-xs text-[#a78bfa] hover:text-white text-left"
                  >
                    Manage Connections →
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={newChat} className="text-gray-300 md:hidden"><Plus size={18} /></button>
        </div>

        {/* Messages or welcome */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loadingMessages ? (
            <Welcome
              onSuggestion={(s) => sendMessage(s)}
              activeOrgName={activeOrg?.name ?? null}
            />
          ) : (
            <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-8 space-y-6 pb-32">
              {messages.map((m, i) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  isLastAssistant={m.role === "assistant" && i === messages.length - 1 && !m.streaming && !m.thinking}
                  onCopy={() => copyToClipboard(m.content)}
                  onRegenerate={regenerate}
                  onFeedback={(fb) => setFeedback(m, fb)}
                  userInitials={(user?.user_metadata?.full_name as string | undefined)?.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="relative">
          <div className="pointer-events-none absolute -top-16 left-0 right-0 h-16" style={{ background: "linear-gradient(to top, #0b0b14, transparent)" }} />
          <div className="max-w-[780px] mx-auto px-4 sm:px-6 pb-6 pt-2 relative">
            {/* Slash palette */}
            {showSlash && filteredSlash.length > 0 && (
              <div
                className="absolute bottom-full mb-2 left-4 right-4 sm:left-6 sm:right-6 rounded-xl overflow-hidden"
                style={{ background: "#111827", border: "1px solid #374151" }}
              >
                {filteredSlash.map((s) => (
                  <button
                    key={s.cmd}
                    onClick={() => { setInput(s.prompt); setShowSlash(false); textareaRef.current?.focus(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#1f2937]"
                  >
                    <span className="font-mono text-sm text-[#a78bfa] w-20">{s.cmd}</span>
                    <span className="text-sm text-gray-400">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Persona picker */}
            {personaPickerOpen && (
              <div
                className="absolute bottom-full mb-2 left-4 right-4 sm:left-6 sm:right-6 rounded-xl overflow-hidden"
                style={{ background: "#111827", border: "1px solid #374151" }}
              >
                <div className="px-3 py-2 text-xs uppercase tracking-wider text-gray-500" style={{ borderBottom: "1px solid #1f2937" }}>Choose a persona</div>
                {PERSONAS.map((p) => {
                  const Icon = PERSONA_ICONS[p.key];
                  const active = p.key === persona;
                  return (
                    <button
                      key={p.key}
                      onClick={() => switchPersona(p.key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#1f2937]"
                    >
                      <span className="text-lg">{p.emoji}</span>
                      <div className="flex-1">
                        <div className="text-sm text-white font-medium">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.systemDescription.split(".")[0].replace(/^You are the user's [^.]*\. ?/i, "").slice(0, 60)}</div>
                      </div>
                      {active && <Check size={14} className="text-[#a78bfa]" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className="flex items-end gap-2 p-2 rounded-2xl"
              style={{ background: "#1f2937", border: "1px solid #374151" }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Message Vision..."
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm py-2 px-2"
                style={{ color: "#fff", maxHeight: 144, lineHeight: "24px" }}
              />
              <button
                onClick={() => setPersonaPickerOpen((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-[#0b0b14]"
                title="Change persona"
              >
                <span className="text-base leading-none">{personaObj.emoji}</span>
                <ChevronDown size={12} />
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
                style={{ background: "#2563eb", color: "white" }}
                title="Send"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="text-center text-[10px] text-gray-600 mt-2">
              Vision can make mistakes. Verify important info.
            </div>
          </div>
        </div>
      </div>

      {/* Clear all confirm */}
      {confirmClear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background: "#111827", border: "1px solid #374151" }}>
            <div className="text-white font-display font-bold text-lg mb-2">Clear all chats?</div>
            <div className="text-sm text-gray-400 mb-5">This permanently deletes every Vision conversation. Can't be undone.</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-[#1f2937]">Cancel</button>
              <button onClick={clearAll} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "#dc2626" }}>Delete all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ConvMenu = ({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white p-0.5 rounded transition"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden min-w-[140px]"
            style={{ background: "#111827", border: "1px solid #374151" }}>
            <button onClick={() => { onRename(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#1f2937] hover:text-white">
              <Pencil size={12} /> Rename
            </button>
            <button onClick={() => { onDelete(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#1f2937]">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const Welcome = ({ onSuggestion, activeOrgName }: { onSuggestion: (s: string) => void; activeOrgName: string | null }) => (
  <div className="h-full flex flex-col items-center justify-center px-6 py-10">
    <div className="mb-5">
      <VisionCircle size={80} />
    </div>
    <div className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight mb-1">Vision</div>
    <div className="text-base text-gray-400 mb-1">Your AI Chief of Staff</div>
    <div className="text-xs text-gray-600 mb-8">
      Powered by Claude · Always org-aware{activeOrgName ? ` · ${activeOrgName}` : ""}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-[720px] w-full">
      {SUGGESTION_CHIPS.map((s) => (
        <button
          key={s.text}
          onClick={() => onSuggestion(s.text)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-gray-200 text-left hover:border-[#374151] transition"
          style={{ background: "#111827", border: "1px solid #1f2937" }}
        >
          <span>{s.icon}</span>
          <span>{s.text}</span>
        </button>
      ))}
    </div>
  </div>
);

const MessageRow = ({
  msg, isLastAssistant, onCopy, onRegenerate, onFeedback, userInitials,
}: {
  msg: ChatMessage;
  isLastAssistant: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onFeedback: (fb: "positive" | "negative") => void;
  userInitials: string;
}) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end gap-2 group">
        <div
          className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap"
          style={{ background: "#374151", color: "#fff" }}
        >
          {msg.content}
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: "#1f2937", color: "#9ca3af", border: "1px solid #374151" }}
        >
          {userInitials}
        </div>
      </div>
    );
  }
  const personaObj = msg.persona ? PERSONA_MAP[msg.persona as PersonaKey] : null;
  return (
    <div className="flex gap-3 group">
      <VisionCircle size={32} thinking={!!msg.thinking} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-1">
          Vision{personaObj ? ` · ${personaObj.name}` : ""}
        </div>
        {msg.thinking && !msg.content ? (
          <ThinkingIndicator />
        ) : (
          <StreamingText text={msg.content} streaming={!!msg.streaming} />
        )}
        {!msg.streaming && !msg.thinking && msg.content && (
          <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button onClick={onCopy} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-[#1f2937]" title="Copy">
              <Copy size={13} />
            </button>
            {isLastAssistant && (
              <button onClick={onRegenerate} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-[#1f2937]" title="Regenerate">
                <RefreshCw size={13} />
              </button>
            )}
            <button
              onClick={() => onFeedback("positive")}
              className={`p-1.5 rounded hover:bg-[#1f2937] ${msg.feedback === "positive" ? "text-emerald-400" : "text-gray-500 hover:text-white"}`}
              title="Good response"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => onFeedback("negative")}
              className={`p-1.5 rounded hover:bg-[#1f2937] ${msg.feedback === "negative" ? "text-red-400" : "text-gray-500 hover:text-white"}`}
              title="Bad response"
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SOURCE_LABELS: { key: string; icon: string; label: string }[] = [
  { key: "gmail", icon: "📧", label: "Gmail" },
  { key: "calendar", icon: "📅", label: "Calendar" },
  { key: "drive", icon: "📁", label: "Drive" },
  { key: "contacts", icon: "👥", label: "Contacts" },
  { key: "tasks", icon: "✅", label: "Tasks" },
  { key: "kb", icon: "📚", label: "Knowledge" },
  { key: "slack", icon: "💬", label: "Slack" },
];

const COUNT_KEY: Record<string, string> = {
  gmail: "emails", calendar: "calendar", drive: "drive",
  contacts: "contacts", tasks: "tasks", kb: "kb", slack: "slack",
};

const SourceList = ({ sources, counts }: { sources: Record<string, boolean> | null; counts: Record<string, number> | null }) => {
  if (!sources) {
    return <div className="text-xs text-gray-500">Send a message to populate context.</div>;
  }
  return (
    <div className="space-y-1.5">
      {SOURCE_LABELS.map((s) => {
        const on = sources[s.key];
        const count = counts?.[COUNT_KEY[s.key]] ?? 0;
        return (
          <div key={s.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-200">
              <span>{s.icon}</span> {s.label}
            </span>
            <span className={`text-xs ${on ? "text-emerald-400" : "text-gray-500"}`}>
              {on ? (count > 0 ? `✓ ${count}` : "✓") : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
};
