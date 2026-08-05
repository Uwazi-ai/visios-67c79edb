import { useSyncExternalStore } from "react";
import { ActionState, CHANNELS, Channel, ME, Message, SEED } from "@/data/chat";

/**
 * Chat state lives outside the component tree for one specific reason:
 * action state must survive every re-render of the channel. Reacting to a
 * message re-renders the list; if "approved" were held in the card's own
 * useState it would silently revert to pending on the next emoji. It is a
 * field on the message record and nowhere else.
 *
 * Replace with: a messages table plus realtime. The shape below is already
 * row-shaped — reactions as a jsonb map, action_state as an enum column.
 */

interface ChatState {
  channels: Channel[];
  messages: Message[];
}

let state: ChatState = { channels: CHANNELS, messages: SEED };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let n = 1000;
const newId = () => `m${++n}`;

export function markRead(channelId: string) {
  if (!state.channels.some((c) => c.id === channelId && c.unread > 0)) return;
  state = {
    ...state,
    channels: state.channels.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c)),
  };
  emit();
}

const mapMessage = (id: string, fn: (m: Message) => Message) => {
  state = {
    ...state,
    messages: state.messages.map((m) => {
      if (m.id === id) return fn(m);
      if (m.replies.some((r) => r.id === id)) {
        return { ...m, replies: m.replies.map((r) => (r.id === id ? fn(r) : r)) };
      }
      return m;
    }),
  };
  emit();
};

export function toggleReaction(messageId: string, emoji: string, who = ME) {
  mapMessage(messageId, (m) => {
    const current = m.reactions[emoji] ?? [];
    const next = current.includes(who) ? current.filter((w) => w !== who) : [...current, who];
    const reactions = { ...m.reactions };
    if (next.length) reactions[emoji] = next;
    else delete reactions[emoji];
    return { ...m, reactions };
  });
}

/** Terminal. An approved write already happened; a second click cannot
 *  un-happen it, so there is no path back to pending. */
export function decideAction(messageId: string, decision: ActionState) {
  mapMessage(messageId, (m) =>
    m.actionState && m.actionState !== "pending" ? m : { ...m, actionState: decision },
  );
}

export function postMessage(channel: string, text: string, author = ME) {
  const body = text.trim();
  if (!body) return;
  const last = state.messages.filter((m) => m.channel === channel).at(-1);
  state = {
    ...state,
    messages: [
      ...state.messages,
      {
        id: newId(),
        channel,
        author,
        at: (last?.at ?? 0) + 1,
        text: body,
        reactions: {},
        replies: [],
      },
    ],
  };
  emit();
}

export function postReply(parentId: string, text: string, author = ME) {
  const body = text.trim();
  if (!body) return;
  mapMessage(parentId, (m) => ({
    ...m,
    replies: [
      ...m.replies,
      {
        id: newId(),
        channel: m.channel,
        author,
        at: (m.replies.at(-1)?.at ?? m.at) + 1,
        text: body,
        reactions: {},
        replies: [],
      },
    ],
  }));
}

export function useChat(): ChatState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
