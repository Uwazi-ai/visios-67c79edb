import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, CheckSquare, Calendar, Link2, MessageSquare,
  Bell, Users, Video, BarChart3, SlidersHorizontal, LogOut, BookOpen, Sparkles, TrendingUp, Instagram, Bot, ClipboardList, Landmark, Lock,
} from "lucide-react";
import { VisiLogo } from "./Logo";
import { OrgSwitcher } from "./OrgSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ORG_COLORS } from "@/lib/orgs";
import { UsageWidget } from "@/components/billing/UsageWidget";
import { useOrgTier } from "@/hooks/useFeatureAccess";
import { TIER_CONFIG } from "@/config/tiers";

const NAV_ALL = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/vision", label: "Vision", icon: Sparkles },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/grants", label: "Grants", icon: ClipboardList },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/social", label: "Social", icon: Instagram },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/bookings", label: "Bookings", icon: Link2 },
  { to: "/notifications", label: "Notifications", icon: Bell, restricted: true },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/finance", label: "Finance", icon: BarChart3, restricted: true },
];


export const Sidebar = ({ variant = "desktop" }: { variant?: "desktop" | "mobile" } = {}) => {
  const { user, signOut } = useAuth();
  const { orgs, activeOrgId, memberships, isOwner, isRestricted } = useOrg();
  const loc = useLocation();

  const NAV = NAV_ALL.filter((n) => !isRestricted || !n.restricted);
  const { tier } = useOrgTier();
  const features = TIER_CONFIG[tier].features;
  const lockedPaths: Record<string, boolean> = {
    "/chat": !features.team_chat,
    "/agents": !features.agents,
    "/social": !features.social,
    "/meetings": !features.meetings,
  };
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const role = activeOrg ? memberships.find((m) => m.org_id === activeOrg.id)?.role : null;

  const initials = (user?.user_metadata?.full_name as string | undefined)?.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? user?.email?.[0]?.toUpperCase() ?? "U";

  const isMobile = variant === "mobile";

  return (
    <aside
      className={isMobile ? "flex h-screen flex-col z-50 w-full" : "sticky top-0 hidden md:flex h-screen flex-col z-50"}
      style={{
        width: isMobile ? "100%" : 256,
        background: "rgba(2,2,10,0.92)",
        backdropFilter: "var(--blur-sidebar)",
        WebkitBackdropFilter: "var(--blur-sidebar)",
        borderRight: "1px solid var(--border-glass)",
        paddingTop: isMobile ? "var(--safe-top)" : 0,
      }}
    >
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <VisiLogo size={32} />
      </div>

      <div style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <OrgSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.end ? loc.pathname === "/" : loc.pathname.startsWith(item.to);
          const locked = lockedPaths[item.to];
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={`nav-item group ${isActive ? "active" : ""}`}>
              <Icon size={16} strokeWidth={1.5} />
              <span className="flex-1">{item.label}</span>
              {locked && <Lock size={11} strokeWidth={2} style={{ color: "var(--text-muted)", opacity: 0.6 }} />}
            </NavLink>
          );
        })}

        {!isRestricted && (
          <>
            <div className="mx-3 my-3" style={{ height: 1, background: "var(--border-glass)" }} />
            <div className="px-5 pb-1.5 t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              Fundraising
            </div>
            <NavLink to="/capital-raise" className={`nav-item ${loc.pathname.startsWith("/capital-raise") ? "active" : ""}`}>
              <TrendingUp size={16} strokeWidth={1.5} />
              <span>Capital Raise</span>
            </NavLink>
          </>
        )}

        {user?.email === "myke@uwazi.ai" && (
          <>
            <div className="mx-3 my-3" style={{ height: 1, background: "var(--border-glass)" }} />
            <div className="px-5 pb-1.5 t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              Admin
            </div>
            <NavLink to="/civic-intel" className={`nav-item ${loc.pathname.startsWith("/civic-intel") ? "active" : ""}`}>
              <Landmark size={16} strokeWidth={1.5} />
              <span>Civic Intel</span>
            </NavLink>
          </>
        )}

        <div className="mx-3 my-3" style={{ height: 1, background: "var(--border-glass)" }} />
        <NavLink to="/settings" className={`nav-item ${loc.pathname.startsWith("/settings") ? "active" : ""}`}>
          <SlidersHorizontal size={16} strokeWidth={1.5} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <UsageWidget />

      <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border-glass)" }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-[10px]" style={{ background: "var(--bg-glass-1)" }}>
          <div
            className="flex items-center justify-center font-display"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: activeOrg ? `${ORG_COLORS[activeOrg.slug] ?? activeOrg.color}33` : "var(--bg-glass-2)",
              color: activeOrg ? ORG_COLORS[activeOrg.slug] ?? activeOrg.color : "var(--text-primary)",
              fontWeight: 700, fontSize: 12, letterSpacing: "0.04em",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {(user?.user_metadata?.full_name as string | undefined) ?? user?.email}
            </div>
            <div className="t-mono truncate" style={{ fontSize: 9, marginTop: 2 }}>
              {activeOrg?.name ?? "—"} <span className="slash" style={{ margin: "0 4px" }}>/</span> {role ?? (isOwner ? "Owner" : "Guest")}
            </div>
          </div>
          <button onClick={() => signOut()} className="btn-icon" style={{ width: 28, height: 28 }} title="Sign out">
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
};
