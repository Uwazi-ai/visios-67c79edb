import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * A signed-out visitor used to reach /os and see an empty shell: every query
 * came back empty and every button silently did nothing. Send them to sign in
 * instead, and remember where they were headed.
 */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
};

export default RequireAuth;
