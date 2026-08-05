import { useSyncExternalStore } from "react";
import { Turn } from "@/data/vision";

/**
 * The thread and the approval decisions live outside the component tree,
 * for the same reason proposal approvals on the dashboard do: navigating to
 * Tasks and back must not quietly un-approve something, and it must not
 * re-offer an action the user already declined.
 *
 * Decisions are terminal in this session. There is no "un-approve" — once a
 * write has notionally happened, pretending it can be taken back with a
 * click is the lie that makes gating theatre.
 */

export type Decision = "approved" | "declined";

interface VisionState {
  thread: Turn[];
  decisions: Record<string, Decision>;
}

let state: VisionState = { thread: [], decisions: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function pushTurns(...turns: Turn[]) {
  state = { ...state, thread: [...state.thread, ...turns] };
  emit();
}

export function decide(turnId: string, decision: Decision) {
  if (state.decisions[turnId]) return; // terminal
  state = { ...state, decisions: { ...state.decisions, [turnId]: decision } };
  emit();
}

export function resetThread() {
  state = { thread: [], decisions: {} };
  emit();
}

export function useVision(): VisionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

let n = 0;
export const nextId = (role: string) => `${role}-${++n}`;
