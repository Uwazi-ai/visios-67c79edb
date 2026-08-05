import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Inbox, MessagesSquare, CheckSquare, Calendar, Users, BookOpen,
  CalendarClock, IdCard, TrendingUp, Megaphone, Rocket, Sparkles, Bot, Settings,
  ChevronRight, ChevronDown, Sun, Moon,
} from "lucide-react";
import { useAppState } from "@/lib/AppState";
import { Face } from "@/components/primitives";

export interface NavEntry {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const MENU: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "bookings", label: "Bookings", icon: CalendarClock },
  { id: "card", label: "Card", icon: IdCard },
  { id: "raise", label: "Raise", icon: TrendingUp },
];

export const MARKETING: NavEntry[] = [
  { id: "social", label: "Social", icon: Megaphone },
  { id: "campaigns", label: "Campaigns", icon: Rocket },
];

export const SYSTEM: NavEntry[] = [
  { id: "vision", label: "Vision", icon: Sparkles },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "settings", label: "Settings", icon: Settings },
];

export const NAV: NavEntry[] = [...MENU, ...MARKETING, ...SYSTEM];

const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 .]/g, "")
    .split(/[ .]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "??";

const NavItem = ({
  entry,
  active,
  onClick,
}: {
  entry: NavEntry;
  active: boolean;
  onClick: () => void;
}) => {
  const Icon = entry.icon;
  return (
    <button
      type="button"
      className="vo-navitem"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      title={entry.label}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      <span className="vo-navitem-label">{entry.label}</span>
    </button>
  );
};

export const Nav = ({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) => {
  const { orgs, scope, setScope, scopeOrg, theme, toggleTheme, me } = useAppState();
  const [open, setOpen] = useState(false);
  const marketingActive = MARKETING.some((m) => m.id === active);
  const [marketingOpen, setMarketingOpen] = useState(marketingActive);
  const wsRef = useRef<HTMLDivElement>(null);

  /* A group holding the active screen may not stay collapsed — the user
     would lose their own location. Opening is automatic; closing stays
     manual. */
  useEffect(() => {
    if (marketingActive) setMarketingOpen(true);
  }, [marketingActive]);

  /* Outside click and Escape both close. A dropdown that only closes on
     re-click is a trap for anyone who opened it by accident. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = scopeOrg();

  return (
    <nav className="vo-rail" aria-label="Kova">
      <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
        <div className="vo-ws" ref={wsRef}>
          <button
            type="button"
            className="vo-ws-btn"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Face
              initials={initialsOf(current.name)}
              photo={current.logo}
              color={current.color}
              shape="square"
              title={current.name}
            />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="vo-ws-name" style={{ display: "block" }}>{current.name}</span>
              <span className="vo-ws-role" style={{ display: "block" }}>{current.role}</span>
            </span>
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
          </button>

          {open && (
            <div className="vo-ws-menu" role="listbox" aria-label="Workspace">
              {orgs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={scope === o.id}
                  className="vo-ws-opt"
                  onClick={() => {
                    setScope(o.id);
                    setOpen(false);
                  }}
                >
                  <span className="vo-dot" style={{ background: o.color }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="vo-ws-name" style={{ display: "block" }}>{o.name}</span>
                    <span className="vo-ws-role" style={{ display: "block" }}>{o.role}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scoped: the rail wears the venture's colour. On "all" it is
            transparent — no single venture owns an unfiltered view. */}
        <div
          className="vo-strip"
          style={{ background: scope === "all" ? "transparent" : current.color }}
          aria-hidden
        />
      </div>

      <div className="vo-stack" style={{ gap: "var(--s-1)" }}>
        <div className="vo-eyebrow vo-rail-eyebrow">Menu</div>
        <div className="vo-navgroup">
          {MENU.map((e) => (
            <NavItem key={e.id} entry={e} active={active === e.id} onClick={() => onNavigate(e.id)} />
          ))}

          <button
            type="button"
            className="vo-navitem"
            aria-expanded={marketingOpen}
            onClick={() => setMarketingOpen((o) => !o)}
          >
            <Megaphone size={16} strokeWidth={1.75} aria-hidden />
            <span className="vo-navitem-label">Marketing</span>
            <ChevronRight size={13} className="vo-caret" data-open={marketingOpen} aria-hidden />
          </button>
          {marketingOpen && (
            <div className="vo-subgroup">
              {MARKETING.map((e) => (
                <NavItem key={e.id} entry={e} active={active === e.id} onClick={() => onNavigate(e.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="vo-stack" style={{ gap: "var(--s-1)" }}>
        <div className="vo-eyebrow vo-rail-eyebrow">System</div>
        <div className="vo-navgroup">
          {SYSTEM.map((e) => (
            <NavItem key={e.id} entry={e} active={active === e.id} onClick={() => onNavigate(e.id)} />
          ))}
        </div>
      </div>

      <div className="vo-rail-foot">
        <button type="button" className="vo-vision" onClick={() => onNavigate("vision")}>
          <div className="vo-vision-title">Ask Vision</div>
          <div className="vo-vision-sub">
            {scope === "all" ? "Across every venture" : `Scoped to ${current.name}`}
          </div>
        </button>

        <button type="button" className="vo-navitem" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} strokeWidth={1.75} aria-hidden /> : <Moon size={16} strokeWidth={1.75} aria-hidden />}
          <span className="vo-navitem-label">{theme === "dark" ? "Light theme" : "Dark theme"}</span>
        </button>

        <button type="button" className="vo-navitem" onClick={() => onNavigate("settings")}>
          <Face initials={me.initials} photo={me.photo} color={me.color} title={me.name} />
          <span className="vo-navitem-label">{me.name}</span>
        </button>
      </div>
    </nav>
  );
};
