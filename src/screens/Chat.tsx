import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Card, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import { ChannelRail, Composer, MessageRow } from "@/components/ChatParts";
import { grouped as isGrouped, Message } from "@/data/chat";
import { decideAction, markRead, postMessage, postReply, toggleReaction, useChat } from "@/data/chatStore";
import { useAppState } from "@/lib/AppState";

/**
 * Chat — the standard mechanics, plus the one thing that isn't standard:
 * agents are channel members. Bug Patrol's finding lands in #uwazi-eng
 * with an AGENT badge and a gated action card, and humans reply to it in
 * thread like they would to a colleague.
 *
 * Action state is read from the message record on every render. Nothing
 * here caches it — reacting to any message re-renders the channel, and an
 * approved action reverting to pending would be the one unforgivable bug.
 */
const Chat = () => {
  const { orgs, inScope, scope } = useAppState();
  const scopeName = orgs.find((o) => o.id === scope)?.name ?? "All organizations";
  const { channels, messages, authors } = useChat();
  const [threadId, setThreadId] = useState<string | null>(null);

  const visible = useMemo(() => channels.filter((c) => inScope(c.org)), [channels, inScope]);
  const [activeId, setActiveId] = useState(visible[0]?.id ?? "");

  /* Scoping down can remove the open channel. Falling back beats a blank pane. */
  useEffect(() => {
    if (!visible.some((c) => c.id === activeId)) {
      setActiveId(visible[0]?.id ?? "");
      setThreadId(null);
    }
  }, [visible, activeId]);

  useEffect(() => {
    if (activeId) markRead(activeId);
  }, [activeId]);

  const channel = visible.find((c) => c.id === activeId);
  const feed = messages.filter((m) => m.channel === activeId);
  const thread: Message | undefined = threadId ? messages.find((m) => m.id === threadId) : undefined;
  const pending = feed.filter((m) => m.action && (m.actionState ?? "pending") === "pending").length;

  const peer = channel?.peer ? authors[channel.peer] : undefined;
  const title = channel ? (channel.kind === "dm" ? channel.name : `#${channel.name}`) : "Chat";

  return (
    <div>
      <SectionHead
        title="Chat"
        action={
          pending ? (
            <span className="vo-tag" data-tone="warn">
              {pending} agent action{pending === 1 ? "" : "s"} waiting on you
            </span>
          ) : undefined
        }
      />

      <div className="vo-chat3" data-thread={thread ? "true" : undefined}>
        <Card ungated style={{ padding: "var(--s-3)" }}>
          <ChannelRail
            channels={visible}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setThreadId(null);
            }}
          />
        </Card>

        <Card ungated style={{ padding: 0 }}>
          {channel ? (
            <div className="vo-chpane">
              <header className="vo-chhead">
                <div>
                  <div className="vo-chtitle">{title}</div>
                  <div className="vo-meta">
                    {channel.kind === "dm"
                      ? `${peer?.presence === "online" ? "Online" : peer?.presence === "away" ? "Away" : "Offline"} · direct message`
                      : channel.topic}
                  </div>
                </div>
                {channel.kind === "channel" ? (
                  <div className="vo-chmembers">
                    {Object.values(authors)
                      .filter((a) => a.kind === "agent")
                      .map((a) => (
                        <span key={a.id} className="vo-chagent" title={a.remit}>
                          {a.name}
                        </span>
                      ))}
                  </div>
                ) : null}
              </header>

              <div className="vo-chfeed">
                {feed.length === 0 ? <Desc>No messages here yet.</Desc> : null}
                {feed.map((m, i) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    grouped={isGrouped(m, feed[i - 1])}
                    threadOpen={threadId === m.id}
                    onReact={(e) => toggleReaction(m.id, e)}
                    onOpenThread={() => setThreadId(m.id)}
                    onDecide={(d) => decideAction(m.id, d)}
                  />
                ))}
              </div>

              <Composer
                label={`Message ${title}`}
                placeholder={`Message ${title}`}
                onSend={(text) => postMessage(activeId, text)}
              />
            </div>
          ) : (
            <div className="vo-empty">
              <Eyebrow>{scopeName}</Eyebrow>
              <Desc>No conversations for {scopeName}. Switch scope in the rail to see the rest.</Desc>
            </div>
          )}
        </Card>

        {thread ? (
          <Card ungated style={{ padding: 0 }}>
            <div className="vo-chpane">
              <header className="vo-chhead">
                <div>
                  <div className="vo-chtitle">Thread</div>
                  <div className="vo-meta">
                    {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"} ·{" "}
                    {authors[thread.author]?.name}
                  </div>
                </div>
                <button type="button" className="vo-chaction" onClick={() => setThreadId(null)} title="Close thread">
                  <X size={14} strokeWidth={1.75} aria-hidden />
                </button>
              </header>

              <div className="vo-chfeed">
                <MessageRow
                  message={thread}
                  grouped={false}
                  compact
                  onReact={(e) => toggleReaction(thread.id, e)}
                  onDecide={(d) => decideAction(thread.id, d)}
                />
                <div className="vo-chdivider">Replies</div>
                {thread.replies.map((r, i) => (
                  <MessageRow
                    key={r.id}
                    message={r}
                    compact
                    grouped={isGrouped(r, thread.replies[i - 1])}
                    onReact={(e) => toggleReaction(r.id, e)}
                  />
                ))}
              </div>

              <Composer label="Reply in thread" placeholder="Reply in thread" onSend={(t) => postReply(thread.id, t)} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default Chat;
