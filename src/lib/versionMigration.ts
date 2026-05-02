import { ASSET_VERSION } from "./assetVersion";

const VERSION_KEY = "visi:appVersion";

/**
 * Preserve list — keys that should survive a version bump cache flush.
 * Auth session, Supabase tokens, and explicit user prefs stay; everything
 * else (cached queries, ephemeral UI state, stale feature flags) is cleared.
 */
const LOCAL_STORAGE_PRESERVE = [
  /^sb-/i, // Supabase auth session
  /^supabase\./i,
  /^visi:user-/i, // user-scoped prefs we explicitly want to keep
];

const SESSION_STORAGE_PRESERVE: RegExp[] = [
  /^sb-/i,
];

function shouldPreserve(key: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(key));
}

function purgeStorage(storage: Storage, patterns: RegExp[]) {
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && !shouldPreserve(key, patterns)) toRemove.push(key);
  }
  toRemove.forEach((k) => {
    try {
      storage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}

async function purgeCacheStorage() {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  } catch {
    /* ignore */
  }
}

async function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
}

/**
 * Run on app boot. If the stored app version differs from the current
 * ASSET_VERSION, flush caches + non-essential storage so the user sees the
 * latest UI without a manual hard refresh.
 */
export function runVersionMigration() {
  if (typeof window === "undefined") return;
  let prev: string | null = null;
  try {
    prev = localStorage.getItem(VERSION_KEY);
  } catch {
    return;
  }

  if (prev === ASSET_VERSION) return;

  // First-run on this device: just record version, don't nuke storage.
  if (prev === null) {
    try {
      localStorage.setItem(VERSION_KEY, ASSET_VERSION);
    } catch {
      /* ignore */
    }
    return;
  }

  // Version changed → flush.
  try {
    purgeStorage(localStorage, LOCAL_STORAGE_PRESERVE);
    purgeStorage(sessionStorage, SESSION_STORAGE_PRESERVE);
    localStorage.setItem(VERSION_KEY, ASSET_VERSION);
  } catch {
    /* ignore */
  }

  // Fire-and-forget async cleanup.
  void purgeCacheStorage();
  void unregisterServiceWorkers();

  // eslint-disable-next-line no-console
  console.info(`[visi] cache flushed: ${prev} → ${ASSET_VERSION}`);
}
