import { useSyncExternalStore } from "react";
import { PROPOSALS, Proposal, ProposalStatus } from "@/data/mock";

/**
 * Proposal records — the one place approval state lives.
 *
 * Deliberately a module-level store rather than component state. The rule
 * is that approval belongs to the record, not to the DOM and not to a
 * mounted component: a re-render must never revert an approved item to
 * pending, and neither should navigating to another screen and back.
 * Component state would satisfy the first and quietly fail the second.
 *
 * Swap the two functions below for a table write and a realtime
 * subscription and nothing in the UI changes.
 */

let records: Proposal[] = PROPOSALS.map((p) => ({ ...p }));
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/**
 * Live rows replace the fixtures wholesale. Approvals already decided in
 * this session are kept: a re-read of the table must not walk an approved
 * item back to pending just because the row has not been written yet.
 */
export function hydrateProposals(next: Proposal[]) {
  const decided = new Map(records.filter((r) => r.status !== "pending").map((r) => [r.id, r.status]));
  records = next.map((p) => ({ ...p, status: decided.get(p.id) ?? p.status }));
  emit();
}

export function setProposalStatus(id: string, status: ProposalStatus) {
  records = records.map((r) => (r.id === id ? { ...r, status } : r));
  emit();
}

export function useProposals(): Proposal[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => records,
    () => records,
  );
}
