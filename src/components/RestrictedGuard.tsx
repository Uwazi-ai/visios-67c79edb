import { Navigate } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";

export const RestrictedGuard = ({ children }: { children: JSX.Element }) => {
  const { isRestricted, loading } = useOrg();
  if (loading) return null;
  if (isRestricted) return <Navigate to="/dashboard" replace />;
  return children;
};
