import { useSyncExternalStore } from "react";
import { TASKS, Task } from "@/data/tasks";

/**
 * Task records — completion lives here, not in a mounted component.
 *
 * Same reasoning as the proposal store: switching from List to Board, or
 * navigating away and back, must not resurrect a task you just closed.
 * Component state satisfies the first case and quietly fails the second.
 *
 * Swap the two writers for an update and a realtime subscription and no
 * screen changes.
 */

let records: Task[] = TASKS.map((t) => ({ ...t }));
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toggleTask(id: string) {
  records = records.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  emit();
}

export function useTaskRecords(): Task[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => records,
    () => records,
  );
}
