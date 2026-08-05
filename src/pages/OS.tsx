import { useState } from "react";
import "@/design/tokens.css";
import { AppStateProvider, useAppState } from "@/lib/AppState";
import { Nav, NAV } from "@/components/Nav";
import { Card, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import Dashboard from "@/screens/Dashboard";

/**
 * Screen registry. Port a screen by writing it under src/screens and
 * adding one line here — nothing else changes.
 */
const SCREENS: Record<string, () => JSX.Element> = {
  dashboard: Dashboard,
};

const Placeholder = ({ id }: { id: string }) => {
  const label = NAV.find((n) => n.id === id)?.label ?? id;
  return (
    <div>
      <SectionHead title={label} />
      <Card ungated>
        <Eyebrow>Not ported yet</Eyebrow>
        <div style={{ height: "var(--s-2)" }} />
        <Desc>
          Dashboard is the reference implementation. Port this screen by adding
          <code> src/screens/{label.replace(/\W/g, "")}.tsx</code> and registering it — primitives,
          tokens and the ledger are already wired.
        </Desc>
      </Card>
    </div>
  );
};

const Shell = () => {
  const { theme } = useAppState();
  const [active, setActive] = useState("dashboard");
  const Screen = SCREENS[active];

  return (
    <div className="visi-os" data-theme={theme}>
      <div className="vo-shell">
        <Nav active={active} onNavigate={setActive} />
        <main className="vo-main">{Screen ? <Screen /> : <Placeholder id={active} />}</main>
      </div>
    </div>
  );
};

const OS = () => (
  <AppStateProvider>
    <Shell />
  </AppStateProvider>
);

export default OS;
