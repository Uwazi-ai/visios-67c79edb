import { supabase } from "@/integrations/supabase/client";

/**
 * Starts Google OAuth with the project's own Google client (custom Gmail/Calendar/Drive scopes).
 *
 * Google sends `X-Frame-Options: DENY`, so its sign-in page cannot load inside a frame
 * (e.g. the editor preview). When framed, we open Google in a new top-level tab instead
 * of redirecting the frame. Outside a frame, this is a normal full-page redirect.
 */
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
