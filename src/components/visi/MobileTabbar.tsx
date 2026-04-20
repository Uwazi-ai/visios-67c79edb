import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Plus, CheckSquare, MessageSquare } from "lucide-react";

const TABS = [
  { to: "/", icon: LayoutDashboard, label: "Home", end: true },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
];

export const MobileTabbar = () => {
  const loc = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom flex items-center justify-around px-2"
      style={{
        height: 72,
        background: "rgba(2,2,10,0.90)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        borderTop: "1px solid var(--border-glass)",
      }}
    >
      <TabBtn tab={TABS[0]} active={loc.pathname === "/"} />
      <TabBtn tab={TABS[1]} active={loc.pathname.startsWith("/inbox")} />

      <button
        aria-label="Quick capture"
        className="-mt-3 flex items-center justify-center"
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "hsl(var(--primary))",
          boxShadow: "0 0 24px var(--glow-blue-strong), 0 4px 16px rgba(0,0,0,0.5)",
          border: "1px solid rgba(96,165,250,0.4)",
          color: "#fff",
        }}
      >
        <Plus size={22} strokeWidth={1.75} />
      </button>

      <TabBtn tab={TABS[2]} active={loc.pathname.startsWith("/tasks")} />
      <TabBtn tab={TABS[3]} active={loc.pathname.startsWith("/chat")} />
    </nav>
  );
};

const TabBtn = ({ tab, active }: { tab: typeof TABS[number]; active: boolean }) => {
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className="flex flex-col items-center justify-center gap-1"
      style={{ width: 56, color: active ? "var(--text-primary)" : "var(--text-muted)" }}
    >
      <Icon size={20} strokeWidth={1.5} />
      <span className="t-mono" style={{ fontSize: 9 }}>{tab.label}</span>
    </NavLink>
  );
};
