import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

/**
 * AppState — the three things every screen needs: theme, workspace scope,
 * identity. One context, no prop drilling, no second source of truth.
 *
 * Declared as module exports so the import graph enforces ordering:
 * nothing here can be read before it is defined.
 */

export type Theme = "dark" | "light";

/** "__any" = belongs to no single venture. A general channel, a shared doc,
 *  a platform notice. These must survive every filter or the founder loses
 *  the cross-org layer the moment they scope down. */
export const ANY_ORG = "__any";

export interface Org {
  id: string;
  name: string;
  /** What you are to this venture, not what it does. */
  role: string;
  /** Always a token reference — no component holds a hex. */
  color: string;
  logo?: string;
}

export interface Me {
  name: string;
  initials: string;
  color: string;
  photo?: string;
}

/**
 * Replace with:
 *   select o.id, o.name, m.role_label, o.color, o.logo_url
 *   from orgs o join org_members m on m.org_id = o.id
 *   where m.user_id = auth.uid() order by o.display_order;
 *
 * "All organizations" is a first-class state, not a fallback. That is the
 * whole difference from Slack, where you are in exactly one workspace at a
 * time. A founder wears four hats before lunch.
 */
export const ORGS: Org[] = [
  { id: "all", name: "All organizations", role: "Everything, unfiltered", color: "var(--org-all)" },
  { id: "uwazi", name: "UWAZI.AI", role: "Founder", color: "var(--org-uwazi)" },
  { id: "cc", name: "Culture Club", role: "Managing partner", color: "var(--org-cc)" },
  { id: "bin", name: "BIN", role: "Black Innovators Network", color: "var(--org-bin)" },
  { id: "raia", name: "Raia Ventures Inc.", role: "Owner", color: "var(--org-raia)" },
  { id: "1flock", name: "1Flock", role: "Ship & handoff", color: "var(--org-1flock)" },
];

const ME: Me = { name: "Myke", initials: "MY", color: "var(--org-uwazi)" };

interface AppStateValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  scope: string;
  setScope: (id: string) => void;
  /** True when unscoped, when the org matches, or when the record belongs
   *  to no single venture. */
  inScope: (org?: string | null) => boolean;
  /** The org record for the current scope — always defined. */
  scopeOrg: () => Org;

  orgs: Org[];
  setOrgColor: (id: string, color: string) => void;
  setOrgLogo: (id: string, logo: string) => void;

  me: Me;
  setMyColor: (color: string) => void;
  setMyPhoto: (photo: string) => void;
}

const noop = () => {};

const Ctx = createContext<AppStateValue>({
  theme: "dark",
  setTheme: noop,
  toggleTheme: noop,
  scope: "all",
  setScope: noop,
  inScope: () => true,
  scopeOrg: () => ORGS[0],
  orgs: ORGS,
  setOrgColor: noop,
  setOrgLogo: noop,
  me: ME,
  setMyColor: noop,
  setMyPhoto: noop,
});

const THEME_KEY = "kova:theme";
const SCOPE_KEY = "kova:scope";

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    return stored === "light" ? "light" : "dark";
  });
  const [scope, setScopeState] = useState<string>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(SCOPE_KEY) : null;
    return stored && ORGS.some((o) => o.id === stored) ? stored : "all";
  });
  const [orgs, setOrgs] = useState<Org[]>(ORGS);
  const [me, setMe] = useState<Me>(ME);

  /* The attribute on <html> is the single switch. index.html ships
     data-theme="dark" so a dead JS bundle still renders a styled page. */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setScope = useCallback((id: string) => {
    setScopeState(id);
    localStorage.setItem(SCOPE_KEY, id);
  }, []);

  const inScope = useCallback(
    (org?: string | null) => scope === "all" || org === scope || org === ANY_ORG,
    [scope],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      scope,
      setScope,
      inScope,
      scopeOrg: () => orgs.find((o) => o.id === scope) ?? orgs[0],
      orgs,
      setOrgColor: (id, color) =>
        setOrgs((list) => list.map((o) => (o.id === id ? { ...o, color } : o))),
      setOrgLogo: (id, logo) =>
        setOrgs((list) => list.map((o) => (o.id === id ? { ...o, logo } : o))),
      me,
      setMyColor: (color) => setMe((m) => ({ ...m, color })),
      setMyPhoto: (photo) => setMe((m) => ({ ...m, photo })),
    }),
    [theme, scope, setScope, inScope, orgs, me],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAppState = () => useContext(Ctx);
