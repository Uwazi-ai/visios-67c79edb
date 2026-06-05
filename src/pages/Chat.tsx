import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Pencil, Sparkles, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";
import { ChannelList, ChatChannel } from "@/components/chat/ChannelList";
import { MessageList, ChatMessage, ProfileLite } from "@/components/chat/MessageList";
import { MessageInput, MentionUser, ChatAttachment } from "@/components/chat/MessageInput";
import { NewDmModal } from "@/components/chat/NewDmModal";
import { toast } from "sonner";

export function toHandle(name: string | null | undefined, email: string): string {
  const base = (name ?? email.split("@")[0] ?? "").toLowerCase().trim();
  return base.replace(/\s+/g, "").replace(/[^a-z0-9_.-]/g, "") || "user";
}

export default function ChatPage() {
  const { user } = useAuth();
  const { orgs, activeOrgId } = useOrg();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [members, setMembers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ user_id: string }[]>([]);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<number | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Load channels
  const loadChannels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("channels")
      .select("id, name, org_id, is_dm, is_system, dm_participants")
      .order("is_system", { ascending: true })
      .order("name");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as ChatChannel[];
    setChannels(list);
    setLoading(false);
  };

  useEffect(() => {
    loadChannels();
  }, []);

  // Pick default active channel when channels load
  useEffect(() => {
    if (activeId || channels.length === 0) return;
    const orgId = activeOrgId && activeOrgId !== "all" ? activeOrgId : channels[0]?.org_id;
    const general = channels.find(
      (c) => c.org_id === orgId && c.name === "general" && !c.is_dm && !c.is_system,
    );
    setActiveId(general?.id ?? channels.find((c) => !c.is_dm && !c.is_system)?.id ?? null);
  }, [channels, activeOrgId, activeId]);

  // Load messages for active channel + subscribe
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setSummary(null);
      return;
    }
    setSummary(null);
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, channel_id, user_id, org_id, content, created_at, edited_at, metadata")
        .eq("channel_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (cancelled) return;
      const msgs = (data ?? []) as unknown as ChatMessage[];
      setMessages(msgs);
      await ensureProfiles(msgs.map((m) => m.user_id).filter(Boolean) as string[]);
    })();

    const ch = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeId}`,
        },
        async (payload) => {
          const m = payload.new as unknown as ChatMessage;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.user_id) await ensureProfiles([m.user_id]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeId}`,
        },
        (payload) => {
          const m = payload.new as unknown as ChatMessage;
          setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${activeId}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((p) => p.id !== old.id));
        },
      )
      .subscribe();

    // Presence channel for typing
    const presence = supabase.channel(`presence:${activeId}`, {
      config: { presence: { key: user?.id ?? "anon" } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState() as Record<string, any[]>;
        const others: { user_id: string }[] = [];
        Object.entries(state).forEach(([key, metas]) => {
          if (key === user?.id) return;
          const meta = metas[0] as any;
          if (meta?.typing) others.push({ user_id: key });
        });
        setTypingUsers(others);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await presence.track({ user_id: user.id, typing: false });
        }
      });
    presenceRef.current = presence;

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      supabase.removeChannel(presence);
      presenceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id]);

  async function ensureProfiles(ids: string[]) {
    const need = Array.from(new Set(ids)).filter((id) => !profiles[id]);
    if (need.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", need);
    if (data) {
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data as ProfileLite[]) next[p.id] = p;
        return next;
      });
    }
  }

  const activeChannel = channels.find((c) => c.id === activeId) ?? null;
  const activeOrg = activeChannel ? orgs.find((o) => o.id === activeChannel.org_id) : null;

  const handleTyping = () => {
    const presence = presenceRef.current;
    if (!presence || !user) return;
    presence.track({ user_id: user.id, typing: true });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      presence.track({ user_id: user.id, typing: false });
    }, 2000);
  };

  // Load org members for @mention suggestions when active channel changes
  useEffect(() => {
    if (!activeChannel?.org_id) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: ms } = await supabase
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", activeChannel.org_id);
      const ids = (ms ?? []).map((m) => m.user_id).filter(Boolean) as string[];
      if (ids.length === 0) {
        if (!cancelled) setMembers([]);
        return;
      }
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", ids);
      if (cancelled) return;
      const list: MentionUser[] = (ps ?? []).map((p) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        handle: toHandle(p.display_name, p.email),
      }));
      setMembers(list);
      // Also seed profile cache so mentioned users render in bubbles
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of (ps ?? []) as ProfileLite[]) next[p.id] = p;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.org_id]);

  async function handleSend(
    text: string,
    mentions: string[],
    attachments: ChatAttachment[] = [],
  ) {
    if (!activeChannel || !user) return;
    if (activeChannel.is_system) return;

    // Slash commands (only when no attachments)
    if (attachments.length === 0) {
      if (text.startsWith("/todo ")) {
        const title = text.slice(6).trim();
        if (!title) return;
        const { error } = await supabase.from("tasks").insert({
          title,
          org_id: activeChannel.org_id,
          created_by: user.id,
          status: "todo",
          priority: "normal",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        await postMessage(`✓ Task created: ${title}`, []);
        toast.success("Task created");
        return;
      }
      if (text.startsWith("/meeting ")) {
        const title = text.slice(9).trim();
        if (!title) return;
        try {
          const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const end = new Date(start.getTime() + 30 * 60 * 1000);
          const { error } = await supabase.functions.invoke("calendar-create-event", {
            body: {
              summary: title,
              start: start.toISOString(),
              end: end.toISOString(),
            },
          });
          if (error) throw error;
          await postMessage(`✓ Meeting added to calendar: ${title} (tomorrow)`, []);
          toast.success("Meeting created");
        } catch (e: any) {
          toast.error(e?.message ?? "Could not create meeting");
        }
        return;
      }
    }

    await postMessage(text, mentions, attachments);
    handleTyping();
  }

  async function uploadAttachment(
    file: File,
    onProgress?: (ratio: number) => void,
  ): Promise<ChatAttachment> {
    if (!activeChannel || !user || !activeChannel.org_id) {
      throw new Error("No active channel");
    }
    if (activeChannel.is_system) {
      throw new Error("System channels are read-only");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${activeChannel.org_id}/${activeChannel.id}/${user.id}/${Date.now()}-${safeName}`;
    const contentType = file.type || "application/octet-stream";

    // Use XHR against the Storage REST endpoint so we can report real upload progress.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
    const url = `${baseUrl}/storage/v1/object/chat-attachments/${path}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(1);
          resolve();
        } else {
          let msg = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.message) msg = body.message;
          } catch {
            if (xhr.responseText) msg = xhr.responseText.slice(0, 200);
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload aborted"));
      xhr.send(file);
    });

    return {
      path,
      name: file.name,
      size: file.size,
      type: contentType,
    };
  }

  // Cache of signed URLs (path -> { url, expiresAt })
  const signedUrlCache = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());

  async function resolveAttachmentUrl(path: string): Promise<string | null> {
    const now = Date.now();
    const cached = signedUrlCache.current.get(path);
    if (cached && cached.expiresAt > now + 30_000) return cached.url;
    const { data, error } = await supabase.storage
      .from("chat-attachments")
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (error || !data?.signedUrl) return null;
    signedUrlCache.current.set(path, {
      url: data.signedUrl,
      expiresAt: now + 60 * 60 * 1000,
    });
    return data.signedUrl;
  }

  async function postMessage(
    content: string,
    mentions: string[] = [],
    attachments: ChatAttachment[] = [],
  ) {
    if (!activeChannel || !user) return;
    const metadata: Record<string, unknown> = {};
    if (mentions.length) metadata.mentions = mentions;
    if (attachments.length) metadata.attachments = attachments;
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      channel_id: activeChannel.id,
      user_id: user.id,
      org_id: activeChannel.org_id,
      content,
      created_at: new Date().toISOString(),
      metadata,
    };
    setMessages((prev) => [...prev, optimistic]);
    const insertRow: any = {
      channel_id: activeChannel.id,
      user_id: user.id,
      org_id: activeChannel.org_id,
      content,
    };
    if (Object.keys(metadata).length) insertRow.metadata = metadata;
    const { data, error } = await supabase
      .from("messages")
      .insert(insertRow)
      .select()
      .single();
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error(error.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === optimistic.id ? (data as unknown as ChatMessage) : m)),
    );

    // Fan-out notifications for mentioned teammates (excluding self)
    const targets = mentions.filter((id) => id !== user.id);
    if (targets.length > 0 && activeChannel.org_id) {
      const senderName =
        profiles[user.id]?.display_name ?? profiles[user.id]?.email ?? "Someone";
      const rows = targets.map((uid) => ({
        org_id: activeChannel.org_id,
        app: "chat",
        severity: "info",
        title: `${senderName} mentioned you in #${activeChannel.name ?? "chat"}`,
        body: content.slice(0, 240),
        metadata: {
          channel_id: activeChannel.id,
          message_id: (data as any)?.id,
          mentioned_user_id: uid,
        },
      }));
      void supabase.from("notifications").insert(rows);
    }
  }

  async function editMessage(messageId: string, newContent: string) {
    if (!user || !activeChannel) return;
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    if (target.user_id !== user.id) {
      toast.error("You can only edit your own messages");
      return;
    }
    if (activeChannel.is_system) {
      toast.error("System channels are read-only");
      return;
    }
    if (newContent.trim() === target.content) return;

    const now = new Date().toISOString();
    const prevEdits = Array.isArray(target.metadata?.edits) ? target.metadata.edits : [];
    const nextMetadata = {
      ...(target.metadata ?? {}),
      edits: [
        ...prevEdits,
        { content: target.content, at: target.edited_at ?? target.created_at },
      ],
    };

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: newContent, edited_at: now, metadata: nextMetadata }
          : m,
      ),
    );

    const { error } = await supabase
      .from("messages")
      .update({
        content: newContent,
        edited_at: now,
        metadata: nextMetadata as any,
      } as any)
      .eq("id", messageId);

    if (error) {
      // Roll back
      setMessages((prev) => prev.map((m) => (m.id === messageId ? target : m)));
      toast.error(error.message);
      return;
    }
    toast.success("Message updated");
  }

  async function deleteMessage(messageId: string) {
    if (!user || !activeChannel) return;
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    if (target.user_id !== user.id) {
      toast.error("You can only delete your own messages");
      return;
    }
    if (activeChannel.is_system) {
      toast.error("System channels are read-only");
      return;
    }
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    // Best-effort cleanup of attachment files
    const atts = Array.isArray(target.metadata?.attachments)
      ? (target.metadata.attachments as ChatAttachment[])
      : [];
    if (atts.length > 0) {
      void supabase.storage.from("chat-attachments").remove(atts.map((a) => a.path));
    }

    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    if (error) {
      setMessages((prev) => [...prev, target].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      toast.error(error.message);
      return;
    }
    toast.success("Message deleted");
  }

  async function saveRename() {
    if (!activeChannel || !renameValue.trim()) return;
    const next = renameValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!next || next === activeChannel.name) {
      setRenaming(false);
      return;
    }
    const { error } = await supabase
      .from("channels")
      .update({ name: next })
      .eq("id", activeChannel.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Renamed to #${next}`);
    setRenaming(false);
    await loadChannels();
  }

  async function handleSummarize() {
    if (!activeChannel) return;
    setSummarizing(true);
    setSummary(null);
    try {
      const recent = messages.slice(-50).map((m) => ({
        from: profiles[m.user_id ?? ""]?.display_name ?? "User",
        text: m.content,
        timestamp: m.created_at,
      }));
      const { data, error } = await supabase.functions.invoke("ai-summarize-channel", {
        body: {
          channel_name: activeChannel.name,
          org: activeOrg?.name,
          messages: recent,
        },
      });
      if (error) throw error;
      setSummary((data as any)?.summary ?? "No summary returned");
    } catch (e: any) {
      toast.error(e?.message ?? "Summary failed");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div
      className="flex h-[calc(100vh-7rem)] -m-4 md:-m-6 rounded-[12px] overflow-hidden"
      style={{
        border: "1px solid var(--border-glass)",
        background: "rgba(2,2,10,0.45)",
      }}
    >
      <ChannelList
        channels={channels}
        activeId={activeId}
        onSelect={setActiveId}
        onCreated={loadChannels}
        onNewDm={() => setDmOpen(true)}
      />

      <NewDmModal
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        onCreated={async (channelId) => {
          await loadChannels();
          setActiveId(channelId);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-glass)" }}
        >
          {activeChannel ? (
            <>
              {activeChannel.is_system ? (
                <Zap size={16} strokeWidth={1.5} style={{ color: "#818cf8" }} />
              ) : (
                <Hash size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
              )}
              {renaming && !activeChannel.is_system ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  onBlur={() => saveRename()}
                  className="input-glass"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 16,
                    padding: "2px 8px",
                    width: Math.max(160, renameValue.length * 10 + 20),
                    minWidth: 120,
                  }}
                />
              ) : (
                <button
                  className="group flex items-center gap-1.5"
                  onClick={() => {
                    if (activeChannel.is_system) return;
                    setRenameValue(activeChannel.name ?? "");
                    setRenaming(true);
                  }}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "var(--text-primary)",
                    background: "transparent",
                    border: "none",
                    cursor: activeChannel.is_system ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  {activeChannel.name}
                  {!activeChannel.is_system && (
                    <Pencil
                      size={11}
                      strokeWidth={1.5}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </button>
              )}
              {activeOrg && (
                <div className="flex items-center gap-2">
                  <span className="slash" style={{ fontSize: 14 }}>
                    /
                  </span>
                  <span
                    className="org-pill"
                    style={{ padding: "2px 10px", fontSize: 11 }}
                  >
                    <span
                      className="org-dot"
                      style={{ background: ORG_COLORS[activeOrg.slug] ?? activeOrg.color }}
                    />
                    {activeOrg.name}
                  </span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                {activeChannel.is_system && (
                  <span className="badge badge-info">System · Read-only</span>
                )}
              </div>
            </>
          ) : (
            <div className="t-mono">{loading ? "Loading…" : "Select a channel"}</div>
          )}
        </div>

        {/* Summary panel */}
        {summary !== null && (
          <div
            className="mx-4 mt-3 p-3 rounded-[10px] flex gap-3"
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.30)",
            }}
          >
            <Sparkles size={14} style={{ color: "#818cf8", marginTop: 2, flexShrink: 0 }} />
            <div className="flex-1">
              <div className="t-mono mb-1" style={{ fontSize: 9, color: "#a5b4fc" }}>
                AI Summary · last {Math.min(messages.length, 50)} messages
              </div>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text-primary)",
                }}
              >
                {summary || "No summary"}
              </div>
            </div>
            <button
              className="btn-icon"
              style={{ width: 24, height: 24 }}
              onClick={() => setSummary(null)}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Messages */}
        {activeChannel ? (
          <MessageList
            messages={messages}
            profiles={profiles}
            currentUserId={user?.id ?? ""}
            members={members}
            isSystemChannel={activeChannel.is_system}
            typingUsers={typingUsers}
            onEdit={editMessage}
            onDelete={deleteMessage}
            resolveAttachmentUrl={resolveAttachmentUrl}
          />
        ) : (
          <div className="flex-1" />
        )}

        {/* Input */}
        {activeChannel && (
          <MessageInput
            channelName={activeChannel.name ?? ""}
            disabled={activeChannel.is_system}
            members={members}
            onSend={handleSend}
            onUpload={uploadAttachment}
            onTyping={handleTyping}
            onSummarize={handleSummarize}
            summarizing={summarizing}
          />
        )}
      </div>
    </div>
  );
}
