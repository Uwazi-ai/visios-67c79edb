import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PendingProposal } from "@/hooks/useDashboardSummary";

/**
 * Vision chat state. Conversations are private to the operator; scope comes
 * from the workspace, not from a control on this screen.
 *
 * Streaming goes through fetch rather than functions.invoke because invoke
 * buffers the whole body — a chief of staff that appears to hang for eight
 * seconds and then dumps a paragraph reads as broken.
 */

export type PersonaKey =
  | "chief_of_staff"
  | "writer"
  | "researcher"
  | "analyst"
  | "advisor"
  | "creative_director";

export interface Persona {
  key: string;
  display_name: string;
  description: string | null;
  sort_order: number;
}

export interface Conversation {
  id: string;
  org_id: string | null;
  persona_key: string;
  title: string | null;
  last_message_at: string;
}

export interface ContextRef {
  kind: string;
  id: string;
  label: string;
  org_id: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  persona_key: string | null;
  status: "streaming" | "complete" | "aborted" | "failed";
  context_refs: ContextRef[];
  proposal_ids: string[];
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vision-chat`;

export function useVisionChat(scopeOrgId: string | null) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<Record<string, PendingProposal>>({});
  const [streaming, setStreaming] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [pendingRefs, setPendingRefs] = useState<ContextRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Personas: the org override is invisible here on purpose — the row the
     server picks is the row the operator sees named. */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("personas")
        .select("key,display_name,description,sort_order,org_id,is_active")
        .eq("is_active", true)
        .order("sort_order");
      const rows = (data ?? []) as any[];
      const byKey = new Map<string, Persona>();
      for (const r of rows) {
        const existing = byKey.get(r.key);
        if (!existing || r.org_id) byKey.set(r.key, r);
      }
      setPersonas([...byKey.values()].sort((a, b) => a.sort_order - b.sort_order));
    })();
  }, []);

  const loadConversations = useCallback(async () => {
    let q = supabase
      .from("conversations")
      .select("id,org_id,persona_key,title,last_message_at")
      .is("archived_at", null)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (scopeOrgId) q = q.or(`org_id.eq.${scopeOrgId},org_id.is.null`);
    const { data } = await q;
    setConversations((data ?? []) as Conversation[]);
  }, [scopeOrgId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id,role,content,persona_key,status,context_refs,proposal_ids,latency_ms,error,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as unknown as ChatMessage[];
    setMessages(rows);

    const ids = rows.flatMap((m) => m.proposal_ids ?? []);
    if (ids.length) {
      const { data: props } = await supabase
        .from("proposals")
        .select("id,org_id,agent_key,kind,title,rationale,payload,confidence,status,created_at,orgs(name,color)")
        .in("id", ids);
      const map: Record<string, PendingProposal> = {};
      for (const p of (props ?? []) as any[]) {
        map[p.id] = {
          ...p,
          org_name: p.orgs?.name ?? "Organization",
          identity_color: p.orgs?.color ?? "var(--brand)",
        };
      }
      setProposals((prev) => ({ ...prev, ...map }));
    }
  }, []);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  const newConversation = useCallback(
    async (personaKey: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return null;
      const { data, error: err } = await supabase
        .from("conversations")
        .insert({ user_id: auth.user.id, org_id: scopeOrgId, persona_key: personaKey })
        .select("id,org_id,persona_key,title,last_message_at")
        .maybeSingle();
      if (err || !data) {
        setError(err?.message ?? "Could not start a conversation.");
        return null;
      }
      setConversations((prev) => [data as Conversation, ...prev]);
      setActiveId((data as Conversation).id);
      setMessages([]);
      return data as Conversation;
    },
    [scopeOrgId],
  );

  const setPersona = useCallback(async (conversationId: string, personaKey: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, persona_key: personaKey } : c)),
    );
    await supabase.from("conversations").update({ persona_key: personaKey }).eq("id", conversationId);
  }, []);

  const archive = useCallback(
    async (id: string) => {
      await supabase.from("conversations").update({ archived_at: new Date().toISOString() }).eq("id", id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (conversationId: string, text: string) => {
      const body = text.trim();
      if (!body || streaming) return;
      setError(null);
      setPendingText("");
      setPendingRefs([]);
      setStreaming(true);

      /* Optimistic user turn: the person's own words must appear instantly. */
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content: body,
          persona_key: null,
          status: "complete",
          context_refs: [],
          proposal_ids: [],
          latency_ms: null,
          error: null,
          created_at: new Date().toISOString(),
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data: session } = await supabase.auth.getSession();
        const res = await fetch(FN_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ conversation_id: conversationId, message: body }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `Vision could not answer (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let event = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
              continue;
            }
            if (!line.startsWith("data:")) continue;
            let payload: any;
            try {
              payload = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (event === "context") setPendingRefs(payload.refs ?? []);
            else if (event === "delta") setPendingText((t) => t + payload.text);
            else if (event === "proposal") {
              setProposals((prev) => ({
                ...prev,
                [payload.id]: {
                  ...payload,
                  identity_color: payload.identity_color ?? "var(--brand)",
                },
              }));
            } else if (event === "error") setError(payload.message);
            else if (event === "done") {
              await loadMessages(conversationId);
              setPendingText("");
              setPendingRefs([]);
              await loadConversations();
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [streaming, loadMessages, loadConversations],
  );

  const commitProposal = useCallback(async (id: string) => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from("proposals")
      .update({
        status: "committed",
        decided_at: new Date().toISOString(),
        decided_by: auth?.user?.id ?? null,

      })
      .eq("id", id);
    setProposals((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "committed" } as any } : prev));
  }, []);

  const dismissProposal = useCallback(async (id: string) => {
    await supabase.from("proposals").update({ status: "dismissed" }).eq("id", id);
    setProposals((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "dismissed" } as any } : prev));
  }, []);

  return {
    personas,
    conversations,
    activeId,
    setActiveId,
    messages,
    proposals,
    streaming,
    pendingText,
    pendingRefs,
    error,
    newConversation,
    setPersona,
    archive,
    send,
    stop,
    commitProposal,
    dismissProposal,
  };
}
