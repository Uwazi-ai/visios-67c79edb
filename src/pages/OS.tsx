import { useState } from "react";
import "@/design/tokens.css";
import "@/design/shell.css";
import { AppStateProvider, useAppState } from "@/lib/AppState";
import { Nav, NAV } from "@/components/Nav";
import { Button, Card, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import Dashboard from "@/screens/Dashboard";

/**
 * Screen registry. Port a screen by writing it under src/screens and adding
 * one line here — nothing else changes.
 */
const SCREENS: Record<string, () => JSX.Element> = {
  dashboard: Dashboard,
};

/**
 * Anything unregistered renders a named placeholder with a way back.
 * A blank pane reads as a crash, and the user has no idea whether they
 * broke it or you did.
 */
const Placeholder = ({ id, onBack }: { id: string; onBack: () => void }) => {
  const label = NAV.find((n) => n.id === id)?.label ?? id;
  return (
    <div>
      <SectionHead title={label} />
      <Card ungated>
        <div className="vo-empty">
          <Eyebrow>Not built yet</Eyebrow>
          <Desc>
            {label} is registered in the nav but has no screen behind it. Dashboard is
            the reference implementation — add <code>src/screens/{label.replace(/\W/g, "")}.tsx</code>{" "}
            and register it in <code>SCREENS</code>. Tokens, primitives and the scope
            filter are already wired.
          </Desc>
          <Button variant="primary" onClick={onBack}>
            Back to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

const Shell = () => {
  const [active, setActive] = useState("dashboard");
  const Screen = SCREENS[active];
  useAppState(); // theme lives on <html>; subscribing keeps the shell in sync

  return (
    <div className="kova">
      <div className="vo-shell">
        <Nav active={active} onNavigate={setActive} />
        <main className="vo-main">
          {Screen ? <Screen /> : <Placeholder id={active} onBack={() => setActive("dashboard")} />}
        </main>
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
