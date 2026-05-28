import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Sparkles, Inbox, Users, Grid3x3, Calendar, BookOpen,
  CheckSquare, CreditCard, Settings as SettingsIcon, Video, BarChart3,
  Link2, MessageSquare, Bell, LogOut, Instagram,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { usePendingReviewCount } from "@/hooks/useGmailAgent";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";

interface Tab {
  to: string;
  icon: any;
  label: string;
  matchPrefix?: boolean;
  badge?: number;
}

const MORE_LINKS_ALL: Array<{ to: string; icon: any; label: string; restricted?: boolean }> = [
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/social", icon: Instagram, label: "Social" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/bookings", icon: Link2, label: "Bookings" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/meetings", icon: Video, label: "Meetings" },
  { to: "/knowledge", icon: BookOpen, label: "Knowledge" },
  { to: "/notifications", icon: Bell, label: "Notifications", restricted: true },
  { to: "/finance", icon: BarChart3, label: "Finance", restricted: true },
  { to: "/settings/my-card", icon: CreditCard, label: "My Digital Card" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
];


export const BottomNav = () => {
  const loc = useLocation();
  const nav = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const { count: reviewCount } = usePendingReviewCount();
  const { signOut } = useAuth();
  const { isRestricted } = useOrg();
  const MORE_LINKS = MORE_LINKS_ALL.filter((l) => !isRestricted || !l.restricted);

  const tabs: Tab[] = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/vision", icon: Sparkles, label: "Vision", matchPrefix: true },
    { to: "/inbox", icon: Inbox, label: "Inbox", matchPrefix: true },
    { to: "/contacts", icon: Users, label: "Contacts", matchPrefix: true, badge: reviewCount },
  ];

  const isActive = (t: Tab) =>
    t.to === "/" ? loc.pathname === "/" : t.matchPrefix ? loc.pathname.startsWith(t.to) : loc.pathname === t.to;

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          background: "rgba(2,2,10,0.92)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderTop: "1px solid var(--border-glass)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
              style={{ minHeight: 56, color: active ? "var(--text-accent)" : "var(--text-muted)" }}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                {t.badge && t.badge > 0 ? (
                  <span
                    className="absolute"
                    style={{
                      top: -4, right: -8, minWidth: 16, height: 16,
                      padding: "0 4px", borderRadius: 8,
                      background: "#EF4444", color: "#fff",
                      fontSize: 9, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                ) : null}
              </div>
              <span className="t-mono" style={{ fontSize: 9 }}>{t.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
          style={{ minHeight: 56, color: moreOpen ? "var(--text-accent)" : "var(--text-muted)" }}
        >
          <Grid3x3 size={22} strokeWidth={1.5} />
          <span className="t-mono" style={{ fontSize: 9 }}>More</span>
        </button>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="grid grid-cols-3 gap-3 pb-2">
          {MORE_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <button
                key={l.to}
                onClick={() => { setMoreOpen(false); nav(l.to); }}
                className="glass flex flex-col items-center justify-center gap-2 py-4"
                style={{ minHeight: 88 }}
              >
                <Icon size={20} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: 11, color: "var(--text-primary)", textAlign: "center" }}>{l.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { setMoreOpen(false); signOut(); }}
          className="btn-ghost w-full mt-4"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </BottomSheet>
    </>
  );
};
