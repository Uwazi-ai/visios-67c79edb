import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Org } from "@/lib/orgs";

interface Membership {
  org_id: string;
  role: "owner" | "admin" | "member";
}

interface OrgCtx {
  orgs: Org[];
  memberships: Membership[];
  activeOrgId: string | "all" | null;
  setActiveOrgId: (id: string | "all") => void;
  isOwner: boolean;
  loading: boolean;
}

const Ctx = createContext<OrgCtx>({
  orgs: [],
  memberships: [],
  activeOrgId: null,
  setActiveOrgId: () => {},
  isOwner: false,
  loading: true,
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActive] = useState<string | "all" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrgs([]);
      setMemberships([]);
      setActive(null);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data: orgsData } = await supabase.from("orgs").select("*").order("name");
      const { data: memData } = await supabase
        .from("org_memberships")
        .select("org_id, role")
        .eq("user_id", user.id);
      setOrgs(orgsData ?? []);
      setMemberships((memData ?? []) as Membership[]);

      const stored = localStorage.getItem("visi:activeOrg");
      if (stored && (stored === "all" || (orgsData ?? []).some((o) => o.id === stored))) {
        setActive(stored as string | "all");
      } else if ((memData ?? []).length > 0) {
        setActive(memData![0].org_id);
      } else if ((orgsData ?? []).length > 0) {
        setActive(orgsData![0].id);
      }
      setLoading(false);
    })();
  }, [user]);

  const setActiveOrgId = (id: string | "all") => {
    setActive(id);
    localStorage.setItem("visi:activeOrg", id);
  };

  const isOwner = memberships.some((m) => m.role === "owner");

  return (
    <Ctx.Provider value={{ orgs, memberships, activeOrgId, setActiveOrgId, isOwner, loading }}>
      {children}
    </Ctx.Provider>
  );
};

export const useOrg = () => useContext(Ctx);
