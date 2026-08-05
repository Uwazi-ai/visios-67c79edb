import { useAppState } from "@/lib/AppState";
import { Eyebrow, Face } from "@/components/primitives";

export interface NavEntry {
  id: string;
  label: string;
  group: "Core" | "Marketing" | "System";
}

export const NAV: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", group: "Core" },
  { id: "tasks", label: "Tasks", group: "Core" },
  { id: "knowledge", label: "Knowledge", group: "Core" },
  { id: "vision", label: "Vision", group: "Core" },
  { id: "contacts", label: "Contacts", group: "Core" },
  { id: "chat", label: "Chat", group: "Core" },
  { id: "inbox", label: "Inbox", group: "Core" },
  { id: "calendar", label: "Calendar", group: "Core" },
  { id: "bookings", label: "Bookings + Card", group: "Core" },
  { id: "raise", label: "Raise", group: "Core" },
  { id: "social", label: "Social", group: "Marketing" },
  { id: "campaigns", label: "Campaigns", group: "Marketing" },
  { id: "agents", label: "Agents", group: "System" },
  { id: "settings", label: "Settings", group: "System" },
];

const GROUPS: NavEntry["group"][] = ["Core", "Marketing", "System"];

export const Nav = ({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) => {
  const { workspaces, scope, setScope, theme, toggleTheme, identity } = useAppState();

  return (
    <nav className="vo-rail" aria-label="Visi OS">
      <div className="vo-row">
        <Face initials={identity.initials} title={identity.name} />
        <div style={{ minWidth: 0 }}>
          <div className="vo-title" style={{ fontSize: "var(--t-body)" }}>
            {identity.name}
          </div>
          <div className="vo-meta">{identity.role}</div>
        </div>
      </div>

      <label className="vo-stack" style={{ gap: "var(--s-1)" }}>
        <Eyebrow>Workspace</Eyebrow>
        <select
          className="vo-btn"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          style={{ width: "100%" }}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      {GROUPS.map((group) => {
        const items = NAV.filter((n) => n.group === group);
        if (!items.length) return null;
        return (
          <div className="vo-stack" key={group} style={{ gap: "var(--s-1)" }}>
            <Eyebrow>{group}</Eyebrow>
            <div className="vo-navgroup">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="vo-navitem"
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: "auto" }}>
        <button type="button" className="vo-navitem" onClick={toggleTheme}>
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
      </div>
    </nav>
  );
};
