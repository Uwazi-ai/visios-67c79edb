import { useSyncExternalStore } from "react";
import { GUARDRAILS } from "@/data/connections";

/**
 * Guardrail switches live outside the component tree for the same reason
 * proposal approvals do: leaving Settings and coming back must not silently
 * re-enable a permission the user just turned off.
 *
 * Only the unlocked rows are represented here. The locked four have no entry
 * and no setter — there is nothing to flip, by construction rather than by
 * convention.
 */

let state: Record<string, boolean> = Object.fromEntries(
  GUARDRAILS.filter((g) => !g.locked).map((g) => [g.id, g.initial]),
);

const listeners = new Set<() => void>();

export function setGuardrail(id: string, value: boolean) {
  if (!(id in state)) return; // locked rows are not addressable
  state = { ...state, [id]: value };
  listeners.forEach((l) => l());
}

export function useGuardrails(): Record<string, boolean> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
