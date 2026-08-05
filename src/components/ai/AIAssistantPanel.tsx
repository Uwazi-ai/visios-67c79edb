import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, Brain, BrainCog, FileText, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { PERSONAS, PERSONA_MAP, DEFAULT_PERSONA, type PersonaKey } from "@/lib/aiPersonas";
import { buildSystemPrompt, getQuickActions, type AIContextSnapshot } from "@/lib/aiPrompt";
import { streamClaude, type ClaudeMessage } from "@/lib/claudeStream";
import { toast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  persona?: PersonaKey;
  citations?: { title: string; document_id: string }[];
  streaming?: boolean;
}

const LS_PERSONA = "visi.ai.persona";
const LS_KB = "visi.ai.useKb";
const LS_CONV = "visi.ai.activeConversation";
const LS_CACHE_PREFIX = "visi.ai.cache.";

export const AIAssistantPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const { activeOrgId, orgs } = useOrg();
  const loc = useLocation();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  const [persona, setPersona] = useState<PersonaKey>(() => {
    return (typeof localStorage !== "undefined" ? (localStorage.getItem(LS_PERSONA) as PersonaKey) : null) ?? DEFAULT_PERSONA;
  });
  const [useKb, setUseKb] = useState<boolean>(() => {
    return typeof localStorage !== "undefined" ? localStorage.getItem(LS_KB) !== "false" : true;
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(LS_PERSONA, persona); }, [persona]);
  useEffect(() => { localStorage.setItem(LS_KB, String(useKb)); }, [useKb]);

  // Load or create conversation when panel opens
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const cachedConvId = localStorage.getItem(LS_CONV);
      if (cachedConvId) {
        const { data: conv } = await supabase.from("ai_conversations").select("*").eq("id", cachedConvId).maybeSingle();
        if (!cancelled && conv) {
          setConversationId(conv.id);
          // Hydrate messages: cache first then fetch fresh
          const cachedRaw = localStorage.getItem(LS_CACHE_PREFIX + conv.id);
          if (cachedRaw) {
            try { setMessages(JSON.parse(cachedRaw)); } catch { /* */ }
          }
          const { data: msgs } = await supabase.from("ai_messages")
            .select("*").eq("conversation_id", conv.id).order("created_at", { ascending: true }).limit(50);
          if (!cancelled && msgs) {
            const hydrated: ChatMessage[] = msgs.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              persona: m.persona,
              citations: m.citations as any,
            }));
            setMessages(hydrated);
            localStorage.setItem(LS_CACHE_PREFIX + conv.id, JSON.stringify(hydrated.slice(-10)));
          }
          return;
        }
      }
      // Create new
      const { data: created } = await supabase.from("ai_conversations").insert({
        user_id: user.id,
        org_id: activeOrgId ?? null,
        persona,
        title: "New chat",
      }).select().single();
      if (!cancelled && created) {
        setConversationId(created.id);
        localStorage.setItem(LS_CONV, created.id);
        setMessages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const quickActions = useMemo(() => getQuickActions(loc.pathname), [loc.pathname]);

  const startNewChat = useCallback(async () => {
    if (!user) return;
    abortRef.current?.abort();
    const { data: created } = await supabase.from("ai_conversations").insert({
      user_id: user.id,
      org_id: activeOrgId ?? null,
      persona,
      title: "New chat",
    }).select().single();
    if (created) {
      setConversationId(created.id);
      localStorage.setItem(LS_CONV, created.id);
      setMessages([]);
    }
  }, [user, activeOrgId, persona]);

  const switchPersona = useCallback((next: PersonaKey) => {
    if (next === persona) return;
    setPersona(next);
    const greeting = PERSONA_MAP[next].greeting;
    setMessages((prev) => [...prev, {
      id: `greet-${Date.now()}`,
      role: "assistant",
      content: greeting,
      persona: next,
    }]);
  }, [persona]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending || !user || !conversationId) return;
    setSending(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, {
      id: assistantId, role: "assistant", content: "", persona, streaming: true,
    }]);

    // Persist user message
    supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: userMsg.content,
      persona,
    }).then(() => {});

    // Build context via edge function
    let ctx: AIContextSnapshot = { today: new Date().toISOString(), active_org_name: activeOrg?.name ?? null };
    let citations: { title: string; document_id: string }[] = [];
    try {
      const { data: ctxData, error: ctxErr } = await supabase.functions.invoke("ai-build-context", {
        body: { org_id: activeOrgId ?? null, query: text, use_kb: useKb },
      });
      if (!ctxErr && ctxData) {
        ctx = { ...ctxData, today: ctxData.today ?? new Date().toISOString(), active_org_name: activeOrg?.name ?? null };
        citations = (ctxData.citations ?? []).map((c: any) => ({ title: c.title, document_id: c.document_id }));
      }
    } catch (e) { console.warn("context build failed", e); }

    const system = buildSystemPrompt(persona, ctx, { surface: loc.pathname });

    // History: last 10 (excluding the streaming placeholder)
    const history: ClaudeMessage[] = [...messages, userMsg]
      .filter((m) => m.content && !m.streaming)
      .slice(-10)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    await streamClaude({ system, messages: history, signal: ac.signal }, {
      onDelta: (chunk) => {
        acc += chunk;
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: acc } : m));
      },
      onDone: async () => {
        setMessages((prev) => {
          const updated = prev.map((m) => m.id === assistantId
            ? { ...m, content: acc, streaming: false, citations: citations.length ? citations : undefined }
            : m);
          // Cache last 10 in localStorage
          try { localStorage.setItem(LS_CACHE_PREFIX + conversationId, JSON.stringify(updated.slice(-10))); } catch { /* */ }
          return updated;
        });
        setSending(false);
        // Persist assistant message
        supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: acc,
          persona,
          citations: citations as any,
        }).then(() => {});
        // Update conv title if first message
        if (history.length <= 1) {
          const title = text.slice(0, 60);
          supabase.from("ai_conversations").update({ title, persona }).eq("id", conversationId).then(() => {});
        }
      },
      onError: (err) => {
        setSending(false);
        setMessages((prev) => prev.map((m) => m.id === assistantId
          ? { ...m, content: `⚠️ ${err.message}`, streaming: false } : m));
        toast({ title: "AI error", description: err.message, variant: "destructive" });
      },
    });
  }, [sending, user, conversationId, persona, activeOrgId, activeOrg, useKb, loc.pathname, messages]);

  if (!open) return null;

  const personaObj = PERSONA_MAP[persona];

  return (
    <div
      className="fixed inset-y-0 right-0 z-[120] flex flex-col"
      style={{
        width: "min(420px, 100vw)",
        background: "rgba(8,8,18,0.92)",
        backdropFilter: "var(--blur-sidebar)",
        WebkitBackdropFilter: "var(--blur-sidebar)",
        borderLeft: "1px solid var(--border-glass)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[hsl(258,90%,66%)]" />
          <span className="font-display font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Kova AI</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex-1" />
        <button onClick={startNewChat} className="btn-icon" title="New chat" style={{ width: 28, height: 28 }}>
          <Plus size={14} />
        </button>
        <button onClick={onClose} className="btn-icon" title="Close" style={{ width: 28, height: 28 }}>
          <X size={14} />
        </button>
      </div>

      {/* Persona row */}
      <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        {PERSONAS.map((p) => {
          const Icon = p.icon;
          const active = p.key === persona;
          return (
            <button
              key={p.key}
              onClick={() => switchPersona(p.key)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition"
              style={{
                background: active ? "linear-gradient(135deg, hsl(217,91%,60%), hsl(258,90%,66%))" : "var(--bg-glass-1)",
                color: active ? "white" : "var(--text-secondary)",
                border: "1px solid " + (active ? "transparent" : "var(--border-glass)"),
              }}
            >
              <Icon size={12} strokeWidth={2} />
              {p.shortLabel}
            </button>
          );
        })}
      </div>

      {/* Active persona + KB toggle */}
      <div className="px-4 py-2 flex items-center gap-3 text-xs" style={{ borderBottom: "1px solid var(--border-glass)", color: "var(--text-secondary)" }}>
        <span>{personaObj.emoji} {personaObj.name}</span>
        {activeOrg && (
          <span className="org-pill" style={{ background: `${activeOrg.color}22`, color: activeOrg.color, border: `1px solid ${activeOrg.color}44` }}>
            {activeOrg.name}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setUseKb((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md transition"
          style={{
            background: useKb ? "rgba(168,85,247,0.15)" : "var(--bg-glass-1)",
            color: useKb ? "#C4B5FD" : "var(--text-tertiary)",
            border: "1px solid " + (useKb ? "rgba(168,85,247,0.3)" : "var(--border-glass)"),
          }}
          title={useKb ? "Knowledge base ON" : "Knowledge base OFF"}
        >
          {useKb ? <BrainCog size={12} /> : <Brain size={12} />}
          KB {useKb ? "ON" : "OFF"}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10 px-4">
            <div className="text-3xl mb-2">{personaObj.emoji}</div>
            <div className="font-display text-sm" style={{ color: "var(--text-primary)" }}>{personaObj.greeting}</div>
            <div className="t-mono text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>
              SHIFT<span className="slash">/</span>ENTER FOR NEWLINE
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
      </div>

      {/* Quick actions */}
      {messages.length === 0 && quickActions.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid var(--border-glass)" }}>
          {quickActions.map((qa) => (
            <button
              key={qa}
              onClick={() => sendMessage(qa)}
              className="px-2.5 py-1 rounded-full text-xs"
              style={{
                background: "var(--bg-glass-1)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-glass)",
              }}
            >
              {qa}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border-glass)" }}>
        <div className="flex items-end gap-2 p-2 rounded-xl" style={{ background: "var(--bg-glass-1)", border: "1px solid var(--border-glass)" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask Kova anything..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm"
            style={{ color: "var(--text-primary)", maxHeight: 160 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="p-2 rounded-lg disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, hsl(217,91%,60%), hsl(258,90%,66%))",
              color: "white",
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ msg }: { msg: ChatMessage }) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tr-sm text-sm" style={{ background: "var(--bg-glass-2)", color: "var(--text-primary)", border: "1px solid var(--border-glass)" }}>
          {msg.content}
        </div>
      </div>
    );
  }
  const personaObj = msg.persona ? PERSONA_MAP[msg.persona] : null;
  return (
    <div className="flex gap-2">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}>
        {personaObj?.emoji ?? "✨"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="px-3 py-2 rounded-2xl rounded-tl-sm text-sm whitespace-pre-wrap" style={{ background: "var(--bg-glass-1)", color: "var(--text-primary)", border: "1px solid var(--border-glass)" }}>
          {msg.content || (msg.streaming ? <span className="inline-block animate-pulse">▋</span> : "")}
          {msg.streaming && msg.content && <span className="inline-block animate-pulse ml-0.5">▋</span>}
        </div>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {msg.citations.map((c) => (
              <span key={c.document_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px]" style={{ background: "rgba(168,85,247,0.12)", color: "#C4B5FD", border: "1px solid rgba(168,85,247,0.25)" }}>
                <FileText size={10} /> {c.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const AIAssistantFAB = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[110] w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition hover:scale-105"
        style={{
          bottom: "calc(20px + env(safe-area-inset-bottom))",
          right: 20,
          background: "linear-gradient(135deg, hsl(217,91%,60%), hsl(258,90%,66%))",
          boxShadow: "0 8px 30px rgba(99,102,241,0.45)",
        }}
        title="Kova AI Assistant"
      >
        <Sparkles size={20} className="text-white" />
      </button>
      <AIAssistantPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
};
