import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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
  isRestricted: boolean;
  loading: boolean;
  refreshOrgs: () => Promise<void>;
}

const Ctx = createContext<OrgCtx>({
  orgs: [],
  memberships: [],
  activeOrgId: null,
  setActiveOrgId: () => {},
  isOwner: false,
  isRestricted: false,
  loading: true,
  refreshOrgs: async () => {},
});

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActive] = useState<string | "all" | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrgs = useCallback(async () => {
    const { data: orgsData } = await supabase
      .from("orgs")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    setOrgs(((orgsData ?? []) as unknown) as Org[]);
  }, []);

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
      const [{ data: orgsData }, { data: memData }] = await Promise.all([
        supabase.from("orgs").select("*").eq("is_active", true).order("display_order", { ascending: true }),
        supabase.from("org_memberships").select("org_id, role").eq("user_id", user.id),
      ]);
      setOrgs(((orgsData ?? []) as unknown) as Org[]);
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

  // Realtime: refresh on any orgs change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("orgs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orgs" }, () => {
        refreshOrgs();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "org_memberships", filter: `user_id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from("org_memberships").select("org_id, role").eq("user_id", user.id);
        setMemberships((data ?? []) as Membership[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refreshOrgs]);

  const setActiveOrgId = (id: string | "all") => {
    setActive(id);
    localStorage.setItem("visi:activeOrg", id);
  };

  const isOwner = memberships.some((m) => m.role === "owner");

  return (
    <Ctx.Provider value={{ orgs, memberships, activeOrgId, setActiveOrgId, isOwner, loading, refreshOrgs }}>
      {children}
    </Ctx.Provider>
  );
};

export const useOrg = () => useContext(Ctx);
