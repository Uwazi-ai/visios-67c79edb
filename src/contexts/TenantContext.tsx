import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  seats: number;
  ai_pool_limit: number;
  status: string;
  trial_ends_at: string;
}

export type TenantRole = "owner" | "admin" | "member";

interface TenantCtx {
  /** Tenants the signed-in user can see. Platform staff see all. */
  tenants: Tenant[];
  /** The tenant currently being viewed. For non-platform users this is always their own. */
  activeTenantId: string | null;
  /** Only meaningful for platform staff — everyone else is pinned to their own tenant. */
  setActiveTenantId: (id: string) => void;
  /** The user's own tenant, derived server-side from tenant_users. */
  myTenantId: string | null;
  role: TenantRole | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<TenantCtx>({
  tenants: [],
  activeTenantId: null,
  setActiveTenantId: () => {},
  myTenantId: null,
  role: null,
  isPlatformAdmin: false,
  loading: true,
  refresh: async () => {},
});

const STORAGE_KEY = "kova:activeTenant";

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [myTenantId, setMyTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<TenantRole | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [activeTenantId, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setMyTenantId(null);
      setRole(null);
      setIsPlatformAdmin(false);
      setActive(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: memberships }, { data: tenantRows }, { data: admin }] = await Promise.all([
      supabase.from("tenant_users").select("tenant_id, role").eq("user_id", user.id),
      supabase.from("tenants").select("*").order("created_at", { ascending: true }),
      supabase.rpc("is_platform_admin"),
    ]);

    const mine = (memberships ?? [])[0] ?? null;
    const platform = Boolean(admin);
    const list = (tenantRows ?? []) as Tenant[];

    setTenants(list);
    setMyTenantId(mine?.tenant_id ?? null);
    setRole((mine?.role as TenantRole) ?? null);
    setIsPlatformAdmin(platform);

    if (platform) {
      const stored = localStorage.getItem(STORAGE_KEY);
      setActive(stored && list.some((t) => t.id === stored) ? stored : mine?.tenant_id ?? list[0]?.id ?? null);
    } else {
      setActive(mine?.tenant_id ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveTenantId = (id: string) => {
    // Only platform staff can view another tenant; RLS enforces this server-side too.
    if (!isPlatformAdmin) return;
    setActive(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <Ctx.Provider
      value={{
        tenants,
        activeTenantId,
        setActiveTenantId,
        myTenantId,
        role,
        isPlatformAdmin,
        loading,
        refresh: load,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useTenant = () => useContext(Ctx);
