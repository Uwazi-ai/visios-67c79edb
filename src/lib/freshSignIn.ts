import { supabase } from "@/integrations/supabase/client";

/**
 * Force sign-in on every new browser session (new tab / new window / browser restart).
 * Existing session tokens are cleared so the user must re-authenticate.
 *
 * Uses sessionStorage (which is per-tab and cleared on browser close) as a marker.
 * If the marker is missing, we treat this as a fresh session and sign out.
 *
 * Public routes (/book/*, /card/*, /login) are exempt — they never trigger sign-out
 * and don't set the marker, so they don't leak an authenticated session into the app.
 */
const MARKER_KEY = "visi:session-active";

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/book/") ||
    pathname.startsWith("/card/") ||
    pathname === "/login"
  );
}

/** Records that this tab has a deliberate sign-in, so a later reload keeps it. */
export function markSessionActive() {
  try {
    sessionStorage.setItem(MARKER_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** True when this page load is the return leg of an OAuth sign-in (tokens in the URL hash). */
function isOAuthReturn() {
  return /(^#|&)(access_token|error)=/.test(window.location.hash);
}

export function enforceFreshSignIn() {
  try {
    const path = window.location.pathname;
    if (isPublicPath(path)) return;

    // Coming back from Google: this IS a fresh sign-in, so keep it.
    if (isOAuthReturn()) {
      markSessionActive();
      return;
    }

    const alreadyActive = sessionStorage.getItem(MARKER_KEY);
    if (alreadyActive) return;

    // Fresh tab/session: clear any persisted Supabase auth so the user must sign in.
    Object.keys(localStorage).forEach((k) => {
      if (/^sb-/i.test(k) || /^supabase\./i.test(k)) {
        localStorage.removeItem(k);
      }
    });

    // Best-effort signOut to clear in-memory state (no-op if no session).
    void supabase.auth.signOut().catch(() => {});

    sessionStorage.setItem(MARKER_KEY, "1");
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}
