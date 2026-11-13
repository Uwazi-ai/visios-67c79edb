import { supabase } from "@/integrations/supabase/client";
import { markSessionActive } from "@/lib/freshSignIn";

/**
 * Starts Google OAuth with the project's own Google client (custom Gmail/Calendar/Drive scopes).
 *
 * Google sends `X-Frame-Options: DENY`, so its sign-in page cannot load inside a frame
 * (e.g. the editor preview). When framed, we open Google in a new top-level tab; when that
 * tab comes back signed in, it hands the session to the frame that opened it (same origin
 * only) and closes, so the preview itself ends up signed in. Outside a frame, this is a
 * normal full-page redirect.
 */
const BRIDGE_MESSAGE = "kova:google-session";

export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function startGoogleOAuth(opts: {
  redirectTo: string;
  scopes: string;
  queryParams?: Record<string, string>;
}): Promise<{ error: Error | null }> {
  const framed = isFramed();
  // Open the tab synchronously, inside the click, so popup blockers allow it.
  const tab = framed ? window.open("", "_blank") : null;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: opts.redirectTo,
      scopes: opts.scopes,
      queryParams: opts.queryParams,
      skipBrowserRedirect: framed,
    },
  });

  if (error) {
    tab?.close();
    return { error };
  }
  if (!framed || !data?.url) return { error: null };

  if (tab) {
    listenForTabSession(tab);
    tab.location.href = data.url;
    return { error: null };
  }
  try {
    window.top!.location.href = data.url;
    return { error: null };
  } catch {
    return { error: new Error("Your browser blocked the Google window. Allow pop-ups for this site and try again.") };
  }
}

/** Frame side: accept the session only from the tab we opened, on our own origin. */
function listenForTabSession(tab: Window) {
  const onMessage = async (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== tab) return;
    const d = e.data as { type?: string; access_token?: string; refresh_token?: string } | null;
    if (!d || d.type !== BRIDGE_MESSAGE || !d.access_token || !d.refresh_token) return;
    window.removeEventListener("message", onMessage);
    const { error } = await supabase.auth.setSession({
      access_token: d.access_token,
      refresh_token: d.refresh_token,
    });
    if (!error) markSessionActive();
  };
  window.addEventListener("message", onMessage);
}

/**
 * Tab side: run once at startup. If this tab is the return leg of a Google sign-in that a
 * framed preview opened, pass the new session back to that frame and close the tab.
 */
export function initGoogleOAuthTabBridge() {
  if (typeof window === "undefined") return;
  if (!/(^#|&)access_token=/.test(window.location.hash)) return;
  const opener = window.opener as Window | null;
  if (!opener || opener === window) return;

  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    if (!session || (event !== "SIGNED_IN" && event !== "INITIAL_SESSION")) return;
    sub.subscription.unsubscribe();
    try {
      // targetOrigin pins delivery to our own origin; any other opener gets nothing.
      opener.postMessage(
        { type: BRIDGE_MESSAGE, access_token: session.access_token, refresh_token: session.refresh_token },
        window.location.origin,
      );
      window.setTimeout(() => window.close(), 300);
    } catch {
      /* opener gone — this tab simply stays signed in */
    }
  });
}
