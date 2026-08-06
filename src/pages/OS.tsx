import { useState } from "react";
import "@/design/tokens.css";
import "@/design/shell.css";
import { AppStateProvider, useAppState } from "@/lib/AppState";
import { Nav, NAV } from "@/components/Nav";
import { KovaDataProvider } from "@/data/live/KovaData";
import DataStatus from "@/components/DataStatus";
import { Button, Card, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import Dashboard from "@/screens/Dashboard";
import Settings from "@/screens/Settings";
import Tasks from "@/screens/Tasks";
import Knowledge from "@/screens/Knowledge";
import Vision from "@/screens/Vision";
import Contacts from "@/screens/Contacts";
import Chat from "@/screens/Chat";
import Inbox from "@/screens/Inbox";
import CalendarScreen from "@/screens/Calendar";
import Bookings from "@/screens/Bookings";
import CardScreen from "@/screens/Card";
import Raise from "@/screens/Raise";
import Social from "@/screens/Social";
import Campaigns from "@/screens/Campaigns";
import Agents from "@/screens/Agents";
import Admin from "@/screens/Admin";


/**
 * Screen registry. Port a screen by writing it under src/screens and adding
 * one line here — nothing else changes.
 */
interface ScreenProps {
  navigate: (id: string) => void;
}

const SCREENS: Record<string, (props: ScreenProps) => JSX.Element> = {
  dashboard: Dashboard,
  settings: Settings,
  tasks: Tasks,
  knowledge: Knowledge,
  vision: Vision,
  contacts: Contacts,
  chat: Chat,
  inbox: Inbox,
  calendar: CalendarScreen,
  bookings: Bookings,
  card: CardScreen,
  raise: Raise,
  social: Social,
  campaigns: Campaigns,
  agents: Agents,
  admin: Admin,

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
          <div className="vo-shellbar">
            <DataStatus />
          </div>
          {Screen ? <Screen navigate={setActive} /> : <Placeholder id={active} onBack={() => setActive("dashboard")} />}
        </main>
      </div>
    </div>
  );
};

const OS = () => (
  <AppStateProvider>
    <KovaDataProvider>
      <Shell />
    </KovaDataProvider>
  </AppStateProvider>
);

export default OS;
