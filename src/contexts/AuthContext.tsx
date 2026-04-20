import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

async function syncGoogleTokens(session: Session | null) {
  if (!session?.user) return;

  const sessionWithProvider = session as Session & {
    provider_token?: string;
    provider_refresh_token?: string;
  };
  const userMeta = session.user.user_metadata as {
    provider_token?: string;
    provider_refresh_token?: string;
  } | null;

  const google_access_token = sessionWithProvider.provider_token ?? userMeta?.provider_token ?? null;
  const google_refresh_token = sessionWithProvider.provider_refresh_token ?? userMeta?.provider_refresh_token ?? null;

  if (!google_access_token && !google_refresh_token) return;

  await supabase
    .from("profiles")
    .update({
      ...(google_access_token ? { google_access_token } : {}),
      ...(google_refresh_token ? { google_refresh_token } : {}),
    })
    .eq("id", session.user.id);
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST per best practice
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      void syncGoogleTokens(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      void syncGoogleTokens(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
