import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SourceId } from "@/lib/sources";

/**
 * Sync status per connected source.
 *
 * Connecting a source is not the same as reading from it. This store keeps
 * the two apart so a tenant can tell "connected but never synced" from
 * "connected and reading cleanly" from "connected and failing since 04:12".
 *
 * States:
 *   idle     connected, no read attempted yet in this session
 *   syncing  a read is in flight
 *   ok       the last read succeeded — lastSyncAt holds when
 *   error    the last read failed — error holds why, lastSyncAt still holds
 *            the last time it *did* work, because that is the number you
 *            need when deciding whether the data on screen is stale
 */
export type SyncState = "idle" | "syncing" | "ok" | "error";

export interface SyncStatus {
  state: SyncState;
  /** Last time this source returned successfully, ms epoch. */
  lastSyncAt: number | null;
  /** Rows the last successful read produced. */
  rows: number | null;
  /** Why the last attempt failed, verbatim. */
  error?: string;
}

const KEY = "kova:sync";

type Map_ = Partial<Record<SourceId, SyncStatus>>;

const load = (): Map_ => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Map_;
    // A page reload never leaves a read in flight.
    Object.values(parsed).forEach((s) => {
      if (s && s.state === "syncing") s.state = "idle";
    });
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

let statuses: Map_ = load();
const listeners = new Set<() => void>();

const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(statuses));
  } catch {
    /* private mode — session state still holds */
  }
};

const commit = (next: Map_) => {
  statuses = next;
  persist();
  listeners.forEach((l) => l());
};

const IDLE: SyncStatus = { state: "idle", lastSyncAt: null, rows: null };

export const getSyncStatus = (id: SourceId): SyncStatus => statuses[id] ?? IDLE;

export const markSyncing = (id: SourceId) =>
  commit({ ...statuses, [id]: { ...getSyncStatus(id), state: "syncing", error: undefined } });

export const markSynced = (id: SourceId, rows: number | null = null) =>
  commit({ ...statuses, [id]: { state: "ok", lastSyncAt: Date.now(), rows, error: undefined } });

export const markSyncError = (id: SourceId, error: string) => {
  const prev = getSyncStatus(id);
  commit({ ...statuses, [id]: { ...prev, state: "error", error } });
};

/** Forget a source's history when it is disconnected — no ghost timestamps. */
export const clearSyncStatus = (id: SourceId) => {
  const next = { ...statuses };
  delete next[id];
  commit(next);
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const snapshot = () => statuses;
const server = () => ({}) as Map_;

export const useSyncStatuses = (): Map_ => useSyncExternalStore(subscribe, snapshot, server);

export const useSyncStatus = (id: SourceId): SyncStatus => useSyncStatuses()[id] ?? IDLE;

/* ------------------------------------------------------------------ */
/* Probes                                                              */
/* ------------------------------------------------------------------ */

/**
 * A probe is the cheapest real read a source can do. If a source has no
 * probe we say so rather than inventing a green tick — an unverified
 * connection is not a working one.
 */
type Probe = () => Promise<number>;

const PROBES: Partial<Record<SourceId, Probe>> = {
  supabase: async () => {
    const { count, error } = await supabase
      .from("kova_tasks")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
  google: async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase.functions.invoke("calendar-list-events", {
      body: { timeMin: now.toISOString(), timeMax: soon.toISOString() },
    });
    if (error) throw new Error(error.message);
    return Array.isArray(data?.events) ? data.events.length : 0;
  },
};

export const hasProbe = (id: SourceId) => Boolean(PROBES[id]);

/** Run one source's probe and record the outcome. Never throws. */
export async function syncSource(id: SourceId): Promise<void> {
  const probe = PROBES[id];
  if (!probe) return;
  markSyncing(id);
  try {
    const rows = await probe();
    markSynced(id, rows);
  } catch (e) {
    markSyncError(id, e instanceof Error ? e.message : String(e));
  }
}

/** Sync every connected source that can actually be checked, in parallel. */
export async function syncAll(ids: SourceId[]): Promise<void> {
  await Promise.allSettled(ids.filter(hasProbe).map(syncSource));
}

/** "2 minutes ago" — relative, because the absolute time is not the question. */
export function relativeTime(ms: number | null): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** 12-hour display, per the house rule. Data stays 24-hour. */
export function absoluteTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
