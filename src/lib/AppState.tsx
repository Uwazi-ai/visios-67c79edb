import { createContext, useContext, useMemo, useState, ReactNode } from "react";

/**
 * AppState — theme · workspace scope · identity.
 *
 * Rule 2: declare shared helpers before anything runs. These are module
 * exports, so the import graph enforces the ordering that discipline
 * used to. Nothing here is read before it is defined.
 */

export type Theme = "dark" | "light";

export interface Workspace {
  id: string;
  name: string;
  short: string;
}

export interface Identity {
  name: string;
  initials: string;
  role: string;
}

/** Replace with: select id, name, short from orgs where member_of(auth.uid()) */
export const WORKSPACES: Workspace[] = [
  { id: "all", name: "All workspaces", short: "ALL" },
  { id: "uwazi", name: "Uwazi.AI", short: "UW" },
  { id: "bin", name: "BIN", short: "BIN" },
  { id: "cc", name: "Culture Club", short: "CC" },
];

interface AppStateValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  scope: string;
  setScope: (id: string) => void;
  workspaces: Workspace[];
  workspace: Workspace;
  identity: Identity;
  setIdentity: (i: Identity) => void;
}

const DEFAULTS: AppStateValue = {
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  scope: "all",
  setScope: () => {},
  workspaces: WORKSPACES,
  workspace: WORKSPACES[0],
  identity: { name: "Myke", initials: "MY", role: "Operator" },
  setIdentity: () => {},
};

const Ctx = createContext<AppStateValue>(DEFAULTS);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");
  const [scope, setScope] = useState<string>("all");
  const [identity, setIdentity] = useState<Identity>(DEFAULTS.identity);

  const value = useMemo<AppStateValue>(() => {
    const workspace = WORKSPACES.find((w) => w.id === scope) ?? WORKSPACES[0];
    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      scope,
      setScope,
      workspaces: WORKSPACES,
      workspace,
      identity,
      setIdentity,
    };
  }, [theme, scope, identity]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAppState = () => useContext(Ctx);
