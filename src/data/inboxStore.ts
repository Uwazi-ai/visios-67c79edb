import { useSyncExternalStore } from "react";

/**
 * Send decisions live outside the component tree and are terminal for the
 * session — the same rule as proposals and Vision gates. Selecting another
 * thread and coming back must not re-arm a send that already happened.
 */
export type SendState = "draft" | "sent" | "discarded";

let state: Record<string, SendState> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setSend(threadId: string, next: Exclude<SendState, "draft">) {
  if (state[threadId]) return; // terminal
  state = { ...state, [threadId]: next };
  emit();
}

export function useSends(): Record<string, SendState> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
