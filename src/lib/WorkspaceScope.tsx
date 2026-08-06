import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * WorkspaceScope — global application state, not a filter label.
 *
 * scopeOrgId === null means "All Organizations". It is persisted on
 * profiles.active_org_id so scope survives reloads and device changes and is
 * readable by server-side functions. Every screen consumes this context; it
 * must never be reimplemented as local state on a screen.
 */

export interface ScopeOrg {
  id: string;
  name: string;
  slug: string;
  /** Identity colour lives in data, not tokens. */
  identity_color: string;
  is_demo: boolean;
}

interface Value {
  loading: boolean;
  orgs: ScopeOrg[];
  scopeOrgId: string | null;
  setScope: (id: string | null) => void;
  /** Orgs counted against the plan — demo orgs are excluded. */
  billableOrgCount: number;
  orgLimit: number;
  atOrgLimit: boolean;
  planLabel: string;
}

const Ctx = createContext<Value>({
  loading: true,
  orgs: [],
  scopeOrgId: null,
  setScope: () => {},
  billableOrgCount: 0,
  orgLimit: Infinity,
  atOrgLimit: false,
  planLabel: "",
});

/** Internal 'platform' tier is unlimited and is not sold. */
const ORG_LIMITS: Record<string, number> = {
  free: 2,
  trial: 2,
  starter: 3,
  growth: 5,
  scale: 10,
  enterprise: Infinity,
  platform: Infinity,
};

export const WorkspaceScopeProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<ScopeOrg[]>([]);
  const [scopeOrgId, setScopeOrgId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [orgsRes, profileRes, tenantRes] = await Promise.allSettled([
        supabase
          .from("orgs")
          .select("id,name,slug,color,is_demo")
          .order("display_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("profiles").select("active_org_id").eq("id", auth.user.id).maybeSingle(),
        supabase.from("tenants").select("plan").limit(1).maybeSingle(),
      ]);

      if (cancelled) return;

      if (orgsRes.status === "fulfilled" && orgsRes.value.data) {
        setOrgs(
          orgsRes.value.data.map((o: any) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            identity_color: o.color,
            is_demo: !!o.is_demo,
          })),
        );
      }
      if (profileRes.status === "fulfilled") {
        setScopeOrgId(((profileRes.value.data as any)?.active_org_id as string) ?? null);
      }
      if (tenantRes.status === "fulfilled" && (tenantRes.value.data as any)?.plan) {
        setPlan((tenantRes.value.data as any).plan);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Optimistic: the UI re-scopes immediately, the write follows. */
  const setScope = useCallback((id: string | null) => {
    setScopeOrgId(id);
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      await supabase.from("profiles").update({ active_org_id: id }).eq("id", auth.user.id);
    })();
  }, []);

  const value = useMemo<Value>(() => {
    const billable = orgs.filter((o) => !o.is_demo).length;
    const limit = ORG_LIMITS[plan] ?? 2;
    return {
      loading,
      orgs,
      scopeOrgId,
      setScope,
      billableOrgCount: billable,
      orgLimit: limit,
      atOrgLimit: billable >= limit,
      planLabel: plan,
    };
  }, [loading, orgs, scopeOrgId, setScope, plan]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useWorkspaceScope = () => useContext(Ctx);
